/**
 * Adam.jsx — a standalone personal site for Adam (Abduazim) Rakhmanov, served
 * at /adam. Public route (no auth, no app chrome) so it works as a shareable
 * bio link. Intentionally not linked anywhere in the app.
 *
 * Design: "chr-adam" — the page is a genome browser and Adam's life is one
 * chromosome. Scrolling pans along it.
 *   - hero: four corners of mono metadata, one 200px headline, and one object:
 *     a G-banded chromosome that turns gently on idle. Scrolling takes over the
 *     rotation and zooms into it (chromosome → chromatin → DNA).
 *   - sticky browser chrome: locus readout, ruler with section ticks, and the
 *     zoom control (chromosome / gene / base pair) that gates content depth.
 *   - Index: one dense table of work, research, school. Rows expand.
 *   - the double helix: ten cards on a 3D spiral, work on one strand, projects
 *     on the other. Scroll turns it; the card facing you is in focus.
 *   - Coverage (research as a depth plot) and Variants (awards as calls).
 *   - footer: 3' end.
 *
 * Reduced motion: the chromosome holds still, the helix becomes a plain grid.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const PAPER = "#F7F6F2";
const INK = "#101828";
const BLUE = "#2457C5";
const MAG = "#C2185B";
const RULE = "#D5D7DC";
const MUTED = "#6B7280";
const BODY = "#374151";
const NIGHT = "#0B0F1A";
const SANS = '"Inter Tight", Inter, system-ui, -apple-system, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const ZOOMS = ["chromosome", "gene", "base pair"];

const LOCI = [
  {
    no: "01",
    locus: "QUEST1",
    color: BLUE,
    feature: "Co-founder, product & engineering",
    org: "Quest Learning",
    span: "2024 – now",
    strand: "+",
    body: "Started Quest with a co-founder to turn state standards into complete, ready-to-teach lessons: hooks, videos, adaptive quizzes, AP-style case studies, each built around spaced repetition and scaffolding so the material sticks.",
    more: "I lead product and engineering. We've grown a 15-person team, shipped 100+ learning resources, passed 110,000 views, and we're in conversations with Williamson County Schools about bringing Quest to their 42,000+ students.",
  },
  {
    no: "02",
    locus: "TSA2",
    color: BLUE,
    feature: "State Secretary",
    org: "Tennessee Technology Student Association",
    span: "2025 – 2026",
    strand: "+",
    body: "One of six state officers for Tennessee TSA: 3,100 members across 87 chapters. Ran statewide communications that passed 100K views, and built the event-selector tool new members use to pick their competitions.",
  },
  {
    no: "03",
    locus: "NOVA1",
    color: BLUE,
    feature: "Software engineer in test",
    org: "Novalab Tech",
    span: "2022 – 2023",
    strand: "−",
    body: "QA automation for two enterprise products, including datatruck.io. Selenium (Java) and Cucumber test suites across the front end, back end, and API layers, plus the manual smoke and regression cases the team ran each release.",
  },
  {
    no: "04",
    locus: "SALVO",
    color: BLUE,
    feature: "Manager, social",
    org: "Salvo's Pizza (family-owned)",
    span: "2020 – now",
    strand: "+",
    body: "My family's restaurant in Nashville. I managed and trained a staff of ten through high school, and I still run our social accounts: 1,000+ posts, 17,000 followers, 40M+ views.",
  },
  {
    no: "05",
    locus: "WEI1",
    color: BLUE,
    feature: "Director & co-founder",
    org: "Wealth Education Initiative",
    span: "2023 – now",
    strand: "+",
    body: "A 501(c)(3) that teaches practical financial literacy. We grew two chapters past 100 members and put an eBook into six high schools, and I sat on the county committee that shaped financial-education policy for 20,000+ students.",
  },
  {
    no: "06",
    locus: "DROS",
    color: MAG,
    feature: "Drosophila research: CRISPR, PCR, cloning",
    org: "Biomedical research program",
    span: "2023 – 2026",
    strand: "+",
    body: "Three years of bench work: DNA extraction, PCR, gene cloning, CRISPR editing. I designed, ran, and presented two independent projects using Drosophila models to study human-health questions.",
    more: "That work is what pointed me at computational biology. In every experiment, the bottleneck was analysis, not pipetting.",
  },
  {
    no: "07",
    locus: "DUKE",
    color: MUTED,
    feature: "Neuroscience & computer science",
    org: "Duke University",
    span: "2026 – 2030",
    strand: "+",
    body: "Class of 2030. Headed toward computational biology.",
  },
];

const WORK_CARDS = [
  { k: "QUEST1 · 2024 – now", t: "Co-founder, Quest Learning", d: "State standards into ready-to-teach lessons. 15-person team, 42,000-student district in talks." },
  { k: "TSA2 · 2025 – 2026", t: "State Secretary, Tennessee TSA", d: "Six state officers, 3,100 members, 87 chapters. Built the event-selector tool." },
  { k: "NOVA1 · 2022 – 2023", t: "Software Engineer in Test, Novalab", d: "Selenium + Cucumber suites across front end, back end, API." },
  { k: "SALVO · 2020 – now", t: "Manager, Salvo's Pizza", d: "Family shop in Nashville. 1,000+ posts, 17,000 followers, 40M+ views." },
  { k: "WEI1 · 2023 – now", t: "Director, Wealth Education Initiative", d: "501(c)(3). Two chapters past 100 members, eBook in six schools." },
];

const PROJECT_CARDS = [
  { k: "ORF 01 · web", t: "TN TSA Event Selector", d: "Ranks competitive events against a member's strengths. 3,100 members.", link: "https://tntsaeventselector.com" },
  { k: "ORF 02 · react native", t: "ExerciseBud", d: "HealthKit + Health Connect steps, four-week plans, friends leaderboard." },
  { k: "ORF 03 · next.js", t: "Unitywall Profit Analysis", d: "Quotes vs. true costs for a web agency: hours, margins, variance.", link: "https://unitydashboard.vercel.app/" },
  { k: "ORF 04 · selenium", t: "Vanderbilt Professor Scraper", d: "200+ VUMC faculty into a sheet for guest-speaker invites." },
  { k: "ORF 05 · daily", t: "Stylize", d: "Picks an outfit from the forecast and color theory. Most-used thing I've built.", link: "https://stylize.base44.app" },
];

const AWARDS = [
  ["rs001", "2× DECA ICDC International Finalist, top 1% of 25,000+ competitors"],
  ["rs002", "Breakthrough Junior Challenge Finalist, top 15 of 2,500+ submissions worldwide"],
  ["rs003", "TSA Nationals: 6th in Data Science & Analytics, top 12 in Biotechnology Design; three state titles"],
  ["rs004", "Biotechnology Aptitude and Competency Credential (BACC), Biotility, University of Florida, 2026"],
  ["rs005", "INCubatoredu final pitch, $2,500 in funding, invited to pitch at the Nashville Entrepreneurship Center"],
];

const SERVICE = [
  ["Volunteer & tutor", "Salahadeen Center", "Tutored twelve students in Arabic weekly, mentored youth, helped organize prayers and community events."],
  ["General Assembly VP", "Model UN · YMCA Civic Engagement", "Helped coordinate a 700–900-delegate conference and chaired parliamentary debate for a 30-member committee."],
  ["Communications director", "ScienceFinds", "Connected 75+ students with Nashville STEM professors as guest speakers for the science club."],
];

const LANGUAGES = ["English", "Russian", "Arabic", "Uzbek"];
const WEEKENDS = ["rock climbing", "wrestling & calisthenics", "rubik's cubes", "chess", "traveling"];

const CODONS = "ATG GAT TCC AAG CTG TTC GGA CAT CCA TGA ACG TTA GCC AAT GTC TAG GCA TTC AGA CCT GGT AAC TGC ATA GCT CAG TTG ACC GTA TGC";

const COVERAGE = [14, 22, 36, 50, 62, 58, 78, 92, 100, 86, 70, 54];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function useViewport() {
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

/** Progress 0..1 of a tall section with a sticky child: 0 when its top hits the
 *  viewport top, 1 when its bottom reaches the viewport bottom. */
