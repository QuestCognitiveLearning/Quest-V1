import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/components/lib/supabase-client.jsx';
import { useAuth } from '@/lib/AuthContext';

export default function SignIn() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  // Allow landing-page CTAs ("Start Free Trial", "Get Started", etc.) to deep-link
  // straight to the signup form via `?mode=signup`. Falls back to sign-in otherwise.
  const initialMode = (() => {
    const params = new URLSearchParams(location.search);
    return params.get('mode') === 'signup' ? 'signup' : 'signin';
  })();
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const [trace, setTrace] = useState([]);
  const log = (msg) => setTrace((t) => [...t, `${new Date().toISOString().slice(11, 19)} ${msg}`]);

  // If already signed in, send them where they were headed. Default landing
  // page is `/LearningHub` (the main authed dashboard), NOT `/` — `/` now
  // always renders the public landing, so falling back to it would put the
  // user in a confusing loop: click "Sign Up" while signed in → bounced back
  // to landing → click "Sign Up" again → bounced back again.
  useEffect(() => {
    if (isLoadingAuth) return;
    if (isAuthenticated) {
      const params = new URLSearchParams(location.search);
      const next = params.get('next') || '/LearningHub';
      window.location.replace(next);
    }
  }, [isAuthenticated, isLoadingAuth, location.search]);

  // Used by the post-signin/signup handlers to know where to send the user
  // after success. Same default rule as the auto-redirect above.
  const next = new URLSearchParams(location.search).get('next') || '/LearningHub';

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  };

  // "Continue with ClassLink" — hidden until VITE_CLASSLINK_SSO is enabled and
  // the backend (edge function + secrets) is provisioned. Hitting the edge
  // function with no `code` kicks off the OAuth authorization redirect.
  const classlinkEnabled = import.meta.env.VITE_CLASSLINK_SSO === 'true';
  const classlinkUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/classlinkSso`;
  // Surface SSO failures bounced back from the edge function (?sso_error=...).
  const ssoError = new URLSearchParams(location.search).get('sso_error');

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email) { setError('Enter your email above, then click "Forgot password?" again.'); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/ResetPassword`,
    });
    setBusy(false);
    if (err) setError(err.message);
    else setInfo(`If an account exists for ${email}, a reset link is on its way.`);
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    log(`submit ${mode} for ${email}`);

    try {
      if (mode === 'signin') {
        log('calling signInWithPassword...');
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        log(`signInWithPassword returned: error=${err ? err.message : 'none'}, has_session=${!!data?.session}`);
        if (err) { setError(err.message); setBusy(false); return; }
        log('signed in, waiting for redirect...');
      } else {
        log('calling signUp...');
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        });
        log(`signUp returned: error=${err ? err.message : 'none'}, has_session=${!!data?.session}, has_user=${!!data?.user}`);
        if (err) { setError(err.message); setBusy(false); return; }
        if (data.session) {
          log('signed up + session created, waiting for redirect...');
        } else {
          setInfo('Account created. Check your email to confirm, then sign in.');
          setBusy(false);
        }
      }
    } catch (ex) {
      log(`EXCEPTION: ${ex?.message || String(ex)}`);
      setError(ex?.message || String(ex));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            {mode === 'signin' ? 'Sign in to Quest' : 'Create your Quest account'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === 'signin' ? 'Continue with Google or your email' : 'Pick a method to get started'}
          </p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span className="text-sm font-medium text-slate-700">
            {busy ? 'Redirecting…' : 'Continue with Google'}
          </span>
        </button>

        {classlinkEnabled && (
          <a
            href={classlinkUrl}
            className="mt-3 w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition"
          >
            <span className="text-sm font-medium text-slate-700">Continue with ClassLink</span>
          </a>
        )}

        {ssoError && (
          <p className="mt-4 text-sm text-red-600 text-center">
            ClassLink sign-in didn't complete ({ssoError}). Please try again.
          </p>
        )}

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400">
          <div className="flex-1 h-px bg-slate-200" />
          or email
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          {mode === 'signin' && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={busy}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Forgot password?
            </button>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
        {info && <p className="mt-4 text-sm text-emerald-700 text-center">{info}</p>}
      </div>
    </div>
  );
}
