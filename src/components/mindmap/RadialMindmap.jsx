import React from "react";

// Positioning & sizing constants
const CENTER = { x: 600, y: 400 };
const UNIT_RADIUS = 220;
const SUBUNIT_RADIUS = 130;

const CENTER_SIZE = 130;
const UNIT_SIZE = 85;
const SUBUNIT_SIZE = 65;

/**
 * When the curriculum has more than this many units, alternate units onto two
 * concentric rings instead of one. With 1 ring + N units, each unit owns
 * 360/N° of angular space; the subunit fan is 120°. Beyond N=8 the fans
 * collide. Staggering doubles the angular budget per ring, and the second
 * ring physically separates adjacent units further in 2D.
 */
const STAGGER_THRESHOLD = 8;

/**
 * Extra radius applied to "outer ring" units when staggering is active.
 * 90px is chosen to keep the outermost subunit (sitting at unit.radius +
 * SUBUNIT_RADIUS = 220 + 90 + 130 = 440 from center) inside a reasonable
 * canvas. See `containerHeight` below for the matching container size bump.
 */
const STAGGER_OFFSET = 90;

function polarToXY(center, radius, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return {
    x: center.x + radius * Math.cos(rad),
    y: center.y + radius * Math.sin(rad)
  };
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
      return progress && progress.new_session_completed === true && (progress.new_session_score || 0) >= 70;
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

  const getOneWord = (text, usedWords = new Set()) => {
    if (!text) return "Topic";
    const words = text.split(/[\s\-_]+/).filter((w) => w.length > 2);

    // Try each word until we find one that hasn't been used
    for (const word of words) {
      if (!usedWords.has(word.toLowerCase())) {
        usedWords.add(word.toLowerCase());
        return word;
      }
    }

    // If all words are used, try first two words
    if (words.length >= 2) {
      const twoWords = `${words[0]} ${words[1]}`;
      if (!usedWords.has(twoWords.toLowerCase())) {
        usedWords.add(twoWords.toLowerCase());
        return twoWords;
      }
    }

    // Fallback to first word or original text
    return words[0] || text.split(/[\s\-_]+/)[0] || "Topic";
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
    return progress && progress.new_session_completed === true && (progress.new_session_score || 0) >= 70;
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

  // Track used words to avoid duplicates
   const usedWords = new Set();

   // Get display text for curriculum
   const curriculumText = getOneWord(curriculum?.subject_name, usedWords);

   // Update line color based on curriculum color
   const lineColor = colors.stroke.replace(/[0-9a-f]{6}/i, '') || "#93C5FD";

  // Crowding-aware layout. With <=8 units we keep the single-ring layout +
  // wide 120° subunit fan. Beyond that, we alternate units onto two rings
  // (inner = even index, outer = odd index) and narrow each fan to fit the
  // tighter per-ring angular budget. This keeps subunits from colliding when
  // a teacher builds a large curriculum (e.g. a 12-unit AP Bio map).
  const needsStagger = units.length > STAGGER_THRESHOLD;
  // When staggered, the angular budget per ring is 720°/N (since N/2 units
  // share each ring). Use 85% as a safety margin so adjacent fans never touch.
  const subunitFanDegrees = needsStagger
    ? Math.min(120, 0.85 * 720 / units.length)
    : 120;

  // Calculate angles + per-unit radius for units
  const unitsWithAngles = units.map((unit, index) => {
    const angle = index / units.length * 360 - 90; // Start from top
    // Odd-indexed units push out to the outer ring when staggering is on.
    const unitRadius =
      needsStagger && index % 2 === 1 ? UNIT_RADIUS + STAGGER_OFFSET : UNIT_RADIUS;
    const displayText = getOneWord(unit.unit_name, usedWords);
    return { ...unit, angle, unitRadius, displayText };
  });

  // Calculate angles for subunits around each unit
  const subunitsWithAngles = unitsWithAngles.map((unit) => {
    const unitSubunits = subunits.filter((s) => s.unit_id === unit.id);
    const totalSubs = unitSubunits.length;

    // Spread subunits around the unit using the dynamic fan.
    const spreadAngle = totalSubs > 1 ? subunitFanDegrees / (totalSubs - 1) : 0;

    return unitSubunits.map((sub, subIndex) => {
      const offset = (subIndex - (totalSubs - 1) / 2) * spreadAngle;
      const angle = unit.angle + offset;
      const displayText = getOneWord(sub.subunit_name, usedWords);
      return { ...sub, angle, unitId: unit.id, displayText };
    });
  }).flat();

  return (
     <div
       className="bg-zinc-50 relative w-full overflow-hidden flex items-center justify-center"
       style={{
         // Stretch the canvas when staggering — outer-ring subunits sit at
         // UNIT_RADIUS + STAGGER_OFFSET + SUBUNIT_RADIUS from center (≈440px)
         // which would clip out of an 800px-tall canvas centered at y=400.
         height: needsStagger ? '1000px' : '800px',
         fontFamily: '"Poppins", sans-serif',
       }}
     >
       {/* Connection lines layer */}
       <svg className="absolute inset-0 w-full h-full pointer-events-none">
         {/* Center → Units */}
         {unitsWithAngles.map((unit) => {
           const pos = polarToXY(CENTER, unit.unitRadius, unit.angle);
           return (
             <Line
               key={unit.id}
               x1={CENTER.x}
               y1={CENTER.y}
               x2={pos.x}
               y2={pos.y}
               stroke={colors.stroke} />);


        })}

        {/* Units → Subunits */}
        {unitsWithAngles.map((unit) => {
          const unitPos = polarToXY(CENTER, unit.unitRadius, unit.angle);
          const unitSubunits = subunitsWithAngles.filter((s) => s.unitId === unit.id);

          return unitSubunits.map((sub) => {
            const subPos = polarToXY(unitPos, SUBUNIT_RADIUS, sub.angle);
            return (
              <Line
                key={`${unit.id}-${sub.id}`}
                x1={unitPos.x}
                y1={unitPos.y}
                x2={subPos.x}
                y2={subPos.y}
                stroke={colors.stroke} />);


          });
        })}
      </svg>

      {/* Center Node */}
      <div
        style={{
          width: CENTER_SIZE,
          height: CENTER_SIZE,
          left: CENTER.x - CENTER_SIZE / 2,
          top: CENTER.y - CENTER_SIZE / 2
        }}
        className="absolute flex items-center justify-center rounded-full text-white font-semibold">

        <div
          className={`w-full h-full rounded-full bg-gradient-to-br ${colors.bg} flex items-center justify-center px-2`}
          style={{ fontSize: `${getFontSize(curriculumText, 20, CENTER_SIZE)}px`, boxShadow: `0 8px 32px ${colors.shadow}` }}>

          {curriculumText}
        </div>
      </div>

      {/* Unit Nodes */}
      {unitsWithAngles.map((unit) => {
        const pos = polarToXY(CENTER, unit.unitRadius, unit.angle);
        const completionPercent = getUnitCompletionPercent(unit.id);
        return (
          <div
            key={unit.id}
            style={{
              width: UNIT_SIZE,
              height: UNIT_SIZE,
              left: pos.x - UNIT_SIZE / 2,
              top: pos.y - UNIT_SIZE / 2
            }}
            className={`absolute flex flex-col items-center justify-center rounded-full bg-white border-[3px] ${colors.border} ${colors.text} font-semibold shadow-lg`}>

            <div style={{ fontSize: `${getFontSize(unit.displayText, 13, UNIT_SIZE)}px` }} className="px-2 text-center leading-tight">
              {unit.displayText}
            </div>
            <div className={`w-14 h-2 ${colors.light} rounded-full overflow-hidden mt-1.5`}>
              <div
                className={`h-full ${colors.text.replace("text-", "bg-")} rounded-full transition-all duration-500`}
                style={{ width: `${completionPercent}%` }} />

            </div>
          </div>);

      })}

      {/* Subunit Nodes with Circular Progress */}
      {unitsWithAngles.map((unit) => {
        const unitPos = polarToXY(CENTER, unit.unitRadius, unit.angle);
        const unitSubunits = subunitsWithAngles.filter((s) => s.unitId === unit.id);

        return unitSubunits.map((sub) => {
          const pos = polarToXY(unitPos, SUBUNIT_RADIUS, sub.angle);
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
                cursor: isClickable ? 'pointer' : 'not-allowed'
              }}
              className="absolute transition-all duration-300 hover:scale-105"
              onClick={() => isClickable && onSubunitClick(sub)}>

              {/* Circular Progress Ring */}
              {completed && timeProgress > 0 &&
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                style={{ pointerEvents: 'none' }}>

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
    </div>);

}