import React, { useEffect, useState } from "react";
import { Clock, TrendingUp, Trophy } from "lucide-react";

const NAMES = [
  "Ava M.",
  "Jordan P.",
  "Sara K.",
  "Diego R.",
  "Maya L.",
  "Tariq W.",
  "Lila J.",
  "Noah B.",
  "Owen K.",
  "Priya S.",
  "Liam V.",
  "Zoe C.",
];
const TOPICS = [
  "Mendelian Inheritance",
  "DNA Replication",
  "Photosynthesis",
  "Cellular Respiration",
  "Mitosis",
  "Osmosis",
  "Natural Selection",
  "Ecology Cycles",
  "ATP Energy",
  "Cell Membrane",
];
const KINDS = [
  { t: "ok", phrase: "Mastered" },
  { t: "review", phrase: "Review Queued · Medium ·" },
  { t: "ok", phrase: "Passed Attention Check On" },
  { t: "warn", phrase: "Flagged Critical ·" },
  { t: "ok", phrase: "Finished Panda Tutor Session On" },
  { t: "review", phrase: "Review Queued · Low ·" },
  { t: "ok", phrase: "🔥 7-Day Streak ·" },
];
const COLORS = ["#2563EB", "#0EA5E9", "#1F8A5B", "#C18A2A", "#4F46E5", "#0B6BCB", "#C4422B"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function mkEvent(secAgo = 0) {
  const k = pick(KINDS);
  return {
    id: Math.random().toString(36).slice(2),
    name: pick(NAMES),
    topic: pick(TOPICS),
    t: k.t,
    phrase: k.phrase,
    when: secAgo === 0 ? "Now" : `${secAgo}s ago`,
    color: pick(COLORS),
  };
}

function bumpTime(w) {
  if (w === "Now") return "5s ago";
  const m = w.match(/^(\d+)s ago$/);
  if (m) return `${parseInt(m[1]) + 5}s ago`;
  return w;
}

export default function ClassroomLive() {
  const [events, setEvents] = useState(() =>
    Array.from({ length: 6 }).map((_, i) => mkEvent(i * 7))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setEvents((prev) => {
        const next = [mkEvent(0), ...prev];
        return next.slice(0, 9).map((e, i) =>
          i === 0 ? e : { ...e, when: bumpTime(e.when) }
        );
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="bg-[#EEF3FB]" style={{ padding: "72px 0" }}>
      <div className="lp-v3-container">
        <div className="mb-8">
          <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase">
            Inside A Class · Live
          </span>
          <h2
            className="font-bold text-[#0F172A] mt-3 mb-3"
            style={{
              fontSize: "clamp(32px, 4.2vw, 52px)",
              lineHeight: "1.05",
              letterSpacing: "-0.025em",
            }}
          >
            The Data Was Always There. Quest <em className="not-italic text-[#2563EB]">Shows It.</em>
          </h2>
          <p className="text-[17px] text-[#64748B] max-w-2xl">
            Every quiz, every review — one feed. Catch slippage on Tuesday, not Friday.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
          <div
            className="rounded-[28px] p-5 lp-v3-deep-shadow"
            style={{
              background: "linear-gradient(160deg, #0F172A 0%, #1E2541 100%)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-white/10">
              <span className="text-white font-bold text-[14px] tracking-tight">
                Biology · Period 3 · Live
              </span>
              <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase text-[#F97316]">
                <span className="w-2 h-2 rounded-full bg-[#F97316] lp-v3-pulse ring-4 ring-[#F97316]/25" />
                Recording
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="grid grid-cols-[28px_1fr_auto] gap-3 items-center bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 lp-v3-stage-in"
                >
                  <div
                    className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                    style={{
                      background:
                        ev.t === "ok"
                          ? "#16A34A"
                          : ev.t === "warn"
                          ? "#DC2626"
                          : "#2563EB",
                    }}
                  >
                    {ev.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-bold text-[13px] truncate">
                      {ev.name}
                    </div>
                    <div className="text-[12px] text-white/70 truncate font-medium">
                      {ev.phrase}{" "}
                      <span className="text-white/85 font-semibold">
                        {ev.topic}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-white/55 font-medium whitespace-nowrap">
                    {ev.when}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <SideItem
              Ic={Clock}
              h="Live Sessions, Real-Time Scores."
              p="Run a quiz with the whole class. Leaderboard updates as students answer."
            />
            <SideItem
              Ic={TrendingUp}
              h="Question-Level Analytics."
              p="Anything the class scored under 70% is surfaced automatically. Edit it or regenerate."
            />
            <SideItem
              Ic={Trophy}
              h="Built-In Motivation."
              p="Streaks, badges, and a personal Knowledge Map keep students coming back."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SideItem({ Ic, h, p }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 lp-v3-soft-shadow">
      <div className="w-10 h-10 rounded-xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center mb-3">
        <Ic size={20} strokeWidth={1.8} />
      </div>
      <h4 className="font-bold text-[16px] text-[#0F172A] tracking-tight mb-1.5">
        {h}
      </h4>
      <p className="text-[13.5px] text-[#64748B] leading-snug font-medium">{p}</p>
    </div>
  );
}
