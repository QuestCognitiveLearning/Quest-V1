import React from "react";

const VOICES = [
  {
    q: "Quest Learning has transformed how I study. The spaced repetition system actually works, and I retain information much longer.",
    nm: "Felo Joseph",
    rl: "Student",
    initials: "FJ",
    c: "#2563EB",
  },
  {
    q: "As an educator, I love seeing my students' progress in real-time. The analytics help me identify knowledge gaps before they become bigger problems.",
    nm: "Drumwright",
    rl: "Teacher",
    initials: "DW",
    c: "#C2410C",
  },
  {
    q: "The Socratic inquiry feature effectively promotes higher-order thinking in students. It functions as a personalized tutoring experience that genuinely supports individual learning progression.",
    nm: "Evelina",
    rl: "College Staff",
    initials: "EV",
    c: "#15803D",
  },
];

export default function Voices() {
  return (
    <section className="bg-white border-y border-[#E2E8F0]" style={{ padding: "72px 0" }}>
      <div className="lp-v3-container">
        <div className="mb-8">
          <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase">
            What Educators Are Saying
          </span>
          <h2
            className="font-bold text-[#0F172A] mt-3"
            style={{
              fontSize: "clamp(32px, 4.2vw, 52px)",
              lineHeight: "1.05",
              letterSpacing: "-0.025em",
            }}
          >
            Words From <em className="not-italic text-[#2563EB]">Students &amp; Teachers.</em>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {VOICES.map((v, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-7 lp-v3-soft-shadow"
            >
              <p className="font-semibold text-[#0F172A] text-[17px] leading-snug mb-5">
                "{v.q}"
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full text-white font-bold text-sm flex items-center justify-center"
                  style={{ background: v.c }}
                >
                  {v.initials}
                </div>
                <div>
                  <div className="font-bold text-[#0F172A] text-[14.5px]">
                    {v.nm}
                  </div>
                  <div className="text-[12.5px] text-[#64748B] font-medium">
                    {v.rl}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
