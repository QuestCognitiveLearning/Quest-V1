/**
 * Studio.jsx — long-form landing page targeting tutors and tutoring
 * businesses. Compact 5-section structure (hero, problem, features,
 * pricing teaser, final CTA) — the full 12-section spec is a follow-up.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, Sparkles, FileText, Mail, Palette, Calendar } from "lucide-react";
import Footer from "@/components/landing/v3/Footer";

const C = {
  paper: "#EEF3FB",
  ink: "#0F172A",
  ink2: "#475569",
  muted: "#64748B",
  brand: "#2563EB",
  brandDeep: "#1D4ED8",
  brandSoft: "#DBEAFE",
  line: "#E2E8F0",
};
const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

const PROBLEMS = [
  {
    head: "Session prep eats your evening.",
    body:
      "Pulling worksheets, scoping topics, writing fresh practice — you spend 30+ min per student before the session starts.",
  },
  {
    head: "Parent communication is a part-time job.",
    body:
      "Parents want to know what their kid worked on. You want to teach. Manual recap emails kill your hourly rate.",
  },
  {
    head: "You look like a freelancer, not a professional.",
    body:
      "Generic Google Docs and screenshots from textbooks signal to parents that you're winging it. Branded packets change the conversation.",
  },
];

const FEATURES = [
  {
    icon: FileText,
    head: "Branded session packets",
    body:
      "Every quiz, case study, and worksheet downloads with your logo, business name, brand color, and contact info. Hand them to parents at pickup — they look like a $200/hour package.",
  },
  {
    icon: Mail,
    head: "Automated parent progress reports",
    body:
      "After each session (or weekly on a schedule), Studio sends parents a branded PDF: topics covered, strengths, areas to practice, plus 3 questions to ask their kid this week. You're cc'd.",
  },
  {
    icon: Sparkles,
    head: "AI session prep",
    body:
      "Paste a YouTube video or topic, and Quest builds a quiz, case study, and inquiry session in 90 seconds. Edit anything. Regenerate anything. Then teach.",
  },
  {
    icon: Palette,
    head: "1-on-1 AI Panda Tutor",
    body:
      "When you're not in session, the Panda Tutor handles practice questions Socratically — your students get unlimited support without you on the call.",
  },
  {
    icon: Calendar,
    head: "Multi-subject session builder",
    body:
      "Studio handles math, ELA, science, test prep, and AP courses in one place. Switch subjects mid-session without losing context.",
  },
  {
    icon: ArrowRight,
    head: "Booking link (Calendly integration)",
    body:
      "Drop your Calendly link into Quest and parents can self-schedule. Native booking is on the roadmap.",
  },
];

export default function Studio() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: FONT, background: C.paper, color: C.ink, minHeight: "100vh" }}>
      {/* Sticky nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-[1200px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <a href="/" className="font-bold text-slate-900 text-lg tracking-tight">
            Quest Studio
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
              onClick={() => navigate("/SignIn?mode=signup&intent=studio")}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm"
            >
              Start 14-day trial
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-12 text-center">
        <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase mb-4">
          For Tutors &amp; Tutoring Businesses
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
          Look like a $200/hour tutor{" "}
          <em className="not-italic text-[#2563EB]">without the prep time.</em>
        </h1>
        <p
          className="text-[18px] text-[#475569] max-w-2xl mx-auto"
          style={{ lineHeight: 1.55 }}
        >
          Quest Studio prepares personalized sessions before you walk in, runs
          an AI Socratic tutor alongside you while you teach, and sends branded
          parent progress reports automatically after every session.
        </p>
        <div className="flex flex-wrap justify-center items-center gap-3 mt-7">
          <button
            type="button"
            onClick={() => navigate("/SignIn?mode=signup&intent=studio")}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[15px]"
          >
            Start 14-day free trial
            <ArrowRight size={16} />
          </button>
          <a
            href="/Pricing"
            className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#2563EB] text-[#0F172A] hover:text-[#2563EB] font-semibold text-[15px]"
          >
            See pricing
          </a>
        </div>
        <p className="text-[13px] text-[#64748B] mt-3">
          No card required. Cancel anytime.
        </p>
      </section>

      {/* PROBLEM */}
      <section className="max-w-[1100px] mx-auto px-6 py-10">
        <h2
          className="text-center font-bold text-[#0F172A]"
          style={{ fontSize: 30, marginBottom: 32, letterSpacing: "-0.02em" }}
        >
          What every tutor we talked to said hurts.
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

      {/* FEATURES */}
      <section className="max-w-[1100px] mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase mb-3">
            What Studio does
          </span>
          <h2
            className="font-bold text-[#0F172A]"
            style={{ fontSize: 36, letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            The whole toolkit.{" "}
            <em className="not-italic text-[#2563EB]">In one tab.</em>
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

      {/* PRICING TEASER */}
      <section className="max-w-[1100px] mx-auto px-6 py-12">
        <div
          className="rounded-3xl p-10 text-center"
          style={{
            background:
              "linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)",
            border: `2px solid ${C.brand}`,
          }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-[#DCFCE7] text-[#15803D] px-3 py-1 text-[11px] font-bold tracking-[0.06em] uppercase">
            <Sparkles size={12} /> Founding member pricing
          </span>
          <h2
            className="font-bold text-[#0F172A] mt-4"
            style={{ fontSize: 36, letterSpacing: "-0.02em" }}
          >
            $59/mo or $499/year
          </h2>
          <p className="text-[#64748B] text-[14px] mt-1">
            <span className="line-through">$99/mo · $799/year</span> &nbsp; standard
            pricing
          </p>
          <p className="text-[15px] text-[#475569] max-w-xl mx-auto mt-3">
            Lock in this price for life. The first 100 paid Studio accounts
            keep founding pricing even after standard rates apply.
          </p>
          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            <button
              type="button"
              onClick={() => navigate("/SignIn?mode=signup&intent=studio")}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[15px]"
            >
              Start 14-day free trial
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

      {/* FOUNDER CALL CALLOUT */}
      <section className="max-w-[900px] mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-7 flex flex-wrap items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[#DBEAFE] flex items-center justify-center text-[#2563EB] font-bold text-xl shrink-0">
            Q
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#0F172A] text-[17px] mb-1">
              Every Studio signup includes a 30-minute call with the founder.
            </h3>
            <p className="text-[14px] text-[#475569] leading-relaxed">
              We'll set up your branding, import your first student, and run
              your first session together. {/* TODO: replace with real founder photo + name */}
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="text-center py-16 px-6">
        <h2
          className="font-bold text-[#0F172A] mb-3"
          style={{ fontSize: 36, letterSpacing: "-0.02em" }}
        >
          Start your 14-day trial.
        </h2>
        <p className="text-[#64748B] mb-6">
          No card required. Cancel anytime before day 14.
        </p>
        <button
          type="button"
          onClick={() => navigate("/SignIn?mode=signup&intent=studio")}
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
