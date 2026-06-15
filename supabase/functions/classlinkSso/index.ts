// deno-lint-ignore-file no-explicit-any
//
// classlinkSso — ClassLink OAuth2 / OIDC single sign-on for Quest.
//
// One endpoint serves both legs of the authorization-code flow:
//
//   1. Initiate (no `code` in the query):
//        Redirects the browser to ClassLink's authorize endpoint. Used by the
//        "Continue with ClassLink" button (SP-initiated). ClassLink-initiated
//        launches skip this step and hit us directly with a `code`.
//
//   2. Callback (`?code=...`):
//        Exchanges the code for an access token SERVER-SIDE using the client
//        secret (a confidential client — that's why PKCE isn't required here),
//        reads the user's profile from ClassLink, provisions a Supabase auth
//        user + public.users row (account_type derived from the ClassLink
//        role), then mints a one-time login token and forwards the browser to
//        our /AuthCallback page, which completes the session client-side.
//
// This function takes top-level browser redirects with no apikey/JWT header,
// so it MUST be deployed with --no-verify-jwt (see supabase/config.toml).
//
// Required secrets (Supabase dashboard → Edge Functions → secrets):
//   CLASSLINK_CLIENT_ID, CLASSLINK_CLIENT_SECRET, CLASSLINK_REDIRECT_URI
// Optional overrides:
//   CLASSLINK_SCOPES (default "profile"), CLASSLINK_SITE_URL,
//   CLASSLINK_AUTH_URL, CLASSLINK_TOKEN_URL, CLASSLINK_INFO_URL

import { adminClient } from '../_shared/client.ts';

const CLASSLINK_AUTH_URL =
  Deno.env.get('CLASSLINK_AUTH_URL') ?? 'https://launchpad.classlink.com/oauth2/v2/auth';
const CLASSLINK_TOKEN_URL =
  Deno.env.get('CLASSLINK_TOKEN_URL') ?? 'https://launchpad.classlink.com/oauth2/v2/token';
const CLASSLINK_INFO_URL =
  Deno.env.get('CLASSLINK_INFO_URL') ?? 'https://nodeapi.classlink.com/v2/my/info';

const CLIENT_ID = Deno.env.get('CLASSLINK_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('CLASSLINK_CLIENT_SECRET') ?? '';
const REDIRECT_URI = Deno.env.get('CLASSLINK_REDIRECT_URI') ?? '';
const SCOPES = Deno.env.get('CLASSLINK_SCOPES') ?? 'profile';
const SITE_URL = (Deno.env.get('CLASSLINK_SITE_URL') ?? 'https://questlearning.co').replace(/\/$/, '');

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

// Any failure routes the user back to the sign-in page with a reason code, so
// we never leave them on a blank edge-function response.
function fail(reason: string): Response {
  return redirect(`${SITE_URL}/SignIn?sso_error=${encodeURIComponent(reason)}`);
}

// Map a ClassLink role string onto Quest's two account types. Anything we
// can't classify returns null, which sends the user through RoleSelection.
function mapRole(raw: unknown): 'teacher' | 'student' | null {
  const r = String(raw ?? '').toLowerCase();
  if (!r) return null;
  if (r.includes('student')) return 'student';
  if (
    r.includes('teacher') ||
    r.includes('staff') ||
    r.includes('admin') ||
    r.includes('faculty') ||
    r.includes('tenant')
  ) {
    return 'teacher';
  }
  return null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ClassLink reported an error (denied consent, expired request, etc.).
  const provErr = url.searchParams.get('error');
  if (provErr) return fail(provErr);

  const code = url.searchParams.get('code');

  // ---- Leg 1: no code yet → start the authorization request. -------------
  if (!code) {
    if (!CLIENT_ID || !REDIRECT_URI) return fail('sso_not_configured');
    const auth = new URL(CLASSLINK_AUTH_URL);
    auth.searchParams.set('client_id', CLIENT_ID);
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('redirect_uri', REDIRECT_URI);
    auth.searchParams.set('scope', SCOPES);
    return redirect(auth.toString());
  }

  // ---- Leg 2: exchange the code and sign the user in. --------------------
  try {
    const tokenRes = await fetch(CLASSLINK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      console.error('ClassLink token exchange failed:', await tokenRes.text());
      return fail('token_exchange_failed');
    }
    const token = await tokenRes.json();
    const accessToken = token?.access_token;
    if (!accessToken) return fail('no_access_token');

    const infoRes = await fetch(CLASSLINK_INFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) {
      console.error('ClassLink userinfo failed:', await infoRes.text());
      return fail('userinfo_failed');
    }
    const info = await infoRes.json();

    const email = String(info.Email || info.email || '').toLowerCase().trim();
    if (!email) return fail('no_email');
    const loginId = String(
      info.LoginId || info.loginId || info.UserName || info.username || '',
    ).trim();
    const fullName = [info.FirstName || info.firstName, info.LastName || info.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const accountType = mapRole(info.Role ?? info.Profile ?? info.role);

    const admin = adminClient();
    const SELECT = 'id, email, account_type, classlink_login_id';

    // Resolve a returning Quest user — prefer the stable ClassLink LoginId,
    // then fall back to email. (Both fields authenticate the user.)
    let existing: any = null;
    if (loginId) {
      const { data } = await admin.from('users').select(SELECT)
        .eq('classlink_login_id', loginId).maybeSingle();
      existing = data ?? null;
    }
    if (!existing) {
      const { data } = await admin.from('users').select(SELECT)
        .eq('email', email).maybeSingle();
      existing = data ?? null;
    }

    // No match → provision. createUser fires handle_new_auth_user, which seeds
    // the matching public.users row; re-read it so we can backfill below.
    if (!existing) {
      const { error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, sso_provider: 'classlink', classlink_login_id: loginId || undefined },
      });
      if (createErr && !/already/i.test(createErr.message ?? '')) {
        console.error('createUser failed:', createErr);
        return fail('user_create_failed');
      }
      const { data } = await admin.from('users').select(SELECT)
        .eq('email', email).maybeSingle();
      existing = data ?? null;
    }

    // Sign into the resolved account's canonical email (matters when we matched
    // by LoginId and the ClassLink email has since changed).
    const signInEmail = existing?.email || email;

    // Backfill the stable LoginId, and seed account_type/full_name only when
    // not already set, so we never override a choice the user made in Quest.
    if (existing?.id) {
      const patch: Record<string, unknown> = {};
      if (loginId && !existing.classlink_login_id) patch.classlink_login_id = loginId;
      if (accountType && !existing.account_type) {
        patch.account_type = accountType;
        if (fullName) patch.full_name = fullName;
      }
      if (Object.keys(patch).length > 0) {
        await admin.from('users').update(patch).eq('id', existing.id);
      }
    }

    // Mint a one-time login token. We forward it to our own callback page
    // (rather than the raw action_link) so verifyOtp completes the session
    // reliably regardless of the client's PKCE/implicit flow setting.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: signInEmail,
      options: { redirectTo: `${SITE_URL}/RoleSelection` },
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('generateLink failed:', linkErr);
      return fail('link_failed');
    }

    const cb = new URL(`${SITE_URL}/AuthCallback`);
    cb.searchParams.set('token_hash', linkData.properties.hashed_token);
    cb.searchParams.set('type', 'magiclink');
    cb.searchParams.set('next', '/RoleSelection');
    return redirect(cb.toString());
  } catch (e) {
    console.error('classlinkSso error:', e);
    return fail('unexpected');
  }
});
