/**
 * Adam.jsx — a standalone personal site for Adam (Abduazim) Rakhmanov, served
 * at /adam. Public route (no auth, no app chrome) so it works as a shareable
 * bio link. Intentionally not linked anywhere in the app.
 *
 * Design: a climbing-guidebook zine. One committed metaphor, one ink.
 * (Inspired by elaineyu.design's train-journey portfolio: strict duotone,
 * hand-drawn feel, handwritten asides, a ticket you can stamp.)
 *   - cream paper + single pine-green ink, everywhere
 *   - sticky route-topo nav whose stops are the page anchors
 *   - hero: serif name, a stampable "route card", the V-grade beta selector
 *     (V0 flash / V3 project / V6 full send) that gates section depth
 *   - sections are pitches ("Pitch 1 — Work.") with handwritten margin notes
 *   - left edge (xl+): ink-outline climbing wall, climber ascends with scroll
 *   - right gutter: ink double helix that twists with scroll
 *   - footer: inverted summit band ("You topped out.")
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
  Mountain,
  PiggyBank,
  Pizza,
  Plane,
  Puzzle,
  Wrench,
} from "lucide-react";

// One ink, one paper.
const INK = "#17493B";
const PAPER = "#F4EFE4";
const CARD = "#FDFBF5";
const SOFT = "rgba(23,73,59,0.74)";
const FAINT = "rgba(23,73,59,0.5)";
const RULE = "rgba(23,73,59,0.28)";
const WASH = "rgba(23,73,59,0.07)";

const SERIF = '"Instrument Serif", Georgia, serif';
const MONO = '"Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const HAND = '"Caveat", "Comic Sans MS", cursive';

// -----------------------------------------------------------------------------
// Content
// -----------------------------------------------------------------------------

const WORK = [
  {
    role: "Co-Founder",
    org: "Quest Learning",
    period: "Jul 2024 – Present",
    icon: Brain,
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
    body: [
      "Served as one of six state officers for Tennessee TSA, which has 3,100 members across 87 chapters. Ran statewide communications that passed 100K views, and built the event-selector tool new members use to pick their competitions.",
    ],
  },
  {
    role: "Software Engineer in Test",
    org: "Novalab Tech",
    period: "May 2022 – Jan 2023",
    icon: Bug,
    body: [
      "QA automation for two enterprise products, including datatruck.io. I wrote Selenium (Java) and Cucumber test suites across the front end, back end, and API layers, plus the manual smoke and regression cases the team ran each release.",
    ],
  },
  {
    role: "Manager",
    org: "Salvo's Pizza (family-owned)",
    period: "Oct 2020 – Present",
    icon: Pizza,
    body: [
      "My family's restaurant in Nashville. I managed and trained a staff of ten through high school, and I still run our social accounts: 1,000+ posts, 17,000 followers, 40M+ views.",
    ],
  },
  {
    role: "Director & Co-Founder",
    org: "Wealth Education Initiative",
    period: "Dec 2023 – Present",
    icon: PiggyBank,
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
  { value: "4", label: "languages spoken" },
  { value: "3", label: "countries grown up in" },
  { value: "40M+", label: "views produced" },
  { value: "1", label: "family pizza shop" },
];

const INTERESTS = [
  { icon: Mountain, label: "rock climbing" },
  { icon: Dumbbell, label: "wrestling & calisthenics" },
  { icon: Puzzle, label: "rubik's cubes" },
  { icon: Crown, label: "chess" },
  { icon: Plane, label: "traveling" },
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

const TLDR = [
  "Duke '30 — neuroscience + CS, aiming at computational biology.",
  "Co-founded Quest Learning; 42,000-student district in talks.",
  "Family pizza shop social: 40M+ views.",
  "Climbs, wrestles, cubes, speaks four languages.",
];

const CODONS =
  "ATG GAT TCC AAG CTG TTC GGA CAT CCA TGA ACG TTA GCC AAT GTC TAG GCA TTC AGA CCT GGT AAC TGC ATA GCT CAG TTG ACC GTA TGC";

const GRADES = [
  { v: 0, tag: "V0", name: "flash", desc: "the 10-second read" },
  { v: 3, tag: "V3", name: "project", desc: "the resume" },
  { v: 6, tag: "V6", name: "full send", desc: "everything" },
];

const NAV_STOPS = [
  { label: "start", href: "#top" },
  { label: "work", href: "#work" },
  { label: "projects", href: "#projects" },
  { label: "summit", href: "#summit" },
];

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
        transform: vis ? "none" : "translateY(20px)",
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// DNA background — single ink on paper
// -----------------------------------------------------------------------------

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
      const baseAmp = wide ? 86 : Math.min(width * 0.4, 150);
      const wavelength = 470;
      const k = (Math.PI * 2) / wavelength;
      const step = 7;
      // slight amplitude wobble so the strands read hand-drawn, not plotted
      const amp = (y) => baseAmp * (1 + 0.04 * Math.sin(y * 0.013 + 1.7));

      for (let y = -40; y <= height + 40; y += 26) {
        const a = k * y + phase;
        const x1 = cx + amp(y) * Math.sin(a);
        const x2 = cx + amp(y) * Math.sin(a + Math.PI);
        ctx.strokeStyle = "rgba(23,73,59,0.16)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }

      for (const offset of [0, Math.PI]) {
        for (let y = -40; y <= height + 40; y += step) {
          const a1 = k * y + offset + phase;
          const a2 = k * (y + step) + offset + phase;
          const depth = (Math.cos(a1) + 1) / 2;
          ctx.strokeStyle = `rgba(23,73,59,${(0.08 + 0.2 * depth).toFixed(3)})`;
          ctx.lineWidth = 1.2 + 1.4 * depth;
          ctx.beginPath();
          ctx.moveTo(cx + amp(y) * Math.sin(a1), y);
          ctx.lineTo(cx + amp(y + step) * Math.sin(a2), y + step);
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
// Climbing wall — ink outlines only
// -----------------------------------------------------------------------------

const WALL_W = 120;
const routeX = (p) => 60 + Math.sin(p * Math.PI * 3) * 22;
const routeY = (p, vh) => vh - 84 - p * (vh - 164);

function Hold({ h }) {
  const style = { fill: WASH, stroke: INK, strokeWidth: 1.4, opacity: 0.85 };
  switch (h.shape) {
    case "crimp":
      return (
        <rect
          x={-h.r}
          y={-h.r * 0.35}
          width={h.r * 2}
          height={h.r * 0.7}
          rx="2"
          {...style}
        />
      );
    case "sloper":
      return <path d={`M ${-h.r},1 A ${h.r} ${h.r} 0 0 1 ${h.r},1 Z`} {...style} />;
    case "pinch":
      return <ellipse rx={h.r * 0.5} ry={h.r} {...style} />;
    default:
      return <ellipse rx={h.r} ry={h.r * 0.78} {...style} />;
  }
}

function ClimbingWall() {
  const climberRef = useRef(null);
  const poseARef = useRef(null);
  const poseBRef = useRef(null);
  const [vh, setVh] = useState(900);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const holds = useMemo(() => {
    const JITTER = [5, -7, 3, -4, 8, -2, 6, -8, 2, -5, 7, -3, 4];
    const SHAPES = ["jug", "crimp", "sloper", "pinch"];
    const list = [];
    for (let i = 0; i < 13; i++) {
      const p = i / 12;
      list.push({
        x: routeX(p) + JITTER[i],
        y: routeY(p, vh) + JITTER[(i + 4) % 13] * 0.8,
        r: 5 + ((i * 7) % 5),
        rot: (i * 53) % 180,
        shape: SHAPES[i % SHAPES.length],
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
        y: 60 + f * (vh - 140),
        r: 4 + (i % 3) * 2,
        rot: (i * 77) % 180,
        shape: SHAPES[(i + 2) % SHAPES.length],
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
      const stepParity = Math.floor(p * 14) % 2;
      if (poseARef.current && poseBRef.current) {
        poseARef.current.style.opacity = stepParity ? "0" : "1";
        poseBRef.current.style.opacity = stepParity ? "1" : "0";
      }
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

  const gradeTags = [
    ["V0", 0.02],
    ["V2", 0.34],
    ["V4", 0.66],
    ["V6", 0.97],
  ];

  return (
    <div
      aria-hidden="true"
      className="fixed left-0 top-0 bottom-0 hidden xl:block pointer-events-none"
      style={{ width: WALL_W, zIndex: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "#EFE9DC",
          borderRight: `1px solid ${RULE}`,
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
            stroke={RULE}
            strokeWidth="1"
          />
        ))}
        <polyline
          points={Array.from({ length: 25 }, (_, i) => {
            const p = i / 24;
            return `${routeX(p).toFixed(1)},${routeY(p, vh).toFixed(1)}`;
          }).join(" ")}
          fill="none"
          stroke={FAINT}
          strokeWidth="1.3"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
        {holds.map((h, i) => (
          <g key={i} transform={`translate(${h.x} ${h.y}) rotate(${h.rot})`}>
            <Hold h={h} />
          </g>
        ))}
        {gradeTags.map(([tag, p]) => (
          <g key={tag} transform={`translate(97 ${routeY(p, vh).toFixed(1)})`}>
            <circle r="10" fill="none" stroke={INK} strokeWidth="1.2" />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              fontSize="8"
              fontFamily="Space Mono, monospace"
              fill={INK}
            >
              {tag}
            </text>
          </g>
        ))}
        {/* summit flag */}
        <g transform="translate(60 34)">
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="-22"
            stroke={INK}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M0,-22 L20,-17 L0,-12 Z"
            fill={WASH}
            stroke={INK}
            strokeWidth="1.2"
          />
        </g>
        {/* crash pad */}
        <g transform={`translate(0 ${vh - 30})`}>
          <rect
            x="8"
            y="0"
            width="104"
            height="18"
            rx="5"
            fill={WASH}
            stroke={INK}
            strokeWidth="1.2"
          />
          <line x1="42" y1="0" x2="42" y2="18" stroke={INK} strokeWidth="1" opacity="0.5" />
          <line x1="78" y1="0" x2="78" y2="18" stroke={INK} strokeWidth="1" opacity="0.5" />
        </g>
        {/* climber */}
        <g ref={climberRef} transform={`translate(60 ${routeY(0, vh)})`}>
          <circle cx="0" cy="-15" r="4.4" fill="none" stroke={INK} strokeWidth="1.8" />
          <path d="M0,-10 L0,4" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <g ref={poseARef} style={{ transition: "opacity 0.15s" }}>
            <path d="M0,-8 L9,-17" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M0,-6 L-8,-1" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M0,4 L-7,12" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M0,4 L6,11" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
          </g>
          <g ref={poseBRef} style={{ opacity: 0, transition: "opacity 0.15s" }}>
            <path d="M0,-8 L-9,-17" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M0,-6 L8,-1" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M0,4 L7,12" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M0,4 L-6,11" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
          </g>
          <circle cx="3.5" cy="6" r="2.4" fill={PAPER} stroke={INK} strokeWidth="1.2" />
        </g>
      </svg>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Route nav — the topo line
