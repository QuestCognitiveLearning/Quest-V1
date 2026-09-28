/**
 * Adam.jsx — a standalone personal site for Adam (Abduazim) Rakhmanov, served
 * at /adam. Public route (no auth, no app chrome) so it works as a shareable
 * bio link. Intentionally not linked anywhere in the app.
 *
 * Design: dark editorial-poster look (inspired by wodniack.dev's duotone
 * poster typography + generative line art, logartis.info's atmosphere, and
 * animejs.com's charcoal/monospace/scroll-motion language), tailored with
 * Adam's own motifs:
 *   - hero: full-width opaque block — giant Anton display type with a
 *     letter-stagger reveal, topographic line art, and a DNA-codon marquee
 *     ticker instead of a binary one. The fixed background layers never
 *     overlap it (per Adam's request the climbing wall starts below).
 *   - right gutter: canvas double helix that twists with scroll
 *   - left edge (xl+): climbing wall; the climber ascends with scroll
 * Sections are numbered editorially (01 / WORK...), panels are charcoal,
 * accents pop per section. Scroll-in reveals via IntersectionObserver.
 *
 * Photo: `public/adam-photo.jpg` (falls back to "AR" monogram if missing).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Linkedin,
  ArrowUpRight,
  Brain,
  Bug,
  Crown,
  Dna,
  Dumbbell,
  Medal,
  Mountain,
  PiggyBank,
  Pizza,
  Plane,
  Puzzle,
  Wrench,
} from "lucide-react";

// Dark palette
const BG = "#131416";
const PANEL = "#1B1D20";
const LINE = "#2A2D31";
const TEXT = "#E8E6E1";
const SUB = "#A6ABB2";
const MUT = "#787E86";
const LIME = "#4ADE80";
const ROSE = "#F43F5E";
const AMBER = "#F59E0B";
const SKY = "#38BDF8";
const TEAL = "#2DD4BF";

const DISPLAY = '"Anton", "Arial Narrow", "Inter", sans-serif';
const MONO =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

// -----------------------------------------------------------------------------
// Content
// -----------------------------------------------------------------------------

const WORK = [
  {
    role: "Co-Founder",
    org: "Quest Learning",
    period: "Jul 2024 – Present",
    icon: Brain,
    accent: SKY,
    body: [
      "Started Quest with a co-founder to turn state standards into complete, ready-to-teach lessons: hooks, videos, adaptive quizzes, AP-style case studies, each built around spaced repetition and scaffolding so the material sticks.",
      "I lead product and engineering. We've grown a 15-person team, shipped 100+ learning resources, passed 110,000 views, and we're in conversations with Williamson County Schools about bringing Quest to their 42,000+ students.",
    ],
  },
  {
    role: "State Secretary",
    org: "Tennessee Technology Student Association",
    period: "Jun 2025 – Jun 2026",
    icon: Wrench,
    accent: TEAL,
    body: [
      "Served as one of six state officers for Tennessee TSA, which has 3,100 members across 87 chapters. Ran statewide communications that passed 100K views, and built the event-selector tool new members use to pick their competitions.",
    ],
  },
  {
    role: "Software Engineer in Test",
    org: "Novalab Tech",
    period: "May 2022 – Jan 2023",
    icon: Bug,
    accent: ROSE,
    body: [
      "QA automation for two enterprise products, including datatruck.io. I wrote Selenium (Java) and Cucumber test suites across the front end, back end, and API layers, plus the manual smoke and regression cases the team ran each release.",
    ],
  },
  {
    role: "Manager",
    org: "Salvo's Pizza (family-owned)",
    period: "Oct 2020 – Present",
    icon: Pizza,
    accent: AMBER,
    body: [
      "My family's restaurant in Nashville. I managed and trained a staff of ten through high school, and I still run our social accounts: 1,000+ posts, 17,000 followers, 40M+ views.",
    ],
  },
  {
    role: "Director & Co-Founder",
    org: "Wealth Education Initiative",
    period: "Dec 2023 – Present",
    icon: PiggyBank,
    accent: LIME,
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

const STATS = [
  { value: "04", label: "languages spoken", color: SKY },
  { value: "03", label: "countries grown up in", color: LIME },
  { value: "40M+", label: "views produced", color: ROSE },
  { value: "01", label: "family pizza shop", color: AMBER },
];

const INTERESTS = [
  { icon: Mountain, label: "Rock climbing", color: TEAL },
  { icon: Dumbbell, label: "Wrestling & calisthenics", color: ROSE },
  { icon: Puzzle, label: "Rubik's cubes", color: AMBER },
  { icon: Crown, label: "Chess", color: SUB },
  { icon: Plane, label: "Traveling", color: SKY },
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

const CODONS =
  "ATG GAT TCC AAG CTG TTC GGA CAT CCA TGA ACG TTA GCC AAT GTC TAG GCA TTC AGA CCT GGT AAC TGC ATA GCT CAG TTG ACC GTA TGC";

// -----------------------------------------------------------------------------
// Reveal-on-scroll
// -----------------------------------------------------------------------------

function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVis(true);
      return;
    }
    // Scroll-driven check instead of IntersectionObserver: an anchor jump or
    // scrollbar drag can skip right past an element between two frames, and
    // the observer never reports it — this reveals anything at or above the
    // 92%-viewport line on every scroll tick, then detaches.
    let raf = 0;
    let done = false;
    const cleanup = () => {
      done = true;
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    const check = () => {
      if (done) return;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        setVis(true);
        cleanup();
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        check();
      });
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    return cleanup;
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "none" : "translateY(24px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// DNA background
// -----------------------------------------------------------------------------

/**
 * Full-viewport fixed canvas drawing a double helix whose twist phase is
 * driven by window.scrollY. Sits at z-0; the opaque hero (z-2) and the
 * charcoal panels cover it, so it lives in the page's right gutter.
 * Honors prefers-reduced-motion by rendering a static helix.
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

      const wide = width >= 1024;
      const cx = wide ? Math.min(width / 2 + 620, width - 110) : width / 2;
      const amp = wide ? 88 : Math.min(width * 0.4, 150);
      const wavelength = 480;
      const k = (Math.PI * 2) / wavelength;
      const step = 7;

      for (let y = -40; y <= height + 40; y += 26) {
        const a = k * y + phase;
        const x1 = cx + amp * Math.sin(a);
        const x2 = cx + amp * Math.sin(a + Math.PI);
        ctx.strokeStyle = "rgba(120,126,134,0.28)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }

      const strands = [
        { offset: 0, rgb: "74,222,128" }, // lime
        { offset: Math.PI, rgb: "232,230,225" }, // off-white
      ];
      for (const strand of strands) {
        for (let y = -40; y <= height + 40; y += step) {
          const a1 = k * y + strand.offset + phase;
          const a2 = k * (y + step) + strand.offset + phase;
          const depth = (Math.cos(a1) + 1) / 2;
          ctx.strokeStyle = `rgba(${strand.rgb},${(
            0.08 +
            0.24 * depth
          ).toFixed(3)})`;
          ctx.lineWidth = 1.6 + 1.8 * depth;
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
// Climbing wall
// -----------------------------------------------------------------------------

const HOLD_COLORS = ["#F97316", "#2DD4BF", "#38BDF8", "#F43F5E", "#A3E635", "#F59E0B"];
const WALL_W = 120;

const routeX = (p) => 60 + Math.sin(p * Math.PI * 3) * 22;
const routeY = (p, vh) => vh - 70 - p * (vh - 150);

/**
 * Fixed 120px strip on the left edge (xl+ only): charcoal climbing wall with
 * neon holds, a dashed route, a summit flag, and a climber whose height
 * tracks scroll progress. z-0, so the opaque hero covers it — it only shows
 * once you scroll into the content, per Adam's request. Decorative only.
 */
