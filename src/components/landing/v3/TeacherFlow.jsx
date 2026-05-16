import React, { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { Check, Trash2, BookOpen, Play, HelpCircle, FileText, Link as LinkIcon } from "lucide-react";

const STAGES = [
  { idx: "01", h: "Standards", p: "Program, subject, grade." },
  { idx: "02", h: "AI Builds", p: "Units & subunits." },
  { idx: "03", h: "Video", p: "YouTube or library." },
  { idx: "04", h: "Review", p: "Edit anything." },
  { idx: "05", h: "Launch", p: "Share the join code." },
];

function StageStandards() {
  const [program, setProgram] = useState("NGSS");
  const [subject, setSubject] = useState("Physical Science");
  const [course, setCourse] = useState("High School");

  const programs = ["AP / College Board", "NGSS", "Common Core", "IB", "NCTM"];
  const subjects = ["Life Science", "Physical Science", "Earth & Space", "Engineering Design", "Nature of Science"];
  const courses = ["High School", "High School DCI", "Middle School", "Middle School DCI"];

  return (
    <div className="bg-white rounded-2xl p-4 lp-v3-soft-shadow flex flex-col gap-3">
      <div className="grid grid-cols-[44px_1fr] gap-3 items-center">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white flex items-center justify-center shadow-md">
          <BookOpen size={18} />
        </div>
        <div>
          <div className="font-extrabold text-[16px] text-[#0F172A] tracking-tight">Curriculum Building</div>
          <div className="text-[11.5px] text-[#64748B] font-medium">Define your units and learning standards</div>
        </div>
      </div>

      <Step
        no="Step 1"
        label="Program"
        pick={program}
        pickColor="#7C3AED"
        bg="linear-gradient(135deg, #F5F3FF, #EDE9FE)"
      >
        {programs.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProgram(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              program === p
                ? "bg-[#7C3AED] text-white border border-[#7C3AED]"
                : "bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#7C3AED] hover:text-[#7C3AED]"
            }`}
          >
            {p}
          </button>
        ))}
      </Step>

      <Step
        no="Step 2"
        label="Subject"
        pick={subject}
        pickColor="#2563EB"
        bg="linear-gradient(135deg, #EFF6FF, #DBEAFE)"
      >
        {subjects.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSubject(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              subject === s
                ? "bg-[#2563EB] text-white border border-[#2563EB]"
                : "bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]"
            }`}
          >
            {s}
          </button>
        ))}
      </Step>

      <Step
        no="Step 3"
        label="Course"
        pick={course}
        pickColor="#4F46E5"
        bg="linear-gradient(135deg, #EEF2FF, #E0E7FF)"
      >
        {courses.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCourse(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              course === c
                ? "bg-[#4F46E5] text-white border border-[#4F46E5]"
                : "bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#4F46E5] hover:text-[#4F46E5]"
            }`}
          >
            {c}
          </button>
        ))}
      </Step>

      <button
        type="button"
        onClick={() => {}}
        className="w-full text-white font-bold text-[13.5px] py-3 rounded-xl shadow-lg shadow-blue-500/30"
        style={{ background: "linear-gradient(135deg, #2563EB, #4F46E5)" }}
      >
        → View Standards
      </button>
    </div>
  );
}

function Step({ no, label, pick, pickColor, bg, children }) {
  return (
    <div className="rounded-2xl p-3.5" style={{ background: bg }}>
      <div className="font-bold text-sm text-[#0F172A] tracking-tight mb-2 flex items-center gap-2 flex-wrap">
        <span className="bg-white border border-[#E2E8F0] px-2 py-0.5 rounded-md text-[11px] font-bold">
          {no}
        </span>
        {label} ·{" "}
        <span className="font-bold" style={{ color: pickColor }}>
          {pick}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function StageCurriculum() {
  const raws = [
    "Obtain, evaluate, and communicate information to compare historical models of the atom.",
    "Use the Periodic Table to predict chemical and physical properties.",
    "Model different representations of atoms (Lewis Dot, Bohr Models).",
    "Predict bonding types between atoms using the periodic table.",
  ];
  const units = [
    { n: 1, h: "Matter and Its Interactions", subs: ["Historical Atom Models", "Using the Periodic Table", "Atom Representation Models", "Bonding Predictions"] },
    { n: 2, h: "Chemical Reactions", subs: ["Gaseous Behavior", "Kinetic Molecular Theory", "Ideal Gas Law"] },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 lp-v3-soft-shadow flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-extrabold text-[16px] text-[#0F172A] tracking-tight">Curriculum Building</div>
          <div className="text-[11.5px] text-[#64748B] font-medium">25 of 25 standards covered</div>
        </div>
        <div className="inline-flex gap-3 items-center text-[11px] font-bold tracking-wider uppercase text-[#64748B]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F97316]" />
            Raw Standards
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
            AI Curriculum
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl p-3.5 border border-[#FDE68A] bg-[#FFFBEB]">
          <div className="flex items-center gap-2 mb-3 font-bold text-[11.5px] tracking-[0.1em] uppercase text-[#0F172A]">
            <span className="w-[22px] h-[22px] rounded-md bg-[#FED7AA] text-[#C2410C] flex items-center justify-center text-[12px]">
              📖
            </span>
            Raw Standards
            <span className="ml-auto text-[11px] text-[#64748B] font-semibold normal-case tracking-normal">25</span>
          </div>
          {raws.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[14px_1fr] gap-2 items-start bg-[#D1FAE5] rounded-lg px-2.5 py-2 text-[11.5px] text-[#064E3B] mb-1.5 font-medium leading-snug"
            >
              <Check size={12} className="text-[#10B981] mt-0.5" strokeWidth={3} />
              <span>{r}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-3.5 border border-[#DDD6FE] bg-[#F5F3FF]">
          <div className="flex items-center gap-2 mb-3 font-bold text-[11.5px] tracking-[0.1em] uppercase text-[#0F172A]">
            <span className="w-[22px] h-[22px] rounded-md bg-[#DDD6FE] text-[#6D28D9] flex items-center justify-center text-[12px]">
              ✨
            </span>
            AI Curriculum
            <span className="ml-auto text-[11px] text-[#16A34A] font-semibold normal-case tracking-normal">Ready</span>
          </div>
          {units.map((u) => (
            <div key={u.n} className="mb-2">
              <div
                className="text-white font-bold text-[12.5px] px-3 py-2 rounded-lg flex items-center gap-2 mb-1"
                style={{ background: "linear-gradient(135deg, #2563EB, #4F46E5)" }}
              >
                <span className="bg-white/20 w-5 h-5 rounded flex items-center justify-center text-[11px]">
                  {u.n}
                </span>
                {u.h}
              </div>
              <div className="flex flex-col gap-1">
                {u.subs.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-md px-3 py-1.5 text-[11.5px] text-[#1E293B] font-medium"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2.5 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl px-3.5 py-3 text-[#064E3B] font-bold text-[13px]">
        <Check size={16} className="text-[#10B981]" strokeWidth={2.6} />
        25 of 25 standards covered
        <button
          type="button"
          onClick={() => {}}
          className="ml-auto bg-[#16A34A] text-white font-bold text-[12px] px-3.5 py-2 rounded-lg"
        >
          Use This Curriculum →
        </button>
      </div>
    </div>
  );
}

function StageVideo() {
  const [picked, setPicked] = useState(1);
  const recs = [
    { ttl: "States of Matter — Solids, Liquids, Gases & Plasma", d: "12:46", desc: "Four states of matter explained: properties and particle behavior.", hue: "#1E3A8A" },
    { ttl: "Types of Matter: Elements, Compounds, Mixtures", d: "4:15", desc: "Definitions and distinctions, with worked examples.", hue: "#7C3AED" },
    { ttl: "General Chemistry in 19 Minutes", d: "18:49", desc: "Concise tour of atomic structure, reactions, stoichiometry.", hue: "#0F766E" },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 lp-v3-soft-shadow flex flex-col gap-3">
      <div className="grid grid-cols-[36px_1fr] gap-3 items-center">
        <div className="w-9 h-9 rounded-lg bg-[#2563EB] text-white flex items-center justify-center">
          <Play size={14} fill="currentColor" />
        </div>
        <div>
          <div className="font-extrabold text-[16px] text-[#0F172A] tracking-tight">Add Video</div>
          <div className="text-[11.5px] text-[#64748B] font-medium">Understanding Matter Interactions</div>
        </div>
      </div>

      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3.5">
        <div className="font-bold text-sm text-[#0F172A] mb-2 flex items-center gap-2">
          <LinkIcon size={14} className="text-[#2563EB]" />
          Add Custom YouTube Video
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            type="text"
            className="bg-white border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-[13px] text-[#64748B] outline-none"
            placeholder="https://www.youtube.com/watch?v=…"
            readOnly
          />
          <button
            type="button"
            className="bg-[#818CF8] text-white font-bold text-[13px] px-4 py-2.5 rounded-lg opacity-70"
          >
            ✓ Add Video
          </button>
        </div>
      </div>

      <div className="font-bold text-sm text-[#0F172A] mt-1 flex items-center gap-2">
        <Play size={12} fill="currentColor" className="text-[#2563EB]" />
        Quest Recommendations
      </div>
      <div className="flex flex-col gap-2">
        {recs.map((r, i) => {
          const on = picked === i;
          return (
            <div
              key={i}
              onClick={() => setPicked(i)}
              className={`grid grid-cols-[130px_1fr] gap-3.5 rounded-xl p-2.5 cursor-pointer transition-all ${
                on
                  ? "border-2 border-[#2563EB] bg-[#EFF6FF] shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                  : "border border-[#E2E8F0] bg-white hover:border-[#2563EB]"
              }`}
            >
              <div
                className="h-[78px] rounded-lg relative flex items-center justify-center text-white overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${r.hue}, #0F172A)` }}
              >
                <span className="w-9 h-9 bg-black/50 rounded-full flex items-center justify-center text-xs pl-1">
                  ▶
                </span>
                <span className="absolute bottom-1.5 right-2 bg-black/70 text-white text-[10.5px] px-1.5 py-0.5 rounded font-semibold">
                  {r.d}
                </span>
              </div>
              <div>
                <div className="font-bold text-[13.5px] text-[#0F172A] mb-1 leading-tight">
                  {r.ttl}
                </div>
                <div className="text-[11.5px] text-[#64748B] mb-2 leading-snug">
                  {r.desc}
                </div>
                <button
                  type="button"
                  className={`font-bold text-[11.5px] px-3 py-1.5 rounded-md text-white ${
                    on ? "bg-[#16A34A]" : "bg-[#2563EB]"
                  }`}
                >
                  {on ? "✓ Selected" : "Select"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageReview() {
  const [tab, setTab] = useState("quiz");
  const [difficulty, setDifficulty] = useState("all");

  const items = [
    {
      lvl: "hard",
      q: "What is the role of oxidative stress in metabolism?",
      ans: [
        "It has no effect",
        "Increases metabolic efficiency",
        "Can cause cellular damage and disrupt metabolic pathways",
        "Only affects anaerobic processes",
      ],
      correct: 2,
    },
    {
      lvl: "medium",
      q: "How can intermittent fasting affect metabolic health?",
      ans: [
        "Increases insulin sensitivity and decreases fat storage",
        "Decreases insulin sensitivity",
        "Has no metabolic effect",
        "Only affects sleep",
      ],
      correct: 0,
    },
  ];

  const filtered = difficulty === "all" ? items : items.filter((i) => i.lvl === difficulty);

  const tabs = [
    { id: "inquiry", h: "Inquiry", Ic: BookOpen },
    { id: "video", h: "Video", Ic: Play },
    { id: "quiz", h: "Quiz", Ic: HelpCircle },
    { id: "case-study", h: "Case Study", Ic: FileText },
  ];

  const diffStyle = {
    all: { on: "bg-[#0F172A] text-white", off: "bg-[#1F2937] text-white opacity-60" },
    easy: { on: "bg-[#D1FAE5] text-[#047857]", off: "bg-[#D1FAE5] text-[#047857] opacity-60" },
    medium: { on: "bg-[#FEF3C7] text-[#B45309]", off: "bg-[#FEF3C7] text-[#B45309] opacity-60" },
    hard: { on: "bg-[#FEE2E2] text-[#B91C1C]", off: "bg-[#FEE2E2] text-[#B91C1C] opacity-60" },
  };
  const diffs = [
    { id: "all", label: "All (40)" },
    { id: "easy", label: "Easy (15)" },
    { id: "medium", label: "Medium (15)" },
    { id: "hard", label: "Hard (10)" },
  ];

  return (
    <div className="bg-white rounded-2xl lp-v3-soft-shadow flex flex-col gap-3">
      <div
        className="rounded-t-2xl px-4 py-3 -mx-0 -mt-0"
        style={{ background: "linear-gradient(135deg, #10B981, #047857)" }}
      >
        <div className="flex items-baseline gap-3 flex-wrap text-white">
          <div className="font-extrabold text-[16px] tracking-tight whitespace-nowrap">
            Review Content
          </div>
          <div className="text-[11.5px] text-white/70 font-medium">Metabolism</div>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-3 pb-4">
        <div
          className="grid grid-cols-4 bg-[#E5ECF7] rounded-lg p-1 gap-0.5"
        >
          {tabs.map((t) => {
            const Ic = t.Ic;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold py-2 rounded-md ${
                  tab === t.id
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-[#475569]"
                }`}
              >
                <Ic size={12} />
                {t.h}
              </button>
            );
          })}
        </div>

        <div className="flex gap-1.5">
          {diffs.map((d) => {
            const on = difficulty === d.id;
            const s = on ? diffStyle[d.id].on : diffStyle[d.id].off;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficulty(d.id)}
                className={`font-bold text-[11.5px] px-3 py-1 rounded-md ${s} ${
                  on ? "-translate-y-0.5" : ""
                } transition-transform`}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5">
          {filtered.map((it, qi) => (
            <div
              key={qi}
              className="bg-white border-2 border-[#2563EB] rounded-xl p-3.5"
            >
              <div className="flex items-center gap-2.5 mb-2 text-[11px]">
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    it.lvl === "hard"
                      ? "bg-[#FEE2E2] text-[#B91C1C]"
                      : it.lvl === "medium"
                      ? "bg-[#FEF3C7] text-[#B45309]"
                      : "bg-[#D1FAE5] text-[#047857]"
                  }`}
                >
                  {it.lvl.toUpperCase()}
                </span>
                <span className="ml-auto text-[#64748B] font-medium">
                  Question {qi + 1}
                </span>
                <span className="flex gap-1">
                  <button type="button" className="bg-white border border-[#E2E8F0] rounded text-[10.5px] font-semibold px-2 py-0.5 text-[#2563EB]">
                    Edit
                  </button>
                  <button type="button" className="bg-white border border-[#FCA5A5] rounded text-[10.5px] font-semibold px-1.5 py-0.5 text-[#DC2626]">
                    <Trash2 size={10} />
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-[26px_1fr] gap-2.5 items-center font-bold text-sm text-[#0F172A] mb-2.5">
                <span className="bg-[#2563EB] text-white w-[26px] h-[26px] rounded-md flex items-center justify-center text-[12px]">
                  {qi + 1}
                </span>
                {it.q}
              </div>
              <div className="flex flex-col gap-1">
                {it.ans.map((a, ai) => {
                  const correct = ai === it.correct;
                  return (
                    <div
                      key={ai}
                      className={`grid grid-cols-[20px_1fr_auto] gap-2 items-center rounded-lg px-3 py-2 text-[12.5px] ${
                        correct
                          ? "bg-[#D1FAE5] border border-[#16A34A] text-[#064E3B]"
                          : "bg-[#F9FAFB] border border-[#E2E8F0] text-[#1E293B]"
                      }`}
                    >
                      <span className={`font-bold ${correct ? "text-[#047857]" : "text-[#64748B]"}`}>
                        {String.fromCharCode(65 + ai)}.
                      </span>
                      <span>{a}</span>
                      {correct && (
                        <span className="bg-[#16A34A] text-white font-bold text-[10.5px] px-2 py-0.5 rounded">
                          Correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StageLaunch() {
  return (
    <div className="bg-white rounded-2xl lp-v3-soft-shadow flex flex-col gap-3 overflow-hidden">
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ background: "linear-gradient(135deg, #10B981, #047857)" }}
      >
        <div className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">
          <Check size={18} strokeWidth={3} />
        </div>
        <div>
          <div className="font-extrabold text-[16px] text-white tracking-tight">
            Class Created · Chemistry I · Period 3
          </div>
          <div className="text-[11.5px] text-white/85 font-medium">
            Share the code below — students join instantly.
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-3 items-stretch">
        <div
          className="rounded-xl p-4 text-center text-white"
          style={{ background: "linear-gradient(160deg, #2563EB 0%, #1D4ED8 100%)" }}
        >
          <div className="text-[10px] font-bold tracking-[0.18em] opacity-70 mb-1.5">
            CLASS JOIN CODE
          </div>
          <div className="font-extrabold text-[32px] tracking-wider leading-none">
            8K3M-Q9
          </div>
          <div className="text-[10.5px] opacity-70 mt-1.5 font-medium">
            Free for students · Reset anytime
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {[
            { v: "2", k: "UNITS" },
            { v: "7", k: "SUBUNITS" },
            { v: "40", k: "QUIZ ITEMS" },
            { v: "3", k: "CASE STUDIES" },
          ].map((s, i) => (
            <div
              key={i}
              className="bg-[#E5ECF7] rounded-xl text-center px-2 py-2.5"
            >
              <div className="font-extrabold text-[22px] text-[#2563EB] leading-none">
                {s.v}
              </div>
              <div className="font-bold text-[9px] tracking-[0.14em] text-[#64748B] mt-1">
                {s.k}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TeacherFlow() {
  const sectionRef = useRef(null);
  // Trigger autoplay only once the section actually scrolls into view, so the
  // user doesn't miss the first step running while they're still up at the hero.
  // `once: true` makes inView latch to true the first time it fires; we
  // explicitly stop autoplay after one full pass so it doesn't loop forever.
  const inView = useInView(sectionRef, { once: true, margin: "-15% 0px" });
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  // Step 1 stays on screen for 3.5s (a touch longer to read its intro);
  // the remaining four steps move every 2.5s. Total walkthrough = 13.5s.
  // STEP_DURATIONS_MS[i] = how long step `i` is visible before advancing.
  const STEP_DURATIONS_MS = [3500, 2500, 2500, 2500, 2500];

  useEffect(() => {
    if (!autoplay || !inView) return;
    // Manually schedule each transition so we can stop precisely after step 4
    // (the 5th and final stage). A naive `setInterval` with one delay would
    // either treat all steps the same or loop endlessly.
    const timeouts = [];
    let elapsed = 0;
    for (let i = 1; i < 5; i++) {
      elapsed += STEP_DURATIONS_MS[i - 1];
      const fireAt = elapsed;
      timeouts.push(setTimeout(() => setActive(i), fireAt));
    }
    // Once the last step has been visible for its own duration, disable
    // autoplay so it rests on step 5 instead of looping.
    elapsed += STEP_DURATIONS_MS[4];
    timeouts.push(setTimeout(() => setAutoplay(false), elapsed));
    return () => timeouts.forEach((t) => clearTimeout(t));
  }, [autoplay, inView]);

  const Stage = [StageStandards, StageCurriculum, StageVideo, StageReview, StageLaunch][active];

  return (
    <section
      id="teacher-flow"
      ref={sectionRef}
      className="bg-white border-y border-[#E2E8F0]"
      style={{ padding: "72px 0" }}
    >
      <div className="lp-v3-container">
        <div className="mb-8">
          <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase">
            For Teachers · How It Works
          </span>
          <h2
            className="font-bold text-[#0F172A] mt-3 mb-3"
            style={{
              fontSize: "clamp(32px, 4.2vw, 52px)",
              lineHeight: "1.05",
              letterSpacing: "-0.025em",
            }}
          >
            From Standard to <em className="not-italic text-[#2563EB]">Live Class</em>, in Five Steps.
          </h2>
          <p className="text-[17px] text-[#64748B] max-w-2xl">
            Each step is a real surface in the app. Click any number to see it.
          </p>
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-7 items-stretch">
          <div className="relative self-start">
            <div
              className="absolute bg-[#E2E8F0]"
              style={{
                left: 38,
                top: 40,
                bottom: 40,
                width: 2,
              }}
            />
            <div className="flex flex-col gap-0">
              {STAGES.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActive(i);
                    setAutoplay(false);
                  }}
                  onMouseEnter={() => setAutoplay(false)}
                  className={`flex flex-row items-center gap-3.5 text-left px-3.5 py-3 rounded-lg transition-colors ${
                    active === i ? "" : "hover:bg-[#2563EB]/[0.04]"
                  }`}
                  style={{ minHeight: 80 }}
                >
                  <div
                    className={`w-[50px] h-[50px] rounded-full border-2 flex items-center justify-center font-extrabold text-sm shrink-0 transition-all relative z-10 ${
                      active === i
                        ? "border-transparent text-white"
                        : "bg-white border-[#E2E8F0] text-[#475569]"
                    }`}
                    style={{
                      background:
                        active === i
                          ? "linear-gradient(160deg, #2563EB 0%, #1D4ED8 100%)"
                          : undefined,
                      transform: active === i ? "scale(1.05)" : "scale(1)",
                      boxShadow:
                        active === i
                          ? "0 10px 22px -10px rgba(37,99,235,0.55)"
                          : undefined,
                    }}
                  >
                    {s.idx}
                  </div>
                  <div>
                    <div
                      className={`font-bold text-[15px] tracking-tight ${
                        active === i ? "text-[#2563EB]" : "text-[#0F172A]"
                      }`}
                    >
                      {s.h}
                    </div>
                    <div className="text-[12.5px] text-[#64748B] font-medium leading-snug">
                      {s.p}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div
            className="rounded-[28px] border border-[#E2E8F0] p-4 lp-v3-deep-shadow self-start"
            style={{
              background: "linear-gradient(180deg, #F8FAFE 0%, #EEF3FB 100%)",
            }}
          >
            <div className="lp-v3-stage-in" key={active}>
              <Stage />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
