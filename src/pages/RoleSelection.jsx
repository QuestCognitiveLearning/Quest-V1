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
        await quest.auth.updateMe({ account_type: "teacher" });
        navigate(createPageUrl("Pricing"));
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
      className="relative min-h-screen overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #eaf1ff 0%, #f5f7fc 50%, #f0eafc 100%)',
        color: '#0b1020',
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      {/* Top-left brand lockup */}
      <div className="absolute top-7 left-8 z-10 flex items-center gap-2.5">
        <img
          src="/quest-logo-on-white.png"
          alt="Quest Learning"
          width="32"
          height="32"
          className="rounded-lg"
        />
        <span
          className="text-[18px] font-bold tracking-tight"
          style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
        >
          Quest Learning
        </span>
      </div>

      {/* Top-right Sign in */}
      <a
        href="#"
        onClick={handleSignInClick}
        className="absolute top-8 right-9 z-10 text-sm text-gray-500 hover:text-gray-700 transition"
      >
        Already have an account?{" "}
        <span className="font-semibold" style={{ color: '#1e4fe0' }}>Sign in</span>
      </a>

      <div
        className="flex flex-col items-center justify-center min-h-screen px-6 pt-24 pb-16"
        style={{ fontFamily: "'Geist', -apple-system, system-ui, sans-serif" }}
      >
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
            Are you here to{" "}
            <span
              style={{
                background: 'linear-gradient(110deg, #1e4fe0, #5388fb)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              learn
            </span>{" "}
            or to{" "}
            <span
              style={{
                background: 'linear-gradient(110deg, #7c3aed, #a855f7)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              teach
            </span>
            ?
          </h1>
          <p className="mt-3.5 text-[17px] leading-relaxed text-gray-500">
            Pick your role to get a tailored experience.
          </p>
        </div>

        {/* Two role cards */}
        <div className="grid md:grid-cols-2 gap-6 w-full max-w-[1080px]">
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
            description="Adaptive lessons that meet you at your level, plus 5-minute warmups so what you learn actually sticks."
            features={[
              "Bite-sized quests tailored to you",
              "Mastery-gated progress, not grades",
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
            description="Generate full units in minutes, run mastery-gated lessons, and watch retention bend — automatically."
            features={[
              "AI drafts a unit in ~90 seconds",
              "Live mastery & misconception alerts",
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

/** Student card's "Today's Quest" micro-preview. */
function StudentMicro() {
  return (
    <div className="mt-5">
      <div
        className="px-3.5 py-3"
        style={{
          background: 'linear-gradient(180deg, #fff 0%, #fbfcff 100%)',
          border: '1px solid #eef1f7',
          borderRadius: 12,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 700,
              color: '#9aa0b6',
              letterSpacing: '.1em',
            }}
          >
            TODAY'S QUEST
          </span>
          <span className="flex-1 h-px" style={{ background: '#eef1f7' }} />
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              fontWeight: 700,
              color: '#1e4fe0',
            }}
          >
            + 60 XP
          </span>
        </div>
        <div className="text-[13.5px] font-semibold text-gray-900">
          Photosynthesis · adaptive set
        </div>
        <div className="flex gap-[3px] mt-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="flex-1 h-[5px] rounded-full"
              style={{ background: i < 6 ? '#2f66f1' : '#e7ecf5' }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-gray-400 mt-1.5 font-medium">
          <span>6 / 10</span>
          <span>~3 min left</span>
        </div>
      </div>
    </div>
  );
}

/** Teacher card's classroom-mastery micro-preview. */
function TeacherMicro() {
  const bars = [0.95, 0.88, 0.7, 0.6, 0.92, 0.4, 0.78, 0.85, 0.95, 0.55, 0.7, 0.82];
  return (
    <div className="mt-5">
      <div
        className="px-3.5 py-3"
        style={{
          background: 'linear-gradient(180deg, #fff 0%, #fbfaff 100%)',
          border: '1px solid #f0eaf7',
          borderRadius: 12,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 700,
              color: '#9aa0b6',
              letterSpacing: '.1em',
            }}
          >
            BIOLOGY 101 · P3
          </span>
          <span className="flex-1 h-px" style={{ background: '#f0eaf7' }} />
          <span className="text-[11px] font-bold inline-flex items-center gap-1" style={{ color: '#7c3aed' }}>
            <span
              aria-hidden
              className="w-[5px] h-[5px] rounded-full"
              style={{ background: '#7c3aed', boxShadow: '0 0 6px #a855f7' }}
            />
            LIVE
          </span>
        </div>
        <div className="grid grid-cols-12 gap-[3px]">
          {bars.map((v, i) => {
            const c = v > 0.85 ? '#22c55e' : v > 0.6 ? '#a855f7' : v > 0.5 ? '#f59e0b' : '#ef4444';
            return (
              <div
                key={i}
                className="h-[22px] rounded relative overflow-hidden"
                style={{ background: '#f3f0fb' }}
              >
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${v * 100}%`,
                    background: c,
                    borderRadius: 4,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[11px] text-gray-400 mt-1.5 font-medium">
          <span>24 students · mastery</span>
          <span className="font-bold" style={{ color: '#22c55e' }}>78% avg</span>
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
