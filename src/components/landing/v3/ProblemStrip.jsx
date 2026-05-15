import React, { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

/**
 * Counts from 0 → `to` once the element scrolls into view.
 * Uses framer-motion's `animate` for smooth easing and `useInView` for trigger.
 */
function CountUp({ to, duration = 1.6, decimals = 0, suffix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration,
      ease: [0.2, 0.8, 0.2, 1], // smooth ease-out
      onUpdate: (v) => {
        setVal(decimals > 0 ? Number(v.toFixed(decimals)) : Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, to, duration, decimals]);

  const display = decimals > 0 ? val.toFixed(decimals) : val;
  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

export default function ProblemStrip() {
  return (
    <section
      className="bg-white border-y border-[#E2E8F0]"
      style={{ padding: "72px 0" }}
    >
      <div className="lp-v3-container">
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-1">
            <p
              className="font-bold text-[#0F172A]"
              style={{
                fontSize: "clamp(26px, 2.8vw, 36px)",
                lineHeight: "1.15",
                letterSpacing: "-0.025em",
              }}
            >
              Teachers spend their nights{" "}
              <em className="not-italic text-[#F97316] font-extrabold">
                planning.
              </em>{" "}
              Students forget by{" "}
              <em className="not-italic text-[#F97316] font-extrabold">
                next week.
              </em>{" "}
              <span className="inline-block mt-2 px-3.5 py-1 rounded-full bg-[#2563EB] text-white font-extrabold">
                Quest fixes both.
              </span>
            </p>
          </div>

          {/* Stat 1: 11 hrs/wk */}
          <div className="bg-[#EEF3FB] rounded-2xl border border-[#E2E8F0] p-7 lg:p-8">
            <div className="flex items-baseline gap-3">
              <span
                className="font-extrabold text-[#2563EB] leading-none tracking-tight"
                style={{
                  fontSize: "clamp(72px, 8vw, 104px)",
                  letterSpacing: "-0.04em",
                }}
              >
                <CountUp to={11} duration={1.4} />
              </span>
              <span className="text-[#64748B] text-lg font-semibold whitespace-nowrap">
                hrs/wk
              </span>
            </div>
            <div className="text-[#475569] font-medium text-[15px] mt-4 leading-snug">
              U.S. teachers spend planning &amp; prep outside paid hours.
            </div>
            <div className="text-[#94A3B8] text-xs mt-2">
              RAND Corporation, 2024
            </div>
          </div>

          {/* Stat 2: 2× retention */}
          <div className="bg-[#EEF3FB] rounded-2xl border border-[#E2E8F0] p-7 lg:p-8">
            <div className="flex items-baseline gap-3">
              <span
                className="font-extrabold text-[#2563EB] leading-none tracking-tight"
                style={{
                  fontSize: "clamp(72px, 8vw, 104px)",
                  letterSpacing: "-0.04em",
                }}
              >
                <CountUp to={2} duration={1.8} decimals={1} suffix="×" />
              </span>
              <span className="text-[#64748B] text-lg font-semibold whitespace-nowrap">
                retention
              </span>
            </div>
            <div className="text-[#475569] font-medium text-[15px] mt-4 leading-snug">
              When learning is active and spaced, not passive.
            </div>
            <div className="text-[#94A3B8] text-xs mt-2">
              Dunlosky et al., 2013
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
