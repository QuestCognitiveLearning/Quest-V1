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
    stack: "React · TypeScript · Supabase · Postgres · OpenAI API · Vercel",
    body: "Engineered a platform that translates cognitive-science principles such as spaced repetition and scaffolding into generated lessons, orchestrating multi-step LLM calls through serverless edge functions.",
    more: "Designed the Postgres schema, authentication, and row-level security policies as co-founder and lead engineer. Shipped 100+ resources and 110,000+ views into a 5,000-student pilot; in conversations with Williamson County Schools about their 42,000+ students.",
  },
  {
    no: "02",
    locus: "GRILL",
    color: MAG,
    feature: "Undergraduate researcher, vagus nerve stimulation",
    org: "Grill Lab, Duke Biomedical Engineering",
    span: "2026 – now",
    strand: "+",
    stack: "MATLAB · Python · multi-channel stimulation hardware",
    body: "Expanding the lab's experimental control software so in vivo vagus nerve stimulation experiments can drive several current sources in sync, from one stimulation definition to delivery and recorded sync.",
    more: "Builds on the lab's computational pipeline for designing selective stimulation paradigms; my part is the bench-side code that lets those paradigms be tested with multi-channel stimulators.",
  },
  {
    no: "03",
    locus: "DROS",
    color: MAG,
    feature: "Student researcher, Drosophila melanogaster",
    org: "Biomedical Sciences Research Program, Ravenwood",
    span: "2023 – 2026",
    strand: "+",
    body: "Designed and conducted two independent Drosophila studies end to end: hypothesis, experimental design, colony handling, data collection, analysis, and presentation.",
    more: "Executed molecular workflows across a three-year sequence: DNA extraction, PCR, gene cloning, CRISPR editing, microarray gene-expression analysis, and dissection under standard aseptic practice. The bottleneck was always analysis, not pipetting. That pointed me at computational biology.",
  },
  {
    no: "04",
    locus: "NSPR",
    color: MAG,
    feature: "Project lead, NeuroSprout",
    org: "TSA Biotechnology Design · 1st state, top 12 national",
    span: "2025",
    strand: "+",
    body: "Proposed a non-invasive approach to restoring CNS axon regeneration, targeting the oligodendrocyte-derived inhibitors Nogo-A, MAG, and OMgp that arrest the axonal cytoskeleton after injury.",
    more: "Specified peptide-functionalized nanoparticles crossing the blood-brain barrier, dCas9 reversibly repressing inhibitor transcription, and split photoactivatable padCas9 gated by infrared light. Rejected knockout, growth-factor, and stem-cell alternatives on glioma and immune risk.",
  },
  {
    no: "05",
    locus: "TSA2",
    color: BLUE,
    feature: "State Secretary",
    org: "Tennessee Technology Student Association",
    span: "2025 – 2026",
    strand: "+",
    body: "One of six state officers for Tennessee TSA: 3,100 members across 87 chapters. Ran statewide communications that passed 100K views, and built the event-selector tool new members use to pick their competitions.",
  },
  {
    no: "06",
    locus: "NOVA1",
    color: BLUE,
    feature: "Software engineer in test",
    org: "Novalab Tech, Nashville",
    span: "2022 – 2023",
    strand: "−",
    stack: "Selenium (Java) · Cucumber · Agile",
    body: "Built automated test suites across front-end, back-end, and API layers for two enterprise products, including datatruck.io.",
    more: "Authored smoke and regression suites within an Agile team and maintained the manual test-case library.",
  },
  {
    no: "07",
    locus: "SALVO",
    color: BLUE,
    feature: "Manager, social",
    org: "Salvo's Pizza (family-owned)",
    span: "2020 – now",
    strand: "+",
    body: "My family's restaurant in Nashville. I managed and trained a staff of ten through high school, and I still run our social accounts: 1,000+ posts, 17,000 followers, 40M+ views.",
  },
  {
    no: "08",
    locus: "WEI1",
    color: BLUE,
    feature: "Director & co-founder",
    org: "Wealth Education Initiative",
    span: "2023 – now",
    strand: "+",
    body: "A 501(c)(3) that teaches practical financial literacy. We grew two chapters past 100 members and put an eBook into six high schools, and I sat on the county committee that shaped financial-education policy for 20,000+ students.",
  },
  {
    no: "09",
    locus: "DUKE",
    color: MUTED,
    feature: "B.S. Neuroscience & Computer Science",
    org: "Duke University, Durham NC",
    span: "2026 – 2030",
    strand: "+",
    body: "Class of 2030. Headed toward computational biology.",
  },
  {
    no: "10",
    locus: "RAVEN",
    color: MUTED,
    feature: "National Merit Finalist · ACT 35 · GPA 4.72",
    org: "Ravenwood High School, Brentwood TN",
    span: "2022 – 2026",
    strand: "+",
    body: "Biomedical Sciences Research Program, TSA, DECA, Model UN.",
  },
];

const WORK_CARDS = [
  { k: "QUEST1 · 2024 – now", t: "Co-founder, Quest Learning", d: "Cognitive-science lessons generated by multi-step LLM calls. 100+ resources, 110K+ views, 5,000-student pilot." },
  { k: "DROS · 2023 – 2026", t: "Student researcher, Drosophila", d: "Two independent studies end to end. DNA extraction, PCR, cloning, CRISPR, microarray analysis." },
  { k: "GRILL · 2026 – now", t: "Researcher, Grill Lab (Duke BME)", d: "Vagus nerve stimulation. Control software for synchronized multi-channel stimulation in vivo." },
  { k: "NOVA1 · 2022 – 2023", t: "Software Engineer in Test, Novalab", d: "Selenium + Cucumber suites for datatruck.io across front end, back end, API." },
  { k: "SALVO · 2020 – now", t: "Manager, Salvo's Pizza", d: "Family shop in Nashville. 1,000+ posts, 17,000 followers, 40M+ views." },
];

