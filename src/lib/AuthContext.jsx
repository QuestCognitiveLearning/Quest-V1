/**
 * @file   AuthContext.jsx
 * @desc   Application-wide authentication state. Owns: current user, loading
 *         flag, auth errors, sign-out flow, and the listener that reacts to
 *         Supabase auth events. Resilient by design — transient errors do not
 *         clear an authenticated session.
 *
 *         TODO [SECURITY]: Sessions are read from localStorage to bypass a
 *         supabase-js auth-lock deadlock observed during token refresh. The
 *         security standard requires HttpOnly cookies for session tokens.
 *         Re-validate the deadlock on the latest supabase-js, then migrate.
 *
 * @author Quest Learning core team
 */

import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { quest } from '@/api/questClient';
import { supabase } from '@/components/lib/supabase-client.jsx';
import { AUTH_REFRESH_RETRY_MS, OAUTH_REDIRECT_TIMEOUT_MS } from '@/constants';

const AuthContext = createContext();

// We only force the user out on these explicit auth-state events. Anything
// else (TOKEN_REFRESHED, USER_UPDATED, transient network failures) leaves
// the current authenticated state alone so a flaky connection or background
// token refresh can't randomly kick the user back to /SignIn.
const SIGN_OUT_EVENTS = new Set(['SIGNED_OUT']);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState(null);

  // Tracks whether we've ever successfully resolved a user. Once true, a
  // failing me() call won't tear the session down — we just keep showing the
  // last good user and let the auto-refresh in supabase-js sort itself out.
  const hasUserRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      if (!mounted) return;
      try {
        const me = await quest.auth.me();
        if (!mounted) return;
        setUser(me);
        setIsAuthenticated(true);
        setAuthError(null);
        hasUserRef.current = true;

        const path = window.location.pathname;
        if (!me.account_type && path !== '/RoleSelection' && path !== '/SignIn') {
          window.location.replace('/RoleSelection');
          return;
        }
      } catch (err) {
        if (!mounted) return;
        if (err?.code === 'USER_NOT_FOUND') {
          setTimeout(() => refresh(), AUTH_REFRESH_RETRY_MS);
          return;
        }
        if (err?.code === 'NOT_AUTHENTICATED') {
          // No session at all — clear state.
          setUser(null);
          setIsAuthenticated(false);
          hasUserRef.current = false;
          return;
        }
        // Any other error (PostgREST 401, network blip, etc.) is treated as
        // transient. If we already had a user, keep them logged in. If we
        // never resolved one, leave the spinner up so RequireAuth doesn't
        // bounce them to /SignIn either.
        console.warn('me() failed transiently:', err.message);
        if (!hasUserRef.current) {
          setAuthError({ type: 'auth_failed', message: err.message });
        }
      } finally {
        if (mounted) setIsLoadingAuth(false);
      }
    };

    // OAuth callback handling — stay loading until supabase-js exchanges the code.
    const url = new URL(window.location.href);
    const pendingOAuth = url.searchParams.has('code') || url.hash.includes('access_token');

    const projectRef = (import.meta.env.VITE_SUPABASE_URL || '')
      .replace('https://', '').split('.')[0];
    let hasStoredSession = false;
    try {
      hasStoredSession = !!localStorage.getItem(`sb-${projectRef}-auth-token`);
    } catch { /* ignore */ }

    if (pendingOAuth) {
      // wait for onAuthStateChange to fire SIGNED_IN
      setTimeout(() => { if (mounted && !hasUserRef.current) refresh(); }, OAUTH_REDIRECT_TIMEOUT_MS);
    } else if (hasStoredSession) {
      refresh();
    } else {
      // No session, no callback — fast-path to "not authenticated".
      setIsLoadingAuth(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (SIGN_OUT_EVENTS.has(event)) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        hasUserRef.current = false;
        setIsLoadingAuth(false);
        return;
      }
      // SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED / USER_UPDATED: re-resolve
      // the user. Failures here won't sign anyone out (handled inside refresh).
      if (session) refresh();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    hasUserRef.current = false;
    setUser(null);
    setIsAuthenticated(false);
    await supabase.auth.signOut();
    if (shouldRedirect) window.location.href = '/';
  };

  const navigateToLogin = () => {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/SignIn?next=${encodeURIComponent(next)}`;
  };

  const checkAppState = async () => { /* legacy no-op */ };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
