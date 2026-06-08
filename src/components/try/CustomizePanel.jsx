/**
 * CustomizePanel — inline form on /Generate (and /try) that controls what
 * the AI bakes into the handout: MCQ count, difficulty, grade level, plus
 * which sections to include (case study, inquiry hook, attention checks).
 */
import React from "react";
import { Sparkles, MessageCircle, Eye, FileText } from "lucide-react";

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

export default function CustomizePanel({ options, onChange, compact = false, mode = "live" }) {
  const set = (patch) => onChange?.({ ...options, ...patch });
  const isHandout = mode === "handout";

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
              <Pill key={c} active={options.count === c} onClick={() => set({ count: c })}>
                {c}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Difficulty">
          <div className="flex gap-1.5">
            {DIFFICULTIES.map((d) => (
              <Pill key={d.id} active={options.difficulty === d.id} onClick={() => set({ difficulty: d.id })}>
                {d.label}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Grade level">
          <div className="flex flex-wrap gap-1.5">
            {GRADES.map((g) => (
              <Pill key={g.id} active={options.gradeLevel === g.id} onClick={() => set({ gradeLevel: g.id })}>
                {g.label}
              </Pill>
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-5 pt-5 border-t border-slate-100">
        <div className="text-[12px] font-semibold tracking-wider uppercase text-slate-500 mb-3">
          What to include
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Toggle
            icon={FileText}
            label="Quiz"
            sub={`${options.count || 10} MCQs (always on)`}
            checked={true}
            disabled
            onChange={() => {}}
          />
          <Toggle
            icon={MessageCircle}
            label="Case study"
            sub="Scenario + 4 free-response prompts"
            checked={options.includeCaseStudy !== false}
            onChange={(v) => set({ includeCaseStudy: v })}
          />
          {!isHandout && (
            <>
              <Toggle
                icon={Sparkles}
                label="Inquiry session"
                sub="Socratic hook from the Panda Tutor"
                checked={options.includeInquiry === true}
                onChange={(v) => set({ includeInquiry: v })}
              />
              <Toggle
                icon={Eye}
                label="Attention checks"
                sub="Mid-video MCQs at key moments"
                checked={options.includeAttentionChecks === true}
                onChange={(v) => set({ includeAttentionChecks: v })}
              />
            </>
          )}
        </div>
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

function Toggle({ icon: Icon, label, sub, checked, disabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!checked)}
      disabled={disabled}
      className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
        disabled
          ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-70"
          : checked
          ? "border-[#2563EB] bg-blue-50/40"
          : "border-slate-200 bg-white hover:border-[#2563EB]"
      }`}
    >
      <div
        className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center shrink-0 ${
          checked ? "bg-[#2563EB] text-white" : "bg-slate-100 text-slate-400"
        }`}
      >
        {checked ? "✓" : ""}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Icon className="w-3.5 h-3.5 text-slate-500" />
          {label}
        </div>
        <div className="text-[11.5px] text-slate-500 mt-0.5">{sub}</div>
      </div>
    </button>
  );
}

export const DEFAULT_OPTIONS = {
  count: 10,
  difficulty: "medium",
  gradeLevel: "High",
  includeCaseStudy: true,
  includeInquiry: true,
  includeAttentionChecks: true,
};
