/**
 * SelfSessionPlay — student player for a scheduled student_self_sessions
 * row. Loaded from the Learning Hub when the student clicks a "due
 * today" card.
 *
 * Walks the same SelfSessionPhases as the inline Generate experience.
 * On completion, writes scores back to the self-session row and (when
 * review_enabled AND this is the original session, not a review entry)
 * queues future review rows on the shared spaced-repetition ladder.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save, XCircle } from "lucide-react";
import SelfSessionPhases from "../components/student/SelfSessionPhases";
import { REVIEW_OFFSETS } from "@/lib/spacedRepetition";

export default function SelfSessionPlay() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [completion, setCompletion] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError("No session specified.");
      setLoading(false);
      return;
    }
    loadAll();
  }, [sessionId]);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const me = await quest.auth.me();
      setUser(me);

      const { data: sRow, error: sErr } = await supabase
        .from("student_self_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (sErr) throw sErr;
      setSession(sRow);

      const { data: bRow, error: bErr } = await supabase
        .from("lesson_bundles")
        .select("id, title, source_type, source_url, payload, grade_level")
        .eq("id", sRow.bundle_id)
        .single();
      if (bErr) throw bErr;
      setBundle(bRow);
    } catch (err) {
      console.error("Failed to load self-session:", err);
      setError(err?.message || "Could not load this session.");
    } finally {
      setLoading(false);
    }
  };

  const persistCompletion = async (data) => {
    const c = data || completion;
    if (!user || !session || !c || saving) return;
    setSaving(true);
    try {
      const responsesJson = {
        quiz_responses: c.quiz_responses || null,
        attention_check_responses: c.attention_check_responses || null,
        case_study_responses: c.case_study_responses || null,
      };

      const { error: upErr } = await supabase
        .from("student_self_sessions")
        .update({
          completed_at: new Date().toISOString(),
          quiz_score_pct: c.quiz_score_pct ?? null,
          case_study_score: c.case_study_score ?? null,
          case_study_max: c.case_study_max ?? null,
          responses: responsesJson,
        })
        .eq("id", session.id);
      if (upErr) throw upErr;

      // Queue review entries ONLY for the original session (review_number=0)
      // AND only the first time it's completed. Re-completing an already-
      // completed session shouldn't double-queue reviews.
      const isOriginal = (session.review_number ?? 0) === 0;
      const alreadyCompleted = !!session.completed_at;
      if (isOriginal && !alreadyCompleted && session.review_enabled) {
        const base = new Date(`${session.scheduled_for}T00:00:00`);
        const rows = REVIEW_OFFSETS.map((days, idx) => {
          const d = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
          return {
            student_id: user.id,
            bundle_id: session.bundle_id,
            scheduled_for: d.toISOString().slice(0, 10),
            review_enabled: false,
            parent_session_id: session.id,
            review_number: idx + 1,
          };
        });
        const { error: rErr } = await supabase
          .from("student_self_sessions")
          .insert(rows);
        if (rErr) console.warn("Review queue insert failed (non-fatal):", rErr);
      }

      setSaved(true);
    } catch (err) {
      console.error("Persist completion failed:", err);
      setError(err?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-md">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Can't open this session
          </h2>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <Button
            onClick={() => navigate(createPageUrl("LearningHub"))}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Learning Hub
          </Button>
        </div>
      </div>
    );
  }

  const reviewLabel =
    (session?.review_number ?? 0) > 0 ? `Review #${session.review_number}` : "My Session";

  // Persist the score (and queue reviews) when the student finishes, then
  // return to the Learning Hub — same "finish and save" behavior as a
  // curriculum learn session.
  const handleFinish = async (payload) => {
    setCompletion(payload);
    await persistCompletion(payload);
    navigate(createPageUrl("LearningHub"));
  };

  return (
    <SelfSessionPhases
      payload={bundle?.payload}
      badgeLabel={reviewLabel}
      onComplete={(payload) => setCompletion(payload)}
      onFinish={handleFinish}
      onExit={() => navigate(createPageUrl("LearningHub"))}
    />
  );
}
