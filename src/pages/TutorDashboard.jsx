/**
 * TutorDashboard — Studio-tier home for tutor users.
 *
 * Surfaces the work a tutor actually does day-to-day, instead of the
 * class/curriculum dashboard a classroom teacher needs:
 *   - Today + next 7d of scheduled sessions (classes with scheduled_for set)
 *   - Recent parent reports sent
 *   - Quick actions: New session, Generate content, Open booking link
 *   - Live counts: students, sessions this week, reports this week
 *
 * Post-payment celebration: when the URL has ?welcome=1 we render a dismissible
 * Studio-welcome banner walking through the unlocked features. The redirect
 * lands here from Stripe's success_url and from the TutorSignup wizard's
 * walkthrough step.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import TeacherLayout from "../components/teacher/TeacherLayout";
import {
  Calendar,
  Users,
  FileText,
  Sparkles,
  Plus,
  Clock,
  ChevronRight,
  Palette,
  Share2,
  X,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { stringsFor } from "@/lib/i18n/role-strings";
import { getUserRole, getUserTier } from "@/lib/tier";

export default function TutorDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  // Two-phase loading: `userReady` flips as soon as quest.auth.me() resolves
  // and the access gate passes, so the page can render its skeleton even if
  // the data fetches take a moment. Individual sections show their own
  // skeletons until their data lands.
  const [userReady, setUserReady] = useState(false);
  const [classesLoading, setClassesLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [branding, setBranding] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") === "1" || url.searchParams.get("checkout") === "success") {
      setShowWelcome(true);
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await quest.auth.me();
        if (cancelled) return;
        setUser(me);
        // Access gate: Studio/Enterprise tier OR explicit tutor role can view
        // this page. Buying Studio doesn't automatically promote the role
        // (the existing schema treats role and tier as orthogonal), so we
        // ALSO opportunistically tag new_role='tutor' the first time a
        // Studio user with no role set lands here — that way the inverse
        // redirect from TeacherDashboard kicks in on every subsequent visit.
        const tierNow = getUserTier(me);
        const roleNow = getUserRole(me);
        const isStudioTier = tierNow === "studio" || tierNow === "enterprise";
        const isTutorRole = roleNow === "tutor";
        // Webhook lag: Stripe checkout completion fires the webhook
        // asynchronously, so a user just back from /Pricing can land here
        // before users.tier is updated. The URL signals 'I just paid' via
        // ?checkout=success or ?welcome=1, so when either is present we
        // skip the gate — the worst case is a free user who manually
        // crafts the URL and gets a dashboard they can't really act on.
        const fromCheckout =
          url.searchParams.get("checkout") === "success" ||
          url.searchParams.get("welcome") === "1";
        if (!isStudioTier && !isTutorRole && !fromCheckout) {
          navigate(createPageUrl("TeacherDashboard"), { replace: true });
          return;
        }
        // Fire role promotion in the background — don't block render on it.
        if ((isStudioTier || fromCheckout) && !isTutorRole) {
          quest.entities.User.update(me.id, { new_role: "tutor" }).catch((err) =>
            console.warn("Could not tag user as tutor:", err),
          );
        }
        setUserReady(true);

        // Branding is cheap (single row, indexed); fetch it eagerly because the
        // welcome banner reads it.
        supabase
          .from("branding")
          .select("booking_slug, business_name, tutor_name")
          .eq("user_id", me.id)
          .maybeSingle()
          .then(({ data }) => {
            if (!cancelled) setBranding(data || null);
          })
          .catch(() => {});

        // Classes + (scoped) enrollments together. We MUST get classes first
        // and then ask the server for enrollments restricted to those class
        // ids — the previous code did StudentEnrollment.list() which scanned
        // every enrollment in the database and dragged the dashboard out for
        // multiple seconds on prod.
        (async () => {
          try {
            const classData = await quest.entities.Class.filter({ teacher_id: me.id });
            if (cancelled) return;
            setClasses(classData || []);
            const classIds = (classData || []).map((c) => c.id);
            if (classIds.length > 0) {
              const enrolled = await quest.entities.StudentEnrollment.filter({
                class_id: classIds,
              });
              if (!cancelled) setEnrollments(enrolled || []);
            } else {
              setEnrollments([]);
            }
          } catch (err) {
            console.warn("Classes load failed:", err);
          } finally {
            if (!cancelled) setClassesLoading(false);
          }
        })();

        // Reports separately — never blocks the rest of the page.
        supabase
          .from("parent_reports")
          .select("id, student_id, sent_at, trigger_type, created_at")
          .eq("tutor_id", me.id)
          .order("created_at", { ascending: false })
          .limit(5)
          .then(({ data }) => {
            if (cancelled) return;
            setRecentReports(data || []);
          })
          .catch(() => {})
          .finally(() => {
            if (!cancelled) setReportsLoading(false);
          });
      } catch (err) {
        console.error("TutorDashboard load failed:", err);
        if (!cancelled) {
          setUserReady(true);
          setClassesLoading(false);
          setReportsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const strings = stringsFor(user);
  const tier = getUserTier(user);

  const { today, upcoming } = useMemo(() => {
    const now = Date.now();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);
    const endWeek = new Date(startToday);
    endWeek.setDate(endWeek.getDate() + 7);

    const withTime = (classes || [])
      .filter((c) => c.scheduled_for && !c.session_ended_at)
      .map((c) => ({ ...c, _at: new Date(c.scheduled_for).getTime() }));

    const t = withTime
      .filter((c) => c._at >= startToday.getTime() && c._at < endToday.getTime())
      .sort((a, b) => a._at - b._at);
    const u = withTime
      .filter((c) => c._at >= endToday.getTime() && c._at < endWeek.getTime())
      .sort((a, b) => a._at - b._at);
    return { today: t, upcoming: u };
  }, [classes]);

  const studentCount = useMemo(() => {
    const ids = new Set((enrollments || []).map((e) => e.student_id));
    return ids.size;
  }, [enrollments]);

  const sessionsThisWeek = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const ms = since.getTime();
    return (classes || []).filter((c) => c.session_ended_at && new Date(c.session_ended_at).getTime() >= ms).length;
  }, [classes]);

  const reportsThisWeek = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const ms = since.getTime();
    return (recentReports || []).filter((r) => r.sent_at && new Date(r.sent_at).getTime() >= ms).length;
  }, [recentReports]);

  if (!userReady) {
    return (
      <TeacherLayout user={user} onSignOut={() => quest.auth.logout()} activeNav="dashboard">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout user={user} onSignOut={() => quest.auth.logout()} activeNav="dashboard">
      <div className="min-h-screen bg-slate-50" style={{ fontFamily: '"Inter", sans-serif' }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

        <div className="max-w-6xl mx-auto px-6 py-8">
          {showWelcome && (
            <WelcomeBanner
              tutorName={branding?.tutor_name || user?.full_name}
              onDismiss={() => {
                setShowWelcome(false);
                const url = new URL(window.location.href);
                url.searchParams.delete("welcome");
                url.searchParams.delete("checkout");
                window.history.replaceState({}, "", url.toString());
              }}
              bookingSlug={branding?.booking_slug}
            />
          )}

          <header className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {tier === "studio" || tier === "enterprise" ? "Studio" : "Welcome"}
              </p>
              <h1 className="text-3xl font-bold text-slate-900 mt-0.5">
                Welcome back, {(user?.full_name || "tutor").split(" ")[0]}
              </h1>
            </div>
            <Button
              onClick={() => navigate(createPageUrl("TeacherClasses"))}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {strings.create_class_cta}
            </Button>
          </header>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <Stat icon={Users} label="Active students" value={classesLoading ? "—" : studentCount} />
            <Stat icon={Clock} label="Sessions this week" value={classesLoading ? "—" : sessionsThisWeek} />
            <Stat icon={FileText} label="Reports sent (7d)" value={reportsLoading ? "—" : reportsThisWeek} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Today</h2>
                <span className="text-xs text-slate-500">
                  {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </span>
              </header>
              {classesLoading ? (
                <SessionSkeleton />
              ) : (
                <SessionList rows={today} emptyText="Nothing on the books today." navigate={navigate} />
              )}

              <header className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Next 7 days</h2>
                <span className="text-xs text-slate-500">
                  {classesLoading ? "—" : `${upcoming.length} scheduled`}
                </span>
              </header>
              {classesLoading ? (
                <SessionSkeleton />
              ) : (
                <SessionList rows={upcoming} emptyText="No upcoming sessions scheduled." navigate={navigate} />
              )}
            </section>

            <aside className="space-y-4">
              <QuickAction
                icon={Sparkles}
                title="Generate content"
                body="Drop a video or PDF — get a quiz, case study, and attention checks."
                onClick={() => navigate(createPageUrl("Generate"))}
              />
              <QuickAction
                icon={Share2}
                title={branding?.booking_slug ? "Share booking link" : "Set up bookings"}
                body={
                  branding?.booking_slug
                    ? `questlearning.co/Book/${branding.booking_slug}`
                    : "Let parents book a session right onto your calendar."
                }
                onClick={() => navigate(createPageUrl("BookingSettings"))}
              />
              <QuickAction
                icon={Palette}
                title="Branding"
                body="Logo, colors, and the parent-report intro paragraph."
                onClick={() => navigate(createPageUrl("BrandingSettings"))}
              />
              {recentReports.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-900">Recent reports</h2>
                    <button
                      onClick={() => navigate(createPageUrl("ParentReports"))}
                      className="text-xs text-blue-700 hover:text-blue-900"
                    >
                      View all
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {recentReports.slice(0, 4).map((r) => (
                      <li key={r.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">
                          {r.trigger_type === "weekly_digest" ? "Weekly digest" : "Session report"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {r.sent_at
                            ? new Date(r.sent_at).toLocaleDateString()
                            : "queued"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function SessionList({ rows, emptyText, navigate }) {
  if (!rows.length) {
    return (
      <div className="px-5 py-8 text-center text-sm text-slate-500">{emptyText}</div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() =>
              navigate(`${createPageUrl("TeacherClassDetail")}?id=${c.id}`)
            }
            className="w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {c.class_name}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(c.scheduled_for).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {" · "}
                {c.scheduled_duration_minutes || 60} min
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function SessionSkeleton() {
  return (
    <div className="px-5 py-3 space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-1/3 bg-slate-100 rounded animate-pulse mb-1.5" />
            <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function QuickAction({ icon: Icon, title, body, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
          <Icon className="w-4 h-4 text-slate-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{body}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 mt-1" />
      </div>
    </button>
  );
}

function WelcomeBanner({ tutorName, onDismiss, bookingSlug }) {
  return (
    <div className="relative bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl shadow-md mb-6 p-6 text-white overflow-hidden">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-3 right-3 text-white/70 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 max-w-2xl">
        <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-blue-100">Welcome to Studio</p>
          <h2 className="text-xl font-bold mt-0.5">
            {tutorName ? `You're in, ${tutorName.split(" ")[0]}.` : "You're in."}
          </h2>
          <p className="text-sm text-blue-50 mt-2 leading-relaxed">
            Your Studio account is live. Here's what's unlocked:
          </p>
          <ul className="mt-3 grid sm:grid-cols-3 gap-2 text-xs">
            <BannerFeature label="Branded PDFs + parent emails" />
            <BannerFeature label="One-tap parent progress reports" />
            <BannerFeature
              label={
                bookingSlug
                  ? `Booking link at /Book/${bookingSlug}`
                  : "Public booking link"
              }
            />
          </ul>
        </div>
      </div>
    </div>
  );
}

function BannerFeature({ label }) {
  return (
    <li className="bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">{label}</li>
  );
}
