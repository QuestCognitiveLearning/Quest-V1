/**
 * SessionReview — a mandatory, step-through review shown after the score
 * screen (unless the student got 100%). The student pages through every quiz
 * question and case-study prompt — both the ones they got right and wrong —
 * each with the AI explanation/feedback, and can only finish (exit) after the
 * last one.
 *
 * Self-contained: the caller passes the items + an onComplete callback that
 * unlocks the exit. If there are no items it renders nothing and the caller
 * should treat review as already complete (never trap the student).
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
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Review your answers</h2>
        <p className="text-sm text-slate-500 mt-1">
          Go through each question with Panda's explanation before you finish.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500">
          {idx + 1} of {items.length}
        </span>
        <div className="flex-1 mx-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${((idx + 1) / items.length) * 100}%` }} />
        </div>
      </div>

      <div className={`rounded-2xl border-2 p-5 ${correct ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
        <div className="flex items-start gap-2 mb-3">
          {correct ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          )}
          <p className="font-semibold text-slate-900">{item.question}</p>
        </div>

        {item.kind === "quiz" ? (
          <div className="space-y-2 text-sm">
            <p className={correct ? "text-emerald-800" : "text-red-700"}>
              <span className="font-semibold">Your answer:</span> {item.picked || "—"}
            </p>
            {!correct && (
              <p className="text-emerald-800">
                <span className="font-semibold">Correct answer:</span> {item.correct || "—"}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Your answer</p>
              <p className="text-slate-900">{item.answer || <span className="italic text-slate-400">No answer</span>}</p>
            </div>
            {item.correct && (
              <div className="bg-white rounded-lg border border-emerald-200 p-3">
                <p className="text-xs font-medium text-emerald-700 mb-1">Correct answer</p>
                <p className="text-emerald-900">{item.correct}</p>
              </div>
            )}
            {item.max != null && (
              <p className="text-slate-600">
                <span className="font-semibold">Score:</span> {item.score}/{item.max}
              </p>
            )}
          </div>
        )}

        {(item.explanation || item.feedback) && (
          <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-indigo-700 mb-1">🐼 Panda explains</p>
            <p className="text-sm text-indigo-900">{item.explanation || item.feedback}</p>
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
