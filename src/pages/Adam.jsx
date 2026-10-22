/**
 * Adam.jsx — a standalone personal site for Adam (Abduazim) Rakhmanov, served
 * at /adam. Public route (no auth, no app chrome) so it works as a shareable
 * bio link. Intentionally not linked anywhere in the app.
 *
 * Design: "chr-adam" — the page is a genome browser and Adam's life is one
 * chromosome. Scrolling pans along it.
 *   - hero: four corners of mono metadata, one 200px headline, and one object:
 *     a CSS-3D puzzle cube (sweep a row to turn it, click to scramble). Scroll
 *     spins and zooms it, then the DNA assembles like a sequence loading.
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
// The specimen: a 3×3 puzzle cube in CSS 3D. Sweep across a row to turn it,
// click to scramble. Stickers use the page's base-pair colours. Written from
// scratch; 26 cubies, each face its own element, so it is editable and cheap.
// ---------------------------------------------------------------------------

const STICKER = {
  px: MAG,       // right
  nx: "#E0B23A", // left
  py: "#2E9E6B", // bottom (y is down in CSS)
  ny: PAPER,     // top
  pz: BLUE,      // front
  nz: "#8B5CF6", // back
};

const FACE_T = (half) => ({
  px: `rotateY(90deg) translateZ(${half}px)`,
  nx: `rotateY(-90deg) translateZ(${half}px)`,
  py: `rotateX(-90deg) translateZ(${half}px)`,
  ny: `rotateX(90deg) translateZ(${half}px)`,
  pz: `translateZ(${half}px)`,
  nz: `rotateY(180deg) translateZ(${half}px)`,
});

function rotVec([x, y, z], axis, dir) {
  if (axis === "y") return [z * dir, y, -x * dir];
  if (axis === "x") return [x, -z * dir, y * dir];
  return [-y * dir, x * dir, z];
}

function makeCubies() {
  const list = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (!x && !y && !z) continue;
    list.push({
      id: `${x}${y}${z}`,
      pos: [x, y, z],
      orient: "",
      stickers: { px: x === 1, nx: x === -1, py: y === 1, ny: y === -1, pz: z === 1, nz: z === -1 },
    });
  }
  return list;
}

function PuzzleCube({ size = 240, style }) {
  const [cubies, setCubies] = useState(makeCubies);
  const [anim, setAnim] = useState(null); // { axis, layer, dir, angle }
  const queue = useRef([]);
  const animRef = useRef(null);
  const sweep = useRef({ x: 0, y: 0, dx: 0, dy: 0, has: false });
  const c = size / 3;
  const gap = Math.max(3, size * 0.016);
  const half = (c - gap) / 2;
  const faceT = useMemo(() => FACE_T(half), [half]);

  const startMove = useCallback((move) => {
    if (animRef.current) { queue.current.push(move); return; }
    animRef.current = { ...move, angle: 0, t0: 0 };
    setAnim(animRef.current);
    const dur = 240;
    const step = (now) => {
      const a = animRef.current;
      if (!a) return;
      if (!a.t0) a.t0 = now;
      const k = clamp((now - a.t0) / dur, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      a.angle = e * 90 * a.dir;
      setAnim({ ...a });
      if (k < 1) { requestAnimationFrame(step); return; }
      // commit: rotate positions and prepend the rotation to each orientation
      setCubies((prev) =>
        prev.map((q) => {
          const idx = { x: 0, y: 1, z: 2 }[a.axis];
          if (q.pos[idx] !== a.layer) return q;
          const rot = `rotate${a.axis.toUpperCase()}(${90 * a.dir}deg)`;
          return { ...q, pos: rotVec(q.pos, a.axis, a.dir), orient: `${rot} ${q.orient}` };
        })
      );
      animRef.current = null;
      setAnim(null);
      const next = queue.current.shift();
      if (next) requestAnimationFrame(() => startMove(next));
    };
    requestAnimationFrame(step);
  }, []);

  const scramble = () => {
    const axes = ["x", "y", "z"];
    for (let i = 0; i < 10; i++) {
      startMove({ axis: axes[Math.floor(Math.random() * 3)], layer: Math.floor(Math.random() * 3) - 1, dir: Math.random() < 0.5 ? 1 : -1 });
    }
  };

  // sweep across a row (horizontal) turns that y-layer; sweep down a column turns that x-layer
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    const x = pt.clientX - r.left, y = pt.clientY - r.top;
    const S = sweep.current;
    if (!S.has) { S.x = x; S.y = y; S.dx = 0; S.dy = 0; S.has = true; return; }
    S.dx += x - S.x; S.dy += y - S.y; S.x = x; S.y = y;
    const row = clamp(Math.floor((y / r.height) * 3), 0, 2) - 1;
    const col = clamp(Math.floor((x / r.width) * 3), 0, 2) - 1;
    const th = r.width * 0.22;
    if (Math.abs(S.dx) > th && Math.abs(S.dx) > Math.abs(S.dy)) {
      startMove({ axis: "y", layer: row, dir: S.dx > 0 ? 1 : -1 });
      S.dx = 0; S.dy = 0;
    } else if (Math.abs(S.dy) > th) {
      startMove({ axis: "x", layer: col, dir: S.dy > 0 ? -1 : 1 });
      S.dx = 0; S.dy = 0;
    }
  };
  const onLeave = () => { sweep.current.has = false; };

  return (
    <div
      role="img"
      aria-label="interactive puzzle cube"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onTouchMove={onMove}
      onTouchEnd={onLeave}
      onClick={scramble}
      style={{ width: size, height: size, position: "relative", cursor: "grab", touchAction: "none", transformStyle: "preserve-3d", ...style }}
    >
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, transformStyle: "preserve-3d" }}>
        {cubies.map((q) => {
          const idx = { x: 0, y: 1, z: 2 }[anim ? anim.axis : "x"];
          const inLayer = anim && q.pos[idx] === anim.layer;
          const layerRot = inLayer ? `rotate${anim.axis.toUpperCase()}(${anim.angle}deg) ` : "";
          const [x, y, z] = q.pos;
          return (
            <div
              key={q.id}
              style={{
                position: "absolute",
                width: c - gap,
                height: c - gap,
                margin: -(c - gap) / 2,
                transformStyle: "preserve-3d",
                transform: `${layerRot}translate3d(${x * c}px, ${y * c}px, ${z * c}px) ${q.orient}`,
              }}
            >
              {Object.keys(faceT).map((f) => (
                <div
                  key={f}
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: faceT[f],
                    backfaceVisibility: "hidden",
                    background: "#0B0F1A",
                    borderRadius: size * 0.03,
                    boxSizing: "border-box",
                    padding: size * 0.012,
                  }}
                >
                  {q.stickers[f] && (
                    <div style={{ width: "100%", height: "100%", borderRadius: size * 0.022, background: STICKER[f], boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12), inset 0 -6px 10px rgba(0,0,0,0.12), inset 0 6px 10px rgba(255,255,255,0.22)" }} />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
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

// ---------------------------------------------------------------------------
// Ball-and-stick DNA, canvas 2D. The hero's second act: the chromosome unwinds
// into this. Scroll spins it, the cursor unzips base pairs where it passes,
// a click flicks it. Written from scratch; no three.js.
// ---------------------------------------------------------------------------

const BASES = "ATGCGTACCGATTAGCATGCCGTAATGCAGTCCGATAGCTTAGCCGATGCATAGGCTAACG";
const BASE_COLOR = { A: "#2457C5", T: "#E0B23A", G: "#2E9E6B", C: "#8B5CF6" };

function DnaHelix({ opacity, spin, active, build = 1 }) {
  const canvasRef = useRef(null);
  const st = useRef({ mouse: null, unzip: new Float32Array(BASES.length), vel: 0, rot: 0, t: 0, raf: 0 });
  const propsRef = useRef({ opacity, spin, active, build });
  propsRef.current = { opacity, spin, active, build };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const S = st.current;
    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const N = BASES.length;
    const draw = (now) => {
      S.raf = 0;
      const { opacity: op, spin: sp, active: on, build: bd } = propsRef.current;
      if (!on || op <= 0.01) { ctx.clearRect(0, 0, w, h); return; }
      const dt = Math.min(0.05, (now - S.t) / 1000 || 0.016);
      S.t = now;
      S.vel *= 0.96;
      S.rot += dt * (0.35 + S.vel);
      const rot = S.rot + sp;

      const L = Math.min(w * 0.86, 1500);
      const R = Math.min(92, w * 0.066);
      const pitch = L / N;
      const tilt = w < 640 ? 0.0 : -0.42;
      const f = 900;
      const cx = w / 2, cy = h * 0.52;
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);

      const items = [];
      // loading: base pairs assemble from the 5' end as `build` climbs 0 → 1
      const built = bd * N;
      for (let i = 0; i < N; i++) {
        if (i > built + 1) break;
        const fadeIn = clamp(built - i + 1, 0, 1);
        const x = -L / 2 + i * pitch;
        // unzip target from cursor distance along the (tilted) axis
        let target = 0;
        if (S.mouse) {
          const mx = S.mouse.x - cx, my = S.mouse.y - cy;
          const ax = mx * cosT + my * sinT;
          const d = Math.abs(ax - x);
          target = clamp(1 - d / 190, 0, 1);
          target = target * target * (3 - 2 * target);
        }
        S.unzip[i] += (target - S.unzip[i]) * 0.12;
        const u = S.unzip[i];
        const a = i * 0.36 + rot;
        const sep = R * (1 + u * 1.7);
        const pts = [
          [x, Math.cos(a) * sep, Math.sin(a) * sep, "A"],
          [x, Math.cos(a + Math.PI) * sep, Math.sin(a + Math.PI) * sep, "B"],
        ];
        const proj = pts.map(([px, py, pz, k]) => {
          const rx = px * cosT - py * sinT, ry = px * sinT + py * cosT;
          const sc = f / (f + pz + 300);
          return { sx: cx + rx * sc, sy: cy + ry * sc, z: pz, sc, k };
        });
        items.push({ kind: "rung", i, u, fadeIn, a: proj[0], b: proj[1], z: (proj[0].z + proj[1].z) / 2 });
        proj.forEach((q) => items.push({ kind: "ball", z: q.z, sx: q.sx, sy: q.sy, sc: q.sc * (0.4 + 0.6 * fadeIn), k: q.k, fadeIn }));
      }
      items.sort((m, n) => m.z - n.z);

      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = op;
      for (const it of items) {
        if (it.kind === "rung") {
          const col = BASE_COLOR[BASES[it.i]];
          const mx = (it.a.sx + it.b.sx) / 2, my = (it.a.sy + it.b.sy) / 2;
          const gap = it.u * 0.55;
          ctx.lineWidth = 4.5 * it.a.sc;
          ctx.lineCap = "round";
          ctx.strokeStyle = col;
          ctx.globalAlpha = op * it.fadeIn * (0.55 + 0.45 * ((it.z + 100) / 200));
          ctx.beginPath();
          ctx.moveTo(it.a.sx, it.a.sy);
          ctx.lineTo(it.a.sx + (mx - it.a.sx) * (1 - gap), it.a.sy + (my - it.a.sy) * (1 - gap));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(it.b.sx, it.b.sy);
          ctx.lineTo(it.b.sx + (mx - it.b.sx) * (1 - gap), it.b.sy + (my - it.b.sy) * (1 - gap));
          ctx.stroke();
          ctx.globalAlpha = op;
        } else {
          const r = 8.5 * it.sc;
          ctx.globalAlpha = op * it.fadeIn;
          const base = it.k === "A" ? [36, 87, 197] : [194, 24, 91];
          const g = ctx.createRadialGradient(it.sx - r * 0.35, it.sy - r * 0.35, r * 0.1, it.sx, it.sy, r);
          g.addColorStop(0, `rgb(${base[0] + 90},${base[1] + 90},${base[2] + 70})`);
          g.addColorStop(0.6, `rgb(${base[0]},${base[1]},${base[2]})`);
          g.addColorStop(1, `rgb(${base[0] * 0.45},${base[1] * 0.45},${base[2] * 0.45})`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(it.sx, it.sy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = op;
        }
      }
      ctx.globalAlpha = 1;
    };
    const loop = (now) => {
      draw(now);
      S.raf = requestAnimationFrame(loop);
    };
    S.raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", resize);
      if (S.raf) cancelAnimationFrame(S.raf);
    };
  }, []);

  const onMove = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    st.current.mouse = { x: pt.clientX - r.left, y: pt.clientY - r.top };
  };
  const onLeave = () => { st.current.mouse = null; };
  const onClick = () => { st.current.vel += 2.2; };

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onTouchMove={onMove}
      onTouchEnd={onLeave}
      onClick={onClick}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: opacity > 0.01 ? 1 : 0, pointerEvents: opacity > 0.3 ? "auto" : "none", cursor: "crosshair" }}
    />
  );
}

function PopLetters({ text }) {
  return (
    <span style={{ display: "inline-block", perspective: 600 }}>
      {text.split("").map((ch, i) => (
        <span key={i} className="adam-letter" style={{ display: "inline-block", transformStyle: "preserve-3d" }}>{ch}</span>
      ))}
    </span>
  );
}

const BIO = "Builds software that makes sense of living things. First-year at Duke, neuroscience and computer science. Co-founder of Quest Learning.".split(" ");

function Hero({ reduced, zoom, setZoom, onLeave }) {
  const ref = useRef(null);
  const [p, setP] = useState(0);
  const leftRef = useRef(false);
  useSectionProgress(ref, (v) => {
    setP(v);
    if (v > 0.5 && !leftRef.current) {
      leftRef.current = true;
      onLeave();
    }
  });

  // Act 1 (p 0 → 0.4): chromosome turns, zooms, fades. Act 2 (0.4 → 1): the
  // DNA assembles base pair by base pair like a sequence loading, then hands
  // off to the index.
  const rot = reduced ? 0 : ramp(p, 0, 0.42) * 170;
  const scale = reduced ? 1 : 1 + ramp(p, 0.08, 0.42) * 2.6;
  const chrOpacity = reduced ? 1 : 1 - ramp(p, 0.3, 0.42);
  const dnaOpacity = reduced ? 0 : ramp(p, 0.36, 0.48) * (1 - ramp(p, 0.97, 1));
  const build = reduced ? 1 : ramp(p, 0.42, 0.86);
  const loaded = reduced ? 1 : ramp(p, 0.42, 0.9);
  const textFade = reduced ? 1 : 1 - ramp(p, 0.26, 0.4);
  const labelFade = reduced ? 1 : 1 - ramp(p, 0.06, 0.2);
  const revealed = reduced ? BIO.length : Math.round((0.42 + 0.58 * ramp(p, 0.02, 0.26)) * BIO.length);
  const { w: vw } = useViewport();
  const cubeSize = clamp(vw * 0.2, 130, 260);
  const bp = Math.round(loaded * 2_400_000);
  const steps = [
    [0.0, "reading sequence"],
    [0.3, "indexing loci"],
    [0.6, "calling variants"],
    [0.85, "assembly complete"],
  ];

  return (
    <section ref={ref} id="top" style={{ height: reduced ? "auto" : "420vh", position: "relative" }}>
      <div
        className="overflow-hidden"
        style={{ position: reduced ? "relative" : "sticky", top: 0, height: reduced ? "auto" : "100vh", minHeight: reduced ? "100vh" : undefined, borderBottom: `1px solid ${INK}` }}
      >
        {/* corners */}
        <Mono style={{ position: "absolute", left: 24, top: 20, color: INK }}>Adam Rakhmanov</Mono>
        <Mono className="hidden sm:block" style={{ position: "absolute", right: 24, top: 20 }}>chr-adam · chr1:1–2,400,000</Mono>
        <Mono className="hidden sm:block" style={{ position: "absolute", left: 24, bottom: 20, opacity: textFade }}>Durham, NC · Duke '30 · Nashville</Mono>
        <div style={{ position: "absolute", right: 24, bottom: 20, zIndex: 3, opacity: textFade, pointerEvents: textFade < 0.3 ? "none" : "auto" }}>
          <ZoomControl zoom={zoom} setZoom={setZoom} />
        </div>

        {/* second act: the chromosome unwinds into DNA */}
        {!reduced && <DnaHelix opacity={dnaOpacity} spin={p * 7} active={p > 0.34 && p < 0.999} build={build} />}
        {!reduced && (
          <div style={{ position: "absolute", left: 24, right: 24, bottom: 20, zIndex: 2, opacity: dnaOpacity, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <span style={{ fontFamily: SANS, fontSize: "clamp(22px, 2.6vw, 34px)", fontWeight: 600, letterSpacing: "-0.03em", color: INK }}>
                {loaded < 1 ? "assembling chr-adam" : "chr-adam ready"}
                <span className="adam-blink" style={{ color: BLUE }}>{loaded < 1 ? "…" : " ▸"}</span>
              </span>
              <Mono style={{ color: INK }}>{bp.toLocaleString("en-US")} / 2,400,000 bp · {Math.round(loaded * 100)}%</Mono>
            </div>
            <div style={{ height: 6, background: RULE, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${loaded * 100}%`, height: "100%", background: `linear-gradient(90deg, ${BLUE}, ${MAG})` }} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {steps.map(([at, label]) => {
                const done = loaded >= at + 0.12;
                const now = loaded >= at && !done;
                return (
                  <Mono key={label} style={{ color: done ? BLUE : now ? INK : MUTED, opacity: loaded >= at ? 1 : 0.35 }}>
                    {done ? "✓" : now ? "●" : "○"} {label}
                  </Mono>
                );
              })}
              <Mono className="hidden md:inline" style={{ marginLeft: "auto", color: MUTED }}>move along the helix to unzip · click to spin</Mono>
            </div>
          </div>
        )}

        {/* the specimen: a puzzle cube. idle turn, scroll spins and zooms it */}
        <div
          className="adam-chr-stage"
          style={{
            position: "absolute",
            right: "clamp(8px, 9vw, 170px)",
            top: "clamp(40px, 9vh, 100px)",
            width: cubeSize,
            height: cubeSize,
            opacity: chrOpacity,
            transform: `scale(${scale})`,
            willChange: "transform, opacity",
            zIndex: 1,
            pointerEvents: chrOpacity > 0.5 ? "auto" : "none",
          }}
        >
          {/* scroll rotation lives inside the perspective element so the cube stays solid while it turns */}
          <div style={{ width: "100%", height: "100%", transformStyle: "preserve-3d", transform: `rotateY(${rot}deg)` }}>
            <div className={reduced ? "" : "adam-chr-idle"} style={{ width: "100%", height: "100%", transformStyle: "preserve-3d", transform: "rotateX(-28deg) rotateY(-36deg)" }}>
              <PuzzleCube size={cubeSize} />
            </div>
          </div>
          <Mono className="hidden lg:block" style={{ position: "absolute", left: "50%", top: "calc(100% + 64px)", transform: "translateX(-50%)", whiteSpace: "nowrap", opacity: labelFade }}>sweep a row to turn it · click to scramble</Mono>
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
            <PopLetters text="Adam" />
            <br />
            <PopLetters text="Rakhmanov" />
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
  const innerRef = useRef(null);
  const sheenRef = useRef(null);
  // holographic tilt: the card leans toward the cursor and a sheen follows it
  const onMove = (e) => {
    const el = innerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateX(${(-py * 14).toFixed(2)}deg) rotateY(${(px * 16).toFixed(2)}deg) translateZ(12px)`;
    if (sheenRef.current) {
      sheenRef.current.style.opacity = "1";
      sheenRef.current.style.background = `radial-gradient(240px circle at ${(px + 0.5) * 100}% ${(py + 0.5) * 100}%, rgba(255,255,255,0.22), rgba(255,255,255,0.04) 40%, transparent 70%)`;
    }
  };
  const onLeave = () => {
    if (innerRef.current) innerRef.current.style.transform = "rotateX(0deg) rotateY(0deg) translateZ(0px)";
    if (sheenRef.current) sheenRef.current.style.opacity = "0";
  };
  const inner = (
    <div ref={innerRef} style={{ position: "relative", width: "100%", height: "100%", boxSizing: "border-box", padding: "16px 18px 16px 20px", borderRadius: 6, background: "rgba(20,27,46,0.92)", border: "1px solid rgba(255,255,255,0.12)", borderLeft: `3px solid ${accent}`, display: "flex", flexDirection: "column", gap: 8, transition: "transform 0.25s ease", transformStyle: "preserve-3d", overflow: "hidden", backdropFilter: "blur(4px)" }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: strand === "A" ? "#8FB0FF" : "#FF7AB6" }}>{c.k}</span>
      <span style={{ fontFamily: SANS, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15, color: PAPER }}>{c.t}{c.link ? " ↗" : ""}</span>
      <span style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.45, color: "#B8BFCF" }}>{c.d}</span>
      <div ref={sheenRef} aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0, transition: "opacity 0.3s", pointerEvents: "none", borderRadius: 8 }} />
    </div>
  );
  const base = { boxSizing: "border-box", textDecoration: "none", perspective: 700, ...style };
  return c.link ? (
    <a ref={cardRef} href={c.link} target="_blank" rel="noreferrer" style={base} onMouseMove={onMove} onMouseLeave={onLeave}>{inner}</a>
  ) : (
    <div ref={cardRef} style={base} onMouseMove={onMove} onMouseLeave={onLeave}>{inner}</div>
  );
}

