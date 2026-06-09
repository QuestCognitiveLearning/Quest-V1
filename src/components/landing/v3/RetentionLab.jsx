import React, { useEffect, useMemo, useRef, useState } from "react";

const W = 880;
const H = 440;
const M = { t: 50, r: 40, b: 60, l: 70 };
const cw = W - M.l - M.r;
const ch = H - M.t - M.b;
const DAYS_MAX = 21;
const ASYMPTOTE = 0.18;
const HALFLIFE_DECAY = 2.0;

const xL = (d) => M.l + (d / DAYS_MAX) * cw;
const yL = (v) => M.t + (1 - v / 100) * ch;
const xToDay = (x) => Math.max(0, Math.min(DAYS_MAX, ((x - M.l) / cw) * DAYS_MAX));

function buildCurve(reviews) {
  const sorted = [...reviews].sort((a, b) => a - b);
  const points = [{ d: 0, v: 100 }];
  let lastD = 0;
  let lastV = 100;
  let strength = 0;
  const baseHL = 1.4;
  for (const r of sorted) {
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const d = lastD + (r - lastD) * (i / steps);
      const hl = baseHL * Math.pow(1.6, strength);
      const v = 100 * Math.pow(0.5, (d - lastD) / hl) * (lastV / 100);
      points.push({ d, v });
    }
    lastD = r;
    lastV = 100;
    points.push({ d: r, v: 100, review: true });
    strength += 1;
  }
  const steps = 30;
  for (let i = 1; i <= steps; i++) {
    const d = lastD + (DAYS_MAX - lastD) * (i / steps);
    const hl = baseHL * Math.pow(1.6, strength);
    const v = 100 * Math.pow(0.5, (d - lastD) / hl) * (lastV / 100);
    points.push({ d, v });
  }
  return points;
}

function buildDecay() {
  const pts = [];
  for (let d = 0; d <= DAYS_MAX; d += 0.4) {
    const v = 100 * (ASYMPTOTE + (1 - ASYMPTOTE) * Math.exp(-d / HALFLIFE_DECAY));
    pts.push({ d, v });
  }
  return pts;
}