// -----------------------------------------------------------------------------

function RouteNav() {
  return (
    <nav
      className="sticky top-0"
      style={{
        zIndex: 30,
        backgroundColor: "rgba(244,239,228,0.94)",
        borderBottom: `1px solid ${RULE}`,
        backdropFilter: "blur(4px)",
      }}
    >
      <div className="max-w-[1020px] mx-auto px-6 py-3 flex items-center">
        {NAV_STOPS.map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className="flex-1 mx-2 border-t border-dashed"
                style={{ borderColor: FAINT }}
              />
            )}
            <a
              href={s.href}
              className="flex items-center gap-1.5 text-[12px] lowercase"
              style={{ fontFamily: MONO, color: INK }}
            >
              <span
                className="w-2 h-2 rounded-full border"
                style={{
                  borderColor: INK,
                  backgroundColor: i === 0 ? INK : "transparent",
                }}
              />
              {s.label}
            </a>
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
}

// -----------------------------------------------------------------------------
// Route card (stampable) + grade selector
// -----------------------------------------------------------------------------

function RouteCard() {
  const [stamped, setStamped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setStamped(true)}
      className="relative text-left w-full transition-transform duration-150 hover:-translate-y-0.5"
      style={{
        transform: "rotate(-1.2deg)",
        backgroundColor: CARD,
        border: `1.5px solid ${INK}`,
        boxShadow: `4px 4px 0 ${INK}`,
        borderRadius: 10,
        padding: "14px 16px",
        cursor: "pointer",
        fontFamily: MONO,
        color: INK,
      }}
    >
      <div className="flex justify-between text-[10px] tracking-[0.14em] uppercase" style={{ color: FAINT }}>
        <span>route card</span>
        <span>plt-01</span>
      </div>
      <div className="mt-1.5 text-[13px] font-bold">
        START → SUMMIT <span style={{ color: FAINT }}>· round trip</span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 text-[11px]" style={{ color: SOFT }}>
        <span>climber: you</span>
        <span>grade: V0–V6</span>
        <span>fa: adam, 2026</span>
        <span>approach: scroll ↓</span>
      </div>
      <div
        className="mt-2 pt-1.5 text-[10px] border-t border-dashed"
        style={{ borderColor: RULE, color: FAINT }}
      >
        adam's 2026 route card
      </div>
      {stamped ? (
        <span
          className="absolute -right-2 -top-3 w-16 h-16 rounded-full flex items-center justify-center text-center leading-tight"
          style={{
            border: `2px solid ${INK}`,
            color: INK,
            fontFamily: HAND,
            fontSize: 15,
            transform: "rotate(12deg)",
            backgroundColor: "rgba(253,251,245,0.85)",
          }}
        >
          sent ✓<br />
          sep '26
        </span>
      ) : (
        <span
          className="absolute right-3 -top-4"
          style={{ fontFamily: HAND, fontSize: 17, color: SOFT, transform: "rotate(-3deg)" }}
        >
          click to stamp ↓
        </span>
      )}
    </button>
  );
}

