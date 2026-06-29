/**
 * SessionFlow — the shared learn-session engine.
 *
 * This reproduces the exact design, steps, and flow of a curriculum learn
 * session (src/pages/NewSession.jsx): inquiry → video (+ attention checks) →
 * quiz → case study → results (+ answer review). It is driven entirely by a
 * normalized `content` object plus callbacks, so a single session and a live
 * session render the identical UI/flow as the curriculum learn session while
 * persisting / scoring through their own respective systems.
 *
 * The component never talks to the database directly — every persistence /
 * scoring side effect is delegated to the caller via callbacks, so it works
 * for curriculum entities, JSONB bundle payloads, and live multiplayer alike.
 *
 * Props:
 *   content: {
 *     topic, unitName, badgeLabel,
 *     videoId, videoDurationSeconds, transcript,
 *     attentionChecks: [{ id?, timestamp, question, choice_a..d, correct_choice }],
 *     questions:       [{ id, question, options:[], correctIndex, explanation }],
 *     caseStudy:       { scenario, question_a..d, answer_a..d } | null,
 *     inquiry:         { hook_question, hook_image_url } | null,
 *   }
 *   inquiryMode:   "inline" | "navigate" | "custom"  (default "inline")
 *   onInquiryStart: () => void          // navigate mode (curriculum)
 *   renderInquiry: ({ onComplete }) => ReactNode   // custom mode (live keeps its own chat)
 *   inquiryLlmCall: ({prompt, schema}) => Promise   // inline-chat transport override (live anon)
 *   events: { onAttentionCheck({check,selectedChoice,isCorrect,index}),
 *             onQuizAnswer({question,selectedIndex,isCorrect,index}) }
 *   onCaseStudySave: (payload) => Promise           // case-study persistence
 *   onFinish: ({score, mcCorrect, quizTotal, frqScore, passed}) => void
 *   onExit: () => void
 *   allowRetry: bool (default true)
 *   onRetry: () => void                 // default: restart internally
 *   resultsFooter: ReactNode            // extra results content (live leaderboard button)
 *   passThreshold: number (default PASS_THRESHOLD)
 *   showLofi, showPandaWidget: bool
 */
import React, { useState, useRef, useEffect, useMemo } from "react";
import { PASS_THRESHOLD, computeSessionScore } from "@/lib/spacedRepetition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, CheckCircle, X } from "lucide-react";
import CaseStudyChat from "../newSession/CaseStudyChat";
import LofiMusicPlayer from "../shared/LofiMusicPlayer";
import AttentionCheckDisplay from "../shared/AttentionCheckDisplay";
import PandaChatWidget from "../shared/PandaChatWidget";
import MathRenderer from "@/components/utils/MathRenderer";
import SessionReview from "../student/SessionReview";
import SocraticInquiryChat from "./SocraticInquiryChat";

