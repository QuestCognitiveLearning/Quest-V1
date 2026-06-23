/**
 * @file   RoleSelection.jsx
 * @desc   Post-signup screen where a brand-new user picks Student or Teacher.
 *         Implements variation A · Refined ("Are you here to learn or to teach?")
 *         from the Role Select design handoff bundle:
 *           - Soft blue → purple gradient surface
 *           - Quest brand lockup top-left, "Sign in" link top-right
 *           - Gradient pill eyebrow + headline with role-coded color highlights
 *           - Two equal-width cards (Student blue, Teacher purple+AI-POWERED)
 *           - Each card has tagline + features + micro-preview + gradient CTA
 *           - Trust strip below the cards (trial / compliance / social proof)
 *
 *         Loading-state policy: only the clicked role greys out while saving
 *         so the user can still pick the other one if they change their mind.
 *
 * @author Quest Learning core team
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Loader2, ArrowRight, Check, GraduationCap, Users, Sparkles } from "lucide-react";
import NotificationModal from "../components/shared/NotificationModal";
import { useNotification } from "../components/shared/useNotification";

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";
const GRAD_STUDENT = 'linear-gradient(180deg, #4f86f7 0%, #1e4fe0 100%)';
const GRAD_TEACHER = 'linear-gradient(180deg, #a855f7 0%, #7c3aed 100%)';
const GRAD_STUDENT_SOFT = 'linear-gradient(135deg, rgba(83,136,251,.18), rgba(47,102,241,.06) 50%, transparent 70%)';
const GRAD_TEACHER_SOFT = 'linear-gradient(135deg, rgba(168,85,247,.20), rgba(124,58,237,.08) 50%, transparent 70%)';

export default function RoleSelection() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(null); // null | 'student' | 'teacher'
  const [hover, setHover] = useState(null);
  const { notification, showError, closeNotification } = useNotification();

  useEffect(() => { checkExistingUser(); }, []);

  const checkExistingUser = async () => {
    try {
      const isAuth = await quest.auth.isAuthenticated();
      if (!isAuth) { setLoading(false); return; }
      const user = await quest.auth.me();
      if (user.account_type === "teacher") {
        navigate(createPageUrl("TeacherDashboard"));
      } else if (user.account_type === "student") {
        navigate(createPageUrl("KnowledgeMap"));
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const handleSelectRole = async (role) => {
    if (savingRole) return;
    setSavingRole(role);
    try {
      if (role === "student") {
        const user = await quest.auth.me();
        if (user.account_type === "student") {
          navigate(createPageUrl("KnowledgeMap"));
          return;
        }
        await quest.auth.updateMe({ account_type: "student" });
        try {
          await quest.functions.invoke('sendWelcomeEmail', {
            student_email: user.email,
            student_name: user.full_name || 'Student',
          });
        } catch { /* non-essential */ }
        navigate(createPageUrl("JoinClass"));
      } else {
        await quest.auth.updateMe({ account_type: "teacher", new_role: "teacher" });
        navigate(createPageUrl("Pricing") + "?intent=classroom");
      }
    } catch (err) {
      showError("Save Failed", "Failed to save your selection. Please try again.");
      setSavingRole(null);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #eaf1ff 0%, #f5f7fc 50%, #f0eafc 100%)' }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleSignInClick = (e) => {
    e.preventDefault();
    navigate(createPageUrl("SignIn"));
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #eaf1ff 0%, #f5f7fc 50%, #f0eafc 100%)',
        color: '#0b1020',
        fontFamily: "'Geist', -apple-system, system-ui, sans-serif",
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      {/* Header — in-flow so it never collides on small screens */}
      <header className="flex items-center justify-between px-5 sm:px-8 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/quest-logo-on-white.png" alt="Quest Learning" width="32" height="32" className="rounded-lg" />
          <span className="text-[17px] font-bold tracking-tight">Quest Learning</span>
        </div>
        <a href="#" onClick={handleSignInClick} className="text-sm text-gray-500 hover:text-gray-700 transition">
          <span className="hidden sm:inline">Already have an account? </span>
          <span className="font-semibold" style={{ color: '#1e4fe0' }}>Sign in</span>
        </a>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-6 pb-12">
        {/* Heading block */}
        <div className="text-center mb-12 max-w-[760px]">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-6"
            style={{
              background: 'linear-gradient(135deg, #eff5ff, #fff)',
              border: '1px solid #dce8ff',
              color: '#1a3fbf',
              fontFamily: FONT_MONO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.08em',
            }}
          >
            <span
              aria-hidden
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#1e4fe0', boxShadow: '0 0 8px #2f66f1' }}
            />
            WELCOME TO QUEST LEARNING
          </span>

          <h1
            className="font-bold tracking-tight m-0 text-gray-900"
            style={{ fontSize: 'clamp(2.25rem, 4vw + 1rem, 3.5rem)', lineHeight: 1.05, letterSpacing: '-0.035em' }}
          >
            How will you{" "}
            <span
              style={{
                background: 'linear-gradient(110deg, #1e4fe0, #5388fb)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              use Quest
            </span>
            ?
          </h1>
          <p className="mt-3.5 text-[17px] leading-relaxed text-gray-500">
            Pick your role to get a tailored experience. Switch anytime in settings.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid md:grid-cols-2 gap-5 w-full max-w-[780px]">
          <RoleCard
            role="student"
            hover={hover}
            setHover={setHover}
            savingRole={savingRole}
            onClick={() => handleSelectRole("student")}
            accentBg={GRAD_STUDENT_SOFT}
            icon={<GraduationCap className="w-8 h-8" strokeWidth={2} />}
            iconGradient={GRAD_STUDENT}
            iconGlow="rgba(30,79,224,.45)"
            accentColor="#1e4fe0"
            accentBorder="#b9d1ff"
            title="Student"
            tagline="Learn faster. Remember longer."
            description="Lessons that match your level, with quick reviews so what you learn sticks."
            features={[
              "Quests tailored to you",
              "Progress by mastery, not grades",
              "Spaced review built in",
            ]}
            micro={<StudentMicro />}
            cta="Continue as Student"
            ctaGradient={GRAD_STUDENT}
            ctaShadow="rgba(30,79,224,.55)"
            hoverShadow="rgba(30,79,224,.30)"
            hoverRing="rgba(47,102,241,.08)"
          />

          <RoleCard
            role="teacher"
            hover={hover}
            setHover={setHover}
            savingRole={savingRole}
            onClick={() => handleSelectRole("teacher")}
            accentBg={GRAD_TEACHER_SOFT}
            icon={<Users className="w-8 h-8" strokeWidth={2} />}
            iconGradient={GRAD_TEACHER}
            iconGlow="rgba(124,58,237,.45)"
            accentColor="#7c3aed"
            accentBorder="#d6c4f0"
            badge={
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #f3eafe, #fff)',
                  border: '1px solid #e3d3fa',
                  color: '#7c3aed',
                  fontFamily: FONT_MONO,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '.06em',
                }}
              >
                <Sparkles className="w-3 h-3" strokeWidth={2.2} />
                AI-POWERED
              </span>
            }
            title="Teacher"
            tagline="Get your weekends back."
            description="Generate full units in minutes and run lessons that track every student."
            features={[
              "AI drafts a unit in about 90 seconds",
              "Live mastery and misconception alerts",
              "Spaced review queued for every student",
            ]}
            micro={<TeacherMicro />}
            cta="Continue as Teacher"
            ctaGradient={GRAD_TEACHER}
            ctaShadow="rgba(124,58,237,.55)"
            hoverShadow="rgba(124,58,237,.30)"
            hoverRing="rgba(168,85,247,.08)"
          />

        </div>

        {/* Trust strip */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-gray-500 text-[12.5px] font-medium">
          <TrustItem>7-day free trial on Premium</TrustItem>
          <span className="hidden md:inline-block w-px h-3.5 bg-gray-300" />
          <TrustItem>FERPA · COPPA aligned</TrustItem>
          <span className="hidden md:inline-block w-px h-3.5 bg-gray-300" />
          <TrustItem>Switch roles anytime</TrustItem>
        </div>
      </div>

      <NotificationModal
        isOpen={notification.isOpen}
        onClose={closeNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
    </div>
  );
}

/**
 * One of the two role cards. Hover state is local; loading state is global
 * so the OTHER card stays interactive while one is saving.
 */
function RoleCard({
  role, hover, setHover, savingRole, onClick,
  accentBg, icon, iconGradient, iconGlow, accentColor, accentBorder,
  badge, title, tagline, description, features, micro,
  cta, ctaGradient, ctaShadow, hoverShadow, hoverRing,
}) {
  const isHover = hover === role;
  const isThisSaving = savingRole === role;
  const isOtherSaving = savingRole && savingRole !== role;

  return (
    <button
      type="button"
      disabled={isThisSaving}
      onMouseEnter={() => !savingRole && setHover(role)}
      onMouseLeave={() => setHover(null)}
      onClick={onClick}
      className={isThisSaving ? "cursor-wait" : isOtherSaving ? "cursor-default" : "cursor-pointer"}
      style={{
        position: 'relative',
        textAlign: 'left',
        background: 'linear-gradient(180deg, #fff 0%, #fcfcff 100%)',
        border: `1.5px solid ${isHover && !isThisSaving ? accentBorder : '#eef1f7'}`,
        borderRadius: 22,
        padding: '32px 32px 28px',
        transition: 'all .2s ease',
        transform: isHover && !savingRole ? 'translateY(-2px)' : 'none',
        boxShadow:
          isHover && !savingRole
            ? `0 28px 64px -22px ${hoverShadow}, 0 0 0 4px ${hoverRing}`
            : '0 1px 0 rgba(255,255,255,.5) inset, 0 16px 36px -20px rgba(15,23,42,.16)',
        overflow: 'hidden',
        opacity: isThisSaving ? 0.6 : 1,
      }}
    >
      {/* Corner glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -90,
          right: -70,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: accentBg,
          pointerEvents: 'none',
        }}
      />

      <div className="flex items-start justify-between">
        <div
          className="flex items-center justify-center"
          style={{
            width: 60,
            height: 60,
            borderRadius: 15,
            background: iconGradient,
            color: '#fff',
            position: 'relative',
            boxShadow: `0 1px 0 rgba(255,255,255,.32) inset, 0 16px 32px -12px ${iconGlow}`,
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 3,
              left: 3,
              width: '50%',
              height: '38%',
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(255,255,255,.4), rgba(255,255,255,0))',
              pointerEvents: 'none',
            }}
          />
          {icon}
        </div>
        {badge}
      </div>

      <h3
        className="text-gray-900 font-bold mt-6 mb-1"
        style={{ fontSize: 28, letterSpacing: '-0.02em' }}
      >
        {title}
      </h3>
      <div className="text-[14.5px] font-semibold mb-2" style={{ color: accentColor }}>
        {tagline}
      </div>
      <p className="text-[15px] leading-[1.55] text-gray-500 m-0">{description}</p>

      <ul className="list-none p-0 mt-5 mb-0 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5 text-[13.5px] text-gray-700 py-0.5">
            <Check
              className="w-4 h-4 mt-[2px] shrink-0"
              strokeWidth={2.4}
              style={{ color: accentColor }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {micro}

      <span
        className="w-full mt-5 box-border inline-flex items-center justify-center gap-2.5 text-white font-semibold"
        style={{
          background: ctaGradient,
          padding: '14px 20px',
          borderRadius: 12,
          fontSize: 15,
          boxShadow: `0 1px 0 rgba(255,255,255,.22) inset, 0 14px 30px -10px ${ctaShadow}`,
          transition: 'transform .2s',
          transform: isHover && !savingRole ? 'translateY(-1px)' : 'none',
        }}
      >
        {isThisSaving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            {cta}
            <ArrowRight
              className="w-4 h-4"
              strokeWidth={2.4}
              style={{
                transform: isHover && !savingRole ? 'translateX(4px)' : 'none',
                transition: 'transform .2s',
              }}
            />
          </>
        )}
      </span>
    </button>
  );
}

/** Student card preview — a mini Knowledge Map (matches the real student view). */
function StudentMicro() {
  const nodes = [
    { x: 50, y: 14, done: true },
    { x: 85, y: 40, done: true },
    { x: 72, y: 82, done: false },
    { x: 28, y: 82, done: true },
    { x: 15, y: 40, done: false },
  ];
  return (
    <div className="mt-5">
      <div
        className="px-3.5 py-3"
        style={{ background: 'linear-gradient(180deg, #fff 0%, #fbfcff 100%)', border: '1px solid #eef1f7', borderRadius: 12 }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: '#9aa0b6', letterSpacing: '.1em' }}>
            KNOWLEDGE MAP
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: '#1e4fe0' }}>3 / 5</span>
        </div>
        <div className="relative" style={{ height: 104 }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            {nodes.map((n, i) => (
              <line key={i} x1="50" y1="50" x2={n.x} y2={n.y} stroke="#cdd9f5" strokeWidth="1.2" />
            ))}
          </svg>
          <div
            className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ left: '50%', top: '50%', width: 34, height: 34, background: GRAD_STUDENT, boxShadow: '0 6px 14px -6px rgba(30,79,224,.6)' }}
          />
          {nodes.map((n, i) => (
            <div
              key={i}
              className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${n.x}%`,
                top: `${n.y}%`,
                width: 18,
                height: 18,
                border: '2.5px solid',
                borderColor: n.done ? '#2f66f1' : '#cdd9f5',
                background: n.done ? '#2f66f1' : '#fff',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Teacher card preview — a class-mastery roster (matches the real teacher view). */
function TeacherMicro() {
  const rows = [
    { n: "Ava R.", p: 92 },
    { n: "Liam K.", p: 78 },
    { n: "Noah P.", p: 54 },
  ];
  const tone = (p) => (p >= 75 ? "#16a34a" : p >= 50 ? "#d97706" : "#ef4444");
  return (
    <div className="mt-5">
      <div
        className="px-3.5 py-3"
        style={{ background: 'linear-gradient(180deg, #fff 0%, #fbfaff 100%)', border: '1px solid #f0eaf7', borderRadius: 12 }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: '#9aa0b6', letterSpacing: '.1em' }}>
            BIOLOGY 101 · MASTERY
          </span>
          <span className="text-[11px] font-bold inline-flex items-center gap-1" style={{ color: '#7c3aed' }}>
            <span aria-hidden className="w-[5px] h-[5px] rounded-full" style={{ background: '#7c3aed', boxShadow: '0 0 6px #a855f7' }} />
            LIVE
          </span>
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: GRAD_TEACHER }}
              >
                {r.n.charAt(0)}
              </div>
              <span className="text-[12.5px] text-gray-700 flex-1 truncate">{r.n}</span>
              <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${r.p}%`, background: tone(r.p) }} />
              </div>
              <span className="text-[11px] font-bold tabular-nums w-8 text-right" style={{ color: tone(r.p) }}>
                {r.p}%
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-gray-400 mt-2.5 font-medium">
          <span>24 students</span>
          <span className="font-bold" style={{ color: '#16a34a' }}>78% avg</span>
        </div>
      </div>
    </div>
  );
}

/** Trust-strip item — green check + label. */
function TrustItem({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Check className="w-3.5 h-3.5" strokeWidth={2.4} style={{ color: '#22c55e' }} />
      {children}
    </span>
  );
}