const PROJECT_CARDS = [
  { k: "ORF 01 · react native", t: "ExerciseBud", d: "HealthKit + Health Connect steps into a shared backend. LLM four-week plans, live presence leaderboard." },
  { k: "ORF 02 · python · bandit", t: "FeelLoop", d: "Autonomous content system: generates, schedules, publishes across six accounts. Engagement-scored bandit allocator over 772 posts." },
  { k: "ORF 03 · biotech design", t: "NeuroSprout", d: "Non-invasive CNS axon regeneration: nanoparticles, dCas9 repression, light-gated padCas9. 1st state, top 12 national." },
  { k: "ORF 04 · web", t: "TN TSA Event Selector", d: "Ranks competitive events against a member's strengths. 3,100 members.", link: "https://tntsaeventselector.com" },
  { k: "ORF 05 · daily", t: "Stylize", d: "Picks an outfit from the forecast and color theory. Most-used thing I've built.", link: "https://stylize.base44.app" },
];

const FEATURED = [
  {
    name: "Quest Learning",
    url: "https://www.questlearning.co/",
    host: "questlearning.co",
    role: "co-founder · product & engineering",
    accent: BLUE,
    d: "State standards into complete, ready-to-teach lessons: hooks, videos, adaptive quizzes, AP-style case studies, built on spaced repetition and scaffolding. Multi-step LLM pipeline on serverless edge functions.",
    stack: ["React", "TypeScript", "Supabase", "Postgres", "OpenAI", "Vercel"],
    stat: "100+ resources · 110K+ views · 5,000-student pilot",
  },
  {
    name: "Unitywalls",
    url: "https://www.unitywalls.app/",
    host: "unitywalls.app",
    role: "built it",
    accent: MAG,
    d: "A living photo wall for weddings and events, assembled by everyone in the room. Guests join with a code and add photos; hosts manage walls, the QR, and downloads.",
    stack: ["Next.js", "Vercel"],
    stat: "guests · venues · hosts",
  },
  {
    name: "Datatruck",
    url: "https://www.datatruck.io/",
    host: "datatruck.io",
    role: "software engineer in test · Novalab",
    accent: BLUE,
    d: "AI-native transportation management system for carriers and brokers. I built the automated test suites across its front end, back end, and API layers, plus the smoke and regression suites the team ran each release.",
    stack: ["Selenium (Java)", "Cucumber", "Agile"],
    stat: "trusted by 1,000+ companies",
  },
  {
    name: "Aros Market",
    url: "https://aros.uz/en",
    host: "aros.uz",
    role: "web · Uzbekistan",
    accent: MAG,
    d: "E-commerce marketplace for phone parts and accessories in Uzbekistan: catalog, cart, favourites, accounts, and a companion app, in three languages.",
    stack: ["web", "mobile"],
    stat: "batteries · displays · accessories",
  },
  {
    name: "Breakthrough Junior Challenge",
    url: "https://www.youtube.com/watch?v=g9BLmBNsepo",
    host: "youtube.com",
    role: "finalist · top 15 of 2,500",
    accent: BLUE,
    video: "g9BLmBNsepo",
    d: "A science-communication video on how the plastic-eating bacterium Ideonella sakaiensis uses PETase enzymes to break down PET, and what that means for the microplastic crisis.",
    stack: ["script", "edit", "animation"],
    stat: "top 0.5% worldwide · Dec 2025",
  },
  {
    name: "NeuroSprout",
    url: "#variants",
    host: "TSA Biotechnology Design",
    role: "project lead · 1st state · top 12 national",
    accent: MAG,
    clip: "/adam-neurosprout.mp4",
    poster: "/adam-neurosprout.jpg",
    d: "Non-invasive CNS axon regeneration: peptide-functionalized nanoparticles across the blood-brain barrier, dCas9 repressing the inhibitors that stop axons regrowing, and a light-gated padCas9 switch. The booth, with its working demo board.",
    stack: ["dCas9", "nanoparticles", "Arduino demo"],
    stat: "30 million people affected · the problem we picked",
  },
  {
    name: "TN TSA Event Selector",
    url: "https://tntsaeventselector.com",
    host: "tntsaeventselector.com",
    role: "built it · state officer project",
    accent: MAG,
    d: "Questionnaire-driven matcher that ranks TSA's competitive events against a member's strengths and interests. Built for Tennessee TSA's 3,100 members.",
    stack: ["web"],
    stat: "3,100 members",
  },
];

// Field notes: photos. Add a file to public/adam-photos/ and an entry here.
const PHOTOS = [
  { src: "/adam-neurosprout.jpg", alt: "NeuroSprout booth at TSA nationals", cap: "NeuroSprout booth · TSA nationals", tag: "NSPR" },
];

const MORE_PROJECTS = [
  ["Unitywall Profit Analysis", "Next.js", "Agency dashboard separating client quotes from true costs: hours, margins, variance.", "https://unitydashboard.vercel.app/"],
  ["Vanderbilt Professor Scraper", "Selenium (Java)", "Crawled 200+ VUMC faculty into a sheet so the science club could invite guest speakers.", null],
];

