import React from "react";

export const GRADE_OPTIONS = [
  { value: "K", label: "K" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
  { value: "7", label: "7" },
  { value: "8", label: "8" },
  { value: "9", label: "9" },
  { value: "10", label: "10" },
  { value: "11", label: "11" },
  { value: "12", label: "12" },
  { value: "Undergraduate", label: "Undergrad" },
  { value: "Graduate", label: "Grad" },
];

export default function GradeLevelPicker({ value = [], onChange, label, hint }) {
  const selected = new Set(value);

  const toggle = (v) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  };

  return (
    <div>
      {label && (
        <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-1.5">
        {GRADE_OPTIONS.map((opt) => {
          const isSelected = selected.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p>}
    </div>
  );
}