function GradeSelector({ grade, setGrade }) {
  const active = GRADES.find((g) => g.v === grade);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1.5px solid ${INK}`, backgroundColor: CARD }}
    >
      <div
        className="px-4 py-2.5 text-[11px] tracking-[0.14em] lowercase border-b"
        style={{ fontFamily: MONO, color: SOFT, borderColor: RULE }}
      >
        how much beta do you want?
      </div>
      <div className="grid grid-cols-3">
        {GRADES.map((g, i) => {
          const isActive = grade === g.v;
          return (
            <button
              key={g.v}
              type="button"
              aria-pressed={isActive}
              onClick={() => setGrade(g.v)}
              className="px-3 py-3.5 text-left transition-colors duration-150"
              style={{
                borderLeft: i ? `1px solid ${RULE}` : "none",
                backgroundColor: isActive ? WASH : "transparent",
                cursor: "pointer",
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0"
                  style={{
                    fontFamily: MONO,
                    border: `1.5px solid ${INK}`,
                    backgroundColor: isActive ? INK : "transparent",
                    color: isActive ? PAPER : INK,
                  }}
                >
                  {g.tag}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-[12px] lowercase"
                    style={{ fontFamily: MONO, color: INK, fontWeight: 700 }}
                  >
                    {g.name}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="px-4 py-2 border-t text-[16px]"
        style={{ borderColor: RULE, fontFamily: HAND, color: SOFT }}
      >
        {active ? active.desc : ""}
      </div>
    </div>
  );
}

function GradePill({ grade, setGrade }) {
  return (
    <div
      className="fixed bottom-5 right-5 hidden sm:flex items-center gap-1 rounded-full px-3 py-2"
      style={{
        zIndex: 20,
        backgroundColor: "rgba(253,251,245,0.95)",
        border: `1.5px solid ${INK}`,
        boxShadow: `3px 3px 0 ${INK}`,
      }}
    >
      <span
        className="text-[10px] tracking-[0.14em] lowercase pr-1"
        style={{ fontFamily: MONO, color: SOFT }}
      >
        beta
      </span>
      {GRADES.map((g) => {
        const active = grade === g.v;
        return (
          <button
            key={g.v}
            type="button"
            aria-pressed={active}
            onClick={() => setGrade(g.v)}
            className="rounded-full px-2.5 py-1 text-[11px] transition-colors duration-150"
            style={{
              fontFamily: MONO,
              color: active ? PAPER : INK,
              backgroundColor: active ? INK : "transparent",
              cursor: "pointer",
            }}
          >
            {g.tag}
          </button>
        );
      })}
    </div>
  );
}

function MoreAt({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] lowercase transition-all duration-150 hover:-translate-y-0.5"
      style={{
        fontFamily: MONO,
        color: INK,
        border: `1.5px solid ${INK}`,
        backgroundColor: CARD,
        boxShadow: `3px 3px 0 ${INK}`,
        cursor: "pointer",
      }}
    >
      {children}
      <ArrowUpRight className="w-3.5 h-3.5" />
    </button>
  );
}

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

function HandNote({ children, className = "", rotate = -2, size = 19 }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: HAND,
        fontSize: size,
        color: SOFT,
        display: "inline-block",
        transform: `rotate(${rotate}deg)`,
        lineHeight: 1.15,
      }}
    >
      {children}
    </span>
  );
}

function SectionHeader({ pitch, title, gradeTag, note }) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-3">
        <span
          className="text-[11px] tracking-[0.2em] uppercase"
          style={{ fontFamily: MONO, color: SOFT }}
        >
          {pitch}
        </span>
        <span
          className="flex-1 border-t border-dashed"
          style={{ borderColor: RULE }}
        />
        {gradeTag && (
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-[10.5px]"
            style={{ fontFamily: MONO, border: `1.5px solid ${INK}`, color: INK }}
          >
            {gradeTag}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h2
          style={{
            fontFamily: SERIF,
            color: INK,
            fontSize: "clamp(32px, 4.4vw, 46px)",
            fontWeight: 400,
            lineHeight: 1.05,
          }}
        >
          {title}
        </h2>
        {note && <HandNote>{note}</HandNote>}
      </div>
    </div>
  );
}

function Panel({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl p-6 transition-all duration-150 hover:-translate-y-0.5 ${className}`}
      style={{
        backgroundColor: CARD,
        border: `1.5px solid ${INK}`,
        boxShadow: `4px 4px 0 rgba(23,73,59,0.9)`,
      }}
    >
      {children}
    </div>
  );
}

