import React, { useState } from "react";

const QUESTIONS = [
  {
    q: "When does Quest launch?",
    a: "Quest is live now and onboarding new teachers and schools daily. You can start a free trial today, no waitlist. Existing classes are already running spaced reviews and Panda Tutor sessions.",
  },
  {
    q: "What subjects are supported?",
    a: "All K-12 subjects are supported, including science, math, history, English, and electives. AI builds curriculum from any state standards you select. You can also upload your own materials and Quest will adapt to them.",
  },
  {
    q: "Is this for K-12 or higher education?",
    a: "Quest is built primarily for K-12 but works for higher-ed too. The same inquiry, recall, and spaced-repetition engine applies. Some college instructors use it for intro-level survey courses.",
  },
  {
    q: "Can teachers use their own content?",
    a: "Yes. Drop in your own YouTube videos, slides, or notes and Quest builds quizzes, inquiry hooks, and case studies from them. The AI extracts learning objectives and aligns them to your standards. You can edit every question, prompt, and example before publishing.",
  },
  {
    q: "How is student data protected?",
    a: "Quest follows FERPA and COPPA for every account, including learners under 13. We collect only what a lesson needs, encrypt data in transit and at rest, run no third-party advertising trackers, and never sell student data. In schools, the district consents on students' behalf as a 'school official.' See the FERPA, COPPA, and Privacy policies linked in the footer and the compliance section.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="bg-white border-y border-[#E2E8F0]" style={{ padding: "72px 0" }}>
      <div className="lp-v3-container">
        <div className="grid lg:grid-cols-[1fr_1.6fr] gap-10 items-start">
          <div>
            <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase">
              FAQ
            </span>
            <h2
              className="font-bold text-[#0F172A] mt-3 mb-3"
              style={{
                fontSize: "clamp(30px, 3.6vw, 44px)",
                lineHeight: "1.05",
                letterSpacing: "-0.025em",
              }}
            >
              Common <em className="not-italic text-[#2563EB]">Questions.</em>
            </h2>
            <p
              className="text-[#64748B] text-base max-w-[32ch]"
            >
              Still curious?{" "}
              <a
                href="mailto:admin@questlearning.co"
                className="text-[#2563EB] underline underline-offset-4"
              >
                Email the team
              </a>
              .
            </p>
          </div>

          <div className="flex flex-col">
            {QUESTIONS.map((it, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={i}
                  className="border-b border-[#E2E8F0]"
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left"
                  >
                    <span
                      className="font-semibold text-[#0F172A] text-[16.5px] tracking-tight"
                    >
                      {it.q}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-full bg-[#E5ECF7] text-[#0F172A] flex items-center justify-center text-[18px] font-bold leading-none shrink-0 transition-transform ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-5 text-[#475569] text-[14.5px] leading-relaxed lp-v3-stage-in pr-10">
                      {it.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
