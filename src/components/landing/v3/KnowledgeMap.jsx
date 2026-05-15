import React, { useEffect, useRef } from "react";

/**
 * KnowledgeMap — radial knowledge graph for the hero.
 *
 * Renders an SVG node graph (center node + two rings of nodes connected by
 * radial lines) and triggers a one-pass entrance animation on mount via the
 * `mounted` class. Every animated piece gets a CSS custom property `--delay`
 * so the stagger sequencing lives in JSX, not in dozens of duplicated keyframes.
 *
 * Animation sequence on mount:
 *   1. Center node fades + scales in, plus a one-shot "ping" halo.
 *   2. Radial lines (center → primary) draw outward, staggered.
 *   3. Primary nodes fade + scale in, staggered.
 *   4. Branch lines (primary → secondary) draw outward, staggered.
 *   5. Secondary nodes fade + scale in, staggered.
 *   6. Progress bars on primary nodes fill from 0 → target width.
 * Then everything rests. No infinite pulses.
 */
export default function KnowledgeMap() {
  const ref = useRef(null);

  useEffect(() => {
    // Flip the `mounted` class on the next frame so CSS transitions kick in
    // AFTER the initial styles paint (otherwise the browser optimizes the
    // animation away because src/dst are applied in the same paint cycle).
    const id = requestAnimationFrame(() => {
      if (ref.current) ref.current.classList.add("mounted");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const cx = 500,
    cy = 500;
  const R1 = 270;
  const R2 = 440;

  const primary = [
    { id: "foundations", label: "Foundations", angle: -90, progress: 0.78 },
    { id: "cells", label: "Cells", angle: -30, progress: 0.52 },
    { id: "genetics", label: "Genetics", angle: 30, progress: 0.34 },
    { id: "evolution", label: "Evolution", angle: 90, progress: 0.86 },
    { id: "ecology", label: "Ecology", angle: 150, progress: 0.61 },
    { id: "human", label: "Human", angle: 210, progress: 0.45 },
  ];

  const secondary = [
    { label: "Water", parent: -90, off: -18 },
    { label: "Biochem", parent: -90, off: 18 },
    { label: "Membrane", parent: -30, off: -18 },
    { label: "Structure", parent: -30, off: 18 },
    { label: "Mendelian", parent: 30, off: -18 },
    { label: "DNA", parent: 30, off: 18 },
    { label: "Selection", parent: 90, off: -18 },
    { label: "Evidence", parent: 90, off: 18 },
    { label: "Energy", parent: 150, off: -18 },
    { label: "Populations", parent: 150, off: 18 },
    { label: "Body", parent: 210, off: -18 },
    { label: "Disease", parent: 210, off: 18 },
  ];

  const pos = (angle, r) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  };

  return (
    <div className="km-wrap" ref={ref}>
      <svg viewBox="0 0 1000 1000" className="km-svg" aria-hidden="true">
        <defs>
          <radialGradient id="km-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </radialGradient>
          <filter
            id="km-glow"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="km-soft-shadow"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="4"
              floodColor="#0B1437"
              floodOpacity="0.12"
            />
          </filter>
        </defs>

        {/* Quiet concentric rings */}
        <circle cx={cx} cy={cy} r={R1} className="km-ring" />
        <circle cx={cx} cy={cy} r={R2} className="km-ring" />

        {/* Primary connecting lines (center → primary) */}
        {primary.map((n, i) => {
          const p = pos(n.angle, R1);
          return (
            <line
              key={`l1-${i}`}
              className="km-line km-line-1"
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              style={{ "--delay": `${0.1 + i * 0.06}s` }}
            />
          );
        })}

        {/* Secondary connecting lines (primary → secondary) */}
        {secondary.map((n, i) => {
          const a = pos(n.parent, R1);
          const b = pos(n.parent + n.off, R2);
          return (
            <line
              key={`l2-${i}`}
              className="km-line km-line-2"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              style={{ "--delay": `${0.6 + i * 0.04}s` }}
            />
          );
        })}

        {/* Center node */}
        <g className="km-center" style={{ "--delay": "0s" }}>
          <circle
            cx={cx}
            cy={cy}
            r="98"
            fill="url(#km-center)"
            filter="url(#km-glow)"
          />
          <circle cx={cx} cy={cy} r="98" className="km-center-pulse" />
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            className="km-center-label"
          >
            Biology
          </text>
        </g>

        {/* Primary nodes + progress bars */}
        {primary.map((n, i) => {
          const p = pos(n.angle, R1);
          return (
            <g
              key={`p-${i}`}
              className="km-node-1"
              style={{ "--delay": `${0.4 + i * 0.08}s` }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r="62"
                fill="#fff"
                filter="url(#km-soft-shadow)"
              />
              <circle cx={p.x} cy={p.y} r="62" className="km-node-ring" />
              <text
                x={p.x}
                y={p.y - 6}
                textAnchor="middle"
                className="km-label-1"
              >
                {n.label}
              </text>
              {/* progress track */}
              <rect
                x={p.x - 36}
                y={p.y + 12}
                width="72"
                height="5"
                rx="2.5"
                className="km-track"
              />
              {/* progress fill — width animated from 0 → --w via CSS */}
              <rect
                x={p.x - 36}
                y={p.y + 12}
                height="5"
                rx="2.5"
                className="km-fill"
                style={{
                  "--w": `${72 * n.progress}px`,
                  "--delay": `${0.9 + i * 0.08}s`,
                }}
              />
            </g>
          );
        })}

        {/* Secondary nodes */}
        {secondary.map((n, i) => {
          const p = pos(n.parent + n.off, R2);
          return (
            <g
              key={`s-${i}`}
              className="km-node-2"
              style={{ "--delay": `${1.0 + i * 0.05}s` }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r="42"
                fill="#fff"
                filter="url(#km-soft-shadow)"
              />
              <circle
                cx={p.x}
                cy={p.y}
                r="42"
                className="km-node-ring km-node-ring-2"
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                className="km-label-2"
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
