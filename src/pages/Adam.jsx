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
  { value: "Duke '30", label: "Neuroscience & CS" },
  { value: "Top 0.5%", label: "National Merit Finalist" },
];

const EXPERIENCE = [
  {
    role: "Co-Founder",
    org: "Quest Learning",
    period: "Jul 2024 – Present",
    points: [
      "Co-founded Quest, an education platform that integrates cognitive-science principles — spaced repetition, multimodal learning, and scaffolding — to make learning more intuitive, efficient, and accessible.",
      "Leveraged AI to streamline curriculum development, generating high-quality instructional materials in seconds instead of hours.",
      "Led a 15-member team to develop 100+ neuroscience-based learning resources and built a digital presence with 110,000+ views.",
      "Currently in discussions with Williamson County Schools to bring Quest's tools to 42,000+ students.",
    ],
  },
  {
    role: "TN TSA State Secretary",
    org: "Technology Student Association",
    period: "Jun 2025 – Present",
    points: [
      "Led initiatives supporting 3,100 members across 87 chapters; grew chapter membership by 90%.",
      "Managed communications reaching 100K+ views across the state association.",
      "Developed an event-selector tool to optimize onboarding for new members.",
    ],
  },
  {
    role: "Vice President of Roleplay Events (Chapter)",
    org: "DECA Inc.",
    period: "Jun 2024 – Present",
    points: [
      "Led and mentored 300+ DECA members, guiding them through competitive events, business concepts, and professional development.",
      "Organized chapter-wide activities and managed student coordination during regional and state competitions.",
      "Built a comprehensive resource hub and ran monthly skill-focused workshops to optimize member performance and engagement.",
    ],
  },
  {
    role: "Software Engineer in Test",
    org: "Novalab Tech",
    period: "May 2022 – Jan 2023",
    points: [
      "Built and executed automated test suites across front-end, back-end, and API layers for two enterprise products — including datatruck.io — using Selenium (Java) and the Cucumber framework.",
      "Wrote smoke and regression tests as part of open-source contributions inside an Agile workflow to support continuous delivery.",
      "Authored and maintained well-organized, efficient manual test cases used across the QA team.",
    ],
  },
  {
    role: "Manager",
    org: "Salvo's Pizza (family-owned)",
    period: "Oct 2020 – Present",
    points: [
      "Drove 25M+ views and built a community of 17,000 followers while producing 1,000+ content pieces.",
      "Managed and trained 10+ staff, overseeing quality control, workflow optimization, and day-to-day operations.",
      "Focused on building meaningful, personal connections with every customer while leading the team to deliver exceptional service.",
    ],
  },
  {
    role: "Director",
    org: "Wealth Education Initiative",
    period: "Dec 2023 – Present",
    points: [
      "Founded and led two chapters with 100+ members, expanding access to practical financial literacy for students.",
      "As part of the County Financial Committee, advocated to shape district financial-education policy, serving 20,000+ students.",
      "Authored an educational eBook distributed to 6 high schools and read by 200+ students; built an engaged community of 500+ followers.",
    ],
  },
];

const ENTREPRENEURSHIP = {
  role: "Entrepreneurship & Innovation Center (EIC) · INCubatoredu",
  detail:
    "Currently part of my county's Entrepreneurship & Innovation Center, a chapter of the national INCubatoredu program. Mentored by Clay Banks (Shark Tank participant and serial entrepreneur), I was invited to pitch at the Nashville Entrepreneurship Center — where I presented to the adult cohort as an example of effective pitching.",
};

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
      "Led outreach and speaker coordination for a school STEM club, connecting 75+ students with 200+ Nashville STEM professors as guest speakers.",
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
      "Tutored 12 students in Arabic weekly; mentored youth and organized prayers and community events for 50+ members. Received an award for contributions.",
  },
];

const AWARDS = [
  "DECA International Career Development Conference (ICDC) — 2× International Finalist (top 1% of 25,000+ competitors)",
  "Breakthrough Junior Challenge Finalist — top 15 of 2,500+ international submissions in global science communication (2025)",
  "TSA Nationals — 6th, Data Science & Analytics · Top 12, Biotechnology Design · 3× 1st-Place State Titles (Biotechnology, Data Science, Geospatial Technologies)",
  "EIC Final Pitch — selected as one of the companies to pitch for the EIC; received $2,500 in funding",
  "2× Tennessee DECA SCDC Finalist",
  "2× 1st Place — Virtual Business Challenge (TN DECA)",
  "2nd Place — System Control Technology 2025 (TSA); Marketing Team Decision Making (TN DECA)",
  "3rd Place — System Control Technology 2024 (TSA)",
  "6th Place — Quick Service Restaurant Management (TN DECA)",
  "Award of Excellence — Local Salahadeen Center (<1%)",
  "3rd Place — Cookeville Debate Tournament",
  "4th Place — Tower Building, Science Olympiad",
  "AP Scholar with Distinction",
  "2× Model UN Awards — Outstanding Delegate & Outstanding Resolution",
  "1st Place — Peach Cup Karate Tournament (3-state)",
  "1st Place — Wilson Central Wrestling; 3rd Place — SBA Wrestling",
];