const SKILLS = [
  ["languages", "Python, Java, JavaScript, TypeScript, SQL (Postgres), HTML/CSS"],
  ["frameworks & tools", "React, React Native, Node.js, Supabase, MongoDB, SQLite, Selenium, Playwright, Git, Vercel"],
  ["laboratory", "DNA extraction, PCR, gene cloning, CRISPR editing, gene-expression analysis, microarray, Drosophila handling"],
  ["research", "Experimental design, primary-literature review, technical writing, scientific presentation, A/B and bandit testing"],
  ["spoken", "English, Russian, Uzbek, Arabic (fluent in all four)"],
];

const AWARDS = [
  {
    id: "rs001",
    title: "Breakthrough Junior Challenge Finalist",
    sub: "Top 15 of 2,500 submissions · Breakthrough Prize Foundation · Dec 2025",
    d: "Selected as a finalist (top 0.5% worldwide) for an educational science video on how Ideonella sakaiensis uses PETase enzymes to break down PET plastics, and what that means for the microplastic crisis. Recognized for clarity, scientific accuracy, and engaging communication of complex concepts.",
    link: "https://www.youtube.com/watch?v=g9BLmBNsepo",
  },
  {
    id: "rs002",
    title: "TSA Nationals: 6th in Data Science & Analytics, top 12 in Biotechnology Design",
    sub: "Technology Student Association · 3× first-place state titles",
    d: "6th nationally in Data Science and Analytics for a full data investigation: cleaning, statistical analysis, and visualization of trends. Top 12 nationally in Biotechnology Design for a sonogenetics-based answer to the microplastic epidemic: ultrasound activation of Ideonella sakaiensis to produce PETase at scale. Three first-place state titles across Biotechnology, Data Science, and Geospatial Technologies.",
  },
  {
    id: "rs003",
    title: "2× DECA ICDC Finalist",
    sub: "Top 1% of 25,000+ competitors · 2× ICDC qualifier · 2× 1st place, State Virtual Business Challenge",
    d: "Two-time finalist at DECA's International Career Development Conference in business strategy, presentation, and analytical decision-making. Twice first in the State Virtual Business Challenge, outperforming hundreds of teams in real-time simulations of finance, operations, and strategic management.",
  },
  {
    id: "rs004",
    title: "National Merit Finalist",
    sub: "National Merit Scholarship Corporation · Jan 2025 · top 1%",
    d: "ACT 35. Finalist standing in the National Merit Scholarship Program.",
  },
  {
    id: "rs005",
    title: "Biotechnology Aptitude and Competency Credential (BACC)",
    sub: "Biotility, University of Florida · issued Apr 2026, valid through Apr 2031",
    d: "Industry-recognized credential in laboratory practice, biotechnology concepts, and aseptic technique.",
  },
  {
    id: "rs006",
    title: "INCubatoredu final pitch, $2,500 in funding",
    sub: "Entrepreneurship & Innovation Center · invited to pitch at the Nashville Entrepreneurship Center",
    d: "Funded in the program's final pitch and invited to present at the Nashville Entrepreneurship Center.",
  },
];

const SERVICE = [
  ["Volunteer & tutor", "Salahadeen Center", "Tutored twelve students in Arabic weekly, mentored youth, helped organize prayers and community events."],
  ["General Assembly VP", "Model UN · YMCA Civic Engagement", "Helped coordinate a 700–900-delegate conference and chaired parliamentary debate for a 30-member committee."],
  ["Communications director", "ScienceFinds", "Connected 75+ students with Nashville STEM professors as guest speakers for the science club."],
];

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
// The specimen: a playable 3×3 puzzle cube in CSS 3D. Drag a sticker to turn
// its layer, drag the paper around it to orbit, click scramble, solve it.
// Written from scratch; 26 cubies, each face its own element.
// ---------------------------------------------------------------------------

const STICKER = {
  pz: BLUE,      // front
  nz: "#FF7AB6", // back
  px: MAG,       // right
  nx: "#8FB0FF", // left
  ny: PAPER,     // top (y is down in CSS)
  py: "#5B6B8C", // bottom
};
const FACE_NORMAL = { px: [1, 0, 0], nx: [-1, 0, 0], py: [0, 1, 0], ny: [0, -1, 0], pz: [0, 0, 1], nz: [0, 0, -1] };
const AXIS_IDX = { x: 0, y: 1, z: 2 };

const FACE_T = (half) => ({
  px: `rotateY(90deg) translateZ(${half}px)`,
  nx: `rotateY(-90deg) translateZ(${half}px)`,
  py: `rotateX(-90deg) translateZ(${half}px)`,
  ny: `rotateX(90deg) translateZ(${half}px)`,
  pz: `translateZ(${half}px)`,
  nz: `rotateY(180deg) translateZ(${half}px)`,
});

// 90° rotations on the grid, matching CSS rotateX/Y/Z handedness
function rotVec([x, y, z], axis, dir) {
  if (axis === "y") return [z * dir, y, -x * dir];
  if (axis === "x") return [x, -z * dir, y * dir];
  return [-y * dir, x * dir, z];
}
// arbitrary-angle rotations, same handedness, for projecting axes to the screen
function rotDeg([x, y, z], axis, deg) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), si = Math.sin(a);
  if (axis === "x") return [x, y * c - z * si, y * si + z * c];
  if (axis === "y") return [x * c + z * si, y, -x * si + z * c];
  return [x * c - y * si, x * si + y * c, z];
}
const cross = ([ax, ay, az], [bx, by, bz]) => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];

function makeCubies() {
  const list = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (!x && !y && !z) continue;
    list.push({
      id: `${x}${y}${z}`,
      pos: [x, y, z],
      orient: "",
      turns: [], // (axis, dir) history, oldest first, for solved detection
      stickers: { px: x === 1, nx: x === -1, py: y === 1, ny: y === -1, pz: z === 1, nz: z === -1 },
    });
  }
  return list;
}