function Helix({ reduced, zoom, setZoom }) {
  const ref = useRef(null);
  const canvasRef = useRef(null);
  const cardRefs = useRef([]);
  const { w, h: vh } = useViewport();
  const narrow = w < 768;
  const cardW = narrow ? 210 : 290;

  // Ten features on a vertical double helix: work on strand A (blue, angle θ),
  // projects on strand B (magenta, θ + π). Feature i sits on rung FEATURE_AT[i].
  const N = 40;
  const FEATURE_AT = useMemo(() => [3, 11, 19, 27, 35], []);
  const features = useMemo(() => {
    const list = [];
    WORK_CARDS.forEach((c, i) => list.push({ c, strand: "A", rung: FEATURE_AT[i] }));
    PROJECT_CARDS.forEach((c, i) => list.push({ c, strand: "B", rung: FEATURE_AT[i] }));
    return list;
  }, [FEATURE_AT]);

  const prog = useRef(0);
  useSectionProgress(ref, (p) => { prog.current = p; });

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf = 0, cw = 0, ch = 0, t0 = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = canvas.clientWidth; ch = canvas.clientHeight;
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (now) => {
      if (!t0) t0 = now;
      const idle = (now - t0) / 1000 * 0.12;
      const rot = -0.8 + prog.current * Math.PI * 3.2 + idle;
      const R = clamp(cw * (narrow ? 0.22 : 0.15), 80, 230);
      const H = ch * (narrow ? 0.78 : 0.8);
      const pitch = H / (N - 1);
      const f = 900;
      const cx = cw / 2, cy = ch * 0.5 - (narrow ? 20 : 0);

      const items = [];
      const featPos = new Array(features.length);
      for (let i = 0; i < N; i++) {
        const y = -H / 2 + i * pitch;
        const a = i * 0.5 + rot;
        const pts = [["A", a], ["B", a + Math.PI]].map(([k, ang]) => {
          const x3 = Math.cos(ang) * R, z3 = Math.sin(ang) * R;
          const sc = f / (f + 260 - z3);
          return { k, sx: cx + x3 * sc, sy: cy + y * sc, z: z3, sc, facing: z3 / R };
        });
        items.push({ kind: "rung", i, a: pts[0], b: pts[1], z: 0 });
        pts.forEach((q) => {
          const fi = features.findIndex((ft) => ft.rung === i && ft.strand === q.k);
          if (fi >= 0) featPos[fi] = q;
          items.push({ kind: "ball", ...q, feature: fi });
        });
      }
      items.sort((m, n) => m.z - n.z);

      ctx.clearRect(0, 0, cw, ch);
      // axis guide
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy - H / 2 - 30); ctx.lineTo(cx, cy + H / 2 + 30); ctx.stroke();

      // rungs: faint, drawn first so the backbones read on top
      for (const it of items) {
        if (it.kind !== "rung") continue;
        const depth = (it.a.z + it.b.z) / (2 * R);
        ctx.strokeStyle = `rgba(143,176,255,${0.08 + 0.14 * (depth + 1) / 2})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(it.a.sx, it.a.sy); ctx.lineTo(it.b.sx, it.b.sy); ctx.stroke();
      }
      // backbones: one continuous ribbon per strand, width and alpha by depth
      const balls = items.filter((it) => it.kind === "ball");
      for (const k of ["A", "B"]) {
        const pts = balls.filter((b) => b.k === k).sort((m, n) => m.sy - n.sy);
        const base = k === "A" ? "36,87,197" : "194,24,91";
        for (let j = 1; j < pts.length; j++) {
          const q0 = pts[j - 1], q1 = pts[j];
          const d = (q0.facing + q1.facing) / 2;
          ctx.strokeStyle = `rgba(${base},${0.25 + 0.65 * ((d + 1) / 2)})`;
          ctx.lineWidth = (2.2 + 2.6 * ((d + 1) / 2)) * q1.sc;
          ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(q0.sx, q0.sy); ctx.lineTo(q1.sx, q1.sy); ctx.stroke();
        }
      }
      for (const it of items) {
        if (it.kind === "rung") continue;
        {
          const isF = it.feature >= 0;
          const r = (isF ? 12 : 4.6) * it.sc;
          const base = it.k === "A" ? [36, 87, 197] : [194, 24, 91];
          const dim = 0.45 + 0.55 * ((it.facing + 1) / 2);
          if (isF) {
            const g2 = ctx.createRadialGradient(it.sx, it.sy, r * 0.6, it.sx, it.sy, r * 3.2);
            g2.addColorStop(0, `rgba(${base[0]},${base[1]},${base[2]},${0.35 * dim})`);
            g2.addColorStop(1, `rgba(${base[0]},${base[1]},${base[2]},0)`);
            ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(it.sx, it.sy, r * 3.2, 0, Math.PI * 2); ctx.fill();
          }
          const g = ctx.createRadialGradient(it.sx - r * 0.35, it.sy - r * 0.35, r * 0.1, it.sx, it.sy, r);
          g.addColorStop(0, `rgba(${base[0] + 110},${base[1] + 110},${base[2] + 80},${dim})`);
          g.addColorStop(0.6, `rgba(${base[0]},${base[1]},${base[2]},${dim})`);
          g.addColorStop(1, `rgba(${base[0] * 0.4},${base[1] * 0.4},${base[2] * 0.4},${dim})`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(it.sx, it.sy, r, 0, Math.PI * 2); ctx.fill();
          if (isF) {
            // locus tag beside the bead, like an annotation on a molecule
            const tag = features[it.feature].c.k.split(" ·")[0];
            const right = it.sx >= cx;
            ctx.font = `700 11px ${MONO}`;
            ctx.textAlign = right ? "left" : "right";
            ctx.textBaseline = "middle";
            ctx.fillStyle = `rgba(${it.k === "A" ? "143,176,255" : "255,122,182"},${0.35 + 0.65 * ((it.facing + 1) / 2)})`;
            ctx.fillText(tag, it.sx + (right ? r + 8 : -r - 8), it.sy);
          }
        }
      }

      // cards: hang off their bead, open when the bead swings to the front
      featPos.forEach((q, fi) => {
        const el = cardRefs.current[fi];
        if (!el || !q) return;
        const open = clamp((q.facing - 0.55) / 0.42, 0, 1);
        const eased = open * open * (3 - 2 * open);
        const right = q.sx >= cx;
        const gap = 70;
        // phones: the card sits under its bead, centered and kept on screen
        const left = narrow ? clamp(q.sx - cardW / 2, 12, cw - cardW - 12) : right ? q.sx + gap : q.sx - gap - cardW;
        const top = narrow ? q.sy + 28 : q.sy - 60;
        el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) scale(${(0.86 + 0.14 * eased).toFixed(3)})`;
        el.style.transformOrigin = narrow ? "50% 0%" : right ? "0% 50%" : "100% 50%";
        el.style.opacity = String(eased);
        el.style.pointerEvents = eased > 0.6 ? "auto" : "none";
        el.style.zIndex = String(Math.round(10 + eased * 10));
        if (eased > 0.05) {
          ctx.strokeStyle = q.k === "A" ? `rgba(143,176,255,${0.7 * eased})` : `rgba(255,122,182,${0.7 * eased})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(q.sx, q.sy);
          if (narrow) ctx.lineTo(q.sx, top); else ctx.lineTo(right ? left : left + cardW, q.sy);
          ctx.stroke();
        }
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { window.removeEventListener("resize", resize); if (raf) cancelAnimationFrame(raf); };
  }, [reduced, narrow, cardW, features, N]);

  if (reduced) {
    return (
      <section id="helix" className="px-6 py-16" style={{ background: NIGHT, color: PAPER, scrollMarginTop: 90 }}>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-8">
          <h2 style={{ margin: 0, fontFamily: SANS, fontSize: "clamp(32px, 3.4vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em" }}>Work &amp; projects</h2>
          <Mono style={{ color: "#8A93A8" }}>base pair view · 10 features</Mono>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {features.map(({ c, strand }, i) => <HelixCard key={i} c={c} strand={strand} style={{ minHeight: 150 }} />)}
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} id="helix" style={{ height: "420vh", background: NIGHT, color: PAPER }}>
      <div className="sticky top-0 overflow-hidden" style={{ height: "100vh" }}>
        <Mono style={{ position: "absolute", left: 24, top: 84, color: "#8A93A8", zIndex: 3 }}>base pair view · 10 features</Mono>
        <Mono className="hidden sm:block" style={{ position: "absolute", right: 24, top: 84, color: "#8A93A8", zIndex: 3 }}>chr1:1,300,000–1,900,000</Mono>
        <div style={{ position: "absolute", left: 24, bottom: 24, zIndex: 3, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
          <span style={{ fontFamily: SANS, fontSize: "clamp(28px, 3.2vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>Work &amp; projects</span>
          <Mono style={{ color: "#8A93A8" }}><span style={{ color: "#8FB0FF" }}>●</span> strand A work &nbsp; <span style={{ color: "#FF7AB6" }}>●</span> strand B projects &nbsp;· scroll turns the helix</Mono>
        </div>
        <div className="hidden sm:block" style={{ position: "absolute", right: 24, bottom: 24, zIndex: 3 }}>
          <ZoomControl zoom={zoom} setZoom={setZoom} dark />
        </div>

        <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        {features.map(({ c, strand }, i) => (
          <HelixCard
            key={i}
            c={c}
            strand={strand}
            cardRef={(el) => { cardRefs.current[i] = el; }}
            style={{ position: "absolute", left: 0, top: 0, width: cardW, minHeight: 120, opacity: 0, willChange: "transform, opacity" }}
          />
        ))}
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

// Constellation: the awards are the bright stars, the cursor draws lines to
// whatever is near it. Faint background stars are seeded, not random, so the
// sky is the same on every visit.
const FAINT_STARS = Array.from({ length: 46 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.678;
  return [a - Math.floor(a), b - Math.floor(b), 0.6 + ((i * 7) % 5) * 0.25];
});
const STAR_POS = [[0.1, 0.42], [0.3, 0.2], [0.5, 0.62], [0.7, 0.3], [0.88, 0.5]];

function Constellation({ lit }) {
  const ref = useRef(null);
  const mouse = useRef(null);
  const [hover, setHover] = useState(-1);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf = 0, w = 0, h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const draw = () => {
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      const m = mouse.current;
      for (const [fx, fy, r] of FAINT_STARS) {
        ctx.fillStyle = "rgba(16,24,40,0.28)";
        ctx.beginPath(); ctx.arc(fx * w, fy * h, r, 0, Math.PI * 2); ctx.fill();
      }
      if (m) {
        const near = [];
        FAINT_STARS.forEach(([fx, fy]) => { const d = Math.hypot(fx * w - m.x, fy * h - m.y); if (d < 120) near.push([fx * w, fy * h, d, false]); });
        STAR_POS.forEach(([fx, fy], i) => { if (i >= lit) return; const d = Math.hypot(fx * w - m.x, fy * h - m.y); if (d < 170) near.push([fx * w, fy * h, d, true]); });
        for (const [x, y, d, big] of near) {
          ctx.strokeStyle = big ? `rgba(194,24,91,${(1 - d / 170) * 0.9})` : `rgba(16,24,40,${(1 - d / 120) * 0.45})`;
          ctx.lineWidth = big ? 1.2 : 0.8;
          ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(x, y); ctx.stroke();
        }
        ctx.fillStyle = "rgba(36,87,197,0.9)";
        ctx.beginPath(); ctx.arc(m.x, m.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      STAR_POS.forEach(([fx, fy], i) => {
        const on = i < lit;
        const x = fx * w, y = fy * h;
        if (on) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
          g.addColorStop(0, "rgba(194,24,91,0.35)"); g.addColorStop(1, "rgba(194,24,91,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = on ? MAG : RULE;
        ctx.beginPath(); ctx.arc(x, y, on ? 5 : 4, 0, Math.PI * 2); ctx.fill();
      });
    };
    const tick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    tick();
    canvas.__tick = tick;
    return () => { window.removeEventListener("resize", resize); if (raf) cancelAnimationFrame(raf); };
  }, [lit]);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    const m = { x: pt.clientX - r.left, y: pt.clientY - r.top };
    mouse.current = m;
    let hi = -1;
    STAR_POS.forEach(([fx, fy], i) => { if (i < lit && Math.hypot(fx * r.width - m.x, fy * r.height - m.y) < 22) hi = i; });
    setHover(hi);
    ref.current.__tick && ref.current.__tick();
  };
  const onLeave = () => { mouse.current = null; setHover(-1); ref.current && ref.current.__tick && ref.current.__tick(); };
  return (
    <div style={{ position: "relative", height: 150, borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}`, background: "#fff", borderRadius: 6, overflow: "hidden" }}>
      <canvas ref={ref} aria-hidden="true" onMouseMove={onMove} onMouseLeave={onLeave} onTouchMove={onMove} onTouchEnd={onLeave} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "crosshair" }} />
      {hover >= 0 && (
        <Mono style={{ position: "absolute", left: `${STAR_POS[hover][0] * 100}%`, top: `${STAR_POS[hover][1] * 100}%`, transform: "translate(12px, -50%)", color: MAG, background: "#fff", padding: "2px 6px", pointerEvents: "none", whiteSpace: "nowrap" }}>
          {AWARDS[hover][0]} · {AWARDS[hover][1].split(",")[0]}
        </Mono>
      )}
      <Mono style={{ position: "absolute", left: 10, bottom: 8, pointerEvents: "none" }}>move to connect the calls</Mono>
    </div>
  );
}