const LANGUAGES = ["English", "Russian", "Arabic", "Uzbek"];

const HOBBIES = [
  "Rubik's cubes & strategic games (chess)",
  "Martial arts, calisthenics, rock climbing",
  "Traveling to new places",
];

const PROJECTS = [
  {
    name: "Quest Learning",
    link: "https://questlearning.co/",
    detail:
      "An ed-tech platform my co-founder and I built that turns state standards into ready-to-teach lessons — hooks, videos, adaptive quizzes, AP-style case studies — in minutes, each engineered around cognitive-science and neuroscience principles like spaced repetition, scaffolding, and multimodal learning so students actually retain what they study. A teacher enters a standard, an Edge Function orchestrates and optimizes the model calls to build a neuroscience-backed lesson, and the Common Standards Project API maps everything back to the correct state standard so content stays aligned.",
    stack: [
      "React + Vite",
      "Supabase (Postgres / Auth / Edge Functions)",
      "OpenAI",
      "Stripe",
      "Common Standards Project API",
      "Vercel",
    ],
  },
  {
    name: "Unitywall Internal Profit Analysis Tool",
    link: "https://unitydashboard.vercel.app/",
    detail:
      "An internal business-intelligence platform that decouples client-facing quotes from true cost analysis — tracking labor hours, profit margins, team satisfaction, and client difficulty across every project. Runs multi-variable filters over historical project data to flag where estimated hours diverged from actual, with a lessons-learned system and a competitive pricing analyzer built to optimize rates across freelancer, agency, and enterprise tiers.",
    stack: ["React", "Next.js", "Node.js", "Vercel"],
  },
  {
    name: "ExerciseBud",
    detail:
      "A cross-platform (iOS + Android) fitness companion app built in React Native and Expo. Syncs native step data from Apple HealthKit and Google Health Connect, generates personalized 4-week workout plans with GPT-4-turbo from a guided intake form, and layers in a social system of friend requests and a step leaderboard, plus an animated guided-breathing meditation. A MongoDB Atlas backend stores users, plans, and activity; a custom AuthContext state machine with on-device secure storage handles sign-in; and an AppState listener tracks presence to power \"online now\" signals on the leaderboard.",
    stack: [
      "React Native 0.73",
      "Expo SDK 50",
      "React Navigation 6",
      "react-native-health / health-connect",
      "MongoDB Atlas Data API",
      "OpenAI (GPT-4-turbo)",
      "expo-secure-store",
    ],
  },
  {
    name: "TN TSA Event Selector",
    link: "https://tntsaeventselector.com",
    detail:
      "An event selector that matches TSA members to competitive events based on their strengths and interests — built for the 4,000-member Technology Student Association. Users answer a short questionnaire, and a scoring model ranks the available TSA events against their responses to optimize matching and surface the best-fit events.",
  },
  {
    name: "Wealth Education Initiative Website",
    link: "https://www.wealthedinitiative.com",
    detail:
      "The website for the 501(c)(3) I co-founded — the central hub for our chapters, resources, and eBook. YouTube and Instagram integrations pull our latest content directly into the site, a Google Maps integration plots and showcases our chapters across the district, and interactive UI elements throughout keep students engaged.",
    stack: [
      "React",
      "Vite",
      "Tailwind CSS",
      "Google Maps JS API",
      "YouTube / Instagram embeds",
      "Vercel",
    ],
  },
  {
    name: "Vanderbilt Professor Scraper",
    detail:
      "A scraping algorithm I built with Selenium (Java) and Apache POI to find professors at Vanderbilt Medical Center to invite as guest speakers for my school's ScienceFinds club. Selenium drives the browser to crawl faculty directory pages and pull names, departments, and contact details — automating a search that would otherwise take hours — while Apache POI writes the results into a structured Excel sheet. The resulting searchable database of 200+ professors enabled 75+ students to find and connect with guest speakers.",
    stack: ["Selenium (Java)", "Apache POI", "Google Sheets"],
  },
  {
    name: "Biomedical Research",
    detail:
      "Across a three-year biomedical curriculum I ran hands-on molecular work — DNA extraction, PCR, gene cloning, CRISPR editing — and designed, conducted, and presented two independent research projects using Drosophila models to investigate human-health questions.",
  },
  {
    name: "Stylize",
    link: "https://stylize.base44.app",
    detail:
      "A small personal project that optimizes an outfit for me every morning based on color theory and the weather — because I hated picking clothes. It pulls the day's local forecast from a weather API and applies color-theory rules to my wardrobe to assemble a coordinated outfit.",
  },
];