function isSolved(cubies) {
  const seen = {};
  for (const q of cubies) {
    for (const f of Object.keys(q.stickers)) {
      if (!q.stickers[f]) continue;
      let n = FACE_NORMAL[f];
      for (const [axis, dir] of q.turns) n = rotVec(n, axis, dir);
      const key = n.join(",");
      if (seen[key] && seen[key] !== STICKER[f]) return false;
      seen[key] = STICKER[f];
    }
  }
  return true;
}

function PuzzleCube({ size = 240, scrollRot = 0, idle = true, onStatus }) {
  const [cubies, setCubies] = useState(makeCubies);
  const [anim, setAnim] = useState(null);
  const [view, setView] = useState({ yaw: -36, pitch: -28 });
  const [moves, setMoves] = useState(0);
  const [scrambled, setScrambled] = useState(false);
  const queue = useRef([]);
  const animRef = useRef(null);
  const drag = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const c = size / 3;
  const gap = Math.max(3, size * 0.016);
  const half = (c - gap) / 2;
  const faceT = useMemo(() => FACE_T(half), [half]);
  const solved = useMemo(() => isSolved(cubies), [cubies]);

  useEffect(() => { onStatus && onStatus({ moves, solved, scrambled }); }, [moves, solved, scrambled, onStatus]);

  // idle drift when nobody is touching it
  useEffect(() => {
    if (!idle) return;
    let raf = 0;
    const tick = () => {
      if (!drag.current) setView((v) => ({ ...v, yaw: v.yaw + 0.06 }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idle]);

  const startMove = useCallback((move, countIt) => {
    if (animRef.current) { queue.current.push([move, countIt]); return; }
    animRef.current = { ...move, angle: 0, t0: 0 };
    setAnim(animRef.current);
    const dur = 200;
    const step = (now) => {
      const a = animRef.current;
      if (!a) return;
      if (!a.t0) a.t0 = now;
      const k = clamp((now - a.t0) / dur, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      a.angle = e * 90 * a.dir;
      setAnim({ ...a });
      if (k < 1) { requestAnimationFrame(step); return; }
      setCubies((prev) =>
        prev.map((q) => {
          if (q.pos[AXIS_IDX[a.axis]] !== a.layer) return q;
          const rot = `rotate${a.axis.toUpperCase()}(${90 * a.dir}deg)`;
          return { ...q, pos: rotVec(q.pos, a.axis, a.dir), orient: `${rot} ${q.orient}`, turns: [...q.turns, [a.axis, a.dir]] };
        })
      );
      if (countIt) setMoves((m) => m + 1);
      animRef.current = null;
      setAnim(null);
      const next = queue.current.shift();
      if (next) requestAnimationFrame(() => startMove(next[0], next[1]));
    };
    requestAnimationFrame(step);
  }, []);

  const scramble = () => {
    const axes = ["x", "y", "z"];
    let last = null;
    for (let i = 0; i < 16; i++) {
      let axis = axes[Math.floor(Math.random() * 3)];
      if (axis === last) axis = axes[(axes.indexOf(axis) + 1) % 3];
      last = axis;
      startMove({ axis, layer: Math.floor(Math.random() * 3) - 1, dir: Math.random() < 0.5 ? 1 : -1 }, false);
    }
    setMoves(0);
    setScrambled(true);
  };
  const reset = () => {
    queue.current = [];
    animRef.current = null;
    setAnim(null);
    setCubies(makeCubies());
    setMoves(0);
    setScrambled(false);
  };

  // screen-space direction of a cube axis under the current view (perspective ignored)
  const project = (e) => {
    const v = viewRef.current;
    let p = rotDeg(e, "y", v.yaw);
    p = rotDeg(p, "x", v.pitch);
    p = rotDeg(p, "y", scrollRot);
    return [p[0], p[1]];
  };

  // Drag a sticker: after a few pixels the layer is chosen and it follows the
  // finger live (highlighted), then snaps to the nearest quarter turn on release.
  const onPointerDown = (e) => {
    if (animRef.current) return;
    const faceEl = e.target.closest ? e.target.closest("[data-face]") : null;
    e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    if (faceEl) {
      drag.current = { kind: "turn", x: e.clientX, y: e.clientY, pos: faceEl.dataset.pos.split(",").map(Number), face: faceEl.dataset.face, axis: null };
    } else {
      drag.current = { kind: "orbit", x: e.clientX, y: e.clientY };
    }
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.kind === "orbit") {
      setView((v) => ({ yaw: v.yaw + dx * 0.5, pitch: clamp(v.pitch - dy * 0.5, -80, 80) }));
      d.x = e.clientX; d.y = e.clientY;
      return;
    }
    if (!d.axis) {
      if (Math.hypot(dx, dy) < 6) return;
      // pick the in-face axis whose screen direction best matches the drag
      const n = FACE_NORMAL[d.face];
      const candidates = [];
      ["x", "y", "z"].forEach((ax) => {
        const e3 = [0, 0, 0]; e3[AXIS_IDX[ax]] = 1;
        if (Math.abs(n[AXIS_IDX[ax]]) === 1) return;
        [1, -1].forEach((sgn) => {
          const m = e3.map((v) => v * sgn);
          const [sx, sy] = project(m);
          const len = Math.hypot(sx, sy) || 1;
          candidates.push({ m, dirX: sx / len, dirY: sy / len, score: (sx * dx + sy * dy) / len });
        });
      });
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      const r = cross(n, best.m); // +90° about r carries n onto m
      const axis = ["x", "y", "z"][r.findIndex((v) => Math.abs(v) === 1)];
      d.axis = axis;
      d.layer = d.pos[AXIS_IDX[axis]];
      d.sign = r[AXIS_IDX[axis]] > 0 ? 1 : -1;
      d.dirX = best.dirX; d.dirY = best.dirY;
    }
    // degrees of turn = distance dragged along the chosen screen direction
    const along = dx * d.dirX + dy * d.dirY;
    const angle = clamp((along / (size * 0.55)) * 90, -180, 180) * d.sign;
    animRef.current = { axis: d.axis, layer: d.layer, dir: d.sign, angle, live: true };
    setAnim({ ...animRef.current });
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.kind !== "turn" || !d.axis) { if (d && d.kind === "turn") { animRef.current = null; setAnim(null); } return; }
    const a = animRef.current;
    if (!a) return;
    const quarters = Math.round(a.angle / 90);
    const target = quarters * 90;
    const from = a.angle;
    const t0 = performance.now();
    const settle = (now) => {
      const k = clamp((now - t0) / 140, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      animRef.current = { ...a, angle: from + (target - from) * e, live: true };
      setAnim({ ...animRef.current });
      if (k < 1) { requestAnimationFrame(settle); return; }
      if (quarters !== 0) {
        const sgn = quarters > 0 ? 1 : -1;
        const times = Math.abs(quarters);
        setCubies((prev) =>
          prev.map((q) => {
            if (q.pos[AXIS_IDX[a.axis]] !== a.layer) return q;
            let pos = q.pos;
            const turns = [...q.turns];
            for (let i = 0; i < times; i++) { pos = rotVec(pos, a.axis, sgn); turns.push([a.axis, sgn]); }
            return { ...q, pos, orient: `rotate${a.axis.toUpperCase()}(${90 * sgn * times}deg) ${q.orient}`, turns };
          })
        );
        setMoves((m) => m + 1);
      }
      animRef.current = null;
      setAnim(null);
    };
    requestAnimationFrame(settle);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div
        role="application"
        aria-label="puzzle cube: drag a sticker to turn its layer, drag around it to orbit"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ width: size * 1.75, height: size * 1.6, position: "relative", cursor: drag.current ? "grabbing" : "grab", touchAction: "none", transformStyle: "preserve-3d" }}
      >
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, transformStyle: "preserve-3d", transform: `rotateY(${scrollRot}deg) rotateX(${view.pitch}deg) rotateY(${view.yaw}deg)` }}>
          {cubies.map((q) => {
            const inLayer = anim && q.pos[AXIS_IDX[anim.axis]] === anim.layer;
            const layerRot = inLayer ? `rotate${anim.axis.toUpperCase()}(${anim.angle}deg) ` : "";
            const lit = inLayer && anim.live;
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
                    data-face={q.stickers[f] ? f : undefined}
                    data-pos={q.stickers[f] ? q.pos.join(",") : undefined}
                    style={{
                      position: "absolute",
                      inset: 0,
                      transform: faceT[f],
                      backfaceVisibility: "hidden",
                      background: "#141B2E",
                      borderRadius: size * 0.03,
                      boxSizing: "border-box",
                      padding: size * 0.012,
                    }}
                  >
                    {q.stickers[f] && (
                      <div data-face={f} data-pos={q.pos.join(",")} style={{ width: "100%", height: "100%", borderRadius: size * 0.022, background: STICKER[f], boxShadow: lit ? "inset 0 0 0 3px rgba(255,255,255,0.9), inset 0 0 12px rgba(255,255,255,0.5)" : "inset 0 0 0 1px rgba(0,0,0,0.12), inset 0 -6px 10px rgba(0,0,0,0.12), inset 0 6px 10px rgba(255,255,255,0.22)" }} />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2" style={{ fontFamily: MONO, fontSize: 11, position: "relative", zIndex: 5 }}>
        <span style={{ color: solved && scrambled ? BLUE : MUTED, minWidth: 92 }}>
          {solved ? (scrambled ? `solved ✓ ${moves} moves` : "solved") : `${moves} moves`}
        </span>
        <button type="button" onClick={scramble} className="px-2.5 py-1 rounded" style={{ font: "inherit", border: `1px solid ${INK}`, background: PAPER, color: INK, cursor: "pointer" }}>scramble</button>
        <button type="button" onClick={reset} className="px-2.5 py-1 rounded" style={{ font: "inherit", border: `1px solid ${RULE}`, background: "transparent", color: MUTED, cursor: "pointer" }}>reset</button>
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
// complementary pairs share a hue family: A/T blue, G/C magenta
const BASE_COLOR = { A: "#2457C5", T: "#8FB0FF", G: "#C2185B", C: "#FF7AB6" };
const COMPLEMENT = { A: "T", T: "A", G: "C", C: "G" };

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
          const base = BASES[it.i];
          const mx = (it.a.sx + it.b.sx) / 2, my = (it.a.sy + it.b.sy) / 2;
          const gap = it.u * 0.55;
          ctx.lineWidth = 4.5 * it.a.sc;
          ctx.lineCap = "round";
          ctx.globalAlpha = op * it.fadeIn * (0.55 + 0.45 * ((it.z + 100) / 200));
          ctx.strokeStyle = BASE_COLOR[base];
          ctx.beginPath();
          ctx.moveTo(it.a.sx, it.a.sy);
          ctx.lineTo(it.a.sx + (mx - it.a.sx) * (1 - gap), it.a.sy + (my - it.a.sy) * (1 - gap));
          ctx.stroke();
          ctx.strokeStyle = BASE_COLOR[COMPLEMENT[base]];
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

const BIO = "Builds software that makes sense of living things. Neuroscience and computer science at Duke, class of 2030. Co-founder of Quest Learning, three years of Drosophila bench work.".split(" ");

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
  const cubeSize = clamp(vw * 0.17, 120, 230);
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
        <Mono className="hidden sm:block" style={{ position: "absolute", right: 24, top: 20 }}>
          chr-adam · chr1:1–2,400,000 · <a href="/adam-resume.pdf" style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}>resume ↓</a>
        </Mono>
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

        {/* the specimen: a playable puzzle cube. scroll spins, zooms and fades it */}
        <div
          className="adam-chr-stage"
          style={{
            position: "absolute",
            right: "clamp(0px, 5vw, 100px)",
            top: "clamp(56px, 13vh, 140px)",
            opacity: chrOpacity,
            transform: `scale(${scale})`,
            transformOrigin: "50% 40%",
            willChange: "transform, opacity",
            zIndex: 1,
            pointerEvents: chrOpacity > 0.5 ? "auto" : "none",
          }}
        >
          <PuzzleCube size={cubeSize} scrollRot={rot} idle={!reduced} />
          <Mono className="hidden lg:block" style={{ display: "block", textAlign: "center", marginTop: 8, whiteSpace: "nowrap", opacity: labelFade }}>drag a sticker and the layer follows · drag the space around it to orbit</Mono>
        </div>

        {/* headline over the object */}
        <div style={{ position: "absolute", left: 24, right: 24, bottom: "clamp(72px, 12vh, 110px)", zIndex: 2, opacity: textFade, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 20, pointerEvents: "none" }}>
          <h1
            style={{
              margin: 0,
              pointerEvents: "auto",
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
  ["projects", "#projects"],
  ["coverage", "#coverage"],
  ["variants", "#variants"],
  ["skills", "#skills"],
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
        <a href="/adam-resume.pdf" className="hidden md:inline" style={{ fontFamily: MONO, fontSize: 12, color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}>resume ↓</a>
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
                    {l.stack && <Mono style={{ color: l.color }}>{l.stack}</Mono>}
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

const HELIX_A = "#3B5BA5"; // muted blue
const HELIX_B = "#A8336B"; // muted magenta

function HelixCard({ c, strand, style, cardRef }) {
  const accent = strand === "A" ? HELIX_A : HELIX_B;
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
      sheenRef.current.style.background = `radial-gradient(240px circle at ${(px + 0.5) * 100}% ${(py + 0.5) * 100}%, rgba(36,87,197,0.10), rgba(36,87,197,0.02) 40%, transparent 70%)`;
    }
  };
  const onLeave = () => {
    if (innerRef.current) innerRef.current.style.transform = "rotateX(0deg) rotateY(0deg) translateZ(0px)";
    if (sheenRef.current) sheenRef.current.style.opacity = "0";
  };
  const inner = (
    <div ref={innerRef} style={{ position: "relative", width: "100%", height: "100%", boxSizing: "border-box", padding: "16px 18px 16px 20px", borderRadius: 6, background: "rgba(255,255,255,0.96)", border: `1px solid ${RULE}`, borderLeft: `3px solid ${accent}`, display: "flex", flexDirection: "column", gap: 8, transition: "transform 0.25s ease", transformStyle: "preserve-3d", overflow: "hidden", boxShadow: "0 10px 30px rgba(16,24,40,0.08)" }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: accent }}>{c.k}</span>
      <span style={{ fontFamily: SANS, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15, color: INK }}>{c.t}{c.link ? " ↗" : ""}</span>
      <span style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.45, color: BODY }}>{c.d}</span>
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
      ctx.strokeStyle = "rgba(16,24,40,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy - H / 2 - 30); ctx.lineTo(cx, cy + H / 2 + 30); ctx.stroke();

      // rungs: faint, drawn first so the backbones read on top
      for (const it of items) {
        if (it.kind !== "rung") continue;
        const depth = (it.a.z + it.b.z) / (2 * R);
        ctx.strokeStyle = `rgba(16,24,40,${0.06 + 0.12 * (depth + 1) / 2})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(it.a.sx, it.a.sy); ctx.lineTo(it.b.sx, it.b.sy); ctx.stroke();
      }
      // backbones: one continuous ribbon per strand, width and alpha by depth
      const balls = items.filter((it) => it.kind === "ball");
      for (const k of ["A", "B"]) {
        const pts = balls.filter((b) => b.k === k).sort((m, n) => m.sy - n.sy);
        const base = k === "A" ? "59,91,165" : "168,51,107";
        for (let j = 1; j < pts.length; j++) {
          const q0 = pts[j - 1], q1 = pts[j];
          const d = (q0.facing + q1.facing) / 2;
          ctx.strokeStyle = `rgba(${base},${0.18 + 0.6 * ((d + 1) / 2)})`;
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
          const base = it.k === "A" ? [59, 91, 165] : [168, 51, 107];
          const dim = 0.35 + 0.65 * ((it.facing + 1) / 2);
          if (isF) {
            const g2 = ctx.createRadialGradient(it.sx, it.sy, r * 0.6, it.sx, it.sy, r * 3.2);
            g2.addColorStop(0, `rgba(${base[0]},${base[1]},${base[2]},${0.16 * dim})`);
            g2.addColorStop(1, `rgba(${base[0]},${base[1]},${base[2]},0)`);
            ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(it.sx, it.sy, r * 3.2, 0, Math.PI * 2); ctx.fill();
          }
          const g = ctx.createRadialGradient(it.sx - r * 0.35, it.sy - r * 0.35, r * 0.1, it.sx, it.sy, r);
          g.addColorStop(0, `rgba(${base[0] + 70},${base[1] + 70},${base[2] + 60},${dim})`);
          g.addColorStop(0.6, `rgba(${base[0]},${base[1]},${base[2]},${dim})`);
          g.addColorStop(1, `rgba(${base[0] * 0.6},${base[1] * 0.6},${base[2] * 0.6},${dim})`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(it.sx, it.sy, r, 0, Math.PI * 2); ctx.fill();
          if (isF) {
            // locus tag beside the bead, like an annotation on a molecule
            const tag = features[it.feature].c.k.split(" ·")[0];
            const right = it.sx >= cx;
            ctx.font = `700 11px ${MONO}`;
            ctx.textAlign = right ? "left" : "right";
            ctx.textBaseline = "middle";
            ctx.fillStyle = `rgba(${it.k === "A" ? "59,91,165" : "168,51,107"},${0.3 + 0.7 * ((it.facing + 1) / 2)})`;
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
          ctx.strokeStyle = q.k === "A" ? `rgba(59,91,165,${0.6 * eased})` : `rgba(168,51,107,${0.6 * eased})`;
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
      <section id="helix" className="px-6 py-16" style={{ background: PAPER, color: INK, scrollMarginTop: 90, borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-8">
          <H2>Work &amp; projects</H2>
          <Mono>base pair view · 10 features</Mono>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {features.map(({ c, strand }, i) => <HelixCard key={i} c={c} strand={strand} style={{ minHeight: 150 }} />)}
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} id="helix" style={{ height: "420vh", background: PAPER, color: INK, borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
      <div className="sticky top-0 overflow-hidden" style={{ height: "100vh" }}>
        <Mono style={{ position: "absolute", left: 24, top: 84, zIndex: 3 }}>base pair view · 10 features</Mono>
        <Mono className="hidden sm:block" style={{ position: "absolute", right: 24, top: 84, zIndex: 3 }}>chr1:1,300,000–1,900,000</Mono>
        <div style={{ position: "absolute", left: 24, bottom: 24, zIndex: 3, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
          <span style={{ fontFamily: SANS, fontSize: "clamp(28px, 3.2vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, color: INK }}>Work &amp; projects</span>
          <Mono><span style={{ color: HELIX_A }}>●</span> strand A work &nbsp; <span style={{ color: HELIX_B }}>●</span> strand B projects &nbsp;· scroll turns the helix</Mono>
        </div>
        <div className="hidden sm:block" style={{ position: "absolute", right: 24, bottom: 24, zIndex: 3 }}>
          <ZoomControl zoom={zoom} setZoom={setZoom} />
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
      <Mono>research · 2023–now · Drosophila → vagus nerve stimulation</Mono>
      <p style={{ margin: 0, maxWidth: "54ch", fontFamily: SANS, fontSize: 16, lineHeight: 1.6, color: BODY }}>
        Three years of bench work: DNA extraction, PCR, gene cloning, CRISPR editing. Two independent Drosophila projects on human-health questions.
        {zoom >= 1 && " The bottleneck was analysis, never pipetting. That pointed me at computational biology, and now at the Grill Lab at Duke, where I write the control software for multi-channel vagus nerve stimulation experiments."}
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
      <div className="flex justify-between"><Mono>2023</Mono><Mono>PCR</Mono><Mono>CRISPR</Mono><Mono>VNS</Mono><Mono>now</Mono></div>
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
const STAR_POS = [[0.08, 0.42], [0.26, 0.2], [0.42, 0.64], [0.58, 0.28], [0.76, 0.56], [0.92, 0.34]];

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
          {AWARDS[hover].id} · {AWARDS[hover].title}
        </Mono>
      )}
      <Mono style={{ position: "absolute", left: 10, bottom: 8, pointerEvents: "none" }}>move to connect the calls</Mono>
    </div>
  );
}

function Variants({ zoom }) {
  const awards = zoom === 0 ? AWARDS.slice(0, 2) : zoom === 1 ? AWARDS.slice(0, 4) : AWARDS;
  return (
    <section id="variants" className="flex flex-col gap-4" style={{ scrollMarginTop: 90 }}>
      <H2>Variants</H2>
      <Mono>awards · {AWARDS.length} calls · showing {awards.length} · filter: PASS</Mono>
      <Constellation lit={awards.length} />
      <div className="flex flex-col gap-3">
        {awards.map((a) => (
          <div key={a.id} className="flex flex-col gap-1.5 p-4 rounded-md" style={{ background: "#fff", border: `1px solid ${RULE}`, borderLeft: `3px solid ${MAG}` }}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Mono style={{ color: MAG }}>{a.id}</Mono>
              <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{a.title}</span>
            </div>
            <Mono>{a.sub}</Mono>
            {zoom >= 1 && <p style={{ margin: "4px 0 0", fontFamily: SANS, fontSize: 14.5, lineHeight: 1.55, color: BODY }}>{a.d}</p>}
            {a.link && zoom >= 1 && (
              <a href={a.link} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 12, color: BLUE, textDecoration: "underline", textUnderlineOffset: 3, marginTop: 4 }}>watch the video ↗</a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Featured: the projects as boxes, each with its site
// ---------------------------------------------------------------------------

function Featured() {
  return (
    <section id="projects" className="px-6 py-16 flex flex-col gap-6" style={{ borderBottom: `1px solid ${RULE}`, scrollMarginTop: 90 }}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <H2>Projects</H2>
        <Mono>{FEATURED.length} features · each box opens the site · hover the booth to play</Mono>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURED.map((f) => (
          <a
            key={f.name}
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="adam-box flex flex-col rounded-md overflow-hidden"
            style={{ background: "#fff", border: `1px solid ${RULE}`, textDecoration: "none", color: INK }}
          >
            {f.clip ? (
              <video
                src={f.clip}
                poster={f.poster}
                muted
                loop
                playsInline
                preload="none"
                onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}); }}
                onMouseLeave={(e) => { e.currentTarget.pause(); }}
                onTouchStart={(e) => { e.currentTarget.play().catch(() => {}); }}
                style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block", background: INK }}
              />
            ) : f.video ? (
              <div style={{ position: "relative", aspectRatio: "16 / 9", background: INK }}>
                <img src={`https://img.youtube.com/vi/${f.video}/hqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 52, height: 52, borderRadius: "50%", background: "rgba(247,246,242,0.92)", display: "flex", alignItems: "center", justifyContent: "center", color: INK, fontSize: 18 }}>▶</span>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4" style={{ height: 44, background: f.accent, color: PAPER }}>
                <Mono style={{ color: PAPER, fontWeight: 700 }}>{f.host}</Mono>
                <Mono style={{ color: "rgba(247,246,242,0.8)" }}>open ↗</Mono>
              </div>
            )}
            <div className="flex flex-col gap-2 p-4" style={{ flex: 1 }}>
              <span style={{ fontFamily: SANS, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15 }}>{f.name}</span>
              <Mono style={{ color: f.accent }}>{f.role}</Mono>
              <p style={{ margin: "2px 0 0", fontFamily: SANS, fontSize: 14.5, lineHeight: 1.55, color: BODY }}>{f.d}</p>
              <div className="flex flex-wrap gap-1.5 mt-auto pt-3">
                {f.stack.map((t) => <span key={t} className="px-2 py-0.5 rounded" style={{ fontFamily: MONO, fontSize: 11, color: BODY, border: `1px solid ${RULE}` }}>{t}</span>)}
              </div>
              <Mono style={{ marginTop: 6 }}>{f.stat}</Mono>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function FieldNotes() {
  if (!PHOTOS.length) return null;
  return (
    <section id="photos" className="px-6 py-16 flex flex-col gap-5" style={{ borderBottom: `1px solid ${RULE}`, scrollMarginTop: 90 }}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <H2>Field notes</H2>
        <Mono>{PHOTOS.length} {PHOTOS.length === 1 ? "image" : "images"}</Mono>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollSnapType: "x mandatory" }}>
        {PHOTOS.map((ph) => (
          <figure key={ph.src} className="shrink-0 m-0 flex flex-col gap-2" style={{ width: "min(420px, 82vw)", scrollSnapAlign: "start" }}>
            <img src={ph.src} alt={ph.alt} loading="lazy" style={{ width: "100%", aspectRatio: "3 / 2", objectFit: "cover", borderRadius: 6, border: `1px solid ${RULE}`, background: "#fff", display: "block" }} />
            <figcaption className="flex items-baseline gap-3">
              <Mono style={{ color: MAG, fontWeight: 700 }}>{ph.tag}</Mono>
              <Mono style={{ color: BODY }}>{ph.cap}</Mono>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Skills() {
  return (
    <section id="skills" className="px-6 py-16 flex flex-col gap-4" style={{ borderBottom: `1px solid ${RULE}`, scrollMarginTop: 90 }}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <H2>Annotations</H2>
        <Mono>technical skills · from the resume</Mono>
      </div>
      <div style={{ borderBottom: `1px solid ${RULE}` }}>
        {SKILLS.map(([k, v]) => (
          <div key={k} className="grid gap-4 py-3" style={{ gridTemplateColumns: "clamp(110px, 16vw, 180px) minmax(0,1fr)", borderTop: `1px solid ${RULE}` }}>
            <Mono style={{ color: INK }}>{k}</Mono>
            <span style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.55, color: BODY }}>{v}</span>
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
        <H2>More ORFs</H2>
        <Mono>older projects · most weekends</Mono>
        <div style={{ borderBottom: `1px solid ${RULE}` }}>
          {MORE_PROJECTS.map(([name, stack, d, link]) => (
            <div key={name} className="py-4 flex flex-col gap-1" style={{ borderTop: `1px solid ${RULE}` }}>
              {link ? (
                <a href={link} target="_blank" rel="noreferrer" style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: INK, textDecoration: "none" }}>{name} ↗</a>
              ) : (
                <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: INK }}>{name}</span>
              )}
              <Mono>{stack}</Mono>
              <p style={{ margin: "4px 0 0", fontFamily: SANS, fontSize: 15, lineHeight: 1.55, color: BODY, maxWidth: "56ch" }}>{d}</p>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontFamily: SANS, fontSize: 15, lineHeight: 1.55, color: BODY, maxWidth: "48ch" }}>Grew up between Tashkent, Cairo, and Nashville. That's where the four languages come from.</p>
        <div className="flex flex-wrap gap-2">
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
        .adam-box { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .adam-box:hover { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(16,24,40,0.10); }
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
        <Featured />
        <div className="px-6 py-16 grid md:grid-cols-2 gap-12" style={{ borderBottom: `1px solid ${RULE}` }}>
          <Coverage zoom={zoom} />
          <Variants zoom={zoom} />
        </div>
        <FieldNotes />
        {zoom >= 1 && <Skills />}
        {zoom === 2 && <BasePairExtras />}
      </main>

      <footer id="end" className="px-6 py-8 flex flex-wrap items-end justify-between gap-4" style={{ scrollMarginTop: 90 }}>
        <div className="flex flex-col gap-3">
          <span style={{ fontFamily: SANS, fontSize: "clamp(32px, 3.4vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>3' end</span>
          <div className="flex flex-wrap gap-2">
            <Pill href="/adam-resume.pdf">resume ↓</Pill>
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
