/**
 * @file   Layout.jsx
 * @desc   Authenticated layout shell. On every route change it re-validates
 *         the user (account_type + subscription_status), redirects them to
 *         the right page if they're somewhere they shouldn't be, and renders
 *         either chrome-less (for pages in `noLayoutPages`) or with the
 *         standard student/teacher chrome.
 *
 *         TODO [refactor]: extract checkAuthAndRedirect into
 *         /src/services/route-guard.js. Right now Layout does data fetching +
 *         routing logic + chrome rendering in one component.
 *
 * @author Quest Learning core team
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Loader2 } from "lucide-react";

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    console.log("🚀 [LAYOUT] Layout mounted/updated. Page:", currentPageName);
    console.log("🚀 [LAYOUT] Full URL:", window.location.href);
    console.log("🚀 [LAYOUT] URL params:", window.location.search);
    checkAuthAndRedirect();
  }, [currentPageName]);

  const checkAuthAndRedirect = async () => {
    // Public marketing pages - no auth required
    const publicPages = ["Landing", "PricingInfo", "RoleSelection", "JoinClass"];
    const noRedirectPages = ["LiveSessionPlay", "SocraticInquiry"];

    // If on public marketing page, skip all auth checks
    if (publicPages.includes(currentPageName)) {
      console.log("✅ [AUTH] Public marketing page, no auth required");
      setChecking(false);
      return;
    }

    // All other pages require authentication
    try {
      // If returning from checkout, sync subscription status first
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('checkout') === 'success') {
        console.log("💳 [AUTH] Checkout success detected, syncing subscription...");
        try {
          await quest.functions.invoke('syncStripeSubscription', {});
          console.log("✅ [AUTH] Subscription sync complete");
        } catch (syncErr) {
          console.warn("⚠️ [AUTH] Subscription sync failed (non-fatal):", syncErr);
        }
        // Remove the query param so it doesn't re-trigger on refresh
        window.history.replaceState({}, '', window.location.pathname);
      }

      const isAuth = await quest.auth.isAuthenticated();
      if (!isAuth) {
        throw new Error('Not authenticated');
      }

      const user = await quest.auth.me();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      console.log("✅ [AUTH] User authenticated successfully");
      console.log("📋 [AUTH] User ID:", user.id);
      console.log("📋 [AUTH] User Email:", user.email);
      console.log("📋 [AUTH] Account Type:", user.account_type || "NOT SET");
      console.log("📋 [AUTH] Subscription Status:", user.subscription_status || "NOT SET");

      // If no account type, send to role selection
      if (!user.account_type) {
        console.log("⚠️ [AUTH] User authenticated but account_type not set");
        console.log("🔄 [AUTH] Redirecting to role selection");
        navigate(createPageUrl("RoleSelection"), { replace: true });
        return;
      }

      // Teacher-specific routing
      if (user.account_type === "teacher") {
        // Tutor-only surfaces. Always allowed for any user with
        // account_type='teacher' regardless of subscription status — the
        // pages themselves enforce tier gates (Studio/Enterprise) via
        // isFeatureEnabled. Without this, a tutor visiting /TutorDashboard
        // would race the App.jsx router-level Studio gate: Layout would
        // bounce to /TeacherDashboard, the router would bounce back to
        // /TutorDashboard, infinite loop, page never renders.
        const tutorPages = [
          "TutorDashboard",
          "TutorSignup",
          "TutorStudents",
          "TutorBookings",
          "ParentReports",
          "BookingSettings",
          "Library",
        ];
        const allTeacherPages = [
          "Pricing", "LiveSessionBuilder", "LiveSessionHost",
          "TeacherDashboard", "TeacherClasses", "TeacherClassDetail",
          "TeacherCurricula", "CreateCurriculum", "ManageCurriculum",
          "TeacherProgress", "TeacherLeaderboard", "TeacherAnalytics",
          "TeacherStudentDetail", "TranscriptTester", "TeacherSettings",
          "Generate", "BrandingSettings",
          ...tutorPages,
        ];

        // Free teachers can still build / host live sessions and access
        // Generate (the new hub) + Settings + Pricing. Tutor pages are
        // allowed for new tutors whose subscription_status is 'free' until
        // they buy Studio.
        const freeTeacherPages = [
          "Generate", "LiveSessionBuilder", "LiveSessionHost",
          "SocraticInquiry", "TeacherSettings", "Pricing",
          ...tutorPages,
        ];

        // Determine allowed pages based on subscription
        const allowedPages = user.subscription_status === 'free' ? freeTeacherPages : allTeacherPages;

        // If trying to access non-teacher page, redirect appropriately
        if (!allowedPages.includes(currentPageName) && !noRedirectPages.includes(currentPageName)) {
          console.log("⚠️ [AUTH] Teacher on invalid page, redirecting");
          console.log("📋 [AUTH] Subscription Status:", user.subscription_status);
          console.log("📋 [AUTH] Allowed pages:", allowedPages);
          // Redirect free teachers to /Generate (now the hub), paid teachers
          // to dashboard; tutors always land on their own dashboard.
          const isTutor = user.new_role === "tutor";
          const redirectPage = isTutor
            ? "TutorDashboard"
            : (user.subscription_status === 'free' ? "Generate" : "TeacherDashboard");
          navigate(createPageUrl(redirectPage), { replace: true });
          return;
        }

        // Log subscription status for teachers
        console.log("✅ [AUTH] Teacher on valid page, subscription:", user.subscription_status);
      }

      // Student-specific routing
      if (user.account_type === "student") {
        const studentPages = ["LiveSessionPlay", "KnowledgeMap", "JoinClass", "Classes", "LearningHub", "Progress", "NewSession", "PracticeSession", "Curriculum", "SocraticInquiry"];

        // If trying to access non-student page, redirect appropriately
        if (!studentPages.includes(currentPageName) && !noRedirectPages.includes(currentPageName)) {
          console.log("⚠️ [AUTH] Student on invalid page, redirecting");
          navigate(createPageUrl("KnowledgeMap"), { replace: true });
          return;
        }
        
        // Log subscription status for students
        console.log("✅ [AUTH] Student on valid page, subscription:", user.subscription_status);
      }

      setChecking(false);
    } catch (err) {
      console.log("❌ [AUTH] Authentication failed - User not authenticated");
      console.error("❌ [AUTH] Error details:", err);
      console.log("📄 [AUTH] Error message:", err.message || "Unknown error");
      console.log("🔐 [AUTH] Current page:", currentPageName);

      // Redirect to Landing page if not authenticated and trying to access protected page
      console.log("🔄 [AUTH] Redirecting to Landing page");
      navigate(createPageUrl("Landing"), { replace: true });
    }
  };

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Don't show layout - pages handle their own layouts
  const noLayoutPages = ["Landing", "Pricing", "PricingInfo", "RoleSelection", "KnowledgeMap", "LiveSessionPlay", "SocraticInquiry", "JoinClass"];
  
  if (noLayoutPages.includes(currentPageName)) {
    return children;
  }

  return children;
}