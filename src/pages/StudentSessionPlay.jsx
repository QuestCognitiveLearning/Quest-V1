/**
 * StudentSessionPlay — player for a student's self-generated learning session.
 * Mirrors AssignedSessionPlay: renders through the SHARED SessionFlow engine
 * so a self-made session has the exact same design/steps/flow as a
 * teacher-assigned one. The data source is the student's own
 * generated_handouts row (saved from /Generate), and finishing a run persists
 * the score + spaced-repetition schedule onto that same row — first
 * completion grades like a learn session, later runs advance the review
 * ladder (1/3/7/14/21/30 days), identical to assigned sessions.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, ArrowLeft } from "lucide-react";
import SessionFlow from "@/components/session/SessionFlow";
import { bundlePayloadToContent } from "@/lib/sessionContent";
import { gradeLearnSession, gradeReview, addDays } from "@/lib/spacedRepetition";

export default function StudentSessionPlay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handoutId = searchParams.get("handout_id");
  // review=N marks a run entered from the LearningHub review queue (N = the
  // upcoming review number). Grading actually keys off the row's own
  // completed_at/review_count, so this is display/context only.
  const isReviewRun = !!searchParams.get("review");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [handout, setHandout] = useState(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!handoutId) {
      setError("No session specified.");
      setLoading(false);
      return;
    }
    loadHandout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoutId]);

  const loadHandout = async () => {
    setLoading(true);
    setError("");
    try {
      // RLS on generated_handouts restricts reads to the owner, so a student
      // can only ever open their own sessions here.
      await quest.auth.me();
      const { data: row, error: hErr } = await supabase
        .from("generated_handouts")
        .select("id, title, source_type, source_url, payload, completed_at, review_count, next_review_date")
        .eq("id", handoutId)
        .single();
      if (hErr) throw hErr;
      setHandout(row);
    } catch (err) {
      console.error("Failed to load session:", err);
      setError(err?.message || "Could not load this session.");
    } finally {
      setLoading(false);
    }
  };

  const content = useMemo(() => {
    const c = bundlePayloadToContent(handout?.payload, {
      badgeLabel: isReviewRun ? "Review" : "My Session",
      sourceUrl: handout?.source_url,
      title: handout?.title,
    });
    // Self-study sessions skip the inquiry hook / Socratic warm-up — students
    // go straight into the material. (Older saved payloads may still carry an
    // inquiry_session; null it so the phase never renders.)
    // Review runs (entered from the LearningHub queue) are quiz-only: no
    // video/reading rewatch, no case study — just the multiple-choice
    // questions to prove retention. Replaying from the library keeps the
    // full session.
    if (isReviewRun) {
      return {
        ...c,
        inquiry: null,
        videoId: null,
        attentionChecks: [],
        readingSections: [],
        caseStudy: null,
      };
    }
    return { ...c, inquiry: null };
  }, [handout, isReviewRun]);

  // ---- Resume support ----------------------------------------------------
  // Progress lives in localStorage keyed per run "generation": handout id +
  // review count + learn/review flag, so finishing a run (which bumps
  // review_count / sets completed_at) naturally orphans the old key and the
  // next run starts fresh.
  // Quiz-only review runs get their own key so a saved full-session snapshot
  // never bleeds into a review (and vice versa).
  const progressKey = handout
    ? `qs_self_progress_${handout.id}_${handout.review_count ?? 0}_${handout.completed_at ? "r" : "l"}${isReviewRun ? "_q" : ""}`
    : null;

  const initialProgress = useMemo(() => {
    if (!progressKey) return null;
    try {
      const raw = localStorage.getItem(progressKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [progressKey]);

  const handleProgress = (snapshot) => {
    if (!progressKey) return;
    try {
      if (snapshot) localStorage.setItem(progressKey, JSON.stringify(snapshot));
      else localStorage.removeItem(progressKey);
    } catch { /* storage full/blocked — resume just won't survive */ }
  };

  const backToGenerate = () => navigate(createPageUrl("Generate"));

  // Persist the run onto the handout row, mirroring AssignedSessionPlay's
  // grading: never-completed row → learn grading (pass schedules review #1);
  // already-completed row → review grading (pass advances the ladder,
  // borderline retries tomorrow, fail resets to relearn).
  const handleFinish = async (result) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const sessionScore = result?.score ?? null;
      if (handout && sessionScore !== null) {
        const now = new Date();
        const priorCount = handout.completed_at ? (handout.review_count ?? 0) : null;
        const graded = priorCount === null
          ? gradeLearnSession(sessionScore)
          : gradeReview(sessionScore, priorCount);
        const reviewCount = priorCount === null ? 0 : graded.reviewCount;
        const nextReview = graded.nextReviewDate || addDays(1, now);
        const { error: upErr } = await supabase
          .from("generated_handouts")
          .update({
            completed_at: handout.completed_at || now.toISOString(),
            last_score_pct: sessionScore,
            next_review_date: nextReview.toISOString(),
            last_review_date: now.toISOString(),
            review_count: reviewCount,
            urgency_status: graded.urgency,
          })
          .eq("id", handout.id);
        if (upErr) throw upErr;
      }
      // Run is over — drop any saved mid-session progress.
      if (progressKey) {
        try { localStorage.removeItem(progressKey); } catch { /* ignore */ }
      }
    } catch (err) {
      console.error("Failed to save self-session completion:", err);
    } finally {
      submittingRef.current = false;
      // Land on the hub so the freshly scheduled review is visible.
      navigate(createPageUrl("LearningHub"));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !handout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-md">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Can't open this session</h2>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <Button onClick={backToGenerate} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Create
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SessionFlow
      content={content}
      inquiryMode="inline"
      onFinish={handleFinish}
      onExit={backToGenerate}
      initialProgress={initialProgress}
      onProgress={handleProgress}
      resumable
    />
  );
}
