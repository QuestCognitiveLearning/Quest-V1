/**
 * @file   App.jsx
 * @desc   Top-level application shell. Owns routing, auth gating, and the
 *         Suspense boundary that lazy-loaded routes resolve into.
 * @author Quest Learning core team
 */

import './App.css';
import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import VisualEditAgent from '@/lib/VisualEditAgent';
import NavigationTracker from '@/lib/NavigationTracker';
import { pagesConfig } from './pages.config';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { getUserRole, getUserTier } from '@/lib/tier';

// Pages a tutor/Studio user must never see — they have their own dashboard
// at /TutorDashboard. Hitting any of these bounces to the Studio surface
// BEFORE the page component mounts, so there's no flash of teacher chrome.
//
// Note: TeacherAnalytics, TeacherProgress, and TeacherLeaderboard are NOT
// blocked — they're surfaced to tutors under the "Insights" label since
// the analytics are useful for tracking per-student progress regardless of
// whether the user runs a classroom or a 1-on-1 practice.
const TEACHER_ONLY_PAGES = new Set([
  'TeacherDashboard',
  'TeacherCurricula',
  'CreateCurriculum',
  'ManageCurriculum',
  'Curriculum',
  'Classes',
]);

function isStudioUser(user) {
  if (!user) return false;
  if (getUserRole(user) === 'tutor') return true;
  const tier = getUserTier(user);
  return tier === 'studio' || tier === 'enterprise';
}

// /Book/:slug needs a dynamic path param, which the auto-route generation in
// pages.config can't express. It's also public — no auth required to view a
// tutor's booking page — so it lives outside the Pages map.
const Book = lazy(() => import('./pages/Book'));

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : null;

// Pages reachable without a signed-in user. Anything not in this list goes
// through RequireAuth and gets redirected to /SignIn when unauthenticated.
const PUBLIC_PAGES = [
  'Landing',
  'Pricing',
  'PricingInfo',
  'RoleSelection',
  'JoinClass',
  'SignIn',
  'ResetPassword',
  'try',
  'Studio',
  'Classroom',
  'Enterprise',
  'TutorSignup',
  'Join',
  'LiveSessionPlay',
];

/**
 * Centered spinner shown during auth-loading and lazy-route resolution.
 * @returns {JSX.Element}
 */
function FullPageSpinner() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * Wrap children with the global <Layout> unless the current page is in the
 * PUBLIC_PAGES list (those have their own marketing chrome).
 */
function LayoutWrapper({ children, currentPageName }) {
  const skipLayout = PUBLIC_PAGES.includes(currentPageName);
  return skipLayout || !Layout
    ? <>{children}</>
    : <Layout currentPageName={currentPageName}>{children}</Layout>;
}

/**
 * Auth gate. Public pages render as-is; private pages either render their
 * children or redirect to /SignIn?next=... when the user isn't signed in.
 */
function RequireAuth({ pageName, children }) {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const location = useLocation();
  if (isLoadingAuth) return <FullPageSpinner />;
  if (!isAuthenticated && !PUBLIC_PAGES.includes(pageName)) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/SignIn?next=${next}`} replace />;
  }
  // Hard tutor gate: tutors and Studio/Enterprise tier users have no business
  // on the teacher-only pages. Bounce to /TutorDashboard before the page
  // component is even mounted — eliminates the flash of teacher chrome.
  if (TEACHER_ONLY_PAGES.has(pageName) && isStudioUser(user)) {
    return (
      <Navigate
        to={`/TutorDashboard${location.search || ''}`}
        replace
      />
    );
  }
  return children;
}

/**
 * `/` route. Always renders the Landing page, regardless of auth state.
 * Signed-in users reaching `/` see the marketing site — they navigate to
 * their dashboard via the in-app nav or by following a deep link. This makes
 * questlearning.co the canonical "front door" of the product. Signing out
 * also lands the user here (custom-sdk's logout sends to `/`).
 */
function RootRoute() {
  const { isLoadingAuth } = useAuth();
  if (isLoadingAuth) return <FullPageSpinner />;
  const LandingPage = Pages.Landing;
  return (
    <LayoutWrapper currentPageName="Landing">
      <LandingPage />
    </LayoutWrapper>
  );
}

/**
 * The full router. Wraps everything in <Suspense> so lazy-loaded chunks
 * resolve into the spinner instead of crashing.
 */
function AuthenticatedApp() {
  const { isLoadingAuth, authError } = useAuth();

  if (isLoadingAuth) return <FullPageSpinner />;
  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        {/* React Router v6 path matching is case-insensitive by default, so
            /try matches the page registry's /try (already lowercase), /Pricing
            matches /Pricing, /studio matches /Studio, etc. — no explicit
            lowercase-alias redirects needed. The previous Navigate redirects
            actually CAUSED infinite loops because the lowercase redirect URL
            re-matched the case-insensitive uppercase Pages route, which then
            re-matched the lowercase redirect, etc. */}
        <Route path="/quiz-from-video" element={<Navigate to="/try" replace />} />
        <Route path="/quiz-from-video/*" element={<Navigate to="/try" replace />} />
        <Route path="/Book/:slug" element={<Book />} />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <RequireAuth pageName={path}>
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              </RequireAuth>
            }
          />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
}

/**
 * Application root. Order matters:
 *   AuthProvider → QueryClientProvider → Router → routes
 * Auth state is consumed by the router, so AuthProvider must be the outer.
 */
export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <a href="#main-content" className="skip-to-content">
            Skip to main content
          </a>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  );
}
