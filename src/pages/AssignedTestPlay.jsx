/**
 * AssignedTestPlay — a student takes an assigned test. Loads the frozen
 * question_ids from the test_assignments row, fetches those questions from the
 * curriculum bank, runs a one-at-a-time multiple-choice quiz, scores it, and
 * upserts a test_completions row. Launched from LearningHub with
 * ?assignment_id=...
 */
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, ClipboardList, ArrowRight, Trophy, RotateCcw } from "lucide-react";

const LETTERS = ["A", "B", "C", "D"];

export default function AssignedTestPlay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const assignmentId = params.get("assignment_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [questions, setQuestions] = useState([]);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState({}); // idx -> choice index
  const [submitted, setSubmitted] = useState({}); // idx -> bool
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [priorCompletion, setPriorCompletion] = useState(null);

  useEffect(() => {
    if (!assignmentId) {
      setError("No test specified.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const user = await quest.auth.me();
        setMe(user);

        const { data: asn, error: aErr } = await supabase
          .from("test_assignments")
          .select("*")
          .eq("id", assignmentId)
          .single();
        if (aErr) throw aErr;
        setAssignment(asn);

        const { data: existing } = await supabase
          .from("test_completions")
          .select("*")
          .eq("assignment_id", assignmentId)
          .eq("student_id", user.id)
          .maybeSingle();
        if (existing) setPriorCompletion(existing);

        const ids = Array.isArray(asn.question_ids) ? asn.question_ids : [];
        if (ids.length > 0) {
          const { data: qs, error: qErr } = await supabase
            .from("questions")
            .select("id, question_text, choice_1, choice_2, choice_3, choice_4, correct_choice, difficulty")
            .in("id", ids);
          if (qErr) throw qErr;
          // Preserve the frozen order from question_ids.
          const byId = new Map((qs || []).map((q) => [q.id, q]));
          setQuestions(ids.map((id) => byId.get(id)).filter(Boolean));
        }
      } catch (err) {
        console.error("Load test failed:", err);
        setError(err?.message || "Could not load this test.");
      } finally {
        setLoading(false);
      }
    })();
  }, [assignmentId]);

  const choose = (choiceIdx) => {
    if (submitted[idx]) return;
    setSelected((p) => ({ ...p, [idx]: choiceIdx }));
    setSubmitted((p) => ({ ...p, [idx]: true }));
  };

  const computeResults = () =>
    questions.map((q, i) => {
      const correctIdx = (q.correct_choice || 1) - 1;
      const picked = selected[i];
      return {
        q_index: i,
        question_id: q.id,
        picked: picked != null ? picked : null,
        correct: correctIdx,
        is_correct: picked === correctIdx,
      };
    });

  const handleFinish = async () => {
    setSaving(true);
    try {
      const responses = computeResults();
      const correct = responses.filter((r) => r.is_correct).length;
      const total = questions.length;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      const { error: cErr } = await supabase
        .from("test_completions")
        .upsert(
          {
            assignment_id: assignmentId,
            student_id: me.id,
            total,
            correct,
            score_pct: pct,
            responses,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "student_id,assignment_id" }
        );
      if (cErr) throw cErr;
      setFinished(true);
    } catch (err) {
      console.error("Save test result failed:", err);
      setError(err?.message || "Could not save your result.");
    } finally {
      setSaving(false);
    }
  };

  const retake = () => {
    setPriorCompletion(null);
    setSelected({});
    setSubmitted({});
    setIdx(0);
    setFinished(false);
  };

  const Shell = ({ children }) => (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #EEF2FF 0%, #EFF6FF 50%, #FAF5FF 100%)",
        fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div className="max-w-2xl mx-auto px-4 py-8">{children}</div>
    </div>
  );

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </Shell>
    );
  }

  if (error && !assignment) {
    return (
      <Shell>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-md">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Can't open this test</h2>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <Button onClick={() => navigate(createPageUrl("LearningHub"))}>Back to Learning Hub</Button>
        </div>
      </Shell>
    );
  }

  // Results screen (just finished, or already completed earlier).
  if (finished || priorCompletion) {
    const responses = finished ? computeResults() : priorCompletion?.responses || [];
    const correct = finished
      ? responses.filter((r) => r.is_correct).length
      : priorCompletion?.correct ?? 0;
    const total = finished ? questions.length : priorCompletion?.total ?? 0;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const tone = pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
    return (
      <Shell>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-md">
          <Trophy className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-slate-900">{assignment?.title}</h1>
          <p className="text-sm text-slate-500 mt-1">Your score</p>
          <div className={`text-5xl font-extrabold mt-2 ${tone}`}>{pct}%</div>
          <p className="text-sm text-slate-500 mt-1">
            {correct} of {total} correct
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <Button variant="outline" onClick={() => navigate(createPageUrl("LearningHub"))}>
              Back to Learning Hub
            </Button>
            <Button onClick={retake} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <RotateCcw className="w-4 h-4" /> Retake
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (questions.length === 0) {
    return (
      <Shell>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-md">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">This test has no questions</h2>
          <Button onClick={() => navigate(createPageUrl("LearningHub"))} className="mt-3">
            Back to Learning Hub
          </Button>
        </div>
      </Shell>
    );
  }

  const q = questions[idx];
  const choices = [q.choice_1, q.choice_2, q.choice_3, q.choice_4];
  const correctIdx = (q.correct_choice || 1) - 1;
  const isSubmitted = !!submitted[idx];
  const sel = selected[idx];
  const isLast = idx === questions.length - 1;
  const answeredCount = Object.keys(submitted).length;

  return (
    <Shell>
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-5 h-5 text-indigo-600" />
        <h1 className="font-bold text-slate-900">{assignment?.title}</h1>
      </div>

      <div className="h-1.5 bg-white rounded-full overflow-hidden mb-5 border border-slate-200">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Question {idx + 1} of {questions.length}
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-5">{q.question_text}</h2>
        <div className="space-y-2.5">
          {choices.map((c, i) => {
            const isSel = sel === i;
            const isCorrect = i === correctIdx;
            let cls = "border-slate-200 bg-white hover:border-indigo-300 cursor-pointer";
            if (isSubmitted) {
              if (isCorrect) cls = "border-emerald-500 bg-emerald-50";
              else if (isSel) cls = "border-red-400 bg-red-50";
              else cls = "border-slate-200 bg-slate-50 opacity-70";
            } else if (isSel) {
              cls = "border-indigo-500 bg-indigo-50";
            }
            return (
              <button
                key={i}
                disabled={isSubmitted}
                onClick={() => choose(i)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-colors ${cls}`}
              >
                <span className="w-9 h-9 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold flex-shrink-0">
                  {LETTERS[i]}
                </span>
                <span className="flex-1 text-slate-900">{c}</span>
                {isSubmitted && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                {isSubmitted && isSel && !isCorrect && <XCircle className="w-5 h-5 text-red-500" />}
              </button>
            );
          })}
        </div>

        {isSubmitted && (
          <div className="mt-5 flex justify-end">
            {isLast ? (
              <Button
                onClick={handleFinish}
                disabled={saving}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                Finish &amp; see score
              </Button>
            ) : (
              <Button onClick={() => setIdx((i) => i + 1)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
