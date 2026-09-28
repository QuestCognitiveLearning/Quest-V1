/**
 * Adam.jsx — a standalone personal site for Adam (Abduazim) Rakhmanov, served
 * at /adam. Public route (no auth, no app chrome) so it works as a shareable
 * bio link. Intentionally not linked anywhere in the app.
 *
 * Visual language matches the Quest Learning landing (blue #2563EB accent,
 * slate text, #EEF3FB header band, white cards on light background — no
 * gradients, no purple).
 *
 * Background: a fixed canvas draws a double helix that twists as the page
 * scrolls (nod to computational biology). Content sits above it on z-1;
 * the hero band is slightly translucent so the helix ghosts through.
 *
 * Photo: `public/adam-photo.jpg` (falls back to "AR" monogram if missing).
 */
import React, { useEffect, useRef, useState } from "react";
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

// -----------------------------------------------------------------------------
// Content
// -----------------------------------------------------------------------------

const WORK = [
  {
    role: "Co-Founder",
    org: "Quest Learning",
    period: "Jul 2024 – Present",
    body: [
      "Started Quest with a co-founder to turn state standards into complete, ready-to-teach lessons: hooks, videos, adaptive quizzes, AP-style case studies, each built around spaced repetition and scaffolding so the material sticks.",
      "I lead product and engineering. We've grown a 15-person team, shipped 100+ learning resources, passed 110,000 views, and we're in conversations with Williamson County Schools about bringing Quest to their 42,000+ students.",
    ],
  },
  {
    role: "State Secretary",
    org: "Tennessee Technology Student Association",
    period: "Jun 2025 – Jun 2026",
    body: [
      "Served as one of six state officers for Tennessee TSA, which has 3,100 members across 87 chapters. Ran statewide communications that passed 100K views, and built the event-selector tool new members use to pick their competitions.",
    ],
  },
  {
    role: "Software Engineer in Test",
    org: "Novalab Tech",
    period: "May 2022 – Jan 2023",
    body: [
      "QA automation for two enterprise products, including datatruck.io. I wrote Selenium (Java) and Cucumber test suites across the front end, back end, and API layers, plus the manual smoke and regression cases the team ran each release.",
    ],
  },
  {
    role: "Manager",
    org: "Salvo's Pizza (family-owned)",
    period: "Oct 2020 – Present",
    body: [
      "My family's restaurant in Nashville. I managed and trained a staff of ten through high school, and I still run our social accounts: 1,000+ posts, 17,000 followers, 40M+ views.",
    ],
  },
  {
    role: "Director & Co-Founder",
    org: "Wealth Education Initiative",
    period: "Dec 2023 – Present",
    body: [
      "A 501(c)(3) that teaches practical financial literacy. We grew two chapters past 100 members and put an eBook into six high schools, and I sat on the county committee that shaped financial-education policy for 20,000+ students.",
    ],
  },
];

const RESEARCH = {
  title: "Molecular biology & Drosophila research",
  period: "2023 – 2026",
  body: [
    "Three years of bench work through a biomedical research program: DNA extraction, PCR, gene cloning, CRISPR editing. I designed, ran, and presented two independent projects using Drosophila models to study human-health questions.",
    "That work is what pointed me at computational biology. In every experiment, the bottleneck was analysis, not pipetting.",
  ],
};

const AWARDS = [
  "2× DECA ICDC International Finalist — top 1% of 25,000+ competitors",
  "Breakthrough Junior Challenge Finalist — top 15 of 2,500+ submissions worldwide",
  "TSA Nationals: 6th in Data Science & Analytics, top 12 in Biotechnology Design; three state titles (Biotechnology, Data Science, Geospatial Technologies)",
  "Biotechnology Aptitude and Competency Credential (BACC) — Biotility, University of Florida, 2026",
  "EIC (INCubatoredu) final pitch — awarded $2,500 in funding; invited to pitch at the Nashville Entrepreneurship Center",
];

const SERVICE = [
  {
    role: "Volunteer & Tutor",
    org: "Salahadeen Center",
    detail:
      "Tutored twelve students in Arabic weekly, mentored youth, and helped organize prayers and community events.",
  },
  {
    role: "General Assembly Vice President",
    org: "Model United Nations · YMCA Civic Engagement",
    detail:
      "Helped coordinate a 700–900-delegate conference and chaired parliamentary debate for a 30-member committee.",
  },
  {
    role: "Communications Director",
    org: "ScienceFinds",
    detail:
      "Connected 75+ students with Nashville STEM professors as guest speakers for my high school's science club.",
  },
];