function Avatar() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative shrink-0" style={{ transform: "rotate(2deg)" }}>
      {failed ? (
        <div
          className="w-36 h-36 sm:w-44 sm:h-44 rounded-lg flex items-center justify-center text-4xl"
          style={{
            backgroundColor: WASH,
            border: `1.5px solid ${INK}`,
            color: INK,
            fontFamily: SERIF,
            boxShadow: `4px 4px 0 ${INK}`,
          }}
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
            border: `1.5px solid ${INK}`,
            boxShadow: `4px 4px 0 ${INK}`,
          }}
        />
      )}
      <HandNote className="mt-2 block text-center" rotate={-2} size={18}>
        me, probably thinking about lunch
      </HandNote>
    </div>
  );
}

function StackChip({ children }) {
  return (
    <span
      className="inline-flex text-[10.5px] lowercase rounded px-2 py-0.5 border"
      style={{ fontFamily: MONO, color: SOFT, borderColor: RULE }}
    >
      {children}
    </span>
  );
}

function StaggerTitle({ text, delayBase = 0 }) {
  return (
    <span className="block overflow-hidden pb-1">
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="inline-block adam-letter"
          style={{ animationDelay: `${delayBase + i * 40}ms` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function Adam() {
  const [grade, setGrade] = useState(3);

  useEffect(() => {
    const prev = document.title;
    document.title = "Adam Rakhmanov";
    return () => {
      document.title = prev;
    };
  }, []);

  const workItems = WORK.map((e) => ({
    ...e,
    body: grade >= 6 ? e.body : e.body.slice(0, 1),
  }));
  const projects = grade >= 6 ? PROJECTS : PROJECTS.slice(0, 3);
  const awards = grade >= 6 ? AWARDS : AWARDS.slice(0, 3);
  let pitchNo = 0;
  const pitch = () => {
    pitchNo += 1;
    return `pitch ${pitchNo}`;
  };

  return (
    <div
      id="top"
      className="min-h-screen"
      style={{
        backgroundColor: PAPER,
        color: INK,
        fontFamily:
          '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Mono:wght@400;700&family=Caveat:wght@500;600&display=swap');
        @keyframes adam-rise {
          from { transform: translateY(110%); opacity: 0; }
          to { transform: none; opacity: 1; }
        }
        .adam-letter {
          transform: translateY(110%);
          opacity: 0;
          animation: adam-rise 0.65s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        @keyframes adam-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .adam-ticker { animation: adam-marquee 52s linear infinite; }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) {
          .adam-letter { animation: none; transform: none; opacity: 1; }
          .adam-ticker { animation: none; }
          html { scroll-behavior: auto; }
        }
      `}</style>

      <DnaBackground />
      <ClimbingWall />
      <GradePill grade={grade} setGrade={setGrade} />
      <RouteNav />

      {/* ================================================================= */}
      {/* Hero — opaque paper block, background art never touches it         */}
      {/* ================================================================= */}
      <header
        className="relative"
        style={{
          backgroundColor: PAPER,
          borderBottom: `1px solid ${RULE}`,
          zIndex: 2,
        }}
      >
        {/* hand-drawn ridgeline */}
        <svg
          aria-hidden="true"
          className="absolute inset-x-0 bottom-8 w-full pointer-events-none"
          height="160"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
        >
          <polyline
            points="0,130 90,112 160,124 260,84 340,116 470,64 560,102 700,52 800,96 930,60 1040,98 1160,74 1280,108 1360,92 1440,104"
            fill="none"
            stroke={INK}
            strokeOpacity="0.22"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <polyline
            points="0,150 120,138 230,146 330,118 430,142 560,108 690,134 820,102 950,132 1080,112 1220,138 1340,124 1440,136"
            fill="none"
            stroke={INK}
            strokeOpacity="0.13"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* tiny flag on the high point */}
          <g transform="translate(700 52)">
            <line x1="0" y1="0" x2="0" y2="-14" stroke={INK} strokeOpacity="0.5" strokeWidth="1.2" />
            <path d="M0,-14 L10,-11.5 L0,-9 Z" fill={INK} fillOpacity="0.35" />
          </g>
        </svg>

        <div className="relative max-w-[1020px] mx-auto px-6 pt-12 pb-16">
          <div className="flex flex-col md:flex-row gap-10 md:gap-14">
            <div className="min-w-0 flex-1">
              <h1
                style={{
                  fontFamily: SERIF,
                  fontWeight: 400,
                  color: INK,
                  fontSize: "clamp(52px, 8vw, 96px)",
                  lineHeight: 1.0,
                }}
              >
                <StaggerTitle text="Adam" delayBase={80} />
                <StaggerTitle text="Rakhmanov." delayBase={280} />
              </h1>

              <p
                className="mt-4 text-[13px] leading-relaxed max-w-[430px]"
                style={{ fontFamily: MONO, color: SOFT }}
              >
                "I want to build software that makes sense of living things."
              </p>

              <div className="mt-6 space-y-1.5">
                {[
                  ["@duke", "neuroscience & cs, class of '30"],
                  ["@quest learning", "co-founder — 42,000-student district in talks"],
                  ["@salvo's pizza", "the family shop, 40M+ views"],
                ].map(([at, what]) => (
                  <div key={at} className="flex gap-3 text-[12.5px]" style={{ fontFamily: MONO }}>
                    <span style={{ color: INK, fontWeight: 700 }}>{at}</span>
                    <span style={{ color: SOFT }}>{what}</span>
                  </div>
                ))}
              </div>

              <p
                className="mt-6 text-[15px] leading-relaxed max-w-[540px]"
                style={{ color: SOFT }}
              >
                First-year at Duke headed toward computational biology. Most
                of my time goes to Quest Learning; the rest goes to the pizza
                shop when I'm home in Nashville.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <ContactPill
                  href="mailto:adamrakhmanovit@gmail.com"
                  icon={Mail}
                  label="email"
                />
                <ContactPill
                  href="tel:+16157088786"
                  icon={Phone}
                  label="(615) 708-8786"
                />
                <ContactPill icon={MapPin} label="durham, nc" static />
                <ContactPill
                  href="https://www.linkedin.com/in/adamrakhmanov/"
                  icon={Linkedin}
                  label="linkedin"
                  external
                />
              </div>
            </div>

            <div className="w-full md:w-[300px] shrink-0 space-y-8">
              <div className="flex md:justify-end">
                <Avatar />
              </div>
              <RouteCard />
            </div>
          </div>

          <div className="mt-12 max-w-[560px]">
            <GradeSelector grade={grade} setGrade={setGrade} />
          </div>
        </div>

        {/* DNA codon ticker */}
        <div
          className="overflow-hidden border-t py-1.5"
          style={{ borderColor: RULE }}
          aria-hidden="true"
        >
          <div className="adam-ticker flex w-max whitespace-nowrap">
            {[0, 1].map((n) => (
              <span
                key={n}
                className="text-[10.5px] tracking-[0.18em] pr-8"
                style={{ fontFamily: MONO, color: FAINT }}
              >
                {`5' ▸ ${CODONS} ▸ ${CODONS} ▸ 3' /// `}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* Route facts                                                        */}
      {/* ================================================================= */}
      <div className="relative" style={{ zIndex: 1 }}>
        <div className="max-w-[1020px] mx-auto px-6 mt-10">
          <Reveal>
            <div
              className="grid grid-cols-2 sm:grid-cols-4 rounded-xl overflow-hidden"
              style={{ border: `1.5px solid ${INK}`, backgroundColor: CARD }}
            >
              {STATS.map((s, i) => (
                <div
                  key={s.label}
                  className="p-5"
                  style={{ borderLeft: i ? `1px solid ${RULE}` : "none" }}
                >
                  <div
                    style={{
                      fontFamily: SERIF,
                      fontStyle: "italic",
                      color: INK,
                      fontSize: 30,
                      lineHeight: 1,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="mt-1.5 text-[10.5px] lowercase leading-tight"
                    style={{ fontFamily: MONO, color: SOFT }}
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
        className="relative max-w-[1020px] mx-auto px-6 py-14 space-y-16"
        style={{ zIndex: 1 }}
      >
        {grade < 3 && (
          <section>
            <SectionHeader
              pitch={pitch()}
              title="The flash read."
              gradeTag="V0"
              note="all you really need"
            />
            <Reveal>
              <Panel>
                <ul className="space-y-3">
                  {TLDR.map((t, i) => (
                    <li
                      key={i}
                      className="flex gap-4 text-[14.5px] leading-relaxed"
                      style={{ color: SOFT }}
                    >
                      <span
                        className="text-[11px] mt-[4px] shrink-0"
                        style={{ fontFamily: MONO, color: INK }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3">
                  <MoreAt onClick={() => setGrade(3)}>bump to v3 — the resume</MoreAt>
                  <MoreAt onClick={() => setGrade(6)}>full send — v6</MoreAt>
                </div>
              </Panel>
            </Reveal>
          </section>
        )}

        {grade >= 3 && (
          <>
            {/* Work */}
            <section id="work" style={{ scrollMarginTop: 70 }}>
              <SectionHeader
                pitch={pitch()}
                title="Work."
                gradeTag={grade >= 6 ? "V6" : "V3"}
                note="the pizza shop taught me the most, honestly"
              />
              <div className="space-y-4">
                {workItems.map((e, i) => (
                  <Reveal key={e.org} delay={i * 60}>
                    <Panel className="relative">
                      <e.icon
                        className="absolute right-5 top-5 w-5 h-5"
                        style={{ color: INK, opacity: 0.4 }}
                      />
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pr-8">
                        <span
                          className="text-[11px]"
                          style={{ fontFamily: MONO, color: FAINT }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3
                          className="text-[19px]"
                          style={{ fontFamily: SERIF, color: INK }}
                        >
                          {e.role} · {e.org}
                        </h3>
                        <span
                          className="ml-auto text-[11px] lowercase"
                          style={{ fontFamily: MONO, color: FAINT }}
                        >
                          {e.period}
                        </span>
                      </div>
                      {e.body.map((para, j) => (
                        <p
                          key={j}
                          className="mt-3 text-[14px] leading-relaxed"
                          style={{ color: SOFT }}
                        >
                          {para}
                        </p>
                      ))}
                    </Panel>
                  </Reveal>
                ))}
              </div>
              {grade < 6 && (
                <MoreAt onClick={() => setGrade(6)}>full beta at v6</MoreAt>
              )}
            </section>

            {/* Research */}
            <section>
              <SectionHeader
                pitch={pitch()}
                title="Research."
                gradeTag={grade >= 6 ? "V6" : "V3"}
                note="flies are underrated"
              />
              <Reveal>
                <Panel className="relative overflow-hidden">
                  <Dna
                    className="absolute -right-3 -bottom-3 w-28 h-28"
                    style={{ color: INK, opacity: 0.06 }}
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3
                      className="text-[19px]"
                      style={{ fontFamily: SERIF, color: INK }}
                    >
                      {RESEARCH.title}
                    </h3>
                    <span
                      className="text-[11px]"
                      style={{ fontFamily: MONO, color: FAINT }}
                    >
                      {RESEARCH.period}
                    </span>
                  </div>
                  {(grade >= 6 ? RESEARCH.body : RESEARCH.body.slice(0, 1)).map(
                    (para, i) => (
                      <p
                        key={i}
                        className="mt-3 text-[14px] leading-relaxed"
                        style={{ color: SOFT }}
                      >
                        {para}
                      </p>
                    )
                  )}
                </Panel>
              </Reveal>
            </section>

            {/* Projects */}
            <section id="projects" style={{ scrollMarginTop: 70 }}>
              <SectionHeader
                pitch={pitch()}
                title="Projects."
                gradeTag={grade >= 6 ? "V6" : "V3"}
                note="stylize: least impressive, most used"
              />
              <div className="grid sm:grid-cols-2 gap-4">
                {projects.map((p, i) => (
                  <Reveal key={p.name} delay={(i % 2) * 80}>
                    <Panel className="h-full">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3
                          className="text-[18px]"
                          style={{ fontFamily: SERIF, color: INK }}
                        >
                          {p.name}
                        </h3>
                        {p.link && (
                          <a
                            href={p.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] lowercase shrink-0 underline underline-offset-2"
                            style={{ fontFamily: MONO, color: INK }}
                          >
                            visit <ArrowUpRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <p
                        className="mt-2 text-[13.5px] leading-relaxed"
                        style={{ color: SOFT }}
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
              {grade < 6 && (
                <MoreAt onClick={() => setGrade(6)}>
                  +{PROJECTS.length - projects.length} more at v6
                </MoreAt>
              )}
            </section>

            {/* Awards */}
            <section>
              <SectionHeader
                pitch={pitch()}
                title="Awards."
                gradeTag={grade >= 6 ? "V6" : "V3"}
                note="the DECA ones took three years"
              />
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: `1.5px solid ${INK}`, backgroundColor: CARD }}
              >
                {awards.map((a, i) => (
                  <Reveal key={i} delay={i * 50}>
                    <div
                      className="flex gap-4 items-start px-5 py-4 transition-colors duration-150 hover:bg-[#F2ECDF]"
                      style={{
                        borderTop: i ? `1px solid ${RULE}` : "none",
                      }}
                    >
                      <span
                        className="text-[11px] mt-[3px] shrink-0"
                        style={{ fontFamily: MONO, color: INK }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="text-[13.5px] leading-relaxed"
                        style={{ color: SOFT }}
                      >
                        {a}
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
              {grade < 6 && (
                <MoreAt onClick={() => setGrade(6)}>
                  +{AWARDS.length - awards.length} more at v6
                </MoreAt>
              )}
            </section>

            {/* Service — V6 only */}
            {grade >= 6 && (
              <section>
                <SectionHeader
                  pitch={pitch()}
                  title="Service."
                  gradeTag="V6"
                />
                <div className="grid sm:grid-cols-3 gap-4">
                  {SERVICE.map((l, i) => (
                    <Reveal key={l.org} delay={i * 70}>
                      <Panel className="!p-5 h-full">
                        <h3
                          className="text-[16px] leading-snug"
                          style={{ fontFamily: SERIF, color: INK }}
                        >
                          {l.role}
                        </h3>
                        <p
                          className="text-[11px] lowercase mt-1"
                          style={{ fontFamily: MONO, color: FAINT }}
                        >
                          {l.org}
                        </p>
                        <p
                          className="mt-2 text-[13px] leading-relaxed"
                          style={{ color: SOFT }}
                        >
                          {l.detail}
                        </p>
                      </Panel>
                    </Reveal>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            <section>
              <SectionHeader
                pitch={pitch()}
                title="Education."
                gradeTag="V3"
                note="go blue devils"
              />
              <div className="grid sm:grid-cols-2 gap-4">
                {EDUCATION.map((edu, i) => (
                  <Reveal key={edu.school} delay={i * 60}>
                    <Panel className="h-full">
                      <h3
                        className="text-[18px]"
                        style={{ fontFamily: SERIF, color: INK }}
                      >
                        {edu.school}
                      </h3>
                      <p
                        className="mt-1 text-[13px]"
                        style={{ color: SOFT }}
                      >
                        {edu.location}
                      </p>
                      <p
                        className="mt-1 text-[11px] lowercase"
                        style={{ fontFamily: MONO, color: FAINT }}
                      >
                        {edu.period}
                      </p>
                    </Panel>
                  </Reveal>
                ))}
              </div>
            </section>

            {/* Offline */}
            <section>
              <SectionHeader
                pitch={pitch()}
                title="Off the computer."
                gradeTag="V3"
                note="ask me about cubes"
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <Reveal>
                  <Panel className="h-full">
                    <div
                      className="text-[10.5px] lowercase tracking-[0.14em] mb-3"
                      style={{ fontFamily: MONO, color: FAINT }}
                    >
                      languages
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {LANGUAGES.map((l) => (
                        <span
                          key={l}
                          className="inline-flex text-[12px] lowercase rounded-full px-3 py-1"
                          style={{
                            fontFamily: MONO,
                            color: INK,
                            border: `1px solid ${INK}`,
                          }}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                    {grade >= 6 && (
                      <HandNote className="mt-3" rotate={-1} size={18}>
                        grew up between Tashkent, Cairo, and Nashville —
                        that's where the four come from
                      </HandNote>
                    )}
                  </Panel>
                </Reveal>
                <Reveal delay={80}>
                  <Panel className="h-full">
                    <div
                      className="text-[10.5px] lowercase tracking-[0.14em] mb-3"
                      style={{ fontFamily: MONO, color: FAINT }}
                    >
                      most weekends
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {INTERESTS.map((it) => (
                        <span
                          key={it.label}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] lowercase"
                          style={{
                            color: INK,
                            border: `1px solid ${INK}`,
                          }}
                        >
                          <it.icon className="w-3.5 h-3.5" style={{ color: INK }} />
                          {it.label}
                        </span>
                      ))}
                    </div>
                  </Panel>
                </Reveal>
              </div>
            </section>
          </>
        )}
      </main>

      {/* ================================================================= */}
      {/* Summit footer — inverted band                                      */}
      {/* ================================================================= */}
      <footer
        id="summit"
        className="relative"
        style={{ backgroundColor: INK, color: PAPER, zIndex: 1 }}
      >
        <svg
          aria-hidden="true"
          className="w-full block"
          height="60"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          style={{ backgroundColor: PAPER }}
        >
          <polygon
            points="0,60 180,30 340,48 520,14 700,44 900,8 1080,40 1260,22 1440,46 1440,60"
            fill={INK}
          />
          <g transform="translate(900 8)">
            <line x1="0" y1="0" x2="0" y2="-16" stroke={INK} strokeWidth="1.6" />
            <path d="M0,-16 L11,-13 L0,-10 Z" fill={INK} />
          </g>
        </svg>
        <div className="max-w-[1020px] mx-auto px-6 pt-10 pb-9">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1 }}>
                You topped out.
              </div>
              <div
                className="mt-2 text-[11px] lowercase tracking-[0.14em]"
                style={{ fontFamily: MONO, color: "rgba(244,239,228,0.75)" }}
              >
                belay off — thanks for reading
              </div>
            </div>
            <div className="flex items-center gap-5">
              <FooterLink href="mailto:adamrakhmanovit@gmail.com" icon={Mail}>
                email
              </FooterLink>
              <FooterLink
                href="https://www.linkedin.com/in/adamrakhmanov/"
                icon={Linkedin}
                external
              >
                linkedin
              </FooterLink>
              <FooterLink
                href="https://www.questlearning.co"
                icon={ExternalLink}
              >
                quest learning
              </FooterLink>
            </div>
          </div>
          <div
            className="mt-8 pt-5 flex flex-wrap items-center justify-between gap-3"
            style={{ borderTop: "1px solid rgba(244,239,228,0.25)" }}
          >
            <span
              className="text-[11px] lowercase"
              style={{ fontFamily: MONO, color: "rgba(244,239,228,0.65)" }}
            >
              © 2026 adam rakhmanov
            </span>
            <span
              style={{
                fontFamily: HAND,
                fontSize: 18,
                color: "rgba(244,239,228,0.85)",
                transform: "rotate(-1deg)",
              }}
            >
              made between problem sets, dough runs, and too many open tabs
            </span>
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
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] lowercase transition-all duration-150"
      style={{
        fontFamily: MONO,
        color: INK,
        backgroundColor: CARD,
        border: `1.5px solid ${INK}`,
      }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: INK }} />
      {label}
      {external && <ArrowUpRight className="w-3 h-3" style={{ color: FAINT }} />}
    </span>
  );
  if (isStatic || !href) return inner;
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="rounded-full inline-block transition-transform duration-150 hover:-translate-y-0.5"
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
      className="inline-flex items-center gap-1.5 text-[12px] lowercase underline-offset-2 hover:underline"
      style={{ fontFamily: MONO, color: PAPER }}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </a>
  );
}
