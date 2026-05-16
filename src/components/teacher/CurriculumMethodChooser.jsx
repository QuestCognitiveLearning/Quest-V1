/**
 * @file   CurriculumMethodChooser.jsx
 * @desc   Two-card chooser shown when a teacher starts building a new
 *         curriculum: "Build Manually" (left) and "Generate with Quest AI"
 *         (right, featured with a "Recommended" badge).
 *
 *         Visual: matches the Curriculum Building design bundle (Plus Jakarta
 *         Sans, equal-width cards, brand-soft palette, mock previews inside
 *         each card so the difference between manual entry and AI generation
 *         is legible at a glance).
 *
 *         Props are unchanged so CreateCurriculum.jsx didn't need to change:
 *           - onSelectManual()   → user picked "Build Manually"
 *           - onSelectQuestAi()  → user picked "Generate with Quest AI"
 *
 * @author Quest Learning core team
 */

import React from "react";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Pencil,
  Sparkles,
  Zap,
} from "lucide-react";

const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

// Palette from the design bundle. Kept inline because the rest of the teacher
// dashboard uses different tokens — scoping these to the chooser avoids
// polluting global CSS.
const C = {
  paper: "#EEF3FB",
  paper2: "#E5ECF7",
  card: "#FFFFFF",
  ink: "#0F172A",
  ink2: "#1E293B",
  ink3: "#475569",
  muted: "#64748B",
  muted2: "#94A3B8",
  line: "#E2E8F0",
  lineStrong: "#CBD5E1",
  brand: "#2563EB",
  brandDeep: "#1D4ED8",
  brandSoft: "#DBEAFE",
};

