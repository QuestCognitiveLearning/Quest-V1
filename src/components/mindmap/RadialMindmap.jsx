import React from "react";
import { PASS_THRESHOLD } from "@/lib/spacedRepetition";

// Base node sizes (virtual px). The whole map is scaled to fit the container,
// so these stay fixed and the layout math below spaces nodes apart based on
// the actual unit / subunit counts — no overlap at any size.
// Minimum ring radii. Kept just large enough to clear the inner node so small
// curricula pull in tight to the center; the no-overlap math below pushes them
// outward as the unit / subunit counts grow, so spacing scales with size.
const UNIT_RADIUS = 150;     // minimum unit-ring radius (clears the center node)
const SUBUNIT_RADIUS = 92;   // minimum subunit-ring radius (clears its unit node)

const CENTER_SIZE = 130;
const UNIT_SIZE = 85;
const SUBUNIT_SIZE = 65;

// Spacing knobs for the adaptive layout.
const SUB_MIN_CHORD = SUBUNIT_SIZE + 16; // min center-to-center between subunits
const SUB_MAX_ARC = 160;                 // cap on a unit's outward subunit fan (deg)
const SUB_ARC_PER = 38;                  // fan degrees added per extra subunit
const UNIT_GAP = 30;                     // clearance between adjacent unit clusters
const PADDING = 70;                      // canvas breathing room

function polarToXY(center, radius, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return {
    x: center.x + radius * Math.cos(rad),
    y: center.y + radius * Math.sin(rad)
  };
}

// How far out a unit's subunits sit, how wide they fan, and the cluster's
// tangential half-width (used to keep adjacent unit clusters from touching).
function subLayoutFor(m) {
  if (m <= 1) {
    return { rS: SUBUNIT_RADIUS, step: 0, arc: 0, halfWidth: SUBUNIT_SIZE / 2 };
  }
  const arc = Math.min(SUB_MAX_ARC, SUB_ARC_PER * (m - 1));
  const step = arc / (m - 1);
  // Grow the subunit ring so neighbours keep at least SUB_MIN_CHORD apart.
  const rS = Math.max(SUBUNIT_RADIUS, SUB_MIN_CHORD / (2 * Math.sin((step * Math.PI) / 360)));
  const halfWidth = rS * Math.sin((arc / 2) * Math.PI / 180) + SUBUNIT_SIZE / 2;
  return { rS, step, arc, halfWidth };
}

// Leading filler we drop when shortening a title (never drop the whole thing).
const LABEL_STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "with", "for", "in", "on", "&",
  "its", "intro", "introduction", "basics", "basic", "overview",
  "fundamentals", "general", "understanding"
]);

// Turn a unit/subunit title into a short label that actually describes the
// topic — not just its first (often generic) word. Strips "Unit 1:" / numbering
// prefixes and leading filler, then keeps up to ~3 meaningful words within a
// tight character budget so it reads as the real topic ("Right Triangle",
// "Pythagorean Theorem") instead of "Right" or "Square".
function conciseLabel(text) {
  if (!text) return "Topic";
  let t = String(text).trim()
    .replace(/^\s*(unit|chapter|lesson|part|section|module|topic|week|day)\b[\s:.\-)]*\d*[\s:.\-)]*/i, "")
    .replace(/^\s*\d+(?:\.\d+)*[\s:.\-)]*/, "")
    .trim();
  if (!t) t = String(text).trim();

  // Treat commas / slashes as separators so "Sine, Cosine, Tangent" tokenizes.
  let words = t.replace(/[,/]+/g, " ").split(/\s+/).filter(Boolean);
  // Drop leading filler words, but always keep at least one word.
  let i = 0;
  while (i < words.length - 1 && LABEL_STOP.has(words[i].toLowerCase())) i++;
  words = words.slice(i);

  // Build a short phrase: always allow up to 2 words, a 3rd if it still fits.
  const out = [];
  for (const w of words) {
    if (out.length >= 3) break;
    const next = out.concat(w).join(" ");
    if (out.length >= 2 && next.length > 26) break;
    out.push(w);
  }
  // Never end on a filler word ("Square Roots and" -> "Square Roots").
  while (out.length > 1 && LABEL_STOP.has(out[out.length - 1].toLowerCase())) out.pop();

  let label = out.join(" ") || words[0] || t;
  if (label.length > 28) label = label.slice(0, 26).trim() + "…";
  return label;
}

