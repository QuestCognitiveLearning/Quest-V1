/**
 * AuthCallback — completes a single-sign-on login.
 *
 * The classlinkSso edge function provisions the user, mints a one-time login
 * token, and forwards the browser here with `?token_hash=...&type=...&next=`.
 * We exchange that token for a real Supabase session via verifyOtp, then send
 * the user on to their destination (RoleSelection, which forwards teachers /
 * students to their dashboards or prompts first-time role choice).
 *
 * Public route — the user isn't signed in yet when they land here.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/components/lib/supabase-client.jsx';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const ssoError = params.get('sso_error');
      if (ssoError) {
        setError(ssoError);
        return;
      }
      const tokenHash = params.get('token_hash');
      const next = params.get('next') || '/RoleSelection';
      if (!tokenHash) {
        setError('missing_token');
        return;
      }

      // generateLink('magiclink') tokens verify under type 'magiclink'; fall
      // back to 'email' to tolerate supabase-js version differences.
      let res = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
      if (res.error) {
        res = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
      }
      if (res.error) {
        setError(res.error.message || 'verification_failed');
        return;
      }
      window.location.replace(next);
    })();
  }, [params]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Sign-in didn't complete</h1>
          <p className="mt-2 text-sm text-slate-500">
            We couldn't finish signing you in ({error}). Please try again.
          </p>
          <a
            href="/SignIn"
            className="mt-6 inline-block h-11 leading-[44px] px-5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" role="status" aria-label="Signing you in">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Signing you in…</p>
      </div>
    </div>
  );
}
