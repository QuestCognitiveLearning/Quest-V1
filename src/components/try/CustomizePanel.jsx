/**
 * CustomizePanel — small inline form on the /try landing step. Lets the
 * visitor pick MCQ count, grade level, and whether to include a case study
 * before generation kicks off. Defaults match the previous /try behavior
 * (10 questions, no specific grade, case study on) so unchanged visitors
 * still get the original handout.
 */
import React from "react";
import { Sparkles } from "lucide-react";

const GRADES = [
  { id: "Elementary", label: "Grades 3–5" },
  { id: "Middle", label: "Grades 6–8" },
  { id: "High", label: "Grades 9–12" },
  { id: "Undergraduate", label: "College" },
];

const COUNTS = [5, 10, 15];

const DIFFICULTIES = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

export default function CustomizePanel({ options, onChange, compact = false }) {
  const set = (patch) => onChange?.({ ...options, ...patch });

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 ${
        compact ? "p-4" : "p-6"
      } shadow-sm`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
        <Sparkles className="w-4 h-4 text-indigo-600" />
        Customize your handout
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Number of questions">
          <div className="flex gap-1.5">
            {COUNTS.map((c) => (
              <Pill
                key={c}
                active={options.count === c}
                onClick={() => set({ count: c })}
              >
                {c}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Difficulty">
          <div className="flex gap-1.5">
            {DIFFICULTIES.map((d) => (
              <Pill
                key={d.id}
                active={options.difficulty === d.id}
                onClick={() => set({ difficulty: d.id })}
              >
                {d.label}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Grade level">
          <div className="flex flex-wrap gap-1.5">
            {GRADES.map((g) => (
              <Pill
                key={g.id}
                active={options.gradeLevel === g.id}
                onClick={() => set({ gradeLevel: g.id })}
              >
                {g.label}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Case study">
          <div className="flex gap-1.5">
            <Pill
              active={options.includeCaseStudy === true}
              onClick={() => set({ includeCaseStudy: true })}
            >
              Include
            </Pill>
            <Pill
              active={options.includeCaseStudy === false}
              onClick={() => set({ includeCaseStudy: false })}
            >
              Skip
            </Pill>
          </div>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[12px] font-semibold tracking-wider uppercase text-slate-500 mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-9 rounded-lg border text-[13px] font-semibold transition-colors ${
        active
          ? "bg-[#2563EB] text-white border-[#2563EB]"
          : "bg-white text-[#0F172A] border-slate-200 hover:border-[#2563EB]"
      }`}
    >
      {children}
    </button>
  );
}

export const DEFAULT_OPTIONS = {
  count: 10,
  difficulty: "medium",
  gradeLevel: "High",
  includeCaseStudy: true,
};