function Line({ x1, y1, x2, y2, stroke = "#93C5FD" }) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.5" />);


}

const colorMap = {
  blue: { bg: "from-blue-600 to-blue-700", border: "border-blue-500", text: "text-blue-600", light: "bg-blue-100", stroke: "#3B82F6", shadow: "rgba(59,130,246,0.4)" },
  purple: { bg: "from-purple-600 to-purple-700", border: "border-purple-500", text: "text-purple-600", light: "bg-purple-100", stroke: "#A855F7", shadow: "rgba(168,85,247,0.4)" },
  pink: { bg: "from-pink-600 to-pink-700", border: "border-pink-500", text: "text-pink-600", light: "bg-pink-100", stroke: "#EC4899", shadow: "rgba(236,72,153,0.4)" },
  green: { bg: "from-green-600 to-green-700", border: "border-green-500", text: "text-green-600", light: "bg-green-100", stroke: "#16A34A", shadow: "rgba(22,163,74,0.4)" },
  orange: { bg: "from-orange-600 to-orange-700", border: "border-orange-500", text: "text-orange-600", light: "bg-orange-100", stroke: "#EA580C", shadow: "rgba(234,88,12,0.4)" },
  red: { bg: "from-red-600 to-red-700", border: "border-red-500", text: "text-red-600", light: "bg-red-100", stroke: "#DC2626", shadow: "rgba(220,38,38,0.4)" },
  indigo: { bg: "from-indigo-600 to-indigo-700", border: "border-indigo-500", text: "text-indigo-600", light: "bg-indigo-100", stroke: "#4F46E5", shadow: "rgba(79,70,229,0.4)" },
  cyan: { bg: "from-cyan-600 to-cyan-700", border: "border-cyan-500", text: "text-cyan-600", light: "bg-cyan-100", stroke: "#0891B2", shadow: "rgba(8,145,178,0.4)" }
};