const LANGUAGES = ["English", "Russian", "Arabic", "Uzbek"];

const HOBBIES = [
  "Rubik's cubes and chess",
  "Wrestling, martial arts, calisthenics, rock climbing",
  "Traveling",
];

const PROJECTS = [
  {
    name: "TN TSA Event Selector",
    link: "https://tntsaeventselector.com",
    detail:
      "A questionnaire-driven matcher that ranks TSA's competitive events against a member's strengths and interests. Built for Tennessee TSA's 3,100 members.",
  },
  {
    name: "ExerciseBud",
    detail:
      "iOS + Android fitness app in React Native and Expo. Syncs steps from Apple HealthKit and Google Health Connect, generates four-week training plans with GPT-4-turbo, and layers on friends, a step leaderboard, and a guided-breathing screen.",
    stack: [
      "React Native",
      "Expo",
      "MongoDB Atlas",
      "OpenAI",
      "HealthKit / Health Connect",
    ],
  },
  {
    name: "Unitywall Profit Analysis Tool",
    link: "https://unitydashboard.vercel.app/",
    detail:
      "Internal dashboard for a web agency that separates client-facing quotes from true costs: labor hours, margins, client difficulty, and where estimates diverged from actuals across past projects.",
    stack: ["React", "Next.js", "Node.js", "Vercel"],
  },
  {
    name: "Vanderbilt Professor Scraper",
    detail:
      "A Selenium (Java) crawler that pulled 200+ Vanderbilt Medical Center faculty into a structured sheet so my high school's science club could invite them as guest speakers. 75+ students used the database.",
    stack: ["Selenium (Java)", "Apache POI"],
  },
  {
    name: "Stylize",
    link: "https://stylize.base44.app",
    detail:
      "Picks my outfit each morning from the local forecast and a few color-theory rules, so I don't have to. I use it more than anything else I've built.",
  },
];

const EDUCATION = [
  {
    school: "Duke University",
    location: "Neuroscience & Computer Science",
    period: "Class of 2030",
  },
  {
    school: "Ravenwood High School",
    location: "Brentwood, TN",
    period: "Class of 2026",
  },
];

// -----------------------------------------------------------------------------
// DNA background
// -----------------------------------------------------------------------------

/**
 * Full-viewport fixed canvas drawing a double helix whose twist phase is
 * driven by window.scrollY, so the strands rotate as the reader scrolls.
 * Sits at z-0 behind the content (which is position:relative, z-1); white
 * cards cover it, so it reads as a margin/backdrop texture, not a layer
 * over text. Honors prefers-reduced-motion by rendering a static helix.
 */
function DnaBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let raf = 0;
    let width = 0;
    let height = 0;

    const draw = () => {
      const phase = reduceMotion ? 0 : window.scrollY * 0.0038;
      ctx.clearRect(0, 0, width, height);

      // Desktop: helix lives in the right gutter beside the 900px column.
      // Narrow screens: centered, wider, mostly peeking around the cards.
      const wide = width >= 1024;
      const cx = wide ? Math.min(width / 2 + 590, width - 120) : width / 2;
      const amp = wide ? 90 : Math.min(width * 0.4, 150);
      const wavelength = 480; // px of height per full twist
      const k = (Math.PI * 2) / wavelength;
      const step = 7;

      // Base-pair rungs. The two strands are half a turn apart, so the rung
      // width collapses naturally where they cross.
      for (let y = -40; y <= height + 40; y += 26) {
        const a = k * y + phase;
        const x1 = cx + amp * Math.sin(a);
        const x2 = cx + amp * Math.sin(a + Math.PI);
        ctx.strokeStyle = "rgba(148,163,184,0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }

      // Strands, drawn as short segments so opacity and width can follow
      // depth: cos(angle) > 0 means the strand is on the near side.
      const strands = [
        { offset: 0, rgb: "37,99,235" }, // blue
        { offset: Math.PI, rgb: "71,85,105" }, // slate
      ];
      for (const strand of strands) {
        for (let y = -40; y <= height + 40; y += step) {
          const a1 = k * y + phase + strand.offset;
          const a2 = k * (y + step) + phase + strand.offset;
          const depth = (Math.cos(a1) + 1) / 2; // 0 = far, 1 = near
          ctx.strokeStyle = `rgba(${strand.rgb},${(
            0.07 +
            0.2 * depth
          ).toFixed(3)})`;
          ctx.lineWidth = 1.4 + 1.6 * depth;
          ctx.beginPath();
          ctx.moveTo(cx + amp * Math.sin(a1), y);
          ctx.lineTo(cx + amp * Math.sin(a2), y + step);
          ctx.stroke();
        }
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        draw();
      });
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reduceMotion) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

