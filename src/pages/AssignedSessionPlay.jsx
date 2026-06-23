/**
 * AssignedSessionPlay — student player for a teacher-assigned learning
 * session bundle. Designed to feel exactly like LiveSessionPlay (gradient
 * background, Plus Jakarta type, rounded-3xl card chrome, indigo/emerald
 * accents) minus the points + leaderboard, plus AI-graded case study
 * free responses like the regular learning sessions.
 *
 * Phase order (only included if payload has the content):
 *   inquiry → video (YT IFrame + attention checks) → quiz → case_study → results
 *
 * Persists to student_bundle_completion (one row per student+assignment):
 *   - quiz_total, quiz_correct, quiz_score_pct, quiz_responses
 *   - attention_check_total/correct/responses
 *   - case_study_score, case_study_max, case_study_responses
 *
 * If a completion row already exists we re-hydrate the answers and jump
 * to the results screen with a "Try again" button.
 *
 * RLS deps: 0029 + 0030 (student SELECT on bundles/assignments),
 *           0031 (manage own completion), 0032 (extra columns).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl, extractYouTubeId as extractVideoId } from "@/utils";
import { PASS_THRESHOLD, gradeLearnSession, gradeReview, addDays } from "@/lib/spacedRepetition";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { invokeLLM } from "@/components/utils/openai";
import { LLM_MODELS } from "@/lib/llmModels";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  CheckCircle,
  XCircle,
  Trophy,
  RotateCcw,
  MessageCircle,
  Send,
  HelpCircle,
} from "lucide-react";

const LETTERS = ["A", "B", "C", "D"];

// Pull the 11-char YouTube ID out of whatever the payload has.
export default function AssignedSessionPlay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("assignment_id");

  // ---- Load state ----
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ---- Walk state ----
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [quizSelected, setQuizSelected] = useState(null); // 0..3 for current q
  const [quizSubmitted, setQuizSubmitted] = useState({}); // { [qIdx]: true }
  const [quizFeedback, setQuizFeedback] = useState(null); // { correct }
  const [quizResponsesAcc, setQuizResponsesAcc] = useState({}); // { [qIdx]: { picked, is_correct, correct } }

  // Video / attention checks
  const [ytPlayer, setYtPlayer] = useState(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [actualDuration, setActualDuration] = useState(0);
  const [videoEnded, setVideoEnded] = useState(false);
  const [activeCheck, setActiveCheck] = useState(null);
  const [checkIdx, setCheckIdx] = useState(0);
  const [checksDone, setChecksDone] = useState([]);
  const [checkSelected, setCheckSelected] = useState(null);
  const [checkFeedback, setCheckFeedback] = useState(null);
  const [acAcc, setAcAcc] = useState([]); // accumulated attention_check responses
  const lastTimeRef = useRef(0);

  // Case study chat
  const [csMessages, setCsMessages] = useState([]); // [{role, content}]
  const [csInput, setCsInput] = useState("");
  const [csQIdx, setCsQIdx] = useState(0);
  const [csAnswers, setCsAnswers] = useState([]);
  const [csGrading, setCsGrading] = useState(false);
  const [csResult, setCsResult] = useState(null); // { responses[], score, max }
  const csEndRef = useRef(null);

  useEffect(() => {
    if (!assignmentId) {
      setError("No assignment specified.");
      setLoading(false);
      return;
    }
    loadAll();
  }, [assignmentId]);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const me = await quest.auth.me();
      setUser(me);

      const { data: aRow, error: aErr } = await supabase
        .from("lesson_bundle_assignments")
        .select("id, bundle_id, class_id, due_at, assigned_at")
        .eq("id", assignmentId)
        .single();
      if (aErr) throw aErr;
      setAssignment(aRow);

      const { data: bRow, error: bErr } = await supabase
        .from("lesson_bundles")
        .select("id, title, source_type, source_url, payload, grade_level")
        .eq("id", aRow.bundle_id)
        .single();
      if (bErr) throw bErr;
      setBundle(bRow);

      const { data: cRow } = await supabase
        .from("student_bundle_completion")
        .select("*")
        .eq("student_id", me.id)
        .eq("assignment_id", aRow.id)
        .maybeSingle();
      if (cRow) {
        setCompletion(cRow);
      }
    } catch (err) {
      console.error("Failed to load assigned session:", err);
      setError(err?.message || "Could not load this session.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Derived payload ----
  const payload = bundle?.payload || {};
  const video = payload.video || {};
  const inquiry = payload.inquiry_session || null;
  const caseStudy = payload.case_study || null;
  const quiz = Array.isArray(payload.quiz) ? payload.quiz : [];
  const attentionChecks = Array.isArray(payload.attention_checks) ? payload.attention_checks : [];
  const videoId = extractVideoId(video.videoId || video.url || bundle?.source_url);

  const phases = useMemo(() => {
    const out = [];
    if (inquiry?.hook_question) out.push("inquiry");
    if (videoId) out.push("video");
    if (quiz.length > 0) out.push("quiz");
    if (caseStudy?.scenario && Array.isArray(caseStudy?.discussion_questions) && caseStudy.discussion_questions.length > 0) {
      out.push("case_study");
    }
    out.push("results");
    return out;
  }, [inquiry, videoId, quiz.length, caseStudy]);

  const phase = phases[phaseIdx] || "results";

  // If already completed, land on results.
  useEffect(() => {
    if (completion && phases.length > 0) {
      setPhaseIdx(phases.length - 1);
    }
  }, [completion, phases.length]);

  // ---- Phase advance ----
  const goNextPhase = () => {
    setPhaseIdx((i) => Math.min(i + 1, phases.length - 1));
    setQIdx(0);
    setQuizSelected(null);
    setQuizFeedback(null);
  };

  // ============== YouTube player + attention checks ==============
  useEffect(() => {
    if (phase !== "video" || !videoId || ytPlayer) return;
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    const init = () => {
      const el = document.getElementById("asn-yt-player");
      if (!el) return setTimeout(init, 150);
      if (!window.YT || !window.YT.Player) return setTimeout(init, 200);
      try {
        new window.YT.Player("asn-yt-player", {
          height: "100%",
          width: "100%",
          videoId,
          playerVars: { controls: 1, modestbranding: 1, rel: 0, autoplay: 1, enablejsapi: 1 },
          events: {
            onReady: (e) => {
              setYtPlayer(e.target);
              const d = e.target.getDuration();
              if (d) setActualDuration(Math.floor(d));
            },
            onStateChange: (e) => {
              if (e.data === 0) setVideoEnded(true);
            },
          },
        });
      } catch (err) {
        console.error("YT init failed:", err);
      }
    };
    setTimeout(init, 400);
  }, [phase, videoId, ytPlayer]);

  useEffect(() => {
    if (phase !== "video" || !ytPlayer) return;
    const id = setInterval(() => {
      if (!ytPlayer.getCurrentTime || !ytPlayer.getPlayerState) return;
      const state = ytPlayer.getPlayerState();
      const t = ytPlayer.getCurrentTime();

      if (activeCheck) {
        if (state === 1) ytPlayer.pauseVideo();
        return;
      }
      // Block forward seeks past current point so students can't skip checks.
      if (t > lastTimeRef.current + 2) {
        ytPlayer.seekTo(lastTimeRef.current, true);
        return;
      }
      if (state === 1) {
        setVideoProgress(Math.floor(t));
        lastTimeRef.current = t;

        const next = attentionChecks[checkIdx];
        if (next && Math.abs(t - next.timestamp) <= 1 && !checksDone.includes(checkIdx)) {
          ytPlayer.pauseVideo();
          setActiveCheck(next);
          setCheckSelected(null);
          setCheckFeedback(null);
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase, ytPlayer, activeCheck, checkIdx, checksDone, attentionChecks]);

  const submitAttentionCheck = () => {
    if (!activeCheck || !checkSelected) return;
    const correctLetter = String(activeCheck.correct_choice || "A").toUpperCase();
    const isCorrect = checkSelected === correctLetter;
    setCheckFeedback({ correct: isCorrect });
    setAcAcc((prev) => [
      ...prev,
      {
        q_index: checkIdx,
        picked: checkSelected,
        correct: correctLetter,
        is_correct: isCorrect,
      },
    ]);
    setTimeout(() => {
      setChecksDone((prev) => [...prev, checkIdx]);
      setActiveCheck(null);
      setCheckSelected(null);
      setCheckFeedback(null);
      setCheckIdx((i) => i + 1);
      if (ytPlayer) ytPlayer.playVideo();
    }, 1200);
  };

  const videoCanProceed = () => {
    const dur = actualDuration || 0;
    const watchedEnough = videoEnded || (dur > 0 && videoProgress >= dur - 3);
    return watchedEnough && checksDone.length === attentionChecks.length;
  };

  // ============== Quiz handlers ==============
  const submitQuizAnswer = (choiceIndex) => {
    if (quizSubmitted[qIdx]) return;
    setQuizSelected(choiceIndex);
    const q = quiz[qIdx];
    const correctLetter = String(q.correct_choice || "A").toUpperCase();
    const pickedLetter = LETTERS[choiceIndex];
    const isCorrect = pickedLetter === correctLetter;
    setQuizFeedback({ correct: isCorrect });
    setQuizSubmitted((prev) => ({ ...prev, [qIdx]: true }));
    setQuizResponsesAcc((prev) => ({
      ...prev,
      [qIdx]: {
        q_index: qIdx,
        picked: pickedLetter.toLowerCase(),
        correct: correctLetter.toLowerCase(),
        is_correct: isCorrect,
      },
    }));
  };

  const nextQuizQuestion = () => {
    if (qIdx + 1 < quiz.length) {
      setQIdx(qIdx + 1);
      setQuizSelected(null);
      setQuizFeedback(null);
    } else {
      goNextPhase();
    }
  };

  // ============== Case study chat ==============
  useEffect(() => {
    // Seed the chat when entering the phase. Show scenario + first question.
    if (phase !== "case_study") return;
    if (csMessages.length > 0) return;
    if (!caseStudy?.scenario) return;
    setCsMessages([
      { role: "assistant", content: `**Scenario:**\n${caseStudy.scenario}` },
      { role: "assistant", content: `**Q1.** ${caseStudy.discussion_questions[0]}` },
    ]);
  }, [phase, caseStudy, csMessages.length]);

  useEffect(() => {
    csEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [csMessages.length, csGrading]);

  const sendCaseStudyAnswer = async () => {
    const text = csInput.trim();
    if (!text || csGrading) return;
    setCsInput("");
    const newAnswers = [...csAnswers, text];
    setCsAnswers(newAnswers);
    setCsMessages((prev) => [...prev, { role: "user", content: text }]);

    const next = csQIdx + 1;
    if (next < caseStudy.discussion_questions.length) {
      setCsQIdx(next);
      setCsMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `**Q${next + 1}.** ${caseStudy.discussion_questions[next]}`,
        },
      ]);
      return;
    }

    // All answered — grade.
    setCsGrading(true);
    setCsMessages((prev) => [
      ...prev,
      { role: "assistant", content: "**Grading your responses...** 📝" },
    ]);
    try {
      const graded = await gradeCaseStudy(newAnswers);
      setCsResult(graded);
      const feedbackBlocks = graded.responses
        .map(
          (r) =>
            `**Q${r.q_index + 1}** — ${r.score}/${r.max}\n${r.feedback || ""}`,
        )
        .join("\n\n");
      setCsMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: `**Case study score: ${graded.score}/${graded.max}** 🌟\n\n${feedbackBlocks}`,
        },
      ]);
    } catch (err) {
      console.error("CS grading failed:", err);
      setCsMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content:
            "Couldn't grade automatically right now — partial credit applied. You can continue.",
        },
      ]);
      setCsResult({
        responses: newAnswers.map((a, i) => ({
          q_index: i,
          question: caseStudy.discussion_questions[i],
          answer: a,
          score: 0.5,
          max: 1,
          feedback: "",
        })),
        score: newAnswers.length * 0.5,
        max: newAnswers.length,
      });
    } finally {
      setCsGrading(false);
    }
  };

  const gradeCaseStudy = async (answers) => {
    const questions = caseStudy.discussion_questions || [];
    const promptBody = questions
      .map(
        (q, i) =>
          `Q${i + 1}: ${q}\nSTUDENT ANSWER ${i + 1}: ${answers[i] || "SKIPPED"}`,
      )
      .join("\n\n");

    const schema = {
      type: "object",
      properties: {
        scores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              q_index: { type: "integer" },
              score: { type: "number" },
              feedback: { type: "string" },
            },
            required: ["q_index", "score", "feedback"],
          },
        },
        total_score: { type: "number" },
      },
      required: ["scores", "total_score"],
    };

    const result = await invokeLLM({
      model: LLM_MODELS.CASE_STUDY_GRADING,
      prompt: `You are grading a student's free-response answers to a case study about "${bundle?.title || video?.title || "this topic"}".

Case study scenario:
${caseStudy.scenario}

Grade each answer on a 0 / 0.5 / 1 scale:
- 0 = skipped, blank, incoherent, or completely misses the key concepts
- 0.5 = partial credit (some key concepts present but incomplete or partially correct)
- 1 = full credit (captures the main concepts, even if worded differently)

Empty answers, "idk", "skip", or just whitespace = 0.
Exact wording is not required — focus on conceptual accuracy.

Provide a short feedback string (one to two sentences) for each question explaining what they got right or what was missing. Address the student directly ("you...").

Questions and student answers:
${promptBody}

Return JSON: { scores: [{q_index, score, feedback}, ...], total_score }`,
      response_json_schema: schema,
    });

    const max = questions.length;
    const responses = questions.map((q, i) => {
      const s = (result?.scores || []).find((x) => x.q_index === i) || {};
      return {
        q_index: i,
        question: q,
        answer: answers[i] || "",
        score: typeof s.score === "number" ? s.score : 0,
        max: 1,
        feedback: s.feedback || "",
      };
    });
    const score =
      typeof result?.total_score === "number"
        ? result.total_score
        : responses.reduce((sum, r) => sum + (r.score || 0), 0);
    return { responses, score, max };
  };

  // ============== Submit + retry ==============
  const handleFinish = async () => {
    if (!user || !assignment || submitting) return;
    setSubmitting(true);
    try {
      const quizResponses = quiz.map((q, i) => {
        const acc = quizResponsesAcc[i];
        const correctLetter = String(q.correct_choice || "A").toLowerCase();
        return {
          q_index: i,
          picked: acc?.picked || null,
          correct: correctLetter,
          is_correct: !!acc?.is_correct,
        };
      });
      const quizCorrect = quizResponses.filter((r) => r.is_correct).length;
      const quizPct = quiz.length > 0 ? Math.round((quizCorrect / quiz.length) * 100) : null;

      const acTotal = attentionChecks.length;
      const acCorrect = acAcc.filter((r) => r.is_correct).length;

      const csScore = csResult?.score ?? null;
      const csMax = csResult?.max ?? null;

      // Unified spaced repetition — same engine as curriculum + self sessions.
      // First completion grades like a learn session; later ones advance the
      // ladder. (Assigned work isn't a hard gate, so a non-passing first try
      // still gets a soon nudge rather than blocking.)
      const now = new Date();
      const priorCount = completion?.review_count ?? null;
      let nextReview, urgency, reviewCount;
      if (quizPct === null) {
        reviewCount = priorCount ?? 0;
        nextReview = addDays(2, now);
        urgency = "Medium";
      } else {
        const result = priorCount === null
          ? gradeLearnSession(quizPct)
          : gradeReview(quizPct, priorCount);
        reviewCount = priorCount === null ? 0 : result.reviewCount;
        nextReview = result.nextReviewDate || addDays(1, now);
        urgency = result.urgency;
      }

      const row = {
        student_id: user.id,
        assignment_id: assignment.id,
        quiz_total: quiz.length || null,
        quiz_correct: quiz.length > 0 ? quizCorrect : null,
        quiz_score_pct: quizPct,
        quiz_responses: quizResponses,
        attention_check_total: acTotal || null,
        attention_check_correct: acTotal > 0 ? acCorrect : null,
        attention_check_responses: acAcc.length > 0 ? acAcc : null,
        case_study_responses: csResult?.responses || null,
        case_study_score: csScore,
        case_study_max: csMax,
        completed_at: now.toISOString(),
        next_review_date: nextReview.toISOString(),
        last_review_date: now.toISOString(),
        review_count: reviewCount,
        urgency_status: urgency,
      };

      const { data, error: upErr } = await supabase
        .from("student_bundle_completion")
        .upsert(row, { onConflict: "student_id,assignment_id" })
        .select("*")
        .single();
      if (upErr) throw upErr;
      setCompletion(data);
    } catch (err) {
      console.error("Failed to save completion:", err);
      setError(err?.message || "Could not save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!user || !assignment) return;
    setSubmitting(true);
    try {
      await supabase
        .from("student_bundle_completion")
        .delete()
        .eq("student_id", user.id)
        .eq("assignment_id", assignment.id);
      setCompletion(null);
      setPhaseIdx(0);
      setQIdx(0);
      setQuizSelected(null);
      setQuizSubmitted({});
      setQuizFeedback(null);
      setQuizResponsesAcc({});
      setVideoEnded(false);
      setVideoProgress(0);
      setActualDuration(0);
      setActiveCheck(null);
      setCheckIdx(0);
      setChecksDone([]);
      setCheckSelected(null);
      setCheckFeedback(null);
      setAcAcc([]);
      setYtPlayer(null);
      setCsMessages([]);
      setCsInput("");
      setCsQIdx(0);
      setCsAnswers([]);
      setCsResult(null);
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // ============== Render ==============
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <Wrapper title={bundle?.title} phaseIdx={0} phases={["results"]} due={null} onBack={() => navigate(createPageUrl("LearningHub"))}>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      title={bundle?.title || video?.title || "Learning session"}
      phaseIdx={phaseIdx}
      phases={phases}
      due={assignment?.due_at}
      onBack={() => navigate(createPageUrl("LearningHub"))}
    >
      {phase === "inquiry" && (
        <InquiryView inquiry={inquiry} onContinue={goNextPhase} />
      )}

      {phase === "video" && (
        <VideoView
          videoId={videoId}
          activeCheck={activeCheck}
          checkSelected={checkSelected}
          checkFeedback={checkFeedback}
          setCheckSelected={setCheckSelected}
          submitCheck={submitAttentionCheck}
          progress={videoProgress}
          duration={actualDuration}
          checksDone={checksDone.length}
          totalChecks={attentionChecks.length}
          canProceed={videoCanProceed()}
          onContinue={goNextPhase}
        />
      )}

      {phase === "quiz" && quiz[qIdx] && (
        <QuizView
          q={quiz[qIdx]}
          index={qIdx}
          total={quiz.length}
          selected={quizSelected}
          submitted={!!quizSubmitted[qIdx]}
          feedback={quizFeedback}
          onSelect={submitQuizAnswer}
          onNext={nextQuizQuestion}
        />
      )}

      {phase === "case_study" && caseStudy && (
        <CaseStudyView
          messages={csMessages}
          input={csInput}
          setInput={setCsInput}
          onSend={sendCaseStudyAnswer}
          grading={csGrading}
          done={!!csResult}
          onContinue={goNextPhase}
          endRef={csEndRef}
        />
      )}

      {phase === "results" && (
        <ResultsView
          quiz={quiz}
          quizResponses={
            completion?.quiz_responses ||
            quiz.map((q, i) => ({
              q_index: i,
              picked: quizResponsesAcc[i]?.picked || null,
              correct: String(q.correct_choice || "A").toLowerCase(),
              is_correct: !!quizResponsesAcc[i]?.is_correct,
            }))
          }
          quizPct={
            completion?.quiz_score_pct ??
            (quiz.length > 0
              ? Math.round(
                  (Object.values(quizResponsesAcc).filter((r) => r.is_correct).length /
                    quiz.length) *
                    100,
                )
              : null)
          }
          quizCorrect={
            completion?.quiz_correct ??
            Object.values(quizResponsesAcc).filter((r) => r.is_correct).length
          }
          quizTotal={completion?.quiz_total ?? quiz.length}
          acTotal={completion?.attention_check_total ?? attentionChecks.length}
          acCorrect={
            completion?.attention_check_correct ??
            acAcc.filter((r) => r.is_correct).length
          }
          csScore={completion?.case_study_score ?? csResult?.score ?? null}
          csMax={completion?.case_study_max ?? csResult?.max ?? null}
          csResponses={completion?.case_study_responses || csResult?.responses || []}
          submitted={!!completion}
          submitting={submitting}
          submittedAt={completion?.completed_at}
          onSubmit={handleFinish}
          onRetry={handleRetry}
          onHome={() => navigate(createPageUrl("LearningHub"))}
        />
      )}
    </Wrapper>
  );
}

// =============================== Chrome ===================================
function Wrapper({ title, phaseIdx, phases, due, onBack, children }) {
  return (
    <div
      className="min-h-screen px-4 py-6 sm:px-6 sm:py-8"
      style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 50%, #FAF5FF 100%)",
        fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <button
            onClick={onBack}
            className="bg-white border border-slate-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm inline-flex items-center gap-1.5 hover:bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Learning Hub
          </button>
          <PhaseDots phases={phases} current={phaseIdx} />
        </div>

        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3" /> Assigned session
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
            {title}
          </h1>
          {due && (
            <p className="text-xs text-slate-500 mt-1">
              Due {new Date(due).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

function PhaseDots({ phases, current }) {
  return (
    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
      {phases.map((p, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === current
              ? "w-6 bg-indigo-600"
              : i < current
              ? "w-3 bg-indigo-400"
              : "w-3 bg-slate-200"
          }`}
          title={p}
        />
      ))}
    </div>
  );
}

// =============================== Views ====================================

function InquiryView({ inquiry, onContinue }) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
      <div className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3">
        <Sparkles className="w-3 h-3" /> Think first
      </div>
      {inquiry?.hook_image_url && (
        <img
          src={inquiry.hook_image_url}
          alt=""
          className="w-full rounded-xl border border-slate-200 mb-4"
        />
      )}
      <h2 className="text-xl font-bold text-slate-900 mb-3">
        {inquiry?.hook_question}
      </h2>
      {inquiry?.tutor_first_message && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-600 mb-1">
            🐼 Panda
          </div>
          <p className="text-slate-800 leading-relaxed">{inquiry.tutor_first_message}</p>
        </div>
      )}
      <Button
        onClick={onContinue}
        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-semibold"
      >
        I've thought about it
      </Button>
    </div>
  );
}

function VideoView({
  videoId,
  activeCheck,
  checkSelected,
  checkFeedback,
  setCheckSelected,
  submitCheck,
  progress,
  duration,
  checksDone,
  totalChecks,
  canProceed,
  onContinue,
}) {
  if (!videoId) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center shadow-md">
        <p className="text-slate-500">Video unavailable.</p>
        <Button onClick={onContinue} variant="outline" className="mt-3">
          Skip
        </Button>
      </div>
    );
  }
  const pct = duration > 0 ? Math.min(100, Math.floor((progress / duration) * 100)) : 0;
  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-md overflow-hidden">
      <div className="aspect-video bg-black">
        <div id="asn-yt-player" className="w-full h-full" />
      </div>
      <div className="p-5">
        {activeCheck && (
          <div className="mb-4 border-2 border-indigo-300 bg-indigo-50 rounded-2xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-2">
              Attention check
            </div>
            <p className="font-semibold text-slate-900 mb-3">{activeCheck.question}</p>
            <div className="space-y-2">
              {["a", "b", "c", "d"].map((k) => {
                const letter = k.toUpperCase();
                const text = activeCheck[`choice_${k}`];
                if (!text) return null;
                const isSel = checkSelected === letter;
                const showResult = !!checkFeedback;
                const isCorrect = letter === String(activeCheck.correct_choice || "A").toUpperCase();
                let cls = "border-slate-200 bg-white";
                if (showResult && isCorrect) cls = "border-emerald-500 bg-emerald-50";
                else if (showResult && isSel && !isCorrect) cls = "border-red-400 bg-red-50";
                else if (isSel) cls = "border-indigo-500 bg-indigo-50";
                return (
                  <button
                    key={k}
                    disabled={showResult}
                    onClick={() => setCheckSelected(letter)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left ${cls}`}
                  >
                    <span className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-xs font-bold">
                      {letter}
                    </span>
                    <span className="flex-1 text-slate-900 text-sm">{text}</span>
                    {showResult && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
            {!checkFeedback && (
              <Button
                onClick={submitCheck}
                disabled={!checkSelected}
                className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Submit
              </Button>
            )}
            {checkFeedback && (
              <p className={`text-sm font-semibold mt-3 ${checkFeedback.correct ? "text-emerald-700" : "text-amber-700"}`}>
                {checkFeedback.correct ? "Nice — correct." : "Not quite. Keep watching."}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Watch progress: {pct}%</span>
          <span>Checks: {checksDone}/{totalChecks}</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>

        <Button
          onClick={onContinue}
          disabled={!canProceed}
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          {canProceed ? "Continue" : "Finish the video first"}
        </Button>
      </div>
    </div>
  );
}

function QuizView({ q, index, total, selected, submitted, feedback, onSelect, onNext }) {
  const choices = ["choice_a", "choice_b", "choice_c", "choice_d"]
    .map((k) => q[k])
    .filter(Boolean);
  const correctLetter = String(q.correct_choice || "A").toUpperCase();
  const correctIdx = LETTERS.indexOf(correctLetter);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
        Question {index + 1} of {total}
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-5">{q.question}</h2>

      <div className="space-y-2.5">
        {choices.map((c, i) => {
          const isSel = selected === i;
          const isCorrect = i === correctIdx;
          let cls = "border-slate-200 bg-white hover:border-indigo-300 cursor-pointer";
          if (submitted) {
            if (isCorrect) cls = "border-emerald-500 bg-emerald-50";
            else if (isSel) cls = "border-red-400 bg-red-50";
            else cls = "border-slate-200 bg-slate-50 opacity-70";
          } else if (isSel) {
            cls = "border-indigo-500 bg-indigo-50";
          }
          return (
            <button
              key={i}
              disabled={submitted}
              onClick={() => onSelect(i)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-colors ${cls}`}
            >
              <span
                className={`w-9 h-9 rounded-md flex items-center justify-center font-bold ${
                  submitted && isCorrect
                    ? "bg-emerald-600 text-white"
                    : isSel
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {LETTERS[i]}
              </span>
              <span className="flex-1 text-slate-900">{c}</span>
              {submitted && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600" />}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`mt-5 rounded-xl p-4 ${
            feedback.correct ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
          }`}
        >
          <p
            className={`font-bold ${
              feedback.correct ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            {feedback.correct ? "Correct!" : `The answer was ${correctLetter}.`}
          </p>
          {q.explanation && (
            <p className="text-sm text-slate-700 mt-1">{q.explanation}</p>
          )}
        </div>
      )}

      {submitted && (
        <Button onClick={onNext} className="w-full mt-4 h-11 bg-indigo-600 hover:bg-indigo-700 text-white">
          {index + 1 < total ? "Next question" : "Finish quiz"}
        </Button>
      )}
    </div>
  );
}

function CaseStudyView({ messages, input, setInput, onSend, grading, done, onContinue, endRef }) {
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
      <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3">
        <MessageCircle className="w-3 h-3" /> Case study
      </div>

      <div className="border border-slate-200 rounded-2xl bg-slate-50 p-3 max-h-[420px] overflow-y-auto mb-3 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-md"
                  : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"
              }`}
            >
              {m.role === "assistant" && (
                <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-600 mb-0.5">
                  🐼 Panda
                </div>
              )}
              <RichText text={m.content} />
            </div>
          </div>
        ))}
        {grading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3.5 py-2 text-sm text-slate-500 inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Grading your answers…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!done ? (
        <div className="flex items-end gap-2">
          <Textarea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={grading}
            placeholder="Type your answer…"
            className="resize-none flex-1"
          />
          <Button
            onClick={onSend}
            disabled={!input.trim() || grading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-[72px] px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          onClick={onContinue}
          className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white text-base font-semibold"
        >
          Continue to results
        </Button>
      )}
    </div>
  );
}

// Render **bold** segments inline.
function RichText({ text }) {
  const parts = (text || "").split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        }
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}

function ResultsView({
  quiz,
  quizResponses,
  quizPct,
  quizCorrect,
  quizTotal,
  acTotal,
  acCorrect,
  csScore,
  csMax,
  csResponses,
  submitted,
  submitting,
  submittedAt,
  onSubmit,
  onRetry,
  onHome,
}) {
  const hasQuiz = (quizTotal || 0) > 0;
  const hasAC = (acTotal || 0) > 0;
  const hasCS = (csMax || 0) > 0;

  // Overall: weighted average of available components
  const components = [];
  if (hasQuiz) components.push(quizPct);
  if (hasAC) components.push(Math.round((acCorrect / acTotal) * 100));
  if (hasCS) components.push(Math.round((csScore / csMax) * 100));
  const overall = components.length
    ? Math.round(components.reduce((a, b) => a + b, 0) / components.length)
    : null;
  const passed = overall !== null && overall >= PASS_THRESHOLD;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-md">
      <div className="text-center mb-6">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
            !submitted
              ? "bg-indigo-100"
              : passed
              ? "bg-emerald-100"
              : "bg-amber-100"
          }`}
        >
          <Trophy
            className={`w-8 h-8 ${
              !submitted
                ? "text-indigo-600"
                : passed
                ? "text-emerald-700"
                : "text-amber-700"
            }`}
          />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          {submitted ? "Session complete" : "Ready to submit?"}
        </h2>
        {overall !== null && (
          <p className="text-5xl font-extrabold mt-3 tabular-nums">
            <span
              className={
                passed
                  ? "text-emerald-700"
                  : submitted
                  ? "text-amber-700"
                  : "text-slate-900"
              }
            >
              {overall}%
            </span>
          </p>
        )}
        {submitted && submittedAt && (
          <p className="text-xs text-slate-400 mt-1">
            Submitted {new Date(submittedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="space-y-2 mb-6">
        {hasQuiz && (
          <ScoreRow
            label="Quiz"
            score={`${quizCorrect}/${quizTotal}`}
            pct={quizPct}
            color="indigo"
          />
        )}
        {hasAC && (
          <ScoreRow
            label="Attention checks"
            score={`${acCorrect}/${acTotal}`}
            pct={Math.round((acCorrect / acTotal) * 100)}
            color="emerald"
          />
        )}
        {hasCS && (
          <ScoreRow
            label="Case study (AI-graded)"
            score={`${csScore}/${csMax}`}
            pct={Math.round((csScore / csMax) * 100)}
            color="amber"
          />
        )}
      </div>

      {hasQuiz && quizResponses.length > 0 && (
        <details className="mb-4 border border-slate-200 rounded-2xl">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
            Quiz review · {quizCorrect}/{quizTotal}
          </summary>
          <ol className="px-4 pb-4 space-y-2">
            {quiz.map((q, i) => {
              const r = quizResponses[i] || {};
              return (
                <li
                  key={i}
                  className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                    r.is_correct
                      ? "border-emerald-200 bg-emerald-50"
                      : r.picked
                      ? "border-red-200 bg-red-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  {r.is_correct ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 text-sm">
                      {i + 1}. {q.question}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Your answer:{" "}
                      <span className="font-semibold">
                        {r.picked ? r.picked.toUpperCase() : "—"}
                      </span>
                      {!r.is_correct && r.correct && (
                        <>
                          {" "}
                          · Correct:{" "}
                          <span className="font-semibold text-emerald-700">
                            {r.correct.toUpperCase()}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </details>
      )}

      {hasCS && csResponses.length > 0 && (
        <details className="mb-4 border border-slate-200 rounded-2xl">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
            Case study feedback · {csScore}/{csMax}
          </summary>
          <ol className="px-4 pb-4 space-y-3">
            {csResponses.map((r, i) => (
              <li
                key={i}
                className={`p-3 rounded-lg border text-sm ${
                  r.score === r.max
                    ? "border-emerald-200 bg-emerald-50"
                    : r.score > 0
                    ? "border-amber-200 bg-amber-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <p className="font-medium text-slate-900 mb-1">
                  Q{(r.q_index ?? i) + 1}. {r.question}
                </p>
                <p className="text-xs text-slate-700 mb-1.5">
                  <span className="font-semibold">Your answer:</span> {r.answer || "—"}
                </p>
                <p className="text-xs text-slate-700 mb-1">
                  <span className="font-semibold">Score:</span> {r.score}/{r.max}
                </p>
                {r.feedback && (
                  <p className="text-xs text-slate-700 italic">{r.feedback}</p>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
        {!submitted ? (
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 text-base font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1.5" /> Submit & finish
              </>
            )}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={onRetry}
              disabled={submitting}
              className="border-slate-300"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" /> Try again
            </Button>
            <Button
              onClick={onHome}
              className="bg-indigo-600 hover:bg-indigo-700 text-white ml-auto"
            >
              Back to Learning Hub
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ScoreRow({ label, score, pct, color }) {
  const palette = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  }[color] || "bg-slate-50 text-slate-700";
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${palette}`}>
      <span className="font-semibold text-sm">{label}</span>
      <span className="text-sm font-bold tabular-nums">
        {score} · {pct}%
      </span>
    </div>
  );
}
