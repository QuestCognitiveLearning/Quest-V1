// deno-lint-ignore-file no-explicit-any
import { userClient, adminClient } from './client.ts';

// Returns the public.users row for the caller, or null if not authenticated.
// The trigger on auth.users guarantees a public.users row exists for any
// signed-in Google user (matched by email if a pre-existing Quest row exists).
export async function getMe(req: Request): Promise<any | null> {
  const supa = userClient(req);
  const { data: { user: authUser }, error } = await supa.auth.getUser();
  if (error || !authUser) return null;

  const admin = adminClient();
  const { data, error: dbErr } = await admin
    .from('users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();
  if (dbErr) return null;
  if (data) return data;

  // Fallback: trigger may not have fired yet — try email match.
  const { data: byEmail } = await admin
    .from('users')
    .select('*')
    .eq('email', authUser.email)
    .limit(1)
    .maybeSingle();
  return byEmail ?? null;
}
