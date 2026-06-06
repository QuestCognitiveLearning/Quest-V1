/**
 * Classroom.jsx — landing page targeting individual teachers. Compact 5-section
 * structure; the full 12-section spec is a follow-up.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, Zap, Users, BookOpen, BarChart3, Brain } from "lucide-react";
import Footer from "@/components/landing/v3/Footer";

const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

const PROBLEMS = [
  {
    head: "Sundays go to lesson prep.",
    body:
      "You shouldn't be writing quizzes, finding case studies, and aligning to standards manually. Quest builds them in 90 seconds.",
  },
  {
    head: "Engagement during direct instruction is hit-or-miss.",
    body:
      "Live sessions with leaderboards, attention checks, and instant insight let you catch a confused student in the moment, not on the next test.",
  },
  {
    head: "Office hours don't scale.",
    body:
      "Every student gets their own AI Panda Tutor that walks them through the work Socratically — so you can spend office hours on the kids who need you most.",
  },
];

const FEATURES = [
  {
    icon: Zap,
    head: "Curriculum from a standard",
    body:
      "Pick the grade and standards code. Quest generates videos, quizzes, case studies, and attention checks. Edit anything. Regenerate anything.",
  },
  {
    icon: Users,
    head: "Live classroom sessions",
    body:
      "Project a join code. Students join in 5 seconds. Run quizzes, attention checks, and case studies live with real-time leaderboards.",
  },
  {
    icon: Brain,
    head: "AI Panda Tutor for every student",
    body:
      "Free-response coaching that asks Socratic questions instead of giving answers. Students arrive at the insight; you keep the rigor.",
  },
  {
    icon: BarChart3,
    head: "Standards-aligned analytics",
    body:
      "See mastery by standard, by student, by class. Identify what to reteach before the next unit, not after.",
  },
  {
    icon: BookOpen,
    head: "Print-ready PDF + Word",
    body:
      "Every quiz, case study, and subunit downloads as a print-ready PDF or editable Word doc with answer key.",
  },
  {
    icon: Sparkles,
    head: "YouTube → handout in 90 seconds",
    body:
      "Paste a YouTube link, get a multiple-choice quiz, case study, and discussion prompts. Try the free tool at /Try.",
  },
];

export default function Classroom() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: FONT, background: "#EEF3FB", color: "#0F172A", minHeight: "100vh" }}>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-[1200px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <a href="/" className="font-bold text-slate-900 text-lg tracking-tight">
            Quest Classroom
          </a>
          <div className="flex items-center gap-3">
            <a
              href="/Pricing"
              className="text-sm text-slate-600 hover:text-slate-900 hidden sm:inline"
            >
              Pricing
            </a>
            <button
              type="button"
              onClick={() => navigate("/SignIn?mode=signup&intent=classroom")}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm"
            >
              Start 7-day trial
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-12 text-center">
        <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase mb-4">
          For Teachers
        </span>
        <h1
          className="font-extrabold text-[#0F172A]"
          style={{
            fontSize: "clamp(36px, 5vw, 60px)",
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            marginBottom: 16,
          }}
        >
          Stop spending Sundays{" "}
          <em className="not-italic text-[#2563EB]">building lesson plans.</em>
        </h1>
        <p
          className="text-[18px] text-[#475569] max-w-2xl mx-auto"
          style={{ lineHeight: 1.55 }}
        >
          Quest Classroom turns a single learning standard into a full week of
          materials — quizzes, case studies, attention checks, and an AI
          Socratic tutor — in under two minutes.
        </p>
        <div className="flex flex-wrap justify-center items-center gap-3 mt-7">
          <button
            type="button"
            onClick={() => navigate("/SignIn?mode=signup&intent=classroom")}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[15px]"
          >
            Start 7-day free trial
            <ArrowRight size={16} />
          </button>
          <a
            href="/Try"
            className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#2563EB] text-[#0F172A] hover:text-[#2563EB] font-semibold text-[15px]"
          >
            Try the free YouTube tool
          </a>
        </div>
        <p className="text-[13px] text-[#64748B] mt-3">
          No card required. Cancel anytime.
        </p>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 py-10">
        <h2
          className="text-center font-bold text-[#0F172A]"
          style={{ fontSize: 30, marginBottom: 32, letterSpacing: "-0.02em" }}
        >
          Built for the way teachers actually work.
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {PROBLEMS.map((p) => (
            <div
              key={p.head}
              className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm"
            >
              <h3 className="font-bold text-[#0F172A] text-[17px] mb-2">
                {p.head}
              </h3>
              <p className="text-[14px] text-[#475569] leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase mb-3">
            What Classroom does
          </span>
          <h2
            className="font-bold text-[#0F172A]"
            style={{ fontSize: 36, letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            Everything you need.{" "}
            <em className="not-italic text-[#2563EB]">Nothing you don't.</em>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.head}
              className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm flex gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-[#DBEAFE] flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5 text-[#2563EB]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0F172A] text-[17px] mb-1.5">
                  {f.head}
                </h3>
                <p className="text-[14px] text-[#475569] leading-relaxed">
                  {f.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 py-12">
        <div
          className="rounded-3xl p-10 text-center"
          style={{
            background:
              "linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)",
            border: `2px solid #2563EB`,
          }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-[#DCFCE7] text-[#15803D] px-3 py-1 text-[11px] font-bold tracking-[0.06em] uppercase">
            <Sparkles size={12} /> Founding member pricing
          </span>
          <h2
            className="font-bold text-[#0F172A] mt-4"
            style={{ fontSize: 36, letterSpacing: "-0.02em" }}
          >
            $29/mo or $250/year
          </h2>
          <p className="text-[#64748B] text-[14px] mt-1">
            <span className="line-through">$49/mo · $399/year</span>{" "}
            standard pricing
          </p>
          <p className="text-[15px] text-[#475569] max-w-xl mx-auto mt-3">
            The first 100 paid Classroom accounts lock in founding-member
            pricing for life.
          </p>
          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            <button
              type="button"
              onClick={() => navigate("/SignIn?mode=signup&intent=classroom")}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[15px]"
            >
              Start 7-day free trial
              <ArrowRight size={16} />
            </button>
            <a
              href="/Pricing"
              className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#2563EB] text-[#0F172A] hover:text-[#2563EB] font-semibold text-[15px]"
            >
              Full comparison
            </a>
          </div>
        </div>
      </section>

      <section className="text-center py-16 px-6">
        <h2
          className="font-bold text-[#0F172A] mb-3"
          style={{ fontSize: 36, letterSpacing: "-0.02em" }}
        >
          Reclaim your Sundays.
        </h2>
        <p className="text-[#64748B] mb-6">
          Start your 7-day trial. No card required.
        </p>
        <button
          type="button"
          onClick={() => navigate("/SignIn?mode=signup&intent=classroom")}
          className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[15px]"
        >
          Start free trial
          <ArrowRight size={16} />
        </button>
      </section>

      <Footer />
    </div>
  );
}