export default function RadialMindmap({ curriculum, units, subunits, studentProgress, assignments = [], onSubunitClick, curriculumColor = "blue" }) {
  const [currentTime, setCurrentTime] = React.useState(Date.now());
  const colors = colorMap[curriculumColor] || colorMap.blue;

  // Auto-fit: scale the virtual canvas down to the available width.
  const wrapRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);

  // Update time every minute to recalculate progress bars
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const getUnitCompletionPercent = (unitId) => {
    const unitSubunits = subunits.filter((s) => s.unit_id === unitId);
    if (unitSubunits.length === 0) return 0;
    const completed = unitSubunits.filter((sub) => {
      const progress = studentProgress.find((p) => p.subunit_id === sub.id);
      return progress && progress.new_session_completed === true && (progress.new_session_score || 0) >= PASS_THRESHOLD;
    }).length;
    return Math.round(completed / unitSubunits.length * 100);
  };

  const getSubunitTimeProgress = (subunitId) => {
    const progress = studentProgress.find((p) => p.subunit_id === subunitId);
    if (!progress || !progress.next_review_date || !progress.last_review_date) return 0;

    const now = currentTime;
    const lastReview = new Date(progress.last_review_date).getTime();
    const nextReview = new Date(progress.next_review_date).getTime();

    const totalDuration = nextReview - lastReview;
    const elapsed = now - lastReview;

    // Progress goes from 100% (just completed) to 0% (review due)
    const percentRemaining = Math.max(0, Math.min(100, (totalDuration - elapsed) / totalDuration * 100));
    return percentRemaining;
  };

  const getFontSize = (text, baseSize, containerSize) => {
    if (!text) return baseSize;

    // Calculate usable width (85% of container, accounting for padding and circular shape)
    const usableWidth = containerSize * 0.7;

    // Estimate text width (average character width is ~0.55 of font size)
    const estimateTextWidth = (fontSize) => text.length * fontSize * 0.55;

    // Start with base size and scale down if needed
    let fontSize = baseSize;
    while (estimateTextWidth(fontSize) > usableWidth && fontSize > 8) {
      fontSize -= 0.5;
    }

    return Math.max(Math.round(fontSize), 8);
  };

  const isSubunitCompleted = (subunitId) => {
    const progress = studentProgress.find((p) => p.subunit_id === subunitId);
    return progress && progress.new_session_completed === true && (progress.new_session_score || 0) >= PASS_THRESHOLD;
  };

  const isSubunitAssigned = (subunitId) => {
    const assignment = assignments.find((a) => a.subunit_id === subunitId);
    if (!assignment) return false;

    // Check if the due date has been reached
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(assignment.due_date);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate <= today;
  };

  // Concise, topic-describing label for the curriculum center node.
  const curriculumText = conciseLabel(curriculum?.subject_name);

  // ---- Adaptive radial layout -------------------------------------------
  // Unit-ring radius grows with the unit count (so clusters never collide) and
  // each unit's subunits spread on a ring sized to their count. The whole thing
  // is then scaled to fit, so the map looks uniform at any size/organization.
  const N = units.length;
  const unitMetas = units.map((unit, index) => {
    const subs = subunits.filter((s) => s.unit_id === unit.id);
    const lay = subLayoutFor(subs.length);
    return {
      unit,
      subs,
      lay,
      index,
      angle: (index / Math.max(1, N)) * 360 - 90, // start from top
      displayText: conciseLabel(unit.unit_name)
    };
  });

  const maxHalfWidth = Math.max(SUBUNIT_SIZE / 2, ...unitMetas.map((m) => m.lay.halfWidth));
  const maxOuter = Math.max(
    SUBUNIT_RADIUS + SUBUNIT_SIZE / 2,
    ...unitMetas.map((m) => m.lay.rS + SUBUNIT_SIZE / 2)
  );
  const unitRadius =
    N <= 1
      ? UNIT_RADIUS
      : Math.max(UNIT_RADIUS, (maxHalfWidth + UNIT_GAP) / Math.sin(Math.PI / N));
  const boundingR = unitRadius + maxOuter;
  const canvas = 2 * (boundingR + PADDING);
  const center = { x: canvas / 2, y: canvas / 2 };

  // Subunit angles fan around each unit's outward direction.
  const subunitsWithAngles = unitMetas.flatMap(({ unit, subs, lay, angle }) => {
    const m = subs.length;
    return subs.map((sub, j) => {
      const offset = m > 1 ? (j - (m - 1) / 2) * lay.step : 0;
      return {
        ...sub,
        unitId: unit.id,
        angle: angle + offset,
        rS: lay.rS,
        displayText: conciseLabel(sub.subunit_name)
      };
    });
  });

  // Fit the virtual canvas to BOTH the available width and height of the region
  // we're mounted in, so the map is always fully visible without scrolling on
  // any screen. The wrapper fills its (bounded) parent, so its client size is
  // stable and there's no shrink-to-zero feedback loop.
  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth || canvas;
      const h = el.clientHeight || canvas;
      setScale(Math.min(1, w / canvas, h / canvas));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [canvas]);

  return (
    <div ref={wrapRef} className="w-full h-full flex items-center justify-center" style={{ fontFamily: '"Poppins", sans-serif' }}>
      <div style={{ width: canvas * scale, height: canvas * scale, position: "relative" }}>
        <div
          className="absolute top-0 left-0 bg-zinc-50 rounded-2xl"
          style={{ width: canvas, height: canvas, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {/* Connection lines layer */}
          <svg className="absolute inset-0 pointer-events-none" style={{ width: canvas, height: canvas }}>
            {/* Center → Units */}
            {unitMetas.map((m) => {
              const pos = polarToXY(center, unitRadius, m.angle);
              return (
                <Line key={m.unit.id} x1={center.x} y1={center.y} x2={pos.x} y2={pos.y} stroke={colors.stroke} />);
            })}

            {/* Units → Subunits */}
            {unitMetas.map((m) => {
              const unitPos = polarToXY(center, unitRadius, m.angle);
              return subunitsWithAngles
                .filter((s) => s.unitId === m.unit.id)
                .map((sub) => {
                  const subPos = polarToXY(unitPos, sub.rS, sub.angle);
                  return (
                    <Line key={`${m.unit.id}-${sub.id}`} x1={unitPos.x} y1={unitPos.y} x2={subPos.x} y2={subPos.y} stroke={colors.stroke} />);
                });
            })}
          </svg>

          {/* Center Node */}
          <div
            style={{
              width: CENTER_SIZE,
              height: CENTER_SIZE,
              left: center.x - CENTER_SIZE / 2,
              top: center.y - CENTER_SIZE / 2
            }}
            className="absolute flex items-center justify-center rounded-full text-white font-semibold">

            <div
              className={`w-full h-full rounded-full bg-gradient-to-br ${colors.bg} flex items-center justify-center px-2`}
              style={{ fontSize: `${getFontSize(curriculumText, 20, CENTER_SIZE)}px`, boxShadow: `0 8px 32px ${colors.shadow}` }}>

              {curriculumText}
            </div>
          </div>

          {/* Unit Nodes */}
          {unitMetas.map((m) => {
            const pos = polarToXY(center, unitRadius, m.angle);
            const completionPercent = getUnitCompletionPercent(m.unit.id);
            return (
              <div
                key={m.unit.id}
                style={{
                  width: UNIT_SIZE,
                  height: UNIT_SIZE,
                  left: pos.x - UNIT_SIZE / 2,
                  top: pos.y - UNIT_SIZE / 2
                }}
                className={`absolute flex flex-col items-center justify-center rounded-full bg-white border-[3px] ${colors.border} ${colors.text} font-semibold shadow-lg`}>

                <div style={{ fontSize: `${getFontSize(m.displayText, 13, UNIT_SIZE)}px` }} className="px-2 text-center leading-tight">
                  {m.displayText}
                </div>
                <div className={`w-14 h-2 ${colors.light} rounded-full overflow-hidden mt-1.5`}>
                  <div
                    className={`h-full ${colors.text.replace("text-", "bg-")} rounded-full transition-all duration-500`}
                    style={{ width: `${completionPercent}%` }} />

                </div>
              </div>);
          })}

          {/* Subunit Nodes with Circular Progress */}
          {unitMetas.map((m) => {
            const unitPos = polarToXY(center, unitRadius, m.angle);
            return subunitsWithAngles
              .filter((s) => s.unitId === m.unit.id)
              .map((sub) => {
                const pos = polarToXY(unitPos, sub.rS, sub.angle);
                const completed = isSubunitCompleted(sub.id);
                const assigned = isSubunitAssigned(sub.id);
                const timeProgress = getSubunitTimeProgress(sub.id);

                const isClickable = assigned;
                const borderColor = completed ? colors.border : assigned ? colors.border.replace("500", "300") : "border-gray-200";
                const textColor = completed ? colors.text : assigned ? colors.text.replace("600", "500") : "text-gray-300";
                const opacity = assigned ? 1 : 0.6;

                // Calculate circular progress (starts at top, goes clockwise)
                const radius = (SUBUNIT_SIZE - 4) / 2;
                const circumference = 2 * Math.PI * radius;
                const progressOffset = circumference - timeProgress / 100 * circumference;

                return (
                  <div
                    key={sub.id}
                    style={{
                      width: SUBUNIT_SIZE,
                      height: SUBUNIT_SIZE,
                      left: pos.x - SUBUNIT_SIZE / 2,
                      top: pos.y - SUBUNIT_SIZE / 2,
                      opacity,
                      cursor: isClickable ? "pointer" : "not-allowed"
                    }}
                    className="absolute transition-all duration-300 hover:scale-105"
                    onClick={() => isClickable && onSubunitClick(sub)}>

                    {/* Circular Progress Ring */}
                    {completed && timeProgress > 0 &&
                    <svg
                      className="absolute inset-0 w-full h-full -rotate-90"
                      style={{ pointerEvents: "none" }}>

                        <circle
                        cx={SUBUNIT_SIZE / 2}
                        cy={SUBUNIT_SIZE / 2}
                        r={radius}
                        stroke={colors.stroke}
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={progressOffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000" />

                      </svg>
                    }

                    {/* Subunit Content */}
                    <div
                      style={{
                        fontSize: `${getFontSize(sub.displayText, 12, SUBUNIT_SIZE)}px`
                      }}
                      className={`w-full h-full flex items-center justify-center rounded-full bg-white border-[2.5px] ${borderColor} ${textColor} font-medium shadow-md px-2`}>

                      {sub.displayText}
                    </div>
                  </div>);
              });
          })}
        </div>
      </div>
    </div>);

}
