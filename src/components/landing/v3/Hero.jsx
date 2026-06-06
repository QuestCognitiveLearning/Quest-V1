import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Play, X } from "lucide-react";
import KnowledgeMap from "./KnowledgeMap";

/**
 * In-page YouTube demo modal.
 *
 * Renders into `document.body` via a React Portal so the fixed overlay can't be
 * trapped by an ancestor stacking context. (The hero section has
 * `.lp-v3-hero > * { position: relative; z-index: 1; }` which would otherwise
 * defeat `position: fixed` on the modal — see this for the gory CSS detail:
 *   https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index)
 */
function YouTubeModal({ open, onClose, videoId = "vOacrBHo0dE" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // autoplay=1 + rel=0 (no unrelated suggestions) + modestbranding=1
  const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quest Learning demo video"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "1100px",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close demo"
          style={{
            position: "absolute",
            top: "-44px",
            right: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "rgba(255,255,255,0.85)",
            fontSize: "14px",
            fontWeight: 500,
            background: "transparent",
            border: 0,
            cursor: "pointer",
          }}
        >
          <X size={18} strokeWidth={2.2} />
          Close
        </button>
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "56.25%",
            overflow: "hidden",
            borderRadius: "16px",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)",
            background: "#000",
          }}
        >
          <iframe
            src={src}
            title="Quest Learning — 90-second demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
          />
        </div>
      </div>
    </div>
  );

  // Portal to document.body so the fixed overlay escapes any ancestor's
  // containing block / stacking context.
  return createPortal(modal, document.body);
}

const FEED_POOL = [
  { id: "p1", name: "Ava M.", line: "Mastered Photosynthesis", color: "#2563EB" },
  { id: "p2", name: "Jordan P.", line: "Review Queued · Genetics", color: "#0EA5E9" },
  { id: "p3", name: "Sara K.", line: "Flagged Critical · Osmosis", color: "#1F8A5B" },
  { id: "p4", name: "Diego R.", line: "Passed Attention Check On Cells", color: "#C18A2A" },
];

export default function Hero() {
  const navigate = useNavigate();
  const [audience, setAudience] = useState("teacher");
  const [demoOpen, setDemoOpen] = useState(false);

  const isStudent = audience === "student";
  const eyebrow = isStudent
    ? "Inquiry · Instruction · Recalling · Applying"
    : "AI Curriculum · Live Sessions · Parent Reports";
  const headlinePre = isStudent ? "Learn to" : "Whether you're a teacher or tutor,";
  const headlineEm = isStudent ? "remember." : "we save you time.";
  const lede = isStudent
    ? "Inquiry, instruction, recall, and applying — wired into every lesson. Your Knowledge Map shows what you've mastered and what's due."
    : "Standards in, full curriculum out — quizzes, free-response, attention checks, and case studies. Edit anything, regenerate anything, then teach.";
  const ctaLabel = isStudent ? "Join Your Class" : "Start Free Trial";

  // Duplicate pool so the carousel can loop seamlessly
  const carouselItems = [...FEED_POOL, ...FEED_POOL];

  return (
    <section
      id="top"
      className="lp-v3-hero flex items-center"
      style={{ minHeight: "calc(100vh - 76px)", padding: "16px 0 24px" }}
    >
      <div className="lp-v3-container w-full">
        <div className="grid lg:grid-cols-2 gap-6 items-center">
          {/* LEFT: white card */}
          <div
            className="bg-white/95 backdrop-blur-md rounded-[28px] p-7 lg:p-8 border border-white/60 lp-v3-deep-shadow"
          >
            {/* Audience tabs */}
            <div
              role="tablist"
              aria-label="Audience"
              className="inline-flex items-center gap-1 p-1 rounded-full bg-[#E5ECF7] mb-3"
            >
              <button
                type="button"
                role="tab"
                onClick={() => setAudience("teacher")}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  audience === "teacher"
                    ? "bg-[#2563EB] text-white"
                    : "text-[#475569] hover:text-[#0F172A]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${audience === "teacher" ? "bg-white" : "bg-[#94A3B8]"}`} />
                For Educators
              </button>
              <button
                type="button"
                role="tab"
                onClick={() => setAudience("student")}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  audience === "student"
                    ? "bg-[#2563EB] text-white"
                    : "text-[#475569] hover:text-[#0F172A]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${audience === "student" ? "bg-white" : "bg-[#94A3B8]"}`} />
                For Students
              </button>
            </div>

            <div
              className="text-[10.5px] font-medium text-[#64748B] tracking-[0.06em] uppercase mb-2"
            >
              {eyebrow}
            </div>

            <h1
              className="font-extrabold tracking-tight text-[#0F172A] mb-3"
              style={{
                fontSize: "clamp(36px, 4.4vw, 52px)",
                lineHeight: "1.02",
                letterSpacing: "-0.035em",
              }}
            >
              {headlinePre}{" "}
              <em className="not-italic text-[#2563EB]">{headlineEm}</em>
            </h1>

            <p className="text-[15px] leading-relaxed text-[#475569] mb-4">
              {lede}
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate("/SignIn?mode=signup")}
                className="inline-flex items-center gap-2 h-[50px] px-6 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[14.5px] transition-colors lp-v3-cta-shadow"
              >
                {ctaLabel}
                <ArrowRight size={16} strokeWidth={2.2} />
              </button>
              {!isStudent && (
                <button
                  type="button"
                  onClick={() => navigate("/try")}
                  className="inline-flex items-center gap-2 h-[50px] px-5 rounded-xl bg-white/80 hover:bg-white border border-[#E2E8F0] hover:border-[#2563EB] text-[#0F172A] hover:text-[#2563EB] font-semibold text-[14.5px] transition-colors"
                >
                  Try free YouTube quiz tool
                </button>
              )}
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                className="inline-flex items-center gap-2 h-[50px] px-5 rounded-xl bg-white/80 hover:bg-white border border-[#E2E8F0] hover:border-[#2563EB] text-[#0F172A] hover:text-[#2563EB] font-semibold text-[14.5px] transition-colors"
              >
                <Play size={14} fill="currentColor" />
                Watch 90-sec Demo
              </button>
            </div>
          </div>

          {/* RIGHT: KnowledgeMap */}
          <div className="flex items-center justify-center">
            <KnowledgeMap />
          </div>
        </div>

        {/* Live mastery feed — full width below grid */}
        <div className="mt-4">
          <div className="flex items-stretch rounded-[14px] overflow-hidden border border-[#E2E8F0] bg-white">
            <div className="bg-[#0F172A] text-white flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold tracking-[0.14em] uppercase shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#F97316] lp-v3-pulse ring-4 ring-[#F97316]/25" />
              Live Mastery Feed
            </div>
            <div className="flex-1 relative overflow-hidden">
              <div className="lp-v3-feed-strip">
                {carouselItems.map((ev, idx) => (
                  <div
                    key={`carousel-${idx}`}
                    className="flex items-center gap-2.5 px-3 py-2 border-r border-[#E2E8F0] shrink-0"
                    style={{ width: 240 }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9.5px] font-bold shrink-0"
                      style={{ background: ev.color }}
                    >
                      {ev.name[0]}
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <div
                        className="text-[11.5px] font-bold text-[#0F172A] truncate"
                        style={{ fontFamily: "inherit" }}
                      >
                        {ev.name}
                      </div>
                      <div className="text-[10px] text-[#64748B] truncate leading-snug">
                        {ev.line}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <YouTubeModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </section>
  );
}
