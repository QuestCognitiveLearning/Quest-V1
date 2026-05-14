import { useEffect, useState } from 'react';
import { supabase } from '@/components/lib/supabase-client.jsx';

// Reached by users clicking the reset link in the password-reset email.
// Supabase puts a `?code=...` (PKCE) on the URL; the supabase-js client
// auto-exchanges it for a recovery session via `detectSessionInUrl: true`.
// Once the session is in place, the user can call `updateUser({ password })`.
export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Wait for the recovery session to land in supabase-js storage. The lib
    // fires onAuthStateChange with event PASSWORD_RECOVERY when ready.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    // Also check if a session already exists (page reload after click).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setBusy(false); return; }
    setDone(true);
    setBusy(false);
    setTimeout(() => { window.location.replace('/'); }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-semibold text-slate-900 text-center">Set a new password</h1>
        <p className="mt-2 text-sm text-slate-500 text-center">Pick something at least 6 characters long.</p>

        {!ready && !done && (
          <p className="mt-6 text-sm text-slate-500 text-center">
            Waiting for the reset link to verify…
          </p>
        )}

        {ready && !done && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              type="password"
              required
              minLength={6}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}

        {done && (
          <p className="mt-6 text-sm text-emerald-700 text-center">
            Password updated. Redirecting…
          </p>
        )}

        {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
      </div>
    </div>
  );
}