export default function SessionFlow({
  content,
  inquiryMode = "inline",
  onInquiryStart,
  renderInquiry,
  inquiryLlmCall,
  events = {},
  onCaseStudySave,
  onFinish,
  onExit,
  onPhaseChange,
  allowRetry = true,
  onRetry,
  resultsFooter = null,
  passThreshold = PASS_THRESHOLD,
  showLofi = true,
  showPandaWidget = true,
  embedded = false,
}) {
  const {
    topic = "Topic",
    unitName = "",
    badgeLabel = "New Topic",
    videoId,
    videoDurationSeconds,
    attentionChecks = [],
    questions = [],
    caseStudy = null,
    inquiry = null,
  } = content || {};

  // Ordered phases present in this session.
  const phases = useMemo(() => {
    const out = [];
    if (inquiry?.hook_question) out.push("inquiry");
    if (videoId) out.push("video");
    if (questions.length > 0) out.push("quiz");
    if (caseStudy?.scenario) out.push("article");
    out.push("results");
    return out;
  }, [inquiry, videoId, questions.length, caseStudy]);

  const [step, setStep] = useState(phases[0]);
  const [showInquiryChat, setShowInquiryChat] = useState(false);

  // Video / attention-check state (mirrors NewSession exactly).
  const [videoProgress, setVideoProgress] = useState(0);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);
  const [currentCheck, setCurrentCheck] = useState(null);
  const [selectedCheckAnswer, setSelectedCheckAnswer] = useState(null);
  const [showCheckFeedback, setShowCheckFeedback] = useState(false);
  const [checksCompleted, setChecksCompleted] = useState([]);
  const [canProceed, setCanProceed] = useState(false);
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  const [actualVideoDuration, setActualVideoDuration] = useState(null);
  const [lastKnownTime, setLastKnownTime] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Quiz state.
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [results, setResults] = useState([]);

  // Case study + results state.
  const [frqScore, setFrqScore] = useState(null);
  const [caseReviewItems, setCaseReviewItems] = useState([]);
  const csResponseRef = useRef(null);
  const [reviewStep, setReviewStep] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const videoTotalDuration = actualVideoDuration || videoDurationSeconds || 120;

  const advance = () => {
    const i = phases.indexOf(step);
    setStep(phases[Math.min(i + 1, phases.length - 1)]);
  };

  // Notify the caller of phase changes (live mirrors this to participant.current_phase).
  useEffect(() => { onPhaseChange?.(step); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [step]);

  // ---- YouTube player init (verbatim from NewSession) --------------------
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const first = document.getElementsByTagName("script")[0];
      first.parentNode.insertBefore(tag, first);
      window.onYouTubeIframeAPIReady = () => {};
    }
  }, []);

  useEffect(() => {
    if (videoId && step === "video" && !youtubePlayer) {
      const initializePlayer = () => {
        const el = document.getElementById("youtube-player");
        if (!el) { setTimeout(initializePlayer, 100); return; }
        if (window.YT && window.YT.Player) {
          try {
            el.innerHTML = "";
            new window.YT.Player("youtube-player", {
              height: "100%", width: "100%", videoId,
              playerVars: { controls: 1, modestbranding: 1, rel: 0, showinfo: 0, autoplay: 1, enablejsapi: 1, fs: 0, iv_load_policy: 3, cc_load_policy: 1, hl: "en" },
              events: {
                onReady: (e) => {
                  setYoutubePlayer(e.target);
                  const d = e.target.getDuration();
                  if (d) setActualVideoDuration(Math.floor(d));
                  e.target.playVideo();
                },
              },
            });
          } catch (err) { console.error("YouTube init failed:", err); }
        } else {
          setTimeout(initializePlayer, 200);
        }
      };
      if (window.YT && window.YT.Player) setTimeout(initializePlayer, 300);
      else {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (prev) prev(); setTimeout(initializePlayer, 300); };
      }
    }
  }, [videoId, step, youtubePlayer]);

  // Watch progress + attention checks (no-skip + open checks).
  useEffect(() => {
    if (step !== "video" || !youtubePlayer) return;
    const interval = setInterval(() => {
      if (!youtubePlayer || typeof youtubePlayer.getCurrentTime !== "function") return;
      const playerState = typeof youtubePlayer.getPlayerState === "function" ? youtubePlayer.getPlayerState() : -1;
      const currentTime = youtubePlayer.getCurrentTime();
      if (currentCheck) { if (playerState === 1) youtubePlayer.pauseVideo(); return; }
      if (currentTime > lastKnownTime + 1.5) { youtubePlayer.seekTo(lastKnownTime, true); return; }
      if (attentionChecks && attentionChecks.length > 0) {
        const nextCheck = attentionChecks[currentCheckIndex];
        if (nextCheck && !checksCompleted.includes(currentCheckIndex) && currentTime >= nextCheck.timestamp - 0.3) {
          youtubePlayer.pauseVideo();
          setCurrentCheck(nextCheck); setSelectedCheckAnswer(null); setShowCheckFeedback(false);
          return;
        }
      }
      setVideoProgress(Math.floor(currentTime));
      setLastKnownTime(currentTime);
      const totalChecks = attentionChecks?.length || 0;
      if (currentTime >= videoTotalDuration - 2 && checksCompleted.length === totalChecks) setCanProceed(true);
    }, 500);
    return () => clearInterval(interval);
  }, [step, currentCheckIndex, checksCompleted, currentCheck, youtubePlayer, videoTotalDuration, attentionChecks, lastKnownTime]);

  // Pause when the student leaves the page.
  useEffect(() => {
    if (step !== "video") return;
    const onHidden = () => {
      if (document.hidden && youtubePlayer && typeof youtubePlayer.pauseVideo === "function") {
        try { youtubePlayer.pauseVideo(); } catch { /* ignore */ }
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [step, youtubePlayer]);

  const handleCheckSubmit = async () => {
    if (!selectedCheckAnswer || !currentCheck) return;
    setShowCheckFeedback(true);
    const isCorrect = selectedCheckAnswer === currentCheck.correct_choice;
    try {
      await events.onAttentionCheck?.({ check: currentCheck, selectedChoice: selectedCheckAnswer, isCorrect, index: currentCheckIndex });
    } catch (err) { console.warn("onAttentionCheck failed:", err); }
    setTimeout(() => {
      setCurrentCheck(null); setSelectedCheckAnswer(null); setShowCheckFeedback(false);
      if (isCorrect) {
        setChecksCompleted((prev) => [...prev, currentCheckIndex]);
        setCurrentCheckIndex(currentCheckIndex + 1);
        if (youtubePlayer) youtubePlayer.playVideo();
      } else {
        const prevTs = currentCheckIndex > 0 ? (attentionChecks[currentCheckIndex - 1]?.timestamp || 0) : 0;
        setLastKnownTime(prevTs);
        if (youtubePlayer) { youtubePlayer.seekTo(prevTs, true); youtubePlayer.playVideo(); }
      }
    }, 2000);
  };

  const handleAnswerSubmit = async () => {
    const q = questions[currentQuestion];
    const correct = selectedAnswer === q.correctIndex;
    setResults((prev) => [...prev, { correct, selectedChoice: selectedAnswer }]);
    try {
      await events.onQuizAnswer?.({ question: q, selectedIndex: selectedAnswer, isCorrect: correct, index: currentQuestion });
    } catch (err) { console.warn("onQuizAnswer failed:", err); }
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      advance(); // → article or results
    }
  };

  const handleCaseSave = async (payload) => {
    csResponseRef.current = payload;
    if (typeof onCaseStudySave === "function") { try { await onCaseStudySave(payload); } catch (e) { console.warn(e); } }
  };

  const handleCaseComplete = (score) => {
    setFrqScore(score);
    const cs = caseStudy;
    const resp = csResponseRef.current;
    if (cs && resp) {
      const items = ["a", "b", "c", "d"].map((L) => ({
        question: cs[`question_${L}`], answer: resp[`answer_${L}`], correct: cs[`answer_${L}`] || "",
        feedback: resp[`feedback_${L}`] || "", score: resp[`score_${L}`] ?? 0, max: 1,
      })).filter((it) => it.question);
      setCaseReviewItems(items);
    }
    advance(); // → results
  };

  // ---- scoring + review --------------------------------------------------
  const mcCorrect = results.filter((r) => r.correct).length;
  const mcPercent = questions.length > 0 ? Math.round((mcCorrect / questions.length) * 100) : 0;
  const finalScore = computeSessionScore({
    quizCorrect: mcCorrect,
    quizTotal: questions.length,
    caseScore: frqScore,
    caseMax: frqScore !== null ? 4 : null,
  }) ?? 0;

  const quizReviewItems = results.map((r, i) => {
    const q = questions[i] || {};
    return {
      question: q.question, picked: q.options?.[r.selectedChoice] ?? "—",
      correct: q.options?.[q.correctIndex] ?? "—", isCorrect: !!r.correct, explanation: q.explanation || "",
    };
  });
  const needsReview =
    quizReviewItems.some((q) => !q.isCorrect) ||
    caseReviewItems.some((c) => (c.score ?? 0) < (c.max ?? 1));

  const finishPassedFlag = finalScore >= passThreshold;
  const callFinish = () => onFinish?.({ score: finalScore, mcCorrect, quizTotal: questions.length, frqScore, passed: finishPassedFlag });

  const handleRetry = () => {
    if (typeof onRetry === "function") { onRetry(); return; }
    // Default: restart the whole flow.
    setResults([]); setFrqScore(null); setCaseReviewItems([]); csResponseRef.current = null;
    setReviewStep(false); setReviewDone(false);
    setCurrentQuestion(0); setSelectedAnswer(null);
    setCurrentCheck(null); setCurrentCheckIndex(0); setChecksCompleted([]); setCanProceed(false);
    setVideoProgress(0); setLastKnownTime(0); setYoutubePlayer(null);
    setShowInquiryChat(false);
    setStep(phases[0]);
  };

  // Progress label / percentage.
  const stepIndex = Math.max(0, phases.indexOf(step));
  const totalPhases = phases.length;
  const progress = step === "results"
    ? 100
    : Math.round(((stepIndex + (step === "video" ? (canProceed ? 1 : videoProgress / videoTotalDuration) : step === "quiz" ? currentQuestion / Math.max(1, questions.length) : 0)) / totalPhases) * 100);

  const startInquiry = () => {
    if (inquiryMode === "navigate") { onInquiryStart?.(); return; }
    setShowInquiryChat(true);
  };

  return (
    <div className={embedded ? "relative" : "min-h-screen relative overflow-hidden"}>
      {showPandaWidget && (
        <PandaChatWidget
          topic={topic}
          phase={step}
          currentPrompt={
            step === "quiz" && questions[currentQuestion]
              ? `Question: ${questions[currentQuestion].question}\nOptions: ${(questions[currentQuestion].options || []).join(" | ")}\nCorrect answer: ${questions[currentQuestion].options?.[questions[currentQuestion].correctIndex] ?? ""}`
              : null
          }
        />
      )}
      {!embedded && <div className="fixed inset-0 bg-white"></div>}
      {showLofi && !embedded && <LofiMusicPlayer />}

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {showExitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Exit Session?</h3>
            </div>
            <p className="text-gray-700 mb-6">Are you sure you want to exit? You'll need to restart this session from the beginning.</p>
            <div className="flex gap-3">
              <Button onClick={() => setShowExitModal(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={() => onExit?.()} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">Exit Session</Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto relative z-10 py-8" style={{ fontFamily: '"Inter", sans-serif', fontWeight: 450 }}>
        <div className="flex items-center justify-between mb-6 px-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowExitModal(true)} className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-[#1A1A1A]">Exit</button>
            <div>
              <h1 className="text-xl font-semibold text-[#1A1A1A]">{unitName || topic}</h1>
              {unitName && <p className="text-sm text-[#1A1A1A]/60">{topic}</p>}
            </div>
          </div>
          <div className="px-4 py-2 bg-[#3B82F6]/20 rounded-full">
            <span className="text-sm font-medium text-[#1A1A1A]">{badgeLabel}</span>
          </div>
        </div>

        <div className="mb-6 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#1A1A1A]/60">Phase {stepIndex + 1} of {totalPhases}</span>
            <span className="text-sm font-medium text-[#1A1A1A]">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-[#C4B5FD]/20 rounded-full overflow-hidden">
            <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        {/* INQUIRY */}
        {step === "inquiry" && inquiry && !showInquiryChat && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px] mx-4">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-[#1A1A1A] mb-6">Let's Think About This...</h2>
              {inquiry.hook_image_url && (
                <div className="mb-6 rounded-2xl overflow-hidden bg-white border-2 border-gray-200">
                  <img src={inquiry.hook_image_url} alt="Hook Image" onLoad={() => setImageLoaded(true)} className="w-full h-auto" />
                </div>
              )}
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 mb-6">
                <p className="text-lg font-semibold text-[#1A1A1A]"><MathRenderer text={inquiry.hook_question} /></p>
              </div>
              <div className="flex gap-3">
                <Button onClick={startInquiry} disabled={!!inquiry.hook_image_url && !imageLoaded}
                  className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full">
                  Start Discussion with Panda 🐼
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "inquiry" && inquiry && showInquiryChat && (
          inquiryMode === "custom" && typeof renderInquiry === "function"
            ? renderInquiry({ onComplete: advance })
            : (
              <SocraticInquiryChat
                subunitName={topic}
                hookQuestion={inquiry.hook_question}
                hookImageUrl={inquiry.hook_image_url}
                llmCall={inquiryLlmCall}
                onComplete={advance}
              />
            )
        )}

        {/* VIDEO */}
        {step === "video" && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-0">
              <div className="p-6 border-b border-[#C4B5FD]/20">
                <div className="flex items-center gap-3">
                  <Play className="w-6 h-6 text-[#2563EB]" />
                  <div>
                    <h2 className="text-xl font-semibold text-[#1A1A1A]">Introduction to {topic}</h2>
                    <p className="text-sm text-[#1A1A1A]/60" style={{ fontWeight: 450 }}>Interactive Learning Video • {Math.floor(videoTotalDuration / 60)}:{String(Math.floor(videoTotalDuration % 60)).padStart(2, "0")}</p>
                  </div>
                </div>
              </div>
              <div className="relative bg-black aspect-video">
                {videoId ? (
                  <div id="youtube-player" className="w-full h-full"></div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"><Play className="w-10 h-10 text-white" /></div>
                      <p className="text-white text-lg font-medium">Loading Video: {topic}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6">
                <AttentionCheckDisplay
                  currentCheck={currentCheck}
                  currentCheckIndex={currentCheckIndex}
                  totalChecks={attentionChecks.length}
                  selectedCheckAnswer={selectedCheckAnswer}
                  showCheckFeedback={showCheckFeedback}
                  onAnswerSelect={setSelectedCheckAnswer}
                  onSubmit={handleCheckSubmit}
                />
                {attentionChecks.length > 0 && (
                  <div className="flex items-center justify-end mb-4">
                    <span className="text-sm text-[#1A1A1A]/60">Checks: {checksCompleted.length}/{attentionChecks.length}</span>
                  </div>
                )}
                <div className="bg-[#2563EB]/5 border border-[#2563EB]/20 rounded-[20px] p-4 mb-4">
                  <p className="text-sm text-[#1A1A1A] font-medium mb-1">Active Learning Required</p>
                  <p className="text-xs text-[#1A1A1A]/70" style={{ fontWeight: 450 }}>Watch completely and answer all attention checks to proceed</p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setShowExitModal(true)} variant="outline" className="px-6 py-3 rounded-full">Exit</Button>
                  <Button onClick={advance} disabled={!canProceed}
                    className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-3 disabled:opacity-50 font-semibold rounded-full">
                    {canProceed ? "Continue" : "Complete video to continue"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QUIZ */}
        {step === "quiz" && questions[currentQuestion] && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2563EB]/10 flex items-center justify-center">
                    <span className="text-[#2563EB] font-semibold">{currentQuestion + 1}</span>
                  </div>
                  <span className="text-sm font-medium text-[#1A1A1A]">Question {currentQuestion + 1} of {questions.length}</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-6"><MathRenderer text={questions[currentQuestion].question} /></h3>
              <div className="space-y-3 mb-6">
                {questions[currentQuestion].options.map((option, index) => (
                  <button key={index} onClick={() => setSelectedAnswer(index)}
                    className={`w-full p-4 text-left border-2 rounded-[20px] transition-all ${selectedAnswer === index ? "border-[#3B82F6] bg-[#3B82F6]/10" : "border-[#C4B5FD]/30 hover:border-[#C4B5FD]/50 bg-white"}`}>
                    <span className="text-sm text-[#1A1A1A]" style={{ fontWeight: 450 }}><MathRenderer text={String(option).replace(/\.$/, "")} /></span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button onClick={handleAnswerSubmit} disabled={selectedAnswer === null}
                  className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full">Submit Answer</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CASE STUDY */}
        {step === "article" && caseStudy && (
          <CaseStudyChat
            subunitName={topic}
            caseStudyData={caseStudy}
            onSaveResponse={handleCaseSave}
            onComplete={handleCaseComplete}
          />
        )}

        {/* RESULTS — review sub-step */}
        {step === "results" && reviewStep && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-8">
              <SessionReview
                quizItems={quizReviewItems}
                caseItems={caseReviewItems}
                completeLabel="Done reviewing"
                onComplete={() => { setReviewDone(true); setReviewStep(false); }}
              />
            </CardContent>
          </Card>
        )}

        {/* RESULTS — score card */}
        {step === "results" && !reviewStep && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                {finalScore >= passThreshold ? <CheckCircle className="w-6 h-6 text-[#3B82F6]" /> : <X className="w-6 h-6 text-red-500" />}
                <h2 className="text-xl font-semibold text-[#1A1A1A]">{finalScore >= passThreshold ? "Session Complete" : "Session Incomplete"}</h2>
              </div>
              <div className="text-center mb-8">
                <p className="text-6xl font-bold text-[#1A1A1A] mb-2">{finalScore}%</p>
                <p className="text-sm text-[#1A1A1A]/70" style={{ fontWeight: 450 }}>
                  {finalScore >= passThreshold ? "Great job!" : "You need 80% or higher to pass. Please redo the lesson."}
                </p>
                <div className="mt-4 h-2 bg-[#C4B5FD]/20 rounded-full overflow-hidden max-w-md mx-auto">
                  <div className={`h-full rounded-full ${finalScore >= passThreshold ? "bg-[#3B82F6]" : "bg-red-500"}`} style={{ width: `${finalScore}%` }}></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-[20px] p-6 mb-6 space-y-4">
                <h3 className="font-semibold text-[#1A1A1A] mb-4">Score Breakdown</h3>
                {questions.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#1A1A1A]">Multiple Choice</p>
                      <p className="text-sm text-[#1A1A1A]/60">{mcCorrect} of {questions.length} correct</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${mcPercent >= passThreshold ? "text-[#3B82F6]" : "text-red-500"}`}>{mcPercent}%</p>
                      <p className="text-xs text-[#1A1A1A]/50">{mcCorrect} of {questions.length} pts</p>
                    </div>
                  </div>
                )}
                {caseStudy && (
                  <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                    <div>
                      <p className="font-medium text-[#1A1A1A]">Case Study (FRQ)</p>
                      <p className="text-sm text-[#1A1A1A]/60">4 questions graded</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${frqScore !== null && frqScore >= 2.8 ? "text-[#3B82F6]" : frqScore !== null ? "text-orange-500" : "text-gray-400"}`}>{frqScore !== null ? `${frqScore}/4` : "—"}</p>
                      <p className="text-xs text-[#1A1A1A]/50">{frqScore !== null ? frqScore : 0} of 4 pts</p>
                    </div>
                  </div>
                )}
                <div className="border-t-2 border-[#1A1A1A]/20 pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#1A1A1A]">Final Score</p>
                    <p className={`text-3xl font-bold ${finalScore >= passThreshold ? "text-[#3B82F6]" : "text-red-500"}`}>{finalScore}%</p>
                  </div>
                </div>
              </div>

              {needsReview && !reviewDone ? (
                <Button onClick={() => setReviewStep(true)} className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full">Review my answers</Button>
              ) : finalScore >= passThreshold || !allowRetry ? (
                <Button onClick={callFinish} className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full">Finish</Button>
              ) : (
                <div className="space-y-3">
                  <Button onClick={handleRetry} className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full">Retry Lesson</Button>
                  <Button onClick={callFinish} variant="outline" className="w-full rounded-full">Exit</Button>
                </div>
              )}

              {resultsFooter}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