function pathFromPoints(pts) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${xL(p.d).toFixed(1)} ${yL(p.v).toFixed(1)}`).join(" ");
}

export default function RetentionLab() {
  const [reviews, setReviews] = useState([1, 3, 7, 12]);
  const [dragIdx, setDragIdx] = useState(null);
  const svgRef = useRef(null);

  const decay = useMemo(() => buildDecay(), []);
  const decayPath = useMemo(() => pathFromPoints(decay), [decay]);
  const curve = useMemo(() => buildCurve(reviews), [reviews]);
  const curvePath = useMemo(() => pathFromPoints(curve), [curve]);

  const retentionD21 = useMemo(() => {
    const last = curve[curve.length - 1];
    return Math.round(last.v);
  }, [curve]);

  const decayD21 = useMemo(
    () =>
      Math.round(
        100 * (ASYMPTOTE + (1 - ASYMPTOTE) * Math.exp(-DAYS_MAX / HALFLIFE_DECAY))
      ),
    []
  );
  const multiplier = useMemo(
    () => (retentionD21 / Math.max(0.1, decayD21)).toFixed(1),
    [retentionD21, decayD21]
  );

  useEffect(() => {
    if (dragIdx === null) return;
    const onMove = (e) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      pt.x = cx;
      pt.y = 0;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const p = pt.matrixTransform(ctm.inverse());
      let d = xToDay(p.x);
      d = Math.round(d * 2) / 2;
      setReviews((prev) => {
        const copy = [...prev];
        const before = copy[dragIdx - 1] !== undefined ? copy[dragIdx - 1] + 0.5 : 0.5;
        const after = copy[dragIdx + 1] !== undefined ? copy[dragIdx + 1] - 0.5 : DAYS_MAX - 0.5;
        copy[dragIdx] = Math.max(before, Math.min(after, d));
        return copy;
      });
    };
    const endDrag = () => setDragIdx(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", endDrag);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", endDrag);
    };
  }, [dragIdx]);

  const yTicks = [0, 25, 50, 75, 100];
  const xTicks = [0, 3, 7, 14, 21];

  return (
    <section id="lab" className="bg-white border-y border-[#E2E8F0]" style={{ padding: "72px 0" }}>
      <div className="lp-v3-container">
        <div className="mb-8">
          <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase">
            The Science · Live
          </span>
          <h2
            className="font-bold text-[#0F172A] mt-3 mb-3"
            style={{
              fontSize: "clamp(32px, 4.2vw, 52px)",
              lineHeight: "1.05",
              letterSpacing: "-0.025em",
            }}
          >
            Drag The Reviews. Watch Them <em className="not-italic text-[#2563EB]">Remember.</em>
          </h2>
          <p className="text-[17px] text-[#64748B] max-w-2xl">
            Spaced practice doubles retention. Drag the markers and the curve recalculates.
          </p>
        </div>

        <div className="rounded-[28px] bg-white border border-[#E2E8F0] p-6 lg:p-8 lp-v3-deep-shadow">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-[#0F172A] text-xl tracking-tight">
              Retention Over 3 Weeks
            </h3>
            <div className="inline-flex items-center gap-2 text-[12px] text-[#64748B] font-medium">
              <span className="bg-[#E5ECF7] rounded-md px-2 py-0.5 font-bold text-[#0F172A]">
                Drag
              </span>
              the blue markers
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_240px] gap-5 items-start">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto select-none"
              role="img"
              aria-label="Retention curve, interactive"
            >
              {yTicks.map((t) => (
                <line
                  key={`y${t}`}
                  x1={M.l}
                  x2={W - M.r}
                  y1={yL(t)}
                  y2={yL(t)}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
              ))}
              {xTicks.map((d) => (
                <line
                  key={`x${d}`}
                  x1={xL(d)}
                  x2={xL(d)}
                  y1={M.t}
                  y2={H - M.b}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                />
              ))}
              {yTicks.map((t) => (
                <text
                  key={`yl${t}`}
                  x={M.l - 12}
                  y={yL(t) + 4}
                  textAnchor="end"
                  fill="#64748B"
                  fontSize="11"
                  fontWeight="600"
                >
                  {t}%
                </text>
              ))}
              {xTicks.map((d) => (
                <text
                  key={`xl${d}`}
                  x={xL(d)}
                  y={H - M.b + 22}
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="11"
                  fontWeight="600"
                >
                  D{d}
                </text>
              ))}

              <path
                d={decayPath}
                fill="none"
                stroke="#94A3B8"
                strokeWidth="2"
                strokeDasharray="6 6"
              />

              <path
                d={curvePath}
                fill="none"
                stroke="#2563EB"
                strokeWidth="3"
                style={{ filter: "drop-shadow(0 4px 6px rgba(37,99,235,0.3))" }}
              />

              {reviews.map((r, i) => (
                <g
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDragIdx(i);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setDragIdx(i);
                  }}
                  transform={`translate(${xL(r)}, ${yL(100)})`}
                  style={{ cursor: "grab" }}
                >
                  <circle r="22" fill="rgba(37,99,235,0.1)" stroke="#2563EB" strokeOpacity="0.4" />
                  <line
                    x1="0"
                    x2="0"
                    y1="0"
                    y2={ch - (yL(100) - M.t)}
                    stroke="#2563EB"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                    opacity="0.35"
                  />
                  <circle r="9" fill="#2563EB" />
                  <text
                    y="-16"
                    textAnchor="middle"
                    fill="#1D4ED8"
                    fontSize="12"
                    fontWeight="700"
                  >
                    D{r % 1 === 0 ? r : r.toFixed(1)}
                  </text>
                </g>
              ))}
            </svg>

            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 lp-v3-soft-shadow">
                <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#64748B] mb-1.5">
                  Retention at Day 21
                </div>
                <div className="font-extrabold text-[38px] leading-none text-[#0F172A] flex items-baseline gap-1">
                  <span className="text-[#2563EB]">{retentionD21}</span>
                  <span className="text-[16px] text-[#64748B] font-semibold">%</span>
                </div>
                <div className="text-[12.5px] text-[#64748B] mt-1.5 font-medium">
                  with your review schedule
                </div>
              </div>

              <div
                className="rounded-xl p-5 text-white lp-v3-soft-shadow"
                style={{ background: "linear-gradient(160deg, #2563EB 0%, #1D4ED8 100%)" }}
              >
                <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-white/70 mb-1.5">
                  That's
                </div>
                <div className="font-extrabold text-[38px] leading-none flex items-baseline gap-1">
                  <span className="text-[#F97316]">{multiplier}×</span>
                </div>
                <div className="text-[12.5px] text-white/80 mt-1.5 font-medium leading-snug">
                  more remembered, three weeks later
                </div>
              </div>
            </div>
          </div>

          <div
            className="inline-flex items-center gap-6 mt-4 px-4 py-2.5 rounded-full bg-[#E5ECF7] w-fit"
          >
            <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#1E293B]">
              <span className="inline-block w-[18px] h-[3px] rounded bg-[#2563EB]" />
              With Quest
            </span>
            <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#1E293B]">
              <span className="inline-block w-[18px] h-[3px] rounded bg-[#64748B]" />
              Without Spacing
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
