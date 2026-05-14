/**
 * @file   CurriculumMethodChooser.jsx
 * @desc   Two-card chooser shown when a teacher starts building a new
 *         curriculum: "Build Manually" (left, 1fr) or "Generate with Quest AI"
 *         (right, ~1.55fr — featured).
 *
 *         Visual design comes from the Curriculum Chooser handoff bundle
 *         (variation A · Asymmetric). The asymmetric grid + multi-color
 *         gradient on the Quest AI card signals it as the recommended path
 *         without removing manual entry.
 *
 * @author Quest Learning core team
 */

import React, { useState } from 'react';
import { Pencil, Sparkles, Clock, Zap, ArrowRight, ChevronRight } from 'lucide-react';

const FONT_MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const GRADIENT_BLUE = 'linear-gradient(180deg, #4f86f7 0%, #1e4fe0 100%)';
const GRADIENT_AI   = 'linear-gradient(135deg, #5388fb 0%, #1e4fe0 55%, #ff6f59 100%)';
const SHADOW_AI     = 'rgba(30,79,224,.45)';

/**
 * Decorative blue circle bleeding off the corner of a card.
 */
function CornerBlob({ color = 'rgba(47,102,241,0.10)', size = 200 }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: -size * 0.45,
        right: -size * 0.35,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * Rounded gradient tile with an icon inside, plus a subtle inner highlight.
 */
function IconTile({ size = 56, radius = 14, gradient, glow, children }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        position: 'relative',
        background: gradient,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 1px 0 rgba(255,255,255,.28) inset, 0 12px 26px -10px ${glow || 'rgba(15,23,42,.3)'}`,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 3,
          left: 3,
          width: '50%',
          height: '38%',
          borderRadius: radius * 0.65,
          background: 'linear-gradient(135deg, rgba(255,255,255,.35), rgba(255,255,255,0))',
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  );
}

/**
 * @param {object} props
 * @param {() => void} props.onSelectManual   - User picked "Build Manually"
 * @param {() => void} props.onSelectQuestAi  - User picked "Generate with Quest AI"
 */
export default function CurriculumMethodChooser({ onSelectManual, onSelectQuestAi }) {
  // Hover state drives the lift + shadow on each card. Default to 'ai' so the
  // featured card looks visually elevated even before the cursor enters.
  const [hover, setHover] = useState('ai');

  return (
    <div className="mt-4">
      <p className="text-center text-[15px] text-gray-500 mb-8 font-normal">
        How would you like to build your curriculum?
      </p>

      <div
        className="mx-auto"
        style={{
          maxWidth: 1320,
          display: 'grid',
          gridTemplateColumns: '1fr 1.55fr',
          gap: 24,
        }}
      >
        {/* ── Build Manually (compact, left, 1fr) ─────────────────────── */}
        <button
          type="button"
          onMouseEnter={() => setHover('manual')}
          onMouseLeave={() => setHover('ai')}
          onClick={onSelectManual}
          style={{
            position: 'relative',
            textAlign: 'left',
            cursor: 'pointer',
            background: '#fff',
            border: `1px solid ${hover === 'manual' ? '#b9d1ff' : '#eef1f7'}`,
            borderRadius: 22,
            padding: '36px 36px 88px',
            transition: 'all .2s ease',
            transform: hover === 'manual' ? 'translateY(-2px)' : 'none',
            boxShadow:
              hover === 'manual'
                ? '0 24px 56px -24px rgba(28,49,150,.22), 0 0 0 4px rgba(47,102,241,.06)'
                : '0 1px 0 rgba(255,255,255,.5) inset, 0 12px 32px -18px rgba(15,23,42,.16)',
            overflow: 'hidden',
            minHeight: 360,
          }}
        >
          <CornerBlob color="rgba(47,102,241,0.10)" size={200} />

          <IconTile size={56} radius={14} gradient={GRADIENT_BLUE} glow="rgba(30,79,224,.45)">
            <Pencil className="w-[26px] h-[26px]" strokeWidth={2} />
          </IconTile>

          <h3
            className="font-bold tracking-tight text-gray-900"
            style={{ fontSize: 26, margin: '24px 0 10px' }}
          >
            Build Manually
          </h3>
          <p
            className="text-[15px] leading-[1.55] text-gray-500 m-0"
            style={{ maxWidth: 360 }}
          >
            Enter your own unit names and learning standards from scratch.
          </p>

          {/* Mock unit list (preview) */}
          <div className="mt-7 flex flex-col gap-2">
            {[
              { label: 'UNIT 1', text: 'Mendelian Genetics', placeholder: false },
              { label: 'UNIT 2', text: 'Molecular Biology',  placeholder: false },
              { label: 'UNIT 3', text: '+ Add a unit',       placeholder: true },
            ].map(({ label, text, placeholder }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-3"
                style={{
                  height: 36,
                  background: placeholder ? 'transparent' : '#fbfcfe',
                  border: placeholder ? '1.5px dashed #d6dceb' : '1px solid #eef1f7',
                  borderRadius: 9,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    color: '#9aa0b6',
                    width: 38,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: placeholder ? 500 : 600,
                    color: placeholder ? '#9aa0b6' : '#0b1020',
                  }}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>

          {/* Footer: time estimate + "Get started" arrow */}
          <div
            className="absolute flex items-center justify-between"
            style={{ bottom: 28, left: 36, right: 36 }}
          >
            <span
              className="inline-flex items-center gap-1.5 text-gray-500"
              style={{ fontSize: 12.5, fontFamily: FONT_MONO, fontWeight: 500 }}
            >
              <Clock className="w-3 h-3" strokeWidth={2} />
              ~5 min / unit
            </span>
            <span
              className="inline-flex items-center gap-1.5 font-semibold"
              style={{ color: '#1e4fe0', fontSize: 15 }}
            >
              Get started
              <ChevronRight
                className="w-4 h-4"
                strokeWidth={2.4}
                style={{
                  transform: hover === 'manual' ? 'translateX(4px)' : 'none',
                  transition: 'transform .2s',
                }}
              />
            </span>
          </div>
        </button>

        {/* ── Generate with Quest AI (featured, right, 1.55fr) ────────── */}
        <button
          type="button"
          onMouseEnter={() => setHover('ai')}
          onMouseLeave={() => setHover('ai')}
          onClick={onSelectQuestAi}
          style={{
            position: 'relative',
            textAlign: 'left',
            cursor: 'pointer',
            background: 'linear-gradient(180deg, #ffffff 0%, #fbfcff 100%)',
            border: `1.5px solid ${hover === 'ai' ? '#88b1ff' : '#dde6f8'}`,
            borderRadius: 22,
            padding: '36px 36px 88px',
            transition: 'all .2s ease',
            transform: hover === 'ai' ? 'translateY(-2px)' : 'none',
            boxShadow:
              hover === 'ai'
                ? '0 28px 64px -22px rgba(30,79,224,.30), 0 0 0 4px rgba(47,102,241,.08)'
                : '0 1px 0 rgba(255,255,255,.5) inset, 0 20px 48px -24px rgba(30,79,224,.22)',
            overflow: 'hidden',
            minHeight: 360,
          }}
        >
          {/* Radial glow blob top-right */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -120,
              right: -90,
              width: 320,
              height: 320,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 30% 30%, rgba(83,136,251,.22), rgba(255,111,89,.10) 50%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* RECOMMENDED · NEW pill */}
          <span
            className="inline-flex items-center gap-1.5"
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              background: 'linear-gradient(135deg, #eff5ff, #fff)',
              color: '#1a3fbf',
              border: '1px solid #dce8ff',
              padding: '5px 11px',
              borderRadius: 99,
              fontFamily: FONT_MONO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.06em',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: '#1e4fe0',
                boxShadow: '0 0 8px #2f66f1',
              }}
            />
            RECOMMENDED · NEW
          </span>

          <IconTile size={64} radius={16} gradient={GRADIENT_AI} glow={SHADOW_AI}>
            <Sparkles className="w-[28px] h-[28px]" strokeWidth={2} />
          </IconTile>

          <h3
            className="font-bold tracking-tight text-gray-900"
            style={{ fontSize: 30, margin: '24px 0 10px' }}
          >
            Generate with Quest AI
          </h3>
          <p
            className="leading-[1.55] m-0"
            style={{ fontSize: 16, color: '#525a76', maxWidth: 560 }}
          >
            Describe your class and Quest drafts a complete unit map — aligned to NGSS,
            Common Core, or AP. Editable, every step.
          </p>

          {/* Prompt preview */}
          <div
            className="mt-5"
            style={{
              padding: 14,
              borderRadius: 12,
              background: 'rgba(47,102,241,0.05)',
              border: '1.5px solid rgba(47,102,241,0.18)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  color: '#1a3fbf',
                  letterSpacing: '.12em',
                  fontWeight: 700,
                }}
              >
                YOUR PROMPT
              </span>
              <span className="flex-1 h-px" style={{ background: 'rgba(47,102,241,.18)' }} />
            </div>
            <div
              style={{
                fontSize: 14.5,
                color: '#0b1020',
                lineHeight: 1.5,
              }}
            >
              9th-grade{' '}
              <b style={{ color: '#1a3fbf' }}>Biology</b>, full year, honors pace, aligned to{' '}
              <b style={{ color: '#1a3fbf' }}>NGSS</b>.
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 16,
                  background: '#1e4fe0',
                  verticalAlign: 'middle',
                  marginLeft: 2,
                  animation: 'cc-cursor 1.1s infinite',
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {[
                { label: 'Biology',         placeholder: false },
                { label: 'NGSS',            placeholder: false },
                { label: '9th grade',       placeholder: false },
                { label: 'Year-long',       placeholder: false },
                { label: '+ Lab activities', placeholder: true },
              ].map(({ label, placeholder }) => (
                <span
                  key={label}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '4px 9px',
                    borderRadius: 7,
                    background: placeholder ? 'transparent' : '#fff',
                    color: placeholder ? '#9aa0b6' : '#2a2f44',
                    border: placeholder ? '1px dashed #b9c5e0' : '1px solid #dde6f8',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Footer: speed badge + gradient CTA */}
          <div
            className="absolute flex items-center justify-between"
            style={{ bottom: 28, left: 36, right: 36 }}
          >
            <span
              className="inline-flex items-center gap-1.5 text-gray-500"
              style={{ fontSize: 12.5, fontFamily: FONT_MONO, fontWeight: 500 }}
            >
              <Zap className="w-3 h-3" strokeWidth={2} />
              Full unit in ~90 sec
            </span>
            <span
              className="inline-flex items-center gap-2 font-semibold text-white"
              style={{
                background: GRADIENT_AI,
                padding: '11px 20px',
                borderRadius: 10,
                fontSize: 14.5,
                boxShadow:
                  '0 1px 0 rgba(255,255,255,.22) inset, 0 12px 28px -10px rgba(30,79,224,.55)',
                transform: hover === 'ai' ? 'translateY(-1px)' : 'none',
                transition: 'transform .2s',
              }}
            >
              Start with Quest AI
              <ArrowRight className="w-[15px] h-[15px]" strokeWidth={2.4} />
            </span>
          </div>
        </button>
      </div>

      {/* Cursor blink keyframe (inline so this component is self-contained) */}
      <style>{`@keyframes cc-cursor { 50% { opacity: 0; } }`}</style>
    </div>
  );
}