export default function CurriculumMethodChooser({
  onSelectManual,
  onSelectQuestAi,
}) {
  return (
    <div style={{ fontFamily: FONT }}>
      <p
        className="text-center"
        style={{
          fontSize: 15,
          color: C.muted,
          marginBottom: 28,
          fontWeight: 500,
        }}
      >
        How would you like to build your curriculum?
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 22,
        }}
        className="cmc-grid"
      >
        {/* ─── Manual ──────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={onSelectManual}
          className="cmc-card"
          style={{
            background: C.card,
            border: `1px solid ${C.line}`,
            borderRadius: 20,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            boxShadow: "0 8px 28px -10px rgba(15,23,42,0.08)",
            textAlign: "left",
            cursor: "pointer",
            fontFamily: FONT,
            color: C.ink,
            transition:
              "transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
          }}
        >
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: 13,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.brand,
              background: C.brandSoft,
            }}
          >
            <Pencil size={22} strokeWidth={1.8} />
          </span>

          <h2
            style={{
              margin: 0,
              fontFamily: FONT,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: C.ink,
            }}
          >
            Build Manually
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: C.ink3,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            Enter your own unit names and learning standards from scratch.
          </p>

          {/* Mock unit preview list */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 4,
            }}
          >
            <UnitRow no={1} name="Mendelian Genetics" />
            <UnitRow no={2} name="Molecular Biology" />
            <UnitRow no={3} name="+ Add a unit" placeholder />
          </div>

          <CardFoot
            meta={
              <>
                <Clock size={14} strokeWidth={2} style={{ color: C.muted2 }} />
                ~5 min / unit
              </>
            }
            cta={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: C.brand,
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "-0.005em",
                  padding: "8px 4px",
                }}
              >
                Get started
                <ChevronRight size={14} strokeWidth={2.2} />
              </span>
            }
          />
        </button>

        {/* ─── Quest AI (featured) ─────────────────────────────────── */}
        <button
          type="button"
          onClick={onSelectQuestAi}
          className="cmc-card cmc-card-featured"
          style={{
            background: C.card,
            border: `2px solid ${C.brand}`,
            borderRadius: 20,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            boxShadow: "0 16px 40px -14px rgba(37,99,235,0.25)",
            textAlign: "left",
            cursor: "pointer",
            fontFamily: FONT,
            color: C.ink,
            position: "relative",
            transition:
              "transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
          }}
        >
          {/* Recommended badge */}
          <span
            style={{
              position: "absolute",
              top: 20,
              right: 24,
              background: C.brandSoft,
              color: C.brandDeep,
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "5px 11px",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.brand,
                display: "inline-block",
              }}
            />
            Recommended
          </span>

          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: 13,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              background: `linear-gradient(160deg, ${C.brand} 0%, ${C.brandDeep} 100%)`,
              boxShadow: "0 10px 24px -10px rgba(37,99,235,0.5)",
            }}
          >
            <Sparkles size={22} strokeWidth={1.8} />
          </span>

          <h2
            style={{
              margin: 0,
              fontFamily: FONT,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: C.ink,
            }}
          >
            Generate with Quest AI
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: C.ink3,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            Describe your class and Quest drafts a complete unit map — aligned
            to NGSS, Common Core, or AP. Editable, every step.
          </p>

          {/* Prompt preview area — no "YOUR PROMPT" label, no separator */}
          <div
            style={{
              background: C.paper,
              border: `1px solid ${C.line}`,
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 14.5,
                color: C.ink,
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              9th-grade{" "}
              <span style={{ color: C.brand, fontWeight: 700 }}>Biology</span>,
              full year, honors pace, aligned to{" "}
              <span style={{ color: C.brand, fontWeight: 700 }}>NGSS</span>.
              <span aria-hidden className="cmc-cursor" />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Tag>Biology</Tag>
              <Tag>NGSS</Tag>
              <Tag>9th grade</Tag>
              <Tag>Year-long</Tag>
              <Tag empty>+ Lab activities</Tag>
            </div>
          </div>

          <CardFoot
            meta={
              <>
                <Zap size={14} strokeWidth={2} style={{ color: C.muted2 }} />
                Full unit in ~90 sec
              </>
            }
            cta={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: C.brand,
                  color: "#fff",
                  border: 0,
                  borderRadius: 10,
                  padding: "11px 20px",
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "-0.005em",
                  boxShadow: "0 8px 20px -8px rgba(37,99,235,0.5)",
                }}
              >
                Start with Quest AI
                <ArrowRight size={14} strokeWidth={2.2} />
              </span>
            }
          />
        </button>
      </div>

      {/* Local styles — keyframes, hover lift, mobile collapse. Inline so
          the component remains self-contained and can drop into any page. */}
      <style>{`
        @keyframes cmc-blink { 50% { opacity: 0; } }
        .cmc-cursor {
          display: inline-block;
          width: 2px;
          height: 14px;
          background: ${C.brand};
          vertical-align: -2px;
          margin-left: 2px;
          animation: cmc-blink 1s steps(2) infinite;
        }
        .cmc-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 40px -16px rgba(15,23,42,0.12);
          border-color: ${C.lineStrong} !important;
        }
        .cmc-card-featured:hover {
          border-color: ${C.brandDeep} !important;
          box-shadow: 0 28px 56px -18px rgba(37,99,235,0.30);
        }
        @media (max-width: 880px) {
          .cmc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function UnitRow({ no, name, placeholder = false }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px 1fr",
        gap: 12,
        alignItems: "center",
        background: placeholder ? "transparent" : C.paper,
        border: placeholder
          ? `1.5px dashed ${C.lineStrong}`
          : `1px solid ${C.line}`,
        borderRadius: 10,
        padding: "12px 14px",
        color: placeholder ? C.muted : undefined,
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: 10,
          letterSpacing: "0.12em",
          color: C.muted,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        Unit{" "}
        <span
          style={{
            color: placeholder ? C.muted2 : C.brand,
            fontSize: 13,
            marginLeft: 4,
          }}
        >
          {no}
        </span>
      </span>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 14.5,
          fontWeight: placeholder ? 600 : 700,
          color: placeholder ? C.muted : C.ink,
          letterSpacing: "-0.01em",
        }}
      >
        {name}
      </span>
    </div>
  );
}

function Tag({ children, empty = false }) {
  return (
    <span
      style={{
        background: empty ? "transparent" : "#fff",
        border: empty
          ? `1.5px dashed ${C.lineStrong}`
          : `1px solid ${C.line}`,
        borderRadius: 999,
        padding: "5px 11px",
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 600,
        color: empty ? C.muted : C.ink2,
      }}
    >
      {children}
    </span>
  );
}

function CardFoot({ meta, cta }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: "auto",
        paddingTop: 8,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: C.muted,
          fontWeight: 500,
          fontFamily: FONT,
        }}
      >
        {meta}
      </span>
      {cta}
    </div>
  );
}