const EDUCATION = [
  {
    school: "Duke University",
    location: "Neuroscience & CS",
    period: "Fall 2026 – Spring 2030",
  },
  {
    school: "Ravenwood High School",
    location: "Brentwood, TN",
    period: "Class of 2026",
    detail:
      "4.72 / 4.0 weighted GPA · 35 ACT · 1480 PSAT · 11 AP courses and 6 dual-enrollment courses (including Multivariable Calculus and Linear Algebra).",
    apScores: [
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
    ],
    deCourses: [
      "Topics in British Literature",
      "Topics in American Literature",
      "Art History Survey I",
      "Art History Survey II",
      "Multivariable Calculus",
      "Introduction to Linear Algebra",
    ],
  },
  {
    school: "Azhar University",
    location: "Cairo, Egypt",
    period: "2021 – 2023",
  },
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

function StackChip({ children }) {
  return (
    <span
      className="inline-flex text-[11.5px] font-medium rounded-full px-2.5 py-1 border"
      style={{
        color: BLUE,
        backgroundColor: "#EFF6FF",
        borderColor: "#DBEAFE",
      }}
    >
      {children}
    </span>
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
                Co-Founder of Quest Learning · Duke '30, Neuroscience &amp; CS
              </p>
              <p
                className="mt-4 text-[15px] leading-relaxed max-w-[560px]"
                style={{ color: BODY }}
              >
                Builder and operator working across education, technology, and
                community — from shipping an AI learning platform headed to
                42,000+ students, to running the operations and social of a
                family restaurant that's reached tens of millions of viewers.
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
        {/* Work History */}
        <section>
          <SectionHeader
            eyebrow="Work History"
            title="Building, leading, operating."
            description="What I've spent my time on across school, community, and family business."
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

        {/* Entrepreneurship Programs */}
        <section>
          <SectionHeader
            eyebrow="Entrepreneurship Programs & Clubs"
            title="Learning to build under real mentors."
          />
          <Card>
            <h3 className="font-bold text-[15.5px]" style={{ color: INK }}>
              {ENTREPRENEURSHIP.role}
            </h3>
            <p
              className="mt-3 text-[14px] leading-relaxed"
              style={{ color: BODY }}
            >
              {ENTREPRENEURSHIP.detail}
            </p>
          </Card>
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

        {/* Honors & Awards */}
        <section>
          <SectionHeader eyebrow="Competitions & Awards" title="Recognition." />
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

        {/* Things I've Built */}
        <section>
          <SectionHeader
            eyebrow="Things I've Built"
            title="Selected projects."
            description="Small tools, side projects, and the platform I'm most proud of."
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
                {p.stack && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.stack.map((s) => (
                      <StackChip key={s}>{s}</StackChip>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* Education */}
        <section>
          <SectionHeader
            eyebrow="Education"
            title="Coursework and academics."
          />
          <div className="space-y-3">
            {EDUCATION.map((edu) => (
              <Card key={edu.school}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-bold text-[15.5px]" style={{ color: INK }}>
                    {edu.school}
                  </h3>
                  <span
                    className="text-[12px] font-medium"
                    style={{ color: MUTED }}
                  >
                    {edu.period}
                  </span>
                </div>
                <p
                  className="mt-0.5 text-[13.5px] font-semibold"
                  style={{ color: BLUE }}
                >
                  {edu.location}
                </p>
                {edu.detail && (
                  <p
                    className="mt-3 text-[14px] leading-relaxed"
                    style={{ color: BODY }}
                  >
                    {edu.detail}
                  </p>
                )}
                {edu.apScores && (
                  <div className="mt-5">
                    <div
                      className="text-[11px] font-semibold tracking-[0.12em] uppercase mb-2"
                      style={{ color: MUTED }}
                    >
                      AP Scores
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {edu.apScores.map(([course, score]) => (
                        <div
                          key={course}
                          className="flex items-center justify-between text-[12.5px] rounded-lg px-2.5 py-1.5 border"
                          style={{
                            borderColor: BORDER,
                            backgroundColor: "#F8FAFC",
                          }}
                        >
                          <span
                            className="truncate pr-2"
                            style={{ color: BODY }}
                          >
                            {course}
                          </span>
                          <span className="font-bold" style={{ color: INK }}>
                            {score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {edu.deCourses && (
                  <div className="mt-5">
                    <div
                      className="text-[11px] font-semibold tracking-[0.12em] uppercase mb-2"
                      style={{ color: MUTED }}
                    >
                      Dual-Enrollment
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {edu.deCourses.map((c) => (
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
                )}
              </Card>
            ))}
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
