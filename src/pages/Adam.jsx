/**
 * Adam.jsx — a standalone personal site for Adam (Abduazim) Rakhmanov, served
 * at /adam. Public route (no auth, no app chrome) so it works as a shareable
 * bio link. Intentionally not linked anywhere in the app.
 *
 * Visual language matches the Quest Learning landing (blue #2563EB accent,
 * slate text, #EEF3FB header band, white cards on light background — no
 * gradients, no purple).
 *
 * Photo: `public/adam-photo.jpg` (falls back to "AR" monogram if missing).
 */
import React, { useEffect, useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Linkedin,
  ArrowUpRight,
} from "lucide-react";

const BLUE = "#2563EB";
const BLUE_HOVER = "#1D4ED8";
const INK = "#0F172A";
const BODY = "#475569";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const BAND = "#EEF3FB";

// -----------------------------------------------------------------------------
// Content
// -----------------------------------------------------------------------------

const STATS = [
  { value: "35", label: "ACT Composite" },
  { value: "4.72 / 4.0", label: "Weighted GPA" },
  { value: "11 AP · 6 DE", label: "Advanced coursework" },
  { value: "Top 0.5%", label: "National Merit Semifinalist" },
];

const EXPERIENCE = [
  {
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
    role: "General Assembly Vice President",
    org: "YMCA Civic Engagement · Model United Nations",
    detail:
      "Coordinated a 700–900-delegate conference; chaired parliamentary debate for a 30-member committee, ensuring equitable participation and balanced speaking.",
  },
  {
    role: "Communications Director",
    org: "ScienceFinds",
    detail:
      "Built a searchable database of 200+ Nashville STEM professors, enabling 75+ students to find and connect with guest speakers.",
  },
  {
    role: "Director",
    org: "Voice4You Podcast",
    detail:
      "Led a team that interviewed 15+ student leaders and generated 30,000+ social media views; built the podcast's website to expand its digital presence.",
  },
  {
    role: "Member",
    org: "Ravenwood Wrestling Team",
    detail:
      "Competed in 25+ matches. Received multiple regional-level awards while building discipline, resilience, and leadership through strenuous training.",
  },
  {
    role: "Member",
    org: "Science Olympiad",
    detail:
      "Competed in team-based STEM events including Dynamic Planet, Tower Building, and Disease Detectors, sharpening problem-solving and STEM expertise.",
  },
  {
    role: "Member",
    org: "Public Forum Debate",
    detail:
      "Partner-based debate on current-event topics. Conducted extensive research, built evidence-based arguments, and delivered persuasive speeches.",
  },
  {
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
      "A cognitive-science-based educational platform for high school students and teachers. Tackles poor retention, ineffective traditional methods, shallow understanding, and excessive teacher prep — through six core features: spaced repetition, knowledge mapping, inquiry-based learning, integrated video learning, AI grading with automated feedback, and AI-powered curriculum building.",
  },
  {
    name: "Biomedical Portfolio",
    detail:
      "Completed a three-year biomedical curriculum spanning foundational to advanced molecular techniques: DNA extraction, PCR, gene cloning, CRISPR editing, and advanced dissections. Explored molecular biology in diagnostics and personalized medicine via gene-expression analysis and microarray techniques. Designed, ran, and presented two independent Drosophila-model research projects.",
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

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

function Eyebrow({ children }) {
  return (
    <div
      className="text-[10.5px] font-semibold tracking-[0.14em] uppercase"
      style={{ color: BLUE }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="mb-8">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        className="mt-2 font-extrabold tracking-tight"
        style={{
          color: INK,
          fontSize: "clamp(22px, 2.6vw, 30px)",
          letterSpacing: "-0.025em",
          lineHeight: 1.15,
        }}
      >
        {title}
      </h2>
      {description && (
        <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: BODY }}>
          {description}
        </p>
      )}
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-2xl border p-6 ${className}`}
      style={{ borderColor: BORDER, boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.04)" }}
    >
      {children}
    </div>
  );
}

function Avatar() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="w-28 h-28 rounded-2xl flex items-center justify-center text-3xl font-extrabold text-white shrink-0"
        style={{ backgroundColor: BLUE }}
      >
        AR
      </div>
    );
  }
  return (
    <img
      src="/adam-photo.jpg"
      alt="Adam Rakhmanov"
      onError={() => setFailed(true)}
      className="w-28 h-28 rounded-2xl object-cover shrink-0 border"
      style={{ borderColor: BORDER }}
    />
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

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
      className="min-h-screen"
      style={{
        backgroundColor: "#F8FAFC",
        color: INK,
        fontFamily:
          '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* ================================================================= */}
      {/* Hero band                                                          */}
      {/* ================================================================= */}
      <header style={{ backgroundColor: BAND, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-[900px] mx-auto px-6 pt-14 pb-16">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <Avatar />
            <div className="min-w-0 flex-1">
              <Eyebrow>Personal Site · Class of 2026</Eyebrow>
              <h1
                className="mt-2 font-extrabold tracking-tight"
                style={{
                  color: INK,
                  fontSize: "clamp(34px, 4.6vw, 48px)",
                  letterSpacing: "-0.035em",
                  lineHeight: 1.02,
                }}
              >
                Adam Rakhmanov
              </h1>
              <p
                className="mt-2 text-[15.5px] font-medium"
                style={{ color: BLUE }}
              >
                Co-Founder of Quest Learning · Ravenwood High School
              </p>
              <p
                className="mt-4 text-[15px] leading-relaxed max-w-[560px]"
                style={{ color: BODY }}
              >
                Builder and operator working across education, technology, and
                community — from shipping an AI learning platform to running a
                family restaurant's operations and mentoring 300+ TSA officers
                across Tennessee.
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-[13px]">
                <ContactPill
                  href="mailto:adamrakhmanovit@gmail.com"
                  icon={Mail}
                  label="adamrakhmanovit@gmail.com"
                />
                <ContactPill
                  href="tel:+16157088786"
                  icon={Phone}
                  label="(615) 708-8786"
                />
                <ContactPill icon={MapPin} label="Brentwood, TN" static />
                <ContactPill
                  href="https://www.linkedin.com/in/adamrakhmanov/"
                  icon={Linkedin}
                  label="LinkedIn"
                  external
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* Stats row                                                          */}
      {/* ================================================================= */}
      <div className="max-w-[900px] mx-auto px-6 -mt-8 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl border p-4 text-center"
              style={{
                borderColor: BORDER,
                boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
              }}
            >
              <div
                className="text-[20px] font-extrabold"
                style={{ color: INK, letterSpacing: "-0.02em" }}
              >
                {s.value}
              </div>
              <div
                className="text-[11px] font-medium mt-1 leading-tight"
                style={{ color: MUTED }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================= */}
      {/* Main                                                               */}
      {/* ================================================================= */}
      <main className="max-w-[900px] mx-auto px-6 py-16 space-y-16">
        {/* Experience */}
        <section>
          <SectionHeader
            eyebrow="Experience"
            title="Building, leading, operating."
            description="What I've worked on across school, community, and family business."
          />
          <div className="space-y-3">
            {EXPERIENCE.map((e) => (
              <Card key={e.org}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3
                    className="font-bold text-[15.5px]"
                    style={{ color: INK }}
                  >
                    {e.role}
                  </h3>
                  <span
                    className="text-[12px] font-medium"
                    style={{ color: MUTED }}
                  >
                    {e.period}
                  </span>
                </div>
                <p
                  className="mt-0.5 text-[13.5px] font-semibold"
                  style={{ color: BLUE }}
                >
                  {e.org}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {e.points.map((p, i) => (
                    <li
                      key={i}
                      className="text-[14px] leading-relaxed flex gap-2.5"
                      style={{ color: BODY }}
                    >
                      <span
                        className="mt-[9px] w-1 h-1 rounded-full shrink-0"
                        style={{ backgroundColor: BORDER }}
                      />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        {/* Leadership & Service */}
        <section>
          <SectionHeader
            eyebrow="Leadership & Service"
            title="Where else I show up."
          />
          <div className="grid sm:grid-cols-2 gap-3">
            {LEADERSHIP.map((l) => (
              <Card key={l.org} className="!p-5">
                <h3
                  className="font-bold text-[14px] leading-snug"
                  style={{ color: INK }}
                >
                  {l.role}
                </h3>
                <p
                  className="text-[12.5px] font-semibold mt-0.5"
                  style={{ color: BLUE }}
                >
                  {l.org}
                </p>
                <p
                  className="mt-2 text-[13px] leading-relaxed"
                  style={{ color: BODY }}
                >
                  {l.detail}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* Projects */}
        <section>
          <SectionHeader
            eyebrow="Projects"
            title="Selected work."
          />
          <div className="grid gap-3">
            {PROJECTS.map((p) => (
              <Card key={p.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-bold text-[15.5px]" style={{ color: INK }}>
                    {p.name}
                  </h3>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold"
                      style={{ color: BLUE }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = BLUE_HOVER)
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.color = BLUE)}
                    >
                      Visit <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <p
                  className="mt-2 text-[13.5px] leading-relaxed"
                  style={{ color: BODY }}
                >
                  {p.detail}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* Honors & Awards */}
        <section>
          <SectionHeader
            eyebrow="Honors & Awards"
            title="Recognition."
          />
          <Card>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {AWARDS.map((a, i) => (
                <li
                  key={i}
                  className="text-[13.5px] leading-relaxed flex gap-2.5"
                  style={{ color: BODY }}
                >
                  <span
                    className="mt-[9px] w-1 h-1 rounded-full shrink-0"
                    style={{ backgroundColor: BLUE }}
                  />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Education */}
        <section>
          <SectionHeader
            eyebrow="Education"
            title="Coursework and academics."
          />
          <div className="space-y-3">
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-bold text-[15.5px]" style={{ color: INK }}>
                  Ravenwood High School
                </h3>
                <span
                  className="text-[12px] font-medium"
                  style={{ color: MUTED }}
                >
                  Class of 2026
                </span>
              </div>
              <p
                className="mt-0.5 text-[13.5px] font-semibold"
                style={{ color: BLUE }}
              >
                Brentwood, TN
              </p>
              <p
                className="mt-3 text-[14px] leading-relaxed"
                style={{ color: BODY }}
              >
                4.72 / 4.0 weighted GPA · 35 ACT · 1480 PSAT · 11 AP courses and
                6 dual-enrollment courses (including Multivariable Calculus and
                Linear Algebra).
              </p>

              <div className="mt-5">
                <div
                  className="text-[11px] font-semibold tracking-[0.12em] uppercase mb-2"
                  style={{ color: MUTED }}
                >
                  AP Scores
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {AP_SCORES.map(([course, score]) => (
                    <div
                      key={course}
                      className="flex items-center justify-between text-[12.5px] rounded-lg px-2.5 py-1.5 border"
                      style={{
                        borderColor: BORDER,
                        backgroundColor: "#F8FAFC",
                      }}
                    >
                      <span className="truncate pr-2" style={{ color: BODY }}>
                        {course}
                      </span>
                      <span className="font-bold" style={{ color: INK }}>
                        {score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <div
                  className="text-[11px] font-semibold tracking-[0.12em] uppercase mb-2"
                  style={{ color: MUTED }}
                >
                  Dual-Enrollment
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DE_COURSES.map((c) => (
                    <span
                      key={c}
                      className="inline-flex text-[11.5px] font-medium rounded-full px-2.5 py-1 border"
                      style={{
                        color: BLUE,
                        backgroundColor: "#EFF6FF",
                        borderColor: "#DBEAFE",
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-bold text-[15.5px]" style={{ color: INK }}>
                  Azhar University
                </h3>
                <span
                  className="text-[12px] font-medium"
                  style={{ color: MUTED }}
                >
                  2021 — 2023
                </span>
              </div>
              <p
                className="mt-0.5 text-[13.5px] font-semibold"
                style={{ color: BLUE }}
              >
                Cairo, Egypt
              </p>
            </Card>
          </div>
        </section>

        {/* Languages & Interests */}
        <section>
          <SectionHeader
            eyebrow="Languages & Interests"
            title="Outside the resume."
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Card>
              <div
                className="text-[11px] font-semibold tracking-[0.12em] uppercase mb-3"
                style={{ color: MUTED }}
              >
                Languages
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((l) => (
                  <span
                    key={l}
                    className="inline-flex text-[12.5px] font-medium rounded-full px-3 py-1 border"
                    style={{
                      color: INK,
                      backgroundColor: "#F8FAFC",
                      borderColor: BORDER,
                    }}
                  >
                    {l}
                  </span>
                ))}
              </div>
              <p className="text-[12px] mt-3" style={{ color: MUTED }}>
                Fluent and articulate in all four.
              </p>
            </Card>
            <Card>
              <div
                className="text-[11px] font-semibold tracking-[0.12em] uppercase mb-3"
                style={{ color: MUTED }}
              >
                Hobbies & Skills
              </div>
              <ul className="space-y-1.5">
                {HOBBIES.map((h) => (
                  <li
                    key={h}
                    className="text-[13.5px] leading-relaxed flex gap-2.5"
                    style={{ color: BODY }}
                  >
                    <span
                      className="mt-[9px] w-1 h-1 rounded-full shrink-0"
                      style={{ backgroundColor: BORDER }}
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>
      </main>

      {/* ================================================================= */}
      {/* Footer                                                             */}
      {/* ================================================================= */}
      <footer
        style={{ backgroundColor: "white", borderTop: `1px solid ${BORDER}` }}
      >
        <div className="max-w-[900px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <span style={{ color: MUTED }}>© 2026 Adam Rakhmanov</span>
          <div className="flex items-center gap-5">
            <FooterLink href="mailto:adamrakhmanovit@gmail.com" icon={Mail}>
              Email
            </FooterLink>
            <FooterLink
              href="https://www.linkedin.com/in/adamrakhmanov/"
              icon={Linkedin}
              external
            >
              LinkedIn
            </FooterLink>
            <FooterLink href="https://www.questlearning.co" icon={ExternalLink}>
              Quest Learning
            </FooterLink>
          </div>
        </div>
      </footer>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Small components
// -----------------------------------------------------------------------------

function ContactPill({ href, icon: Icon, label, external, static: isStatic }) {
  const inner = (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 border transition-colors"
      style={{
        color: INK,
        backgroundColor: "white",
        borderColor: BORDER,
      }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: BLUE }} />
      {label}
      {external && <ArrowUpRight className="w-3 h-3" style={{ color: MUTED }} />}
    </span>
  );
  if (isStatic || !href) return inner;
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="focus:outline-none"
    >
      {inner}
    </a>
  );
}

function FooterLink({ href, icon: Icon, external, children }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex items-center gap-1.5 transition-colors"
      style={{ color: MUTED }}
      onMouseEnter={(e) => (e.currentTarget.style.color = INK)}
      onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </a>
  );
}