function SectionHeader({ title, description }) {
  return (
    <div className="mb-7">
      <h2
        className="font-extrabold tracking-tight"
        style={{
          color: INK,
          fontSize: "clamp(21px, 2.4vw, 27px)",
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
      <DnaBackground />

      {/* ================================================================= */}
      {/* Hero band                                                          */}
      {/* ================================================================= */}
      <header
        className="relative"
        style={{
          backgroundColor: "rgba(238,243,251,0.88)",
          borderBottom: `1px solid ${BORDER}`,
          zIndex: 1,
        }}
      >
        <div className="max-w-[900px] mx-auto px-6 pt-14 pb-14">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <Avatar />
            <div className="min-w-0 flex-1">
              <h1
                className="font-extrabold tracking-tight"
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
                Co-Founder of Quest Learning · Neuroscience &amp; CS at Duke
              </p>
              <p
                className="mt-4 text-[15px] leading-relaxed max-w-[580px]"
                style={{ color: BODY }}
              >
                I'm a first-year at Duke studying neuroscience and computer
                science, headed toward computational biology — I want to
                work on software that makes sense of biological data. Most
                of my time right now goes to Quest Learning. The rest goes
                to my family's pizza shop when I'm home in Nashville.
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
                <ContactPill icon={MapPin} label="Durham, NC" static />
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
      {/* Main                                                               */}
      {/* ================================================================= */}
      <main
        className="relative max-w-[900px] mx-auto px-6 py-16 space-y-16"
        style={{ zIndex: 1 }}
      >
        {/* Work */}
        <section>
          <SectionHeader title="Work" />
          <div className="space-y-3">
            {WORK.map((e) => (
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
                {e.body.map((para, i) => (
                  <p
                    key={i}
                    className="mt-3 text-[14px] leading-relaxed"
                    style={{ color: BODY }}
                  >
                    {para}
                  </p>
                ))}
              </Card>
            ))}
          </div>
        </section>

        {/* Research */}
        <section>
          <SectionHeader title="Research" />
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-bold text-[15.5px]" style={{ color: INK }}>
                {RESEARCH.title}
              </h3>
              <span
                className="text-[12px] font-medium"
                style={{ color: MUTED }}
              >
                {RESEARCH.period}
              </span>
            </div>
            {RESEARCH.body.map((para, i) => (
              <p
                key={i}
                className="mt-3 text-[14px] leading-relaxed"
                style={{ color: BODY }}
              >
                {para}
              </p>
            ))}
          </Card>
        </section>

        {/* Projects */}
        <section>
          <SectionHeader
            title="Projects"
            description="Side projects — most started as fixes for problems I ran into."
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

        {/* Awards */}
        <section>
          <SectionHeader title="Selected awards" />
          <Card>
            <ul className="space-y-2.5">
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

        {/* Service & leadership */}
        <section>
          <SectionHeader title="Service & leadership" />
          <div className="grid sm:grid-cols-2 gap-3">
            {SERVICE.map((l) => (
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

        {/* Education */}
        <section>
          <SectionHeader title="Education" />
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
              </Card>
            ))}
          </div>
        </section>

        {/* Languages & interests */}
        <section>
          <SectionHeader title="Languages & interests" />
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
                I grew up between Tashkent, Cairo, and Nashville — that's
                where the four come from.
              </p>
            </Card>
            <Card>
              <div
                className="text-[11px] font-semibold tracking-[0.12em] uppercase mb-3"
                style={{ color: MUTED }}
              >
                Off the computer
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
        className="relative"
        style={{
          backgroundColor: "white",
          borderTop: `1px solid ${BORDER}`,
          zIndex: 1,
        }}
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
      className="rounded-full"
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
