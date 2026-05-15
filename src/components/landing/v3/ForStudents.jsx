import React, { useState } from "react";
import { ArrowRight, Brain, CheckSquare, RotateCw, Pause } from "lucide-react";

function DemoInquiry() {
  const initialTurns = [
    { who: "panda", text: "Why do you think plants grow toward sunlight?" },
    { who: "student", text: "Because they need it to make food?" },
    { who: "panda", text: "Right — and what part of the plant senses where the light is?" },
  ];
  const more = [
    { who: "student", text: "Maybe the leaves?" },
    { who: "panda", text: "Close — try the part that grows. The tip. What's happening there with the cells on the dark side vs. the light side?" },
    { who: "student", text: "The dark side grows faster, so the plant bends toward the light?" },
    { who: "panda", text: "You just described phototropism. Notice we got there by asking, not by me telling you." },
  ];
  const [turns, setTurns] = useState(initialTurns);
  const [idx, setIdx] = useState(0);
  const [thinking, setThinking] = useState(false);

  const advance = () => {
    if (idx >= more.length || thinking) return;
    setThinking(true);
    setTimeout(() => {
      setTurns((t) => [...t, more[idx]]);
      setIdx((i) => i + 1);
      setThinking(false);
    }, 600);
  };
  const reset = () => {
    setTurns(initialTurns);
    setIdx(0);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E2E8F0]">
        <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#2563EB]">
          Panda Tutor · Live Session
        </span>
        <span className="text-[12px] text-[#64748B] font-medium">
          Lesson · Photosynthesis
        </span>
      </div>
      <div className="flex flex-col gap-2.5 flex-1 py-1.5">
        {turns.map((t, i) => (
          <div
            key={i}
            className={`flex gap-2.5 items-end lp-v3-stage-in ${
              t.who === "student" ? "justify-end" : ""
            }`}
          >
            {t.who === "panda" && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
                style={{ background: "linear-gradient(140deg, #DBEAFE, #BFDBFE)" }}
              >
                🐼
              </div>
            )}
            <div
              className={`px-3.5 py-2.5 text-sm leading-snug max-w-[80%] ${
                t.who === "student"
                  ? "bg-[#2563EB] text-white rounded-[14px_14px_4px_14px]"
                  : "bg-[#E5ECF7] text-[#0F172A] rounded-[14px_14px_14px_4px]"
              }`}
            >
              {t.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex gap-2.5 items-end">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
              style={{ background: "linear-gradient(140deg, #DBEAFE, #BFDBFE)" }}
            >
              🐼
            </div>
            <div className="bg-[#E5ECF7] rounded-[14px_14px_14px_4px] px-3.5 py-3.5 inline-flex gap-1 lp-v3-typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2.5 mt-3 pt-3 border-t border-[#E2E8F0]">
        <button
          type="button"
          onClick={advance}
          disabled={idx >= more.length}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13.5px] font-semibold disabled:opacity-90 disabled:bg-[#16A34A] disabled:cursor-default"
        >
          {idx >= more.length ? "Concept reached: phototropism ✓" : "Continue the Dialogue"}
          {idx < more.length && <ArrowRight size={14} strokeWidth={2.2} />}
        </button>
        {idx >= more.length && (
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-white border border-[#E2E8F0] text-[13.5px] font-semibold text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB]"
          >
            Replay
          </button>
        )}
      </div>
    </div>
  );
}

function DemoRecall() {
  const [pick, setPick] = useState(null);
  const correct = 0; // RuBisCO is correct
  const opts = [
    "RuBisCO",
    "ATP synthase",
    "DNA polymerase",
    "Hexokinase",
  ];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E2E8F0]">
        <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#2563EB]">
          Attention Check · Auto-Embedded at 2:14
        </span>
        <span className="text-[12px] text-[#64748B] font-medium">
          Video · The Calvin Cycle
        </span>
      </div>
      <div className="grid md:grid-cols-[1fr_1.1fr] gap-4 items-stretch">
        <div className="flex flex-col gap-2.5">
          <div
            className="relative rounded-xl flex items-center justify-center overflow-hidden p-4 min-h-[220px]"
            style={{
              background:
                "radial-gradient(circle at 30% 35%, rgba(124,58,237,0.5), rgba(15,23,42,0.92) 70%), linear-gradient(160deg, #1E2541 0%, #0F172A 100%)",
            }}
          >
            <div
              className="absolute top-3 left-3.5 text-[12px] font-bold text-white/85 tracking-wide"
            >
              The Calvin Cycle
            </div>
            <div className="w-16 h-16 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-sm">
              <Pause size={24} fill="currentColor" />
            </div>
            <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center gap-2.5 text-[11px] text-white/85 font-semibold">
              <span>2:14</span>
              <div className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
                <div className="w-[48%] h-full bg-white rounded-full" />
              </div>
              <span>4:32</span>
            </div>
          </div>
          <div className="text-[12px] font-semibold text-[#64748B]">
            ⏸ Paused for an attention check
          </div>
        </div>

        <div className="bg-[#E5ECF7] border border-[#E2E8F0] rounded-xl p-4 flex flex-col gap-2">
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#F97316]">
            Quick Check
          </div>
          <p className="font-semibold text-[15px] text-[#0F172A] leading-snug">
            Which molecule fixes CO₂ in the Calvin cycle?
          </p>
          <div className="grid gap-1.5 mt-1.5">
            {opts.map((o, i) => {
              const isPick = pick === i;
              const isCorrect = i === correct;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPick(i)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-left transition-colors border ${
                    isPick && isCorrect
                      ? "bg-[#D1FAE5] border-[#16A34A] text-[#064E3B]"
                      : isPick && !isCorrect
                      ? "bg-[#FEE2E2] border-[#DC2626] text-[#7F1D1D]"
                      : "bg-white border-[#E2E8F0] text-[#1E293B] hover:border-[#2563EB]"
                  }`}
                >
                  <span
                    className={`w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-[11px] font-bold border ${
                      isPick && isCorrect
                        ? "bg-[#16A34A] text-white border-[#16A34A]"
                        : isPick && !isCorrect
                        ? "bg-[#DC2626] text-white border-[#DC2626]"
                        : "bg-[#E5ECF7] text-[#475569] border-[#E2E8F0]"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {o}
                </button>
              );
            })}
          </div>
          {pick !== null && (
            <div className="mt-1 text-[12.5px] text-[#475569] font-medium">
              {pick === correct
                ? "✓ Correct — video resumes."
                : "↻ Quest will replay the last 30 seconds."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DemoSpaced() {
  const queue = [
    { topic: "Cell Membrane", learned: "yesterday", due: "today", review: "Day 1 Review" },
    { topic: "Photosynthesis", learned: "3 days ago", due: "today", review: "Day 3 Review" },
    { topic: "Mitochondria", learned: "5 days ago", due: "in 2 days", review: "Day 7 Review" },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E2E8F0]">
        <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#2563EB]">
          Review Queue · Fixed Cadence
        </span>
        <span className="text-[12px] text-[#64748B] font-medium">
          Student · Ava M.
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {queue.map((it, i) => (
          <div
            key={i}
            className="grid grid-cols-[1.2fr_1fr_auto_auto] gap-3.5 items-center bg-white border border-[#E2E8F0] border-l-[3px] border-l-[#2563EB] rounded-lg px-3.5 py-3 text-[13.5px]"
          >
            <div className="font-semibold text-[#0F172A]">{it.topic}</div>
            <div className="text-[12.5px] text-[#64748B] font-medium">
              learned {it.learned}
            </div>
            <div className="text-[12.5px] text-[#64748B] font-medium">
              {it.due}
            </div>
            <span className="bg-[#DBEAFE] text-[#1D4ED8] font-bold text-[10.5px] tracking-wider uppercase px-2.5 py-1 rounded-full whitespace-nowrap">
              {it.review}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const METHODS = [
  {
    id: "inquiry",
    h: "Inquiry-Based",
    p: "Panda Tutor asks. Students think.",
    Ic: Brain,
    Demo: DemoInquiry,
  },
  {
    id: "recall",
    h: "Active Recall",
    p: "Attention checks. Quizzes. Case studies.",
    Ic: CheckSquare,
    Demo: DemoRecall,
  },
  {
    id: "spaced",
    h: "Spaced Repetition",
    p: "Reviews on day 1, 3, 7, 14, 21 — fixed cadence.",
    Ic: RotateCw,
    Demo: DemoSpaced,
  },
];

export default function ForStudents() {
  const [open, setOpen] = useState("inquiry");

  return (
    <section id="how" className="bg-[#EEF3FB]" style={{ padding: "72px 0" }}>
      <div className="lp-v3-container">
        <div className="mb-8">
          <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase">
            For Students · How It Works
          </span>
          <h2
            className="font-bold text-[#0F172A] mt-3 mb-3"
            style={{
              fontSize: "clamp(32px, 4.2vw, 52px)",
              lineHeight: "1.05",
              letterSpacing: "-0.025em",
            }}
          >
            Three Methods. <em className="not-italic text-[#2563EB]">One Quest.</em>
          </h2>
          <p className="text-[16px] text-[#64748B] whitespace-normal">
            Inquiry-based learning, active recall, and spaced repetition — wired into every Quest lesson.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {METHODS.map((m) => {
            const isOpen = open === m.id;
            const Ic = m.Ic;
            const Demo = m.Demo;
            return (
              <div
                key={m.id}
                className={`bg-white border rounded-[28px] overflow-hidden transition-all ${
                  isOpen
                    ? "border-transparent lp-v3-deep-shadow"
                    : "border-[#E2E8F0] lp-v3-soft-shadow hover:border-[#CBD5E1]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : m.id)}
                  className={`w-full grid grid-cols-[56px_1fr_auto] gap-4 items-center px-6 py-5 text-left ${
                    isOpen
                      ? "text-white"
                      : "text-[#0F172A]"
                  }`}
                  style={{
                    background: isOpen
                      ? "linear-gradient(160deg, #2563EB 0%, #1D4ED8 100%)"
                      : "transparent",
                  }}
                >
                  <span
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isOpen
                        ? "bg-white/20 text-white"
                        : "bg-[#DBEAFE] text-[#2563EB]"
                    }`}
                  >
                    <Ic size={22} strokeWidth={1.8} />
                  </span>
                  <div>
                    <div className="font-bold text-[18px] tracking-tight">
                      {m.h}
                    </div>
                    <div
                      className={`text-[13.5px] font-medium leading-snug ${
                        isOpen ? "text-white/85" : "text-[#64748B]"
                      }`}
                    >
                      {m.p}
                    </div>
                  </div>
                  <span
                    className={`w-8 h-8 rounded-full inline-flex items-center justify-center font-bold text-[18px] leading-none ${
                      isOpen
                        ? "bg-white/20 text-white"
                        : "bg-[#E5ECF7] text-[#94A3B8]"
                    }`}
                  >
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div
                    className="border-t border-[#E2E8F0] px-6 py-5 lp-v3-stage-in"
                    style={{ background: "#FAFBFE" }}
                  >
                    <Demo />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