function ClimbingWall() {
  const climberRef = useRef(null);
  const [vh, setVh] = useState(900);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const holds = useMemo(() => {
    const JITTER = [5, -7, 3, -4, 8, -2, 6, -8, 2, -5, 7, -3, 4];
    const list = [];
    for (let i = 0; i < 13; i++) {
      const p = i / 12;
      list.push({
        x: routeX(p) + JITTER[i],
        y: routeY(p, vh) + JITTER[(i + 4) % 13] * 0.8,
        r: 5 + ((i * 7) % 5),
        color: HOLD_COLORS[i % HOLD_COLORS.length],
        rot: (i * 53) % 180,
      });
    }
    const SCATTER = [
      [18, 0.08],
      [98, 0.16],
      [22, 0.3],
      [102, 0.42],
      [14, 0.55],
      [100, 0.66],
      [20, 0.8],
      [96, 0.9],
    ];
    SCATTER.forEach(([x, f], i) => {
      list.push({
        x,
        y: 60 + f * (vh - 120),
        r: 4 + (i % 3) * 2,
        color: HOLD_COLORS[(i + 3) % HOLD_COLORS.length],
        rot: (i * 77) % 180,
      });
    });
    return list;
  }, [vh]);

  useEffect(() => {
    const el = climberRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let raf = 0;

    const update = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      const x = routeX(p);
      const y = routeY(p, window.innerHeight);
      const sway = Math.sin(p * Math.PI * 8) * 6;
      el.setAttribute(
        "transform",
        `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${sway.toFixed(1)})`
      );
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    update();
    if (!reduceMotion) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [vh]);

  return (
    <div
      aria-hidden="true"
      className="fixed left-0 top-0 bottom-0 hidden xl:block pointer-events-none"
      style={{ width: WALL_W, zIndex: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "#17181B",
          borderRight: `1px solid ${LINE}`,
          boxShadow: "inset -10px 0 18px -14px rgb(0 0 0 / 0.6)",
        }}
      />
      <svg
        width={WALL_W}
        height={vh}
        viewBox={`0 0 ${WALL_W} ${vh}`}
        className="absolute inset-0"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={WALL_W}
            y1={f * vh}
            y2={f * vh}
            stroke="#212429"
            strokeWidth="2"
          />
        ))}
        <polyline
          points={Array.from({ length: 25 }, (_, i) => {
            const p = i / 24;
            return `${routeX(p).toFixed(1)},${routeY(p, vh).toFixed(1)}`;
          }).join(" ")}
          fill="none"
          stroke="#4A4F55"
          strokeWidth="1.5"
          strokeDasharray="2 6"
          strokeLinecap="round"
          opacity="0.6"
        />
        {holds.map((h, i) => (
          <g key={i} transform={`translate(${h.x} ${h.y}) rotate(${h.rot})`}>
            <ellipse rx={h.r} ry={h.r * 0.78} fill={h.color} opacity="0.92" />
            <circle r="1.4" fill="rgba(0,0,0,0.45)" />
          </g>
        ))}
        <g transform="translate(60 34)">
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="-22"
            stroke={TEXT}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M0,-22 L20,-17 L0,-12 Z" fill={AMBER} />
        </g>
        <g ref={climberRef} transform={`translate(60 ${vh - 70})`}>
          <circle cx="0" cy="-15" r="4.6" fill={TEXT} />
          <path
            d="M0,-10 L0,4"
            stroke={LIME}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path d="M0,-8 L9,-17" stroke={TEXT} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M0,-6 L-8,-1" stroke={TEXT} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M0,4 L-7,12" stroke={TEXT} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M0,4 L6,11" stroke={TEXT} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="3" cy="6" r="2.6" fill={AMBER} />
        </g>
      </svg>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

