/**
 * @file   pages.config.js
 * @desc   Route registry. Every page is lazy-loaded so the initial JS bundle
 *         only ships the runtime + the route the user actually opened. Other
 *         routes load on demand (and on hover, via React Router's preload
 *         heuristics).
 *
 *         TODO [style]: filenames here are PascalCase (e.g., `pages/Pricing`)
 *         per React community convention. The internal style guide calls for
 *         kebab-case (`pages/pricing.jsx`). Rename is a big-bang change
 *         (~150 import statements) — defer to its own PR.
 *
 *         Setup notes:
 *           - `mainPage` controls which component renders at `/` for signed-in
 *             users. The Landing page handles signed-out visitors at `/`.
 *           - Public (unauthenticated) pages are listed in App.jsx's
 *             PUBLIC_PAGES array; this file is just a route → component map.
 *
 *         To add a page:
 *           1. Create src/pages/MyPage.jsx
 *           2. Add `"MyPage": lazy(() => import('./pages/MyPage'))` below
 *           3. The route `/MyPage` is now live
 * @author Quest Learning core team
 */

import { lazy } from 'react';
import __Layout from './Layout.jsx';

// Each entry is React.lazy() — emits a separate chunk at build time.
export const PAGES = {
  "Classes":              lazy(() => import('./pages/Classes')),
  "CreateCurriculum":     lazy(() => import('./pages/CreateCurriculum')),
  "CreateLiveSession":    lazy(() => import('./pages/CreateLiveSession')),
  "Curriculum":           lazy(() => import('./pages/Curriculum')),
  "Demo":                 lazy(() => import('./pages/Demo')),
  "JoinClass":            lazy(() => import('./pages/JoinClass')),
  "KnowledgeMap":         lazy(() => import('./pages/KnowledgeMap')),
  "Landing":              lazy(() => import('./pages/Landing')),
  "LearningHub":          lazy(() => import('./pages/LearningHub')),
  "ManageCurriculum":     lazy(() => import('./pages/ManageCurriculum')),
  "ManageLiveSession":    lazy(() => import('./pages/ManageLiveSession')),
  "NewSession":           lazy(() => import('./pages/NewSession')),
  "PracticeSession":      lazy(() => import('./pages/PracticeSession')),
  "Pricing":              lazy(() => import('./pages/Pricing')),
  "PricingInfo":          lazy(() => import('./pages/PricingInfo')),
  "BrandingSettings":     lazy(() => import('./pages/BrandingSettings')),
  "Progress":             lazy(() => import('./pages/Progress')),
  "ResetPassword":        lazy(() => import('./pages/ResetPassword')),
  "RoleSelection":        lazy(() => import('./pages/RoleSelection')),
  "SignIn":               lazy(() => import('./pages/SignIn')),
  "SocraticInquiry":      lazy(() => import('./pages/SocraticInquiry')),
  "StudentLiveSession":   lazy(() => import('./pages/StudentLiveSession')),
  "TeacherAnalytics":     lazy(() => import('./pages/TeacherAnalytics')),
  "TeacherClassDetail":   lazy(() => import('./pages/TeacherClassDetail')),
  "TeacherClasses":       lazy(() => import('./pages/TeacherClasses')),
  "TeacherCurricula":     lazy(() => import('./pages/TeacherCurricula')),
  "TeacherDashboard":     lazy(() => import('./pages/TeacherDashboard')),
  "TeacherLeaderboard":   lazy(() => import('./pages/TeacherLeaderboard')),
  "TeacherLiveSession":   lazy(() => import('./pages/TeacherLiveSession')),
  "TeacherProgress":      lazy(() => import('./pages/TeacherProgress')),
  "TeacherSettings":      lazy(() => import('./pages/TeacherSettings')),
  "TeacherStudentDetail": lazy(() => import('./pages/TeacherStudentDetail')),
  "Try":                  lazy(() => import('./pages/Try')),
};

export const pagesConfig = {
  mainPage: "LearningHub",
  Pages: PAGES,
  Layout: __Layout,
};