function useSectionProgress(ref, onFrame) {
  const cbRef = useRef(onFrame);
  cbRef.current = onFrame;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = travel <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / travel));
      cbRef.current(p, r);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ramp = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

// ---------------------------------------------------------------------------
// The specimen: a submetacentric chromosome with G-banding
// ---------------------------------------------------------------------------

const BANDS = [
  [64, 16, "#05070E", 0.55], [92, 8, "#fff", 0.1], [108, 28, "#05070E", 0.5], [146, 10, "#fff", 0.12],
  [164, 14, "#05070E", 0.55], [190, 10, "#05070E", 0.35], [242, 12, "#05070E", 0.5], [266, 8, "#fff", 0.12],
  [284, 32, "#05070E", 0.55], [326, 9, "#fff", 0.1], [344, 18, "#05070E", 0.45], [372, 12, "#fff", 0.14],
  [392, 36, "#05070E", 0.58], [438, 8, "#fff", 0.1], [452, 12, "#05070E", 0.4],
];

function Chromosome({ style }) {
  const P = "M -72 46 A 32 32 0 0 1 -8 46 C -2 110 -2 170 0 206 C -4 223 -28 223 -32 206 C -42 170 -78 110 -72 46 Z";
  const Q = "M -32 232 C -28 215 -4 215 0 232 C -1 320 -2 400 -8 458 A 35 35 0 0 1 -78 458 C -84 400 -48 320 -32 232 Z";
  return (
    <svg viewBox="-150 0 300 540" width="300" height="540" aria-hidden="true" style={{ display: "block", overflow: "visible", ...style }}>
      <defs>
        <linearGradient id="chr-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6B7694" /><stop offset="0.18" stopColor="#3A4461" /><stop offset="0.55" stopColor="#1B2338" /><stop offset="0.85" stopColor="#0D1222" /><stop offset="1" stopColor="#070A14" />
        </linearGradient>
        <linearGradient id="chr-spec" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.1" stopColor="#fff" stopOpacity="0" /><stop offset="0.24" stopColor="#fff" stopOpacity="0.28" /><stop offset="0.4" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="chr-tip" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id="chr-soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.6" /></filter>
        <filter id="chr-shadow" x="-40%" y="-20%" width="180%" height="150%"><feDropShadow dx="0" dy="24" stdDeviation="18" floodColor={INK} floodOpacity="0.3" /></filter>
        <path id="chr-p" d={P} />
        <path id="chr-q" d={Q} />
        <clipPath id="chr-clipL"><use href="#chr-p" /><use href="#chr-q" /></clipPath>
        <clipPath id="chr-clipR"><use href="#chr-p" transform="scale(-1 1)" /><use href="#chr-q" transform="scale(-1 1)" /></clipPath>
        <g id="chr-bands">
          {BANDS.map(([y, h, f, o], i) => <rect key={i} x="-150" y={y} width="300" height={h} fill={f} opacity={o} />)}
        </g>
        <g id="chr-tid"><use href="#chr-p" fill="url(#chr-body)" /><use href="#chr-q" fill="url(#chr-body)" /></g>
      </defs>
      <g filter="url(#chr-shadow)">
        <use href="#chr-tid" />
        <g clipPath="url(#chr-clipL)">
          <use href="#chr-bands" filter="url(#chr-soft)" />
          <use href="#chr-p" fill="url(#chr-spec)" /><use href="#chr-q" fill="url(#chr-spec)" />
          <circle cx="-40" cy="44" r="30" fill="url(#chr-tip)" /><circle cx="-43" cy="462" r="32" fill="url(#chr-tip)" />
        </g>
        <use href="#chr-tid" transform="scale(-1 1)" />
        <g clipPath="url(#chr-clipR)">
          <use href="#chr-bands" filter="url(#chr-soft)" />
          <use href="#chr-p" fill="url(#chr-spec)" transform="scale(-1 1)" /><use href="#chr-q" fill="url(#chr-spec)" transform="scale(-1 1)" />
          <circle cx="40" cy="44" r="30" fill="url(#chr-tip)" /><circle cx="43" cy="462" r="32" fill="url(#chr-tip)" />
        </g>
        <ellipse cx="0" cy="219" rx="24" ry="11" fill="#05070E" />
        <ellipse cx="-3" cy="215" rx="14" ry="5" fill="#3A4461" opacity="0.8" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Mono({ children, style, className = "" }) {
  return (
    <span className={className} style={{ fontFamily: MONO, fontSize: 12, color: MUTED, ...style }}>
      {children}
    </span>
  );
}

function ZoomControl({ zoom, setZoom, dark }) {
  const fg = dark ? PAPER : INK;
  const bg = dark ? NIGHT : PAPER;
  return (
    <div
      role="group"
      aria-label="zoom level"
      className="flex gap-1 p-[3px] rounded-md"
      style={{ border: `1px solid ${dark ? "rgba(255,255,255,.22)" : INK}`, background: bg, fontFamily: MONO, fontSize: 11 }}
    >
      {ZOOMS.map((z, i) => {
        const on = zoom === i;
        return (
          <button
            key={z}
            type="button"
            aria-pressed={on}
            onClick={() => setZoom(i)}
            className="px-2.5 py-1.5 rounded transition-colors duration-150"
            style={{ background: on ? fg : "transparent", color: on ? bg : dark ? "#8A93A8" : "#4B5563", cursor: "pointer", font: "inherit" }}
          >
            {z}
          </button>
        );
      })}
    </div>
  );
}

function H2({ children }) {
  return (
    <h2 style={{ margin: 0, fontFamily: SANS, fontSize: "clamp(32px, 3.4vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", color: INK, lineHeight: 1 }}>
      {children}
    </h2>
  );
}

function Pill({ href, children }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="inline-flex items-center px-3 py-2 rounded transition-colors duration-150 hover:bg-[#101828] hover:text-[#F7F6F2]"
      style={{ fontFamily: MONO, fontSize: 12, color: INK, border: `1px solid ${INK}`, textDecoration: "none" }}
    >
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Hero: sticky frame, scroll turns and zooms the chromosome
// ---------------------------------------------------------------------------

const BIO = "Builds software that makes sense of living things. First-year at Duke, neuroscience and computer science. Co-founder of Quest Learning.".split(" ");

function Hero({ reduced, zoom, setZoom, onLeave }) {
  const ref = useRef(null);
  const [p, setP] = useState(0);
  const leftRef = useRef(false);
  useSectionProgress(ref, (v) => {
    setP(v);
    if (v > 0.6 && !leftRef.current) {
      leftRef.current = true;
      onLeave();
    }
  });

  const rot = reduced ? 0 : p * 170;
  const scale = reduced ? 1 : 1 + ramp(p, 0.15, 1) * 2.6;
  const chrOpacity = reduced ? 1 : 1 - ramp(p, 0.62, 0.92);
  const textFade = reduced ? 1 : 1 - ramp(p, 0.55, 0.85);
  const revealed = reduced ? BIO.length : Math.round((0.42 + 0.58 * ramp(p, 0.02, 0.4)) * BIO.length);

  return (
    <section ref={ref} id="top" style={{ height: reduced ? "auto" : "260vh", position: "relative" }}>
      <div
        className="overflow-hidden"
        style={{ position: reduced ? "relative" : "sticky", top: 0, height: reduced ? "auto" : "100vh", minHeight: reduced ? "100vh" : undefined, borderBottom: `1px solid ${INK}` }}
      >
        {/* corners */}
        <Mono style={{ position: "absolute", left: 24, top: 20, color: INK }}>Adam Rakhmanov</Mono>
        <Mono className="hidden sm:block" style={{ position: "absolute", right: 24, top: 20 }}>chr-adam · chr1:1–2,400,000</Mono>
        <Mono className="hidden sm:block" style={{ position: "absolute", left: 24, bottom: 20 }}>Durham, NC · Duke '30 · Nashville</Mono>
        <div style={{ position: "absolute", right: 24, bottom: 20, zIndex: 3, opacity: textFade, pointerEvents: textFade < 0.3 ? "none" : "auto" }}>
          <ZoomControl zoom={zoom} setZoom={setZoom} />
        </div>

        {/* the specimen */}
        <div
          className="adam-chr-stage"
          style={{
            position: "absolute",
            right: "clamp(8px, 10vw, 180px)",
            top: "clamp(48px, 10vh, 110px)",
            width: "clamp(150px, 24vw, 320px)",
            aspectRatio: "300 / 540",
            opacity: chrOpacity,
            transform: `rotateY(${rot}deg) scale(${scale})`,
            transformOrigin: "50% 44%",
            transformStyle: "preserve-3d",
            willChange: "transform, opacity",
            zIndex: 1,
          }}
        >
          <div className={reduced ? "" : "adam-chr-idle"} style={{ width: "100%", height: "100%", transformStyle: "preserve-3d" }}>
            <Chromosome style={{ width: "100%", height: "100%" }} />
          </div>
          <Mono className="hidden lg:block" style={{ position: "absolute", left: "-44%", top: "16%", whiteSpace: "nowrap", opacity: textFade }}>p13 · work</Mono>
          <Mono className="hidden lg:block" style={{ position: "absolute", right: "-36%", top: "68%", whiteSpace: "nowrap", opacity: textFade }}>q22 · projects</Mono>
        </div>

        {/* headline over the object */}
        <div style={{ position: "absolute", left: 24, right: 24, bottom: "clamp(72px, 12vh, 110px)", zIndex: 2, opacity: textFade, display: "flex", flexDirection: "column", gap: 20 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: SANS,
              fontWeight: 600,
              fontSize: "clamp(56px, 13.5vw, 200px)",
              lineHeight: 0.86,
              letterSpacing: "-0.045em",
              color: INK,
            }}
          >
            Adam
            <br />
            Rakhmanov
          </h1>
          <p style={{ margin: 0, maxWidth: "44ch", fontFamily: SANS, fontSize: "clamp(16px, 1.6vw, 22px)", lineHeight: 1.4, color: BODY }}>
            {BIO.map((w, i) => (
              <span key={i} style={{ color: i < revealed ? BODY : "rgba(55,65,81,0.22)", transition: "color 0.25s" }}>
                {w}{" "}
              </span>
            ))}
          </p>
        </div>

        <Mono className="hidden md:block" style={{ position: "absolute", left: "50%", bottom: 20, transform: "translateX(-50%)", color: BLUE, whiteSpace: "nowrap", opacity: 1 - ramp(p, 0, 0.15) }}>
          ▸ ATG GCT GAC GCA ATG · scroll to unwind ↓
        </Mono>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Browser chrome: sticky locus + ruler + zoom, with codon ticker
// ---------------------------------------------------------------------------

const STOPS = [
  ["index", "#index"],
  ["helix", "#helix"],
  ["coverage", "#coverage"],
  ["variants", "#variants"],
  ["3'", "#end"],
];

function Chrome({ zoom, setZoom }) {
  const [frac, setFrac] = useState(0);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const doc = document.documentElement;
        const max = Math.max(1, doc.scrollHeight - window.innerHeight);
        setFrac(window.scrollY / max);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  const locus = Math.round(1 + frac * 2_399_999).toLocaleString("en-US");

  return (
    <div className="sticky top-0" style={{ zIndex: 30, background: "rgba(247,246,242,0.94)", backdropFilter: "blur(6px)", borderBottom: `1px solid ${RULE}` }}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2.5">
        <div className="flex items-center gap-2.5" style={{ fontFamily: MONO, fontSize: 12 }}>
          <a href="#top" style={{ color: INK, fontWeight: 700, textDecoration: "none" }}>chr-adam</a>
          <span className="px-2 py-1 rounded" style={{ border: `1px solid ${RULE}`, color: BODY, background: "#fff", minWidth: 150, textAlign: "center" }}>
            chr1:{locus}
          </span>
        </div>
        <div className="flex-1 min-w-[200px] flex flex-col gap-1">
          <div className="flex justify-between" style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
            <span>5'</span>
            {STOPS.map(([label, href]) => (
              <a key={label} href={href} style={{ color: MUTED, textDecoration: "none" }} className="hover:underline">
                {label}
              </a>
            ))}
          </div>
          <div style={{ position: "relative", height: 7, borderTop: `1px solid ${INK}` }}>
            {Array.from({ length: 25 }, (_, i) => (
              <span key={i} style={{ position: "absolute", left: `${(i / 24) * 100}%`, top: 0, width: 1, height: i % 4 === 0 ? 7 : 4, background: INK }} />
            ))}
            <span style={{ position: "absolute", left: `${frac * 100}%`, top: -4, width: 2, height: 10, background: BLUE, transform: "translateX(-1px)" }} />
          </div>
        </div>
        <div className="hidden sm:block">
          <ZoomControl zoom={zoom} setZoom={setZoom} />
        </div>
      </div>
      <div className="overflow-hidden border-t py-1" style={{ borderColor: RULE }} aria-hidden="true">
        <div style={{ display: "flex", width: "max-content", whiteSpace: "nowrap", transform: `translateX(${-(frac * 2400) % 1800}px)`, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "rgba(107,114,128,0.8)" }}>
          {[0, 1, 2].map((n) => (
            <span key={n} className="pr-8">{`5' ▸ ${CODONS} ▸ ${CODONS} ▸ 3' /// `}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Index: the dense table
// ---------------------------------------------------------------------------

function Index({ zoom }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (no) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(no)) n.delete(no);
      else n.add(no);
      return n;
    });

  return (
    <section id="index" className="px-6 pt-12 pb-16" style={{ scrollMarginTop: 90 }}>
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
        <H2>Index</H2>
        <Mono>{ZOOMS[zoom]} view · {LOCI.length} loci · {zoom === 2 ? "all expanded" : zoom === 1 ? "click a row to expand" : "loci only"}</Mono>
      </div>
      <div style={{ borderBottom: `1px solid ${RULE}` }}>
        <div className="adam-row hidden md:grid" style={{ borderTop: 0, padding: "6px 0" }}>
          {["no.", "locus", "feature", "organism", "span", "strand"].map((h) => <Mono key={h}>{h}</Mono>)}
        </div>
        {LOCI.map((l) => {
          const expanded = zoom === 2 || (zoom === 1 && open.has(l.no));
          return (
            <div key={l.no} className="adam-row" style={{ background: expanded ? "#fff" : "transparent" }}>
              <Mono className="hidden md:block">{l.no}</Mono>
              <Mono style={{ color: l.color, fontWeight: 700 }}>{l.locus}</Mono>
              <div className="min-w-0 flex flex-col gap-2.5">
                <button
                  type="button"
                  aria-expanded={expanded}
                  disabled={zoom !== 1}
                  onClick={() => toggle(l.no)}
                  className="text-left"
                  style={{ font: "inherit", fontFamily: SANS, fontSize: 16, fontWeight: 600, color: INK, background: "none", border: 0, padding: 0, cursor: zoom === 1 ? "pointer" : "default" }}
                >
                  {l.feature}
                </button>
                <span className="md:hidden" style={{ fontFamily: SANS, fontSize: 14, color: BODY }}>{l.org} · <Mono>{l.span}</Mono></span>
                {expanded && (
                  <div className="flex flex-col gap-2" style={{ maxWidth: "62ch", fontFamily: SANS, fontSize: 15, lineHeight: 1.6, color: BODY }}>
                    <p style={{ margin: 0 }}>{l.body}</p>
                    {zoom === 2 && l.more && <p style={{ margin: 0 }}>{l.more}</p>}
                  </div>
                )}
              </div>
              <span className="hidden md:block" style={{ fontFamily: SANS, fontSize: 15, color: BODY }}>{l.org}</span>
              <Mono className="hidden md:block">{l.span}</Mono>
              <Mono className="hidden md:block">{l.strand}</Mono>
            </div>
          );
        })}
      </div>
      {zoom === 0 && (
        <Mono style={{ display: "block", marginTop: 14 }}>chromosome view shows loci only. zoom to gene for detail.</Mono>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// The double helix: ten cards on a 3D spiral
// ---------------------------------------------------------------------------

function HelixCard({ c, strand, style, cardRef }) {
  const accent = strand === "A" ? BLUE : MAG;
  const inner = (
    <>
      <span style={{ fontFamily: MONO, fontSize: 11, color: strand === "A" ? "#8FB0FF" : "#FF7AB6" }}>{c.k}</span>
      <span style={{ fontFamily: SANS, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15, color: PAPER }}>{c.t}{c.link ? " ↗" : ""}</span>
      <span style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.45, color: "#B8BFCF" }}>{c.d}</span>
    </>
  );
  const base = {
    boxSizing: "border-box",
    padding: "18px 20px",
    borderRadius: 8,
    background: "#141B2E",
    border: `1px solid ${accent}`,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    textDecoration: "none",
    ...style,
  };
  return c.link ? (
    <a ref={cardRef} href={c.link} target="_blank" rel="noreferrer" style={base}>{inner}</a>
  ) : (
    <div ref={cardRef} style={base}>{inner}</div>
  );
}

function Helix({ reduced, zoom, setZoom }) {
  const ref = useRef(null);
  const groupRef = useRef(null);
  const cardRefs = useRef([]);
  const { w } = useViewport();
  const R = clamp(w * 0.3, 150, 420);
  const cardW = w < 640 ? 230 : 300;
  const stepY = w < 640 ? 78 : 92;

  const cards = useMemo(() => {
    const list = [];
    WORK_CARDS.forEach((c, i) => list.push({ c, strand: "A", angle: i * 72, y: i * stepY - 2 * stepY }));
    PROJECT_CARDS.forEach((c, i) => list.push({ c, strand: "B", angle: i * 72 + 180, y: i * stepY - 2 * stepY }));
    return list;
  }, [stepY]);

  useSectionProgress(ref, (p) => {
    if (reduced) return;
    const g = groupRef.current;
    if (!g) return;
    const rot = -30 + p * 720;
    g.style.transform = `rotateX(-8deg) rotateY(${rot}deg)`;
    cards.forEach((card, i) => {
      const el = cardRefs.current[i];
      if (!el) return;
      const facing = Math.cos(((card.angle + rot) * Math.PI) / 180);
      el.style.opacity = String(0.18 + 0.82 * Math.max(0, facing));
      el.style.pointerEvents = facing > 0.5 ? "auto" : "none";
    });
  });

  if (reduced) {
    return (
      <section id="helix" className="px-6 py-16" style={{ background: NIGHT, color: PAPER, scrollMarginTop: 90 }}>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-8">
          <h2 style={{ margin: 0, fontFamily: SANS, fontSize: "clamp(32px, 3.4vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em" }}>Work &amp; projects</h2>
          <Mono style={{ color: "#8A93A8" }}>base pair view · 10 features</Mono>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {cards.map(({ c, strand }, i) => <HelixCard key={i} c={c} strand={strand} />)}
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} id="helix" style={{ height: "320vh", background: NIGHT, color: PAPER }}>
      <div className="sticky top-0 overflow-hidden" style={{ height: "100vh" }}>
        <Mono style={{ position: "absolute", left: 24, top: 84, color: "#8A93A8" }}>base pair view · 10 features</Mono>
        <Mono className="hidden sm:block" style={{ position: "absolute", right: 24, top: 84, color: "#8A93A8" }}>chr1:1,300,000–1,900,000</Mono>
        <div style={{ position: "absolute", left: 24, bottom: 24, zIndex: 2, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: SANS, fontSize: "clamp(28px, 3.2vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>Work &amp; projects</span>
          <Mono style={{ color: "#8A93A8" }}>two strands · scroll turns the helix</Mono>
        </div>
        <div className="hidden sm:block" style={{ position: "absolute", right: 24, bottom: 24, zIndex: 2 }}>
          <ZoomControl zoom={zoom} setZoom={setZoom} dark />
        </div>

        <div style={{ position: "absolute", inset: "0 0 8vh 0", perspective: 1600 }}>
          <div ref={groupRef} style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: "rotateX(-8deg) rotateY(-30deg)", willChange: "transform" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={`rung-${i}`}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: R * 2,
                  height: 2,
                  margin: `-1px 0 0 ${-R}px`,
                  background: `linear-gradient(90deg, transparent, ${BLUE} 18%, ${MAG} 82%, transparent)`,
                  transform: `translateY(${i * stepY - 2 * stepY}px) rotateY(${i * 72}deg)`,
                }}
              />
            ))}
            {cards.map(({ c, strand, angle, y }, i) => (
              <HelixCard
                key={i}
                c={c}
                strand={strand}
                cardRef={(el) => { cardRefs.current[i] = el; }}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: cardW,
                  height: 150,
                  margin: `-75px 0 0 ${-cardW / 2}px`,
                  transform: `translateY(${y}px) rotateY(${angle}deg) translateZ(${R}px)`,
                  backfaceVisibility: "hidden",
                }}
              />
            ))}
          </div>
        </div>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 50%, rgba(11,15,26,0) 36%, rgba(11,15,26,.88) 76%)" }} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coverage + Variants
// ---------------------------------------------------------------------------

function Coverage({ zoom }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section id="coverage" ref={ref} className="flex flex-col gap-4" style={{ scrollMarginTop: 90 }}>
      <H2>Coverage</H2>
      <Mono>research · 2023–2026 · Drosophila</Mono>
      <p style={{ margin: 0, maxWidth: "54ch", fontFamily: SANS, fontSize: 16, lineHeight: 1.6, color: BODY }}>
        Three years of bench work: DNA extraction, PCR, gene cloning, CRISPR editing. Two independent Drosophila projects on human-health questions.
        {zoom >= 1 && " The bottleneck was analysis, never pipetting. That pointed me at computational biology."}
      </p>
      <div className="flex items-end gap-[3px] mt-2" style={{ height: 120, borderBottom: `1px solid ${RULE}` }}>
        {COVERAGE.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: seen ? `${h}%` : "4%",
              background: BLUE,
              opacity: 0.35 + 0.65 * (h / 100),
              transition: `height 0.9s cubic-bezier(0.16,1,0.3,1) ${i * 45}ms`,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between"><Mono>2023</Mono><Mono>PCR</Mono><Mono>cloning</Mono><Mono>CRISPR</Mono><Mono>2026</Mono></div>
    </section>
  );
}

function Variants({ zoom }) {
  const awards = zoom === 0 ? AWARDS.slice(0, 2) : zoom === 1 ? AWARDS.slice(0, 3) : AWARDS;
  return (
    <section id="variants" className="flex flex-col gap-4" style={{ scrollMarginTop: 90 }}>
      <H2>Variants</H2>
      <Mono>awards · {AWARDS.length} calls · showing {awards.length} · filter: PASS</Mono>
      <div style={{ position: "relative", height: 20, borderBottom: "1px solid #9CA3AF", marginBottom: 8 }}>
        {[8, 26, 49, 70, 88].map((x, i) => (
          <span key={x} style={{ position: "absolute", left: `${x}%`, bottom: -5, width: 10, height: 10, borderRadius: "50%", background: i < awards.length ? MAG : RULE }} />
        ))}
      </div>
      <div style={{ borderBottom: `1px solid ${RULE}` }}>
        {awards.map(([id, text]) => (
          <div key={id} className="grid gap-4 py-3" style={{ gridTemplateColumns: "72px minmax(0,1fr)", borderTop: `1px solid ${RULE}` }}>
            <Mono style={{ color: MAG }}>{id}</Mono>
            <span style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.5, color: INK }}>{text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BasePairExtras() {
  return (
    <section className="px-6 pb-16 grid md:grid-cols-2 gap-12">
      <div className="flex flex-col gap-4">
        <H2>Service</H2>
        <Mono>base pair view only</Mono>
        <div style={{ borderBottom: `1px solid ${RULE}` }}>
          {SERVICE.map(([role, org, d]) => (
            <div key={org} className="py-4 flex flex-col gap-1" style={{ borderTop: `1px solid ${RULE}` }}>
              <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: INK }}>{role}</span>
              <Mono>{org}</Mono>
              <p style={{ margin: "4px 0 0", fontFamily: SANS, fontSize: 15, lineHeight: 1.55, color: BODY, maxWidth: "56ch" }}>{d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <H2>Off the computer</H2>
        <Mono>languages · most weekends</Mono>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => <span key={l} className="px-3 py-1.5 rounded" style={{ fontFamily: MONO, fontSize: 12, color: INK, border: `1px solid ${INK}` }}>{l.toLowerCase()}</span>)}
        </div>
        <p style={{ margin: 0, fontFamily: SANS, fontSize: 15, lineHeight: 1.55, color: BODY, maxWidth: "48ch" }}>Grew up between Tashkent, Cairo, and Nashville. That's where the four come from.</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {WEEKENDS.map((l) => <span key={l} className="px-3 py-1.5 rounded" style={{ fontFamily: MONO, fontSize: 12, color: BODY, border: `1px solid ${RULE}` }}>{l}</span>)}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Adam() {
  const reduced = useReducedMotion();
  const [zoom, setZoom] = useState(0);
  const onLeaveHero = useCallback(() => setZoom((z) => (z === 0 ? 1 : z)), []);

  useEffect(() => {
    const prev = document.title;
    document.title = "Adam Rakhmanov";
    return () => { document.title = prev; };
  }, []);

  return (
    <div style={{ background: PAPER, color: INK, fontFamily: SANS, minHeight: "100vh", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        html { scroll-behavior: smooth; }
        .adam-chr-stage { perspective: 1400px; }
        @keyframes adam-chr-idle {
          0%   { transform: rotateX(8deg) rotateY(-32deg) rotateZ(-3deg); }
          50%  { transform: rotateX(-6deg) rotateY(32deg) rotateZ(3deg); }
          100% { transform: rotateX(8deg) rotateY(-32deg) rotateZ(-3deg); }
        }
        .adam-chr-idle { animation: adam-chr-idle 10s ease-in-out infinite; }
        .adam-row {
          display: grid;
          grid-template-columns: 56px 110px minmax(0,1fr) 220px 130px 60px;
          gap: 24px;
          align-items: baseline;
          padding: 18px 0;
          border-top: 1px solid ${RULE};
          transition: background 0.15s;
        }
        .adam-row:hover { background: #fff; }
        @media (max-width: 767px) {
          .adam-row { grid-template-columns: 76px minmax(0,1fr); gap: 14px; padding: 14px 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .adam-chr-idle { animation: none; }
        }
      `}</style>

      <Hero reduced={reduced} zoom={zoom} setZoom={setZoom} onLeave={onLeaveHero} />
      <Chrome zoom={zoom} setZoom={setZoom} />

      <main>
        <Index zoom={zoom} />
        <Helix reduced={reduced} zoom={zoom} setZoom={setZoom} />
        <div className="px-6 py-16 grid md:grid-cols-2 gap-12" style={{ borderBottom: `1px solid ${RULE}` }}>
          <Coverage zoom={zoom} />
          <Variants zoom={zoom} />
        </div>
        {zoom === 2 && <BasePairExtras />}
      </main>

      <footer id="end" className="px-6 py-8 flex flex-wrap items-end justify-between gap-4" style={{ scrollMarginTop: 90 }}>
        <div className="flex flex-col gap-3">
          <span style={{ fontFamily: SANS, fontSize: "clamp(32px, 3.4vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>3' end</span>
          <div className="flex flex-wrap gap-2">
            <Pill href="mailto:adamrakhmanovit@gmail.com">email</Pill>
            <Pill href="tel:+16157088786">(615) 708-8786</Pill>
            <Pill href="https://www.linkedin.com/in/adamrakhmanov/">linkedin ↗</Pill>
            <Pill href="https://www.questlearning.co">quest learning ↗</Pill>
          </div>
        </div>
        <Mono>chr-adam · assembled 2026 · Durham, NC</Mono>
      </footer>
    </div>
  );
}