function StaggerTitle({ text, delayBase = 0 }) {
  return (
    <span className="block overflow-hidden">
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="inline-block adam-letter"
          style={{ animationDelay: `${delayBase + i * 45}ms` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

function SectionHeader({ index, accent, title, description }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3">
        <span
          className="text-[12px] font-medium tracking-[0.2em]"
          style={{ fontFamily: MONO, color: accent }}
        >
          {index}
        </span>
        <span className="h-px flex-1" style={{ backgroundColor: LINE }} />
      </div>
      <h2
        className="mt-3 uppercase"
        style={{
          fontFamily: DISPLAY,
          color: TEXT,
          fontSize: "clamp(30px, 4.2vw, 46px)",
          fontWeight: 400,
          letterSpacing: "0.015em",
          lineHeight: 1.05,
        }}
      >
        {title}
      </h2>
      {description && (
        <p
          className="mt-2 text-[14px] leading-relaxed"
          style={{ color: SUB }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

function Panel({ children, className = "", accent }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={`rounded-xl border p-6 transition-all duration-200 ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: PANEL,
        borderColor: hover && accent ? `${accent}66` : LINE,
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover
          ? "0 14px 30px -18px rgb(0 0 0 / 0.8)"
          : "0 1px 2px 0 rgb(0 0 0 / 0.3)",
      }}
    >
      {children}
    </div>
  );
}

function Avatar() {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="relative shrink-0"
      style={{ transform: "rotate(-2deg)" }}
    >
      {failed ? (
        <div
          className="w-36 h-36 sm:w-44 sm:h-44 rounded-lg flex items-center justify-center text-4xl text-black"
          style={{ backgroundColor: LIME, fontFamily: DISPLAY }}
        >
          AR
        </div>
      ) : (
        <img
          src="/adam-photo.jpg"
          alt="Adam Rakhmanov"
          onError={() => setFailed(true)}
          className="w-36 h-36 sm:w-44 sm:h-44 rounded-lg object-cover"
          style={{
            border: `1px solid ${LINE}`,
            filter: "saturate(0.85) contrast(1.05)",
            boxShadow: "0 18px 40px -18px rgb(0 0 0 / 0.9)",
          }}
        />
      )}
      <div
        className="mt-2 text-[10px] tracking-[0.2em] uppercase"
        style={{ fontFamily: MONO, color: MUT }}
      >
        fig. 01 — me
      </div>
    </div>
  );
}

function StackChip({ children }) {
  return (
    <span
      className="inline-flex text-[11px] rounded px-2 py-1 border"
      style={{
        fontFamily: MONO,
        color: LIME,
        backgroundColor: "rgba(74,222,128,0.07)",
        borderColor: "rgba(74,222,128,0.25)",
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
        backgroundColor: BG,
        color: TEXT,
        fontFamily:
          '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes adam-rise {
          from { transform: translateY(110%); opacity: 0; }
          to { transform: none; opacity: 1; }
        }
        .adam-letter {
          transform: translateY(110%);
          opacity: 0;
          animation: adam-rise 0.7s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        @keyframes adam-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .adam-ticker { animation: adam-marquee 48s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .adam-letter { animation: none; transform: none; opacity: 1; }
          .adam-ticker { animation: none; }
        }
        .adam-tickstrip {
          background-image: repeating-linear-gradient(
            to right, ${LINE} 0, ${LINE} 1px, transparent 1px, transparent 9px
          );
        }
      `}</style>

      <DnaBackground />
      <ClimbingWall />

      {/* ================================================================= */}
      {/* Hero — full-width opaque block; background layers never touch it   */}
      {/* ================================================================= */}
      <header
        className="relative"
        style={{
          backgroundColor: BG,
          borderBottom: `1px solid ${LINE}`,
          zIndex: 2,
        }}
      >
        {/* top mono bar */}
        <div
          className="border-b"
          style={{ borderColor: LINE }}
        >
          <div className="max-w-[1060px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <span
              className="text-[11px] tracking-[0.22em] uppercase"
              style={{ fontFamily: MONO, color: SUB }}
            >
              Adam Rakhmanov — Personal Site
            </span>
            <span
              className="text-[11px] tracking-[0.22em] uppercase hidden sm:block"
              style={{ fontFamily: MONO, color: MUT }}
            >
              Durham, NC · Duke '30
            </span>
          </div>
        </div>

        {/* topographic line art */}
        <svg
          aria-hidden="true"
          className="absolute inset-x-0 bottom-10 w-full pointer-events-none"
          height="300"
          viewBox="0 0 1440 300"
          preserveAspectRatio="none"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const yb = 30 + i * 24;
            const lift = 26 + i * 3;
            return (
              <path
                key={i}
                d={`M0 ${yb} Q 180 ${yb - lift} 360 ${yb} T 720 ${yb} T 1080 ${yb} T 1440 ${yb}`}
                stroke={i % 3 === 0 ? LIME : SUB}
                strokeOpacity={i % 3 === 0 ? 0.1 : 0.06}
                strokeWidth="1"
                fill="none"
              />
            );
          })}
        </svg>

        <div className="relative max-w-[1060px] mx-auto px-6 pt-14 pb-12">
          <div className="flex flex-col md:flex-row md:items-end gap-10">
            <div className="min-w-0 flex-1">
              <div
                className="text-[12px] tracking-[0.3em] uppercase"
                style={{ fontFamily: MONO, color: AMBER }}
              >
                Hey — I'm
              </div>
              <h1
                className="mt-3 uppercase"
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 400,
                  color: TEXT,
                  fontSize: "clamp(56px, 9.5vw, 128px)",
                  letterSpacing: "0.01em",
                  lineHeight: 0.96,
                }}
              >
                <StaggerTitle text="Adam" delayBase={100} />
                <StaggerTitle text="Rakhmanov" delayBase={350} />
              </h1>
              <p
                className="mt-5 text-[13px] tracking-[0.14em] uppercase"
                style={{ fontFamily: MONO, color: LIME }}
              >
                Neuroscience + CS @ Duke → Computational Biology
              </p>
              <p
                className="mt-5 text-[15px] leading-relaxed max-w-[560px]"
                style={{ color: SUB }}
              >
                I'm a first-year at Duke studying neuroscience and computer
                science, headed toward computational biology — I want to
                work on software that makes sense of biological data. Most
                of my time right now goes to Quest Learning. The rest goes
                to my family's pizza shop when I'm home in Nashville.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
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
            <Avatar />
          </div>
        </div>

        {/* DNA codon ticker */}
        <div
          className="overflow-hidden border-t py-2"
          style={{ borderColor: LINE }}
          aria-hidden="true"
        >
          <div className="adam-ticker flex w-max whitespace-nowrap">
            {[0, 1].map((n) => (
              <span
                key={n}
                className="text-[11px] tracking-[0.18em] pr-8"
                style={{ fontFamily: MONO, color: MUT }}
              >
                {`5' ▸ ${CODONS} ▸ ${CODONS} ▸ 3' /// `}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* Stats strip                                                        */}
      {/* ================================================================= */}
      <div className="relative" style={{ zIndex: 1 }}>
        <div className="max-w-[1060px] mx-auto px-6 mt-10">
          <Reveal>
            <div
              className="grid grid-cols-2 sm:grid-cols-4 rounded-xl border overflow-hidden"
              style={{ borderColor: LINE, backgroundColor: PANEL }}
            >
              {STATS.map((s, i) => (
                <div
                  key={s.label}
                  className="p-5"
                  style={{
                    borderLeft: i ? `1px solid ${LINE}` : "none",
                  }}
                >
                  <div
                    className="text-[24px]"
                    style={{ fontFamily: DISPLAY, color: s.color }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="mt-1 text-[10.5px] tracking-[0.16em] uppercase leading-tight"
                    style={{ fontFamily: MONO, color: MUT }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Main                                                               */}
      {/* ================================================================= */}
      <main
        className="relative max-w-[1060px] mx-auto px-6 py-16 space-y-20"
        style={{ zIndex: 1 }}
      >
        {/* Work */}
        <section>
          <SectionHeader index="01 / WORK" accent={SKY} title="Work" />
          <div className="space-y-3">
            {WORK.map((e, i) => (
              <Reveal key={e.org} delay={i * 60}>
                <Panel accent={e.accent} className="relative">
                  <e.icon
                    className="absolute right-5 top-5 w-5 h-5"
                    style={{ color: e.accent, opacity: 0.6 }}
                  />
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pr-8">
                    <span
                      className="text-[11px]"
                      style={{ fontFamily: MONO, color: MUT }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3
                      className="font-bold text-[16px]"
                      style={{ color: TEXT }}
                    >
                      {e.role}
                    </h3>
                    <span
                      className="ml-auto text-[11px] tracking-[0.08em]"
                      style={{ fontFamily: MONO, color: MUT }}
                    >
                      {e.period}
                    </span>
                  </div>
                  <p
                    className="mt-0.5 text-[13.5px] font-semibold"
                    style={{ color: e.accent }}
                  >
                    {e.org}
                  </p>
                  {e.body.map((para, j) => (
                    <p
                      key={j}
                      className="mt-3 text-[14px] leading-relaxed"
                      style={{ color: SUB }}
                    >
                      {para}
                    </p>
                  ))}
                </Panel>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Research */}
        <section>
          <SectionHeader index="02 / RESEARCH" accent={LIME} title="Research" />
          <Reveal>
            <Panel accent={LIME} className="relative overflow-hidden">
              <Dna
                className="absolute -right-4 -bottom-4 w-32 h-32"
                style={{ color: LIME, opacity: 0.06 }}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-bold text-[16px]" style={{ color: TEXT }}>
                  {RESEARCH.title}
                </h3>
                <span
                  className="text-[11px] tracking-[0.08em]"
                  style={{ fontFamily: MONO, color: MUT }}
                >
                  {RESEARCH.period}
                </span>
              </div>
              {RESEARCH.body.map((para, i) => (
                <p
                  key={i}
                  className="mt-3 text-[14px] leading-relaxed"
                  style={{ color: SUB }}
                >
                  {para}
                </p>
              ))}
            </Panel>
          </Reveal>
        </section>

        {/* Projects */}
        <section>
          <SectionHeader
            index="03 / PROJECTS"
            accent={AMBER}
            title="Projects"
            description="Side projects — most started as fixes for problems I ran into."
          />
          <div className="grid sm:grid-cols-2 gap-3">
            {PROJECTS.map((p, i) => (
              <Reveal key={p.name} delay={(i % 2) * 80}>
                <Panel accent={AMBER} className="h-full">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3
                      className="font-bold text-[15.5px]"
                      style={{ color: TEXT }}
                    >
                      {p.name}
                    </h3>
                    {p.link && (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] tracking-[0.14em] uppercase shrink-0"
                        style={{ fontFamily: MONO, color: AMBER }}
                      >
                        Visit <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <p
                    className="mt-2 text-[13.5px] leading-relaxed"
                    style={{ color: SUB }}
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
                </Panel>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Awards — editorial rows */}
        <section>
          <SectionHeader
            index="04 / AWARDS"
            accent={ROSE}
            title="Selected awards"
          />
          <div
            className="border-t"
            style={{ borderColor: LINE }}
          >
            {AWARDS.map((a, i) => (
              <Reveal key={i} delay={i * 50}>
                <div
                  className="flex gap-5 items-start py-4 border-b transition-colors duration-200 hover:bg-[#17181B]"
                  style={{ borderColor: LINE }}
                >
                  <span
                    className="text-[12px] mt-[2px] shrink-0"
                    style={{ fontFamily: MONO, color: ROSE }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="text-[13.5px] leading-relaxed"
                    style={{ color: SUB }}
                  >
                    {a}
                  </span>
                  <Medal
                    className="w-4 h-4 ml-auto mt-[2px] shrink-0"
                    style={{ color: ROSE, opacity: 0.5 }}
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Service & leadership */}
        <section>
          <SectionHeader
            index="05 / SERVICE"
            accent={TEAL}
            title="Service & leadership"
          />
          <div className="grid sm:grid-cols-3 gap-3">
            {SERVICE.map((l, i) => (
              <Reveal key={l.org} delay={i * 70}>
                <Panel accent={TEAL} className="!p-5 h-full">
                  <h3
                    className="font-bold text-[14px] leading-snug"
                    style={{ color: TEXT }}
                  >
                    {l.role}
                  </h3>
                  <p
                    className="text-[12px] font-semibold mt-0.5"
                    style={{ color: TEAL }}
                  >
                    {l.org}
                  </p>
                  <p
                    className="mt-2 text-[13px] leading-relaxed"
                    style={{ color: SUB }}
                  >
                    {l.detail}
                  </p>
                </Panel>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Education */}
        <section>
          <SectionHeader
            index="06 / EDUCATION"
            accent={SKY}
            title="Education"
          />
          <div className="space-y-3">
            {EDUCATION.map((edu, i) => (
              <Reveal key={edu.school} delay={i * 60}>
                <Panel accent={SKY}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3
                      className="font-bold text-[15.5px]"
                      style={{ color: TEXT }}
                    >
                      {edu.school}
                    </h3>
                    <span
                      className="text-[11px] tracking-[0.08em]"
                      style={{ fontFamily: MONO, color: MUT }}
                    >
                      {edu.period}
                    </span>
                  </div>
                  <p
                    className="mt-0.5 text-[13.5px] font-semibold"
                    style={{ color: SKY }}
                  >
                    {edu.location}
                  </p>
                </Panel>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Languages & interests */}
        <section>
          <SectionHeader
            index="07 / OFFLINE"
            accent={AMBER}
            title="Languages & interests"
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Reveal>
              <Panel accent={AMBER} className="h-full">
                <div
                  className="text-[10.5px] tracking-[0.2em] uppercase mb-3"
                  style={{ fontFamily: MONO, color: MUT }}
                >
                  Languages
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((l) => (
                    <span
                      key={l}
                      className="inline-flex text-[12.5px] rounded px-3 py-1 border"
                      style={{
                        fontFamily: MONO,
                        color: TEXT,
                        backgroundColor: "#17181B",
                        borderColor: LINE,
                      }}
                    >
                      {l}
                    </span>
                  ))}
                </div>
                <p className="text-[12px] mt-3" style={{ color: MUT }}>
                  I grew up between Tashkent, Cairo, and Nashville — that's
                  where the four come from.
                </p>
              </Panel>
            </Reveal>
            <Reveal delay={80}>
              <Panel accent={AMBER} className="h-full">
                <div
                  className="text-[10.5px] tracking-[0.2em] uppercase mb-3"
                  style={{ fontFamily: MONO, color: MUT }}
                >
                  Off the computer
                </div>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((it) => (
                    <span
                      key={it.label}
                      className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 border text-[12.5px]"
                      style={{
                        color: TEXT,
                        backgroundColor: "#17181B",
                        borderColor: `${it.color}44`,
                      }}
                    >
                      <it.icon
                        className="w-3.5 h-3.5"
                        style={{ color: it.color }}
                      />
                      {it.label}
                    </span>
                  ))}
                </div>
              </Panel>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ================================================================= */}
      {/* Footer                                                             */}
      {/* ================================================================= */}
      <footer
        className="relative"
        style={{
          backgroundColor: BG,
          borderTop: `1px solid ${LINE}`,
          zIndex: 1,
        }}
      >
        <div className="adam-tickstrip h-6 opacity-60" aria-hidden="true" />
        <div className="max-w-[1060px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-3">
          <span
            className="text-[11px] tracking-[0.16em] uppercase"
            style={{ fontFamily: MONO, color: MUT }}
          >
            © 2026 Adam Rakhmanov · the helix twists when you scroll
          </span>
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
      className="inline-flex items-center gap-1.5 rounded px-3.5 py-1.5 border transition-colors text-[12px]"
      style={{
        fontFamily: MONO,
        color: TEXT,
        backgroundColor: PANEL,
        borderColor: LINE,
      }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: LIME }} />
      {label}
      {external && <ArrowUpRight className="w-3 h-3" style={{ color: MUT }} />}
    </span>
  );
  if (isStatic || !href) return inner;
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="rounded"
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
      className="inline-flex items-center gap-1.5 transition-colors text-[12px] tracking-[0.1em] uppercase"
      style={{ fontFamily: MONO, color: MUT }}
      onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
      onMouseLeave={(e) => (e.currentTarget.style.color = MUT)}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </a>
  );
}
