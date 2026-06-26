/**
 * SessionReview — its own step after the score (not part of the score card).
 * Panda re-asks each quiz question and case-study prompt — right and wrong —
 * one at a time; under each, the student sees what they answered and, if they
 * got it wrong, the correct answer. The student pages through all of them and
 * can only finish at the end.
 *
 * Self-contained: caller passes the items + onComplete. No items ⇒ renders
 * nothing (caller treats review as complete; a student is never trapped).
 */
import React, { useState } from "react";
import { CheckCircle, XCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SessionReview({ quizItems = [], caseItems = [], onComplete, completeLabel = "Finish" }) {
  const items = [
    ...quizItems.map((q) => ({ kind: "quiz", ...q })),
    ...caseItems.map((c) => ({ kind: "case", ...c })),
  ];
  const [idx, setIdx] = useState(0);

  if (items.length === 0) return null;

  const item = items[idx];
  const isLast = idx === items.length - 1;
  const correct = item.kind === "quiz" ? !!item.isCorrect : (item.score ?? 0) >= (item.max ?? 1) * 0.7;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Review with Panda</h2>
        <p className="text-sm text-slate-500 mt-1">Go through each question before you finish.</p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500">{idx + 1} of {items.length}</span>
        <div className="flex-1 mx-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${((idx + 1) / items.length) * 100}%` }} />
        </div>
      </div>

      {/* Panda asks the question */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-xl shrink-0" aria-hidden="true">🐼</div>
        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">Panda asks</p>
          <p className="text-slate-900 font-semibold">{item.question}</p>
        </div>
      </div>

      {/* The student's response + the correct one (if wrong) */}
      <div className={`rounded-2xl border-2 p-4 ${correct ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
        <div className="flex items-center gap-2 mb-2">
          {correct ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          <span className={`text-sm font-bold ${correct ? "text-emerald-700" : "text-red-700"}`}>
            {correct ? "You got it right" : "Not quite"}
          </span>
        </div>

        {item.kind === "quiz" ? (
          <div className="space-y-1.5 text-sm">
            <p className="text-slate-800"><span className="font-semibold">Your response:</span> {item.picked || "—"}</p>
            {!correct && (
              <p className="text-emerald-800"><span className="font-semibold">Correct response:</span> {item.correct || "—"}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Your response</p>
              <p className="text-slate-900">{item.answer || <span className="italic text-slate-400">No answer</span>}</p>
            </div>
            {!correct && item.feedback && (
              <div className="bg-white rounded-lg border border-emerald-200 p-3">
                <p className="text-xs font-medium text-emerald-700 mb-1">What a strong answer covers</p>
                <p className="text-slate-900">{item.feedback}</p>
              </div>
            )}
            {item.max != null && (
              <p className="text-slate-600"><span className="font-semibold">Score:</span> {item.score}/{item.max}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-5">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 disabled:opacity-30"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {isLast ? (
          <Button onClick={onComplete} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            {completeLabel}
          </Button>
        ) : (
          <Button onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
