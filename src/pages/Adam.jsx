/**
 * Adam.jsx — a standalone personal site for Adam (Abduazim) Rakhmanov, served
 * at /adam. Public route (no auth, no app chrome) so it works as a shareable
 * bio link. Intentionally not linked anywhere in the app.
 *
 * Photo: `public/adam-photo.jpg` (falls back to "AR" monogram if missing).
 */
import React, { useEffect, useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  GraduationCap,
  Rocket,
  Mic,
  Landmark,
  Award,
  Sparkles,
  ArrowUpRight,
  Gavel,
  BookOpen,
  Microscope,
  Trophy,
  Users,
  Globe,
  Coins,
  Utensils,
  Languages,
  Puzzle,
  Code2,
  Linkedin,
  Search,
  Dumbbell,
} from "lucide-react";

// Logo tile with graceful fallback: shows image if it loads, else colored icon.
function Logo({ src, alt, icon: Icon, color = "text-indigo-600 bg-indigo-50", contain = true }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className={`w-11 h-11 rounded-xl border border-slate-200 bg-white ${contain ? "object-contain p-1.5" : "object-cover"}`}
      />
    );
  }
  return (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

const STATS = [
  { value: "35", label: "ACT Composite" },
  { value: "4.72 / 4.0", label: "Weighted GPA" },
  { value: "11 AP · 6 DE", label: "Advanced coursework" },
  { value: "Top 0.5%", label: "National Merit Semifinalist" },
];

const EXPERIENCE = [
  {
    logo: "/quest-logo-on-white.png",
    icon: Rocket,
    color: "text-indigo-600 bg-indigo-50",
    role: "Co-Founder",
    org: "Quest — Cognitive Sciences Learning Platform",
    period: "11th – 12th · 6 hrs/wk · 35 wks",
    points: [
      "Coded a platform bridging traditional instruction with cognitive sciences and AI.",
      "In talks with a county partnership set to reach 30,000+ learners.",
      "Led a 15-member team to create 100+ student resources reaching 100,000+ viewers.",
    ],
  },
  {
    icon: Code2,
    color: "text-blue-600 bg-blue-50",
    role: "State & Chapter Secretary",
    org: "Tennessee Technology Student Association (TSA)",
    period: "10th – 12th · 3 hrs/wk · 30 wks",
    points: [
      "Developed an interactive event selector tool used across the state association.",
      "Served 3,100 members across 87 chapters.",
      "Organized 10+ workshops for 300+ local chapter officers.",
    ],
  },
  {
    icon: Coins,
    color: "text-emerald-600 bg-emerald-50",
    role: "Director",
    org: "Wealth Education Initiative 501(c)(3)",
    period: "11th – 12th · 2 hrs/wk · 20 wks",
    points: [
      "Co-founded 2 chapters and led a team that advocated on the county committee.",
      "Helped change financial education policy affecting 14,000 students.",
      "Authored an eBook sent to 6 local high schools.",
    ],
  },
  {
    icon: Users,
    color: "text-rose-600 bg-rose-50",
    role: "VP of Roleplay Events (Chapter)",
    org: "Distributive Education Clubs of America (DECA)",
    period: "10th – 12th · 2 hrs/wk · 30 wks",
    points: [
      "Directed 400+ chapter members.",
      "Oversaw event logistics, registration, and fees.",
      "Coached students at competitions and ran a monthly workshop hub.",
    ],
  },
  {
    icon: Utensils,
    color: "text-amber-600 bg-amber-50",
    role: "Operations & Social Media Manager",
    org: "Salvo's Family Pizza & Pasta (family-owned)",
    period: "10th – 12th · 15 hrs/wk · 40 wks",
    points: [
      "Managed a 10+ member team, built schedules, and drove customer engagement.",
      "Grew socials to 17K followers across platforms via 1,000+ posts.",
      "25M+ total views across @salvoshermitage and @taste_ny_.",
    ],
  },
];

const LEADERSHIP = [
  {
    icon: Globe,
    color: "text-blue-600 bg-blue-50",
    role: "General Assembly Vice President",
    org: "YMCA Civic Engagement · Model United Nations",
    detail:
      "Coordinated a 700–900-delegate conference; chaired parliamentary debate for a 30-member committee, ensuring equitable participation and balanced speaking.",
  },
  {
    icon: Search,
    color: "text-indigo-600 bg-indigo-50",
    role: "Communications Director",
    org: "ScienceFinds",
    detail:
      "Built a searchable database of 200+ Nashville STEM professors, enabling 75+ students to find and connect with guest speakers.",
  },
  {
    icon: Mic,
    color: "text-violet-600 bg-violet-50",
    role: "Director",
    org: "Voice4You Podcast",
    detail:
      "Led a team that interviewed 15+ student leaders and generated 30,000+ social media views; built the podcast's website to expand its digital presence.",
  },
  {
    icon: Dumbbell,
    color: "text-slate-600 bg-slate-100",
    role: "Member",
    org: "Ravenwood Wrestling Team",
    detail:
      "Competed in 25+ matches. Received multiple regional-level awards while building discipline, resilience, and leadership through strenuous training.",
  },
  {
    icon: Microscope,
    color: "text-cyan-600 bg-cyan-50",
    role: "Member",
    org: "Science Olympiad",
    detail:
      "Competed in team-based STEM events including Dynamic Planet, Tower Building, and Disease Detectors, sharpening problem-solving and STEM expertise.",
  },
  {
    icon: Gavel,
    color: "text-amber-600 bg-amber-50",
    role: "Member",
    org: "Public Forum Debate",
    detail:
      "Partner-based debate on current-event topics. Conducted extensive research, built evidence-based arguments, and delivered persuasive speeches.",
  },
  {
    icon: BookOpen,
    color: "text-emerald-600 bg-emerald-50",
    role: "Community Service · 200 hours",
    org: "Salahadeen Center",
    detail:
      "Tutored 12 students in Arabic weekly; mentored youth and organized prayers and community events for 50+ members. Awarded for contributions.",
  },
];

const AWARDS = [
  "National Merit Semifinalist (top 0.5%)",
  "2× DECA ICDC Finalist — Quick Service Restaurant Management & Marketing Team Decision Making (top 1% of 25,000+ competitors)",
  "Breakthrough Junior Challenge Finalist — top 15 of 2,500 submissions",
  "6th Place, Data Science & Analytics — TSA Nationals",
  "Top 12, Biotechnology Design — TSA Nationals",
  "2× Tennessee DECA SCDC Finalist",
  "2× 1st Place — Virtual Business Challenge (TN DECA)",
  "1st Place — Biotechnology (TSA), Data Science (TSA), Geospatial Technologies (TSA)",
  "2nd Place — System Control Technology 2025 (TSA); Marketing Team Decision Making (TN DECA)",
  "3rd Place — System Control Technology 2024 (TSA)",
  "6th Place — Quick Service Restaurant Management (TN DECA)",
  "Award of Excellence — Local Salahadeen Center (<1%)",
  "2nd Place — EIC Final Pitch ($2,500 in funding)",
  "3rd Place — Cookeville Debate Tournament",
  "4th Place — Tower Building, Science Olympiad",
  "AP Scholar with Distinction",
  "2× Model UN Awards — Outstanding Delegate & Outstanding Resolution",
  "1st Place — Peach Cup Karate Tournament (3-state)",
  "1st Place — Wilson Central Wrestling; 3rd Place — SBA Wrestling",
];

const PROJECTS = [
  {
    name: "Quest Learning",
    link: "https://questlearning.co/",
    detail:
      "A cognitive-science-based educational platform for high school students and teachers. Tackles poor retention, ineffective traditional methods, shallow understanding, and excessive teacher prep — through six core features: spaced repetition, knowledge mapping, inquiry-based learning, integrated video learning, AI grading with automated feedback, and AI-powered curriculum building. An all-in-one personalized ecosystem that saves teacher time while adapting to each student.",
  },
  {
    name: "Biomedical Portfolio",
    detail:
      "Completed a three-year biomedical curriculum spanning foundational to advanced molecular techniques: DNA extraction, PCR, gene cloning, CRISPR editing, and advanced dissections. Explored molecular biology in diagnostics and personalized medicine via gene-expression analysis and microarray techniques. Designed, ran, and presented two independent Drosophila-model research projects investigating human health questions.",
  },
];

const AP_SCORES = [
  ["AP Precalculus", "5"],
  ["AP Chemistry", "5"],
  ["AP Physics 1", "5"],
  ["AP Lang & Composition", "5"],
  ["AP Calculus AB", "5"],
  ["AP Biology", "4"],
  ["AP World History", "4"],
  ["AP U.S. History", "4"],
  ["AP Calculus BC", "4"],
  ["AP Macroeconomics", "—"],
  ["AP Government", "—"],
];

const DE_COURSES = [
  "Topics in British Literature",
  "Topics in American Literature",
  "Art History Survey I",
  "Art History Survey II",
  "Multivariable Calculus",
  "Introduction to Linear Algebra",
];

const LANGUAGES = ["English", "Russian", "Arabic", "Uzbek"];

const HOBBIES = [
  "Rubik's cubes & strategic games (chess)",
  "Martial arts, calisthenics, rock climbing",
  "Traveling to new places",
];

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      {Icon && <Icon className="w-5 h-5 text-indigo-600" />}
      <h2 className="text-xl font-bold tracking-tight text-slate-900">{children}</h2>
      <div className="flex-1 h-px bg-slate-200 ml-2" />
    </div>
  );
}