function Variants({ zoom }) {
  const awards = zoom === 0 ? AWARDS.slice(0, 2) : zoom === 1 ? AWARDS.slice(0, 3) : AWARDS;
  return (
    <section id="variants" className="flex flex-col gap-4" style={{ scrollMarginTop: 90 }}>
      <H2>Variants</H2>
      <Mono>awards · {AWARDS.length} calls · showing {awards.length} · filter: PASS</Mono>
      <Constellation lit={awards.length} />
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
        .adam-chr-stage { perspective: 1200px; }
        @keyframes adam-chr-idle {
          0%   { transform: rotateX(-24deg) rotateY(-48deg); }
          50%  { transform: rotateX(-32deg) rotateY(-22deg); }
          100% { transform: rotateX(-24deg) rotateY(-48deg); }
        }
        .adam-chr-idle { animation: adam-chr-idle 10s ease-in-out infinite; }
        @keyframes adam-blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0; } }
        .adam-blink { animation: adam-blink 1s steps(1) infinite; }
        .adam-letter { transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), color 0.35s; }
        .adam-letter:hover { transform: translateY(-8%) rotateX(14deg) rotateY(-10deg) translateZ(40px); color: ${BLUE}; }
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
          .adam-letter { transition: none; }
          .adam-letter:hover { transform: none; }
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
