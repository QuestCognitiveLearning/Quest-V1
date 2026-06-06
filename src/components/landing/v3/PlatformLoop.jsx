import React, { useEffect, useState } from "react";

function VStandards({ on }) {
  const pills = ["NGSS", "Physical Science", "High School"];
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {pills.map((p, i) => (
        <span
          key={p}
          className={`inline-block w-fit px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition-colors ${
            on
              ? "bg-[#2563EB] text-white border border-[#2563EB]"
              : "bg-[#E5ECF7] text-[#64748B] border border-[#E2E8F0]"
          }`}
          style={{ transitionDelay: `${i * 0.12}s` }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

function VAI({ on }) {
  const units = ["Matter and Its Interactions", "Chemical Reactions", "Thermodynamics"];
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {units.map((u, i) => (
        <span
          key={u}
          className={`inline-flex items-center gap-2 text-[11.5px] font-semibold ${
            on ? "text-[#0F172A]" : "text-[#64748B]"
          } ${i === 2 ? "opacity-70" : ""}`}
        >
          <span
            className={`w-2 h-2 rounded-sm ${
              on ? "bg-[#7C3AED]" : "bg-[#94A3B8]"
            }`}
          />
          {u}
          {i === 2 && on && (
            <span className="inline-block w-1.5 h-3 bg-[#7C3AED] lp-v3-blink ml-0.5" />
          )}
        </span>
      ))}
    </div>
  );
}

function VStudent({ on }) {
  const stages = ["Inquiry", "Instruction", "Recall", "Apply"];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 w-full">
      {stages.map((s, i) => {
        const isNow = on && i === 1;
        return (
          <div
            key={s}
            className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-md border min-w-0 ${
              isNow
                ? "border-[#F97316] bg-[#FFF7ED]"
                : on
                ? "border-[#E2E8F0] bg-white"
                : "border-[#E2E8F0] bg-white"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isNow
                  ? "bg-[#F97316] ring-2 ring-[#F97316]/30"
                  : on
                  ? "bg-[#16A34A]"
                  : "bg-[#CBD5E1]"
              }`}
            />
            <span className="text-[7.5px] lg:text-[8px] font-bold tracking-normal uppercase text-[#475569] leading-tight text-center truncate max-w-full">
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VMastery({ on }) {
  const bars = [82, 64, 91, 38];
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {bars.map((b, i) => {
        const color = b < 50 ? "#DC2626" : b < 80 ? "#F97316" : "#16A34A";
        return (
          <div key={i} className="grid grid-cols-[1fr_36px] gap-2 items-center">
            <span className="h-2 bg-white border border-[#E2E8F0] rounded-full overflow-hidden">
              <span
                className="block h-full rounded-full transition-all"
                style={{
                  width: `${b}%`,
                  background: on ? color : "#CBD5E1",
                  transitionDelay: `${i * 0.08}s`,
                }}
              />
            </span>
            <span
              className="text-[11px] font-bold text-right"
              style={{ color: on ? "#1E293B" : "#64748B" }}
            >
              {b}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

const PHASES = [
  { who: "teacher", h: "You Set the Standards", sub: "Pick a program, subject, and grade.", Viz: VStandards, tag: "TEACHER", tagColor: "#2563EB", border: "#2563EB", grad: "from-white to-[#EFF6FF]" },
  { who: "ai", h: "AI Builds the Quest", sub: "Units, inquiry, quizzes, case studies.", Viz: VAI, tag: "AI", tagColor: "#7C3AED", border: "#7C3AED", grad: "from-white to-[#F5F3FF]" },
  { who: "student", h: "Students Learn It Four Ways", sub: "Four phases. Spaced review locks it in.", Viz: VStudent, tag: "STUDENT", tagColor: "#F97316", border: "#F97316", grad: "from-white to-[#FFF7ED]" },
  { who: "teacher", h: "You See What Stuck", sub: "Live mastery. Flagged questions. Refine.", Viz: VMastery, tag: "TEACHER", tagColor: "#2563EB", border: "#2563EB", grad: "from-white to-[#EFF6FF]" },
];

export default function PlatformLoop() {
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => setActive((a) => (a + 1) % PHASES.length), 2400);
    return () => clearInterval(id);
  }, [autoplay]);

  return (
    <section id="loop" className="bg-[#EEF3FB]" style={{ padding: "52px 0" }}>
      <div className="lp-v3-container">
        <div className="text-center max-w-2xl mx-auto mb-7">
          <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase">
            How Quest Works
          </span>
          <h2
            className="font-bold text-[#0F172A] mt-3 mb-3"
            style={{
              fontSize: "clamp(32px, 4.2vw, 52px)",
              lineHeight: "1.05",
              letterSpacing: "-0.025em",
            }}
          >
            The Loop, in <em className="not-italic text-[#2563EB]">Four Moves.</em>
          </h2>
          <p className="text-[17px] text-[#64748B]">
            Built once, then it runs. The same data that helps students improve teaches you what to refine next.
          </p>
        </div>

        <div className="relative">
          {/* Responsive grid:
              - Mobile (default): 2 columns → 4 cards wrap into a 2×2 block,
                so step 3/4 sit BELOW step 1/2 instead of overflowing right.
              - lg+: 7-column row with thin arrow connectors interleaved
                between cards (1fr  arrow  1fr  arrow  1fr  arrow  1fr).
              Each arrow `<div>` below uses `hidden lg:flex` so it disappears
              on mobile where the linear "→" doesn't make sense. */}
          <div
            className="grid items-stretch gap-3 grid-cols-2 lg:[grid-template-columns:1fr_24px_1fr_24px_1fr_24px_1fr]"
          >
            {PHASES.map((p, i) => {
              const isOn = active === i;
              return (
                <React.Fragment key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(i);
                      setAutoplay(false);
                    }}
                    onMouseEnter={() => setAutoplay(false)}
                    className={`flex flex-col gap-2.5 text-left rounded-[20px] p-5 transition-all bg-white border ${
                      isOn ? "border-transparent -translate-y-1" : "border-[#E2E8F0]"
                    }`}
                    style={{
                      minHeight: 200,
                      borderTop: isOn ? `3px solid ${p.border}` : undefined,
                      background: isOn
                        ? p.who === "ai"
                          ? "linear-gradient(180deg, #fff 0%, #F5F3FF 100%)"
                          : p.who === "student"
                          ? "linear-gradient(180deg, #fff 0%, #FFF7ED 100%)"
                          : "linear-gradient(180deg, #fff 0%, #EFF6FF 100%)"
                        : "#fff",
                      boxShadow: isOn
                        ? "0 24px 60px -24px rgba(15,23,42,0.2), 0 6px 14px rgba(15,23,42,0.06)"
                        : "0 1px 2px rgba(15,23,42,0.04)",
                    }}
                  >
                    <div
                      className="font-extrabold text-[13px] tracking-wider"
                      style={{ color: isOn ? "#0F172A" : "#94A3B8" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div
                      className="rounded-xl p-3 flex items-center min-h-[90px] transition-all"
                      style={{
                        background: isOn
                          ? p.who === "ai"
                            ? "rgba(124,58,237,0.06)"
                            : p.who === "student"
                            ? "rgba(249,115,22,0.06)"
                            : "rgba(37,99,235,0.06)"
                          : "#E5ECF7",
                        filter: isOn ? "grayscale(0)" : "grayscale(1)",
                        opacity: isOn ? 1 : 0.55,
                      }}
                    >
                      <p.Viz on={isOn} />
                    </div>
                    <div className="font-bold text-[17px] tracking-tight text-[#0F172A] leading-tight">
                      {p.h}
                    </div>
                    <div className="text-[13.5px] text-[#64748B] font-medium leading-snug">
                      {p.sub}
                    </div>
                    <div
                      className="inline-block self-start px-2.5 py-1 rounded-full text-[9.5px] font-bold tracking-[0.18em] text-white mt-auto"
                      style={{ background: p.tagColor }}
                    >
                      {p.tag}
                    </div>
                  </button>
                  {i < PHASES.length - 1 && (
                    <div
                      className="hidden lg:flex items-center justify-center self-center transition-colors"
                      style={{
                        color:
                          active === i || active === i + 1 ? "#2563EB" : "#CBD5E1",
                        height: 24,
                      }}
                    >
                      <svg viewBox="0 0 60 24" preserveAspectRatio="none" className="w-full h-full">
                        <line
                          x1="0"
                          y1="12"
                          x2="50"
                          y2="12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeDasharray="3 5"
                        />
                        <polyline
                          points="44,6 52,12 44,18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Refine & rerun back arrow — desktop only. On mobile the cards
              are stacked in a 2×2 grid, so a horizontal U-shape would be
              nonsensical. */}
          <div
            className="relative mt-3 hidden lg:block"
            style={{ height: 56, color: "#475569", opacity: 0.85 }}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 1000 80"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              <path
                d="M 970,8 L 970,40 Q 970,68 940,68 L 60,68 Q 30,68 30,40 L 30,16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeDasharray="4 6"
                fill="none"
              />
              <polyline
                points="22,22 30,12 38,22"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            <span
              className="absolute bottom-0 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#EEF3FB] text-[11px] font-bold tracking-[0.14em] uppercase text-[#475569]"
            >
              Refine &amp; Rerun ↻
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