// Hero avatar — dropped-in photo if present, else "AR" monogram.
function Avatar() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 ring-4 ring-white/10 flex items-center justify-center text-3xl font-extrabold text-white shrink-0">
        AR
      </div>
    );
  }
  return (
    <img
      src="/adam-photo.jpg"
      alt="Adam Rakhmanov"
      onError={() => setFailed(true)}
      className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white/10 shrink-0"
    />
  );
}

export default function Adam() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Adam Rakhmanov";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-800"
      style={{ fontFamily: '"Inter", system-ui, sans-serif' }}
    >
      {/* Hero */}
      <header className="relative overflow-hidden bg-slate-900 text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60% 80% at 20% 0%, #4f46e5 0%, transparent 60%), radial-gradient(50% 70% at 90% 20%, #7c3aed 0%, transparent 55%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-14">
          <div className="flex items-start gap-5">
            <Avatar />
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300 mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Builder · Operator · Student
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
                Adam Rakhmanov
              </h1>
              <p className="mt-1.5 text-indigo-200 font-medium">
                Co-Founder of Quest Learning · Ravenwood '26
              </p>
            </div>
          </div>

          <p className="mt-6 text-lg text-slate-300 leading-relaxed max-w-2xl">
            I build at the intersection of education, technology, and community —
            shipping an AI learning platform used by tens of thousands of students,
            running a family restaurant's operations, and competing at the top of
            national STEM and business competitions.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5 text-sm">
            <a
              href="mailto:adamrakhmanovit@gmail.com"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-4 py-2 backdrop-blur"
            >
              <Mail className="w-4 h-4" /> adamrakhmanovit@gmail.com
            </a>
            <a
              href="tel:+16157088786"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-4 py-2 backdrop-blur"
            >
              <Phone className="w-4 h-4" /> (615) 708-8786
            </a>
            <span className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 backdrop-blur">
              <MapPin className="w-4 h-4" /> Brentwood, TN
            </span>
            <a
              href="https://www.linkedin.com/in/adamrakhmanov/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-4 py-2 backdrop-blur"
            >
              <Linkedin className="w-4 h-4" /> LinkedIn <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Stats strip */}
      <div className="max-w-3xl mx-auto px-6 -mt-8 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center"
            >
              <div className="text-xl font-extrabold text-slate-900">{s.value}</div>
              <div className="text-[11px] font-medium text-slate-500 mt-1 leading-tight">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-14 space-y-14">
        {/* About */}
        <section>
          <SectionTitle icon={Sparkles}>About</SectionTitle>
          <p className="text-[15px] leading-relaxed text-slate-700">
            I'm a builder and operator drawn to problems that sit between people
            and systems. On any given week I'm shipping features for Quest
            Learning (an AI-powered platform grounded in cognitive science),
            running social and operations for a family restaurant that reaches
            millions of viewers, mentoring 300+ TSA chapter officers across
            Tennessee, and pushing county-level policy on financial education.
            My work is unified by a single instinct: turn a good idea into
            something a lot of people can actually use.
          </p>
        </section>

        {/* Experience */}
        <section>
          <SectionTitle icon={Rocket}>Experience</SectionTitle>
          <div className="space-y-4">
            {EXPERIENCE.map((e) => (
              <div
                key={e.org}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
              >
                <div className="flex items-start gap-4">
                  <Logo src={e.logo} alt={e.org} icon={e.icon} color={e.color} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="font-bold text-slate-900">{e.role}</h3>
                      <span className="text-xs font-medium text-slate-400">{e.period}</span>
                    </div>
                    <p className="text-sm font-semibold text-indigo-600">{e.org}</p>
                    <ul className="mt-3 space-y-1.5">
                      {e.points.map((p, i) => (
                        <li key={i} className="text-sm text-slate-600 leading-relaxed flex gap-2">
                          <span className="mt-2 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Leadership & Service */}
        <section>
          <SectionTitle icon={Landmark}>Leadership &amp; Service</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            {LEADERSHIP.map((l) => (
              <div
                key={l.org}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${l.color}`}>
                    <l.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">{l.role}</h3>
                    <p className="text-xs font-semibold text-indigo-600 mb-2">{l.org}</p>
                    <p className="text-[13px] text-slate-600 leading-relaxed">{l.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Awards */}
        <section>
          <SectionTitle icon={Trophy}>Honors &amp; Awards</SectionTitle>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <ul className="space-y-2.5">
              {AWARDS.map((a, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
                  <Award className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Projects */}
        <section>
          <SectionTitle icon={Sparkles}>Selected Projects</SectionTitle>
          <div className="grid gap-3">
            {PROJECTS.map((p) => (
              <div
                key={p.name}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
              >
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <h3 className="font-bold text-slate-900">{p.name}</h3>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Visit <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <p className="text-[13.5px] text-slate-600 leading-relaxed">{p.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Education */}
        <section>
          <SectionTitle icon={GraduationCap}>Education</SectionTitle>
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <Logo src={null} alt="Ravenwood High School" icon={GraduationCap} color="text-slate-600 bg-slate-100" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="font-bold text-slate-900">Ravenwood High School</h3>
                    <span className="text-xs font-medium text-slate-400">Class of 2026</span>
                  </div>
                  <p className="text-sm font-semibold text-indigo-600">Brentwood, TN</p>
                  <p className="text-sm text-slate-600 mt-2">
                    4.72 / 4.0 weighted GPA · 35 ACT · 1480 PSAT · 11 AP courses and 6 dual-enrollment courses (incl. Multivariable Calculus and Linear Algebra).
                  </p>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {AP_SCORES.map(([course, score]) => (
                      <div
                        key={course}
                        className="flex items-center justify-between text-[12px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="text-slate-600 truncate pr-2">{course}</span>
                        <span className="font-bold text-slate-900">{score}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {DE_COURSES.map((c) => (
                      <span
                        key={c}
                        className="inline-flex text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-1"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <Logo src={null} alt="Azhar University" icon={GraduationCap} color="text-emerald-600 bg-emerald-50" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="font-bold text-slate-900">Azhar University</h3>
                    <span className="text-xs font-medium text-slate-400">2021 — 2023</span>
                  </div>
                  <p className="text-sm font-semibold text-indigo-600">Cairo, Egypt</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Languages & Hobbies */}
        <section>
          <SectionTitle icon={Languages}>Languages &amp; Interests</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Languages className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Languages</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((l) => (
                  <span
                    key={l}
                    className="inline-flex text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-full px-3 py-1"
                  >
                    {l}
                  </span>
                ))}
              </div>
              <p className="text-[12px] text-slate-500 mt-2">Fluent and articulate in all four.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Puzzle className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Hobbies &amp; Skills</h3>
              </div>
              <ul className="space-y-1.5">
                {HOBBIES.map((h) => (
                  <li key={h} className="text-[13px] text-slate-600 leading-relaxed flex gap-2">
                    <span className="mt-2 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>© 2026 Adam Rakhmanov</span>
          <div className="flex items-center gap-4">
            <a href="mailto:adamrakhmanovit@gmail.com" className="hover:text-slate-900 inline-flex items-center gap-1.5">
              <Mail className="w-4 h-4" /> Email
            </a>
            <a
              href="https://www.linkedin.com/in/adamrakhmanov/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-900 inline-flex items-center gap-1.5"
            >
              <Linkedin className="w-4 h-4" /> LinkedIn
            </a>
            <a
              href="https://www.questlearning.co"
              className="hover:text-slate-900 inline-flex items-center gap-1.5"
            >
              Quest Learning <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
