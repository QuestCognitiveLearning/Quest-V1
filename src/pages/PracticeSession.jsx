import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { toast } from "sonner";
import { PASS_THRESHOLD, RELEARN_THRESHOLD, gradeReview, computeSessionScore } from "@/lib/spacedRepetition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, RefreshCw, Play, Clock } from "lucide-react";
import LofiMusicPlayer from "../components/shared/LofiMusicPlayer";
import PandaChatWidget from "../components/shared/PandaChatWidget";
import CaseStudyChat from "../components/newSession/CaseStudyChat";
import SessionReview from "../components/student/SessionReview";
import SessionFeedbackModal from "../components/newSession/SessionFeedbackModal";
import { loadResume, saveResume, clearResume } from "@/lib/sessionResume";

// Spaced-repetition reviews get progressively harder: the further along the
// review cycle, the more "hard" questions are pulled in. Always backfills from
// other difficulties so a short bank still yields a full set.
function selectReviewQuestions(allQuestions, reviewNumber, count = 10) {
  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
  const buckets = { easy: [], medium: [], hard: [] };
  for (const q of allQuestions) {
    const d = String(q.difficulty || "medium").toLowerCase();
    (buckets[d] || buckets.medium).push(q);
  }
  const r = Math.max(1, reviewNumber || 1);
  // Hard share climbs ~15% per review, capped at 70%.
  const hardTarget = Math.min(count, Math.round(count * Math.min(0.7, 0.1 + 0.15 * r)));
  const mediumTarget = Math.round((count - hardTarget) * 0.6);
  const easyTarget = Math.max(0, count - hardTarget - mediumTarget);
  const take = (pool, n) => shuffle(pool).slice(0, n);

  let selected = [
    ...take(buckets.hard, hardTarget),
    ...take(buckets.medium, mediumTarget),
    ...take(buckets.easy, easyTarget),
  ];
  if (selected.length < count) {
    const chosen = new Set(selected.map((q) => q.id));
    selected = selected.concat(
      shuffle(allQuestions.filter((q) => !chosen.has(q.id))).slice(0, count - selected.length),
    );
  }
  return shuffle(selected).slice(0, count);
}

export default function PracticeSession() {
  const navigate = useNavigate();
  const [step, setStep] = useState("quiz");
  const [reviewDone, setReviewDone] = useState(false);
  const [reviewStep, setReviewStep] = useState(false);
  const [recallText, setRecallText] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState(false);
  const [bonusAnswer, setBonusAnswer] = useState("");
  const [results, setResults] = useState([]);
  const [user, setUser] = useState(null);
  const [subunit, setSubunit] = useState(null);
  const [video, setVideo] = useState(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [canProceed, setCanProceed] = useState(false);
  const [reflectionText, setReflectionText] = useState("");
  const [showExitModal, setShowExitModal] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [dbQuestions, setDbQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [frqScore, setFrqScore] = useState(null);
  const [isQuestathonClass, setIsQuestathonClass] = useState(false);
  const [questathonClassId, setQuestathonClassId] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const subunitId = urlParams.get("topic");

  // Persist step so a refresh / timeout keeps the student in the same place.
  // Terminal "results" step clears the snapshot so refresh = fresh start.
  useEffect(() => {
    if (!user?.id || !subunitId || !step) return;
    if (step === "results" || step === "done") {
      try { clearResume(user.id, subunitId, "review"); } catch { /* ignore */ }
    } else {
      saveResume(user.id, subunitId, "review", { step });
    }
  }, [step, user?.id, subunitId]);
  const unit = urlParams.get("unit") || "Unit";
  const reviewNumber = parseInt(urlParams.get("review")) || 0;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await quest.auth.me();
      setUser(currentUser);

      // Resume the prior step in this review session, if any.
      const resume = loadResume(currentUser.id, subunitId, "review");
      if (resume?.step) setStep(resume.step);

      // Check questathon class
      try {
        const enrollments = await quest.entities.StudentEnrollment.filter({ student_id: currentUser.id });
        if (enrollments.length > 0) {
          const allClasses = await quest.entities.Class.list();
          const studentClasses = enrollments.map(e => allClasses.find(c => c.id === e.class_id)).filter(Boolean);
          const qClass = studentClasses.find(c => c.is_questathon);
          if (qClass) {
            setIsQuestathonClass(true);
            setQuestathonClassId(qClass.id);
          }
        }
      } catch (e) { /* silent */ }

      if (subunitId) {
        const subunitData = await quest.entities.Subunit.filter({ id: subunitId });
        if (subunitData.length > 0) {
          setSubunit(subunitData[0]);
        }

        const videoData = await quest.entities.Video.filter({ subunit_id: subunitId });
        if (videoData.length > 0) {
          setVideo(videoData[0]);
        }

        const quizData = await quest.entities.Quiz.filter({ subunit_id: subunitId, quiz_type: "new_topic" });
        if (quizData.length > 0) {
          setQuiz(quizData[0]);
          const questionsData = await quest.entities.Question.filter({ quiz_id: quizData[0].id }, "question_order");
          // Pick 10 questions, weighting toward harder ones as the review
          // cycle progresses (review 1 is gentlest, later reviews are hardest).
          if (questionsData.length > 0) {
            setDbQuestions(selectReviewQuestions(questionsData, reviewNumber, 10));
          }
        }
      }
      setLoading(false);
    } catch (err) {
      console.error("Failed to load data:", err);
      setLoading(false);
    }
  };

  const topic = subunit?.subunit_name || "Topic";
  const [unitName, setUnitName] = useState("Unit");
  const videoTotalDuration = video?.duration_seconds || 120;

  useEffect(() => {
    const loadUnitName = async () => {
      if (subunit?.unit_id) {
        try {
          const units = await quest.entities.Unit.filter({ id: subunit.unit_id });
          if (units.length > 0) {
            setUnitName(units[0].unit_name);
          }
        } catch (err) {
          console.error("Failed to load unit name:", err);
        }
      }
    };
    loadUnitName();
  }, [subunit]);
  
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    
    let videoId = null;
    
    // Handle youtube.com/watch?v=VIDEO_ID
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('watch?v=')[1]?.split('&')[0];
    }
    // Handle youtu.be/VIDEO_ID
    else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0];
    }
    // Handle youtube.com/embed/VIDEO_ID
    else if (url.includes('youtube.com/embed/')) {
      videoId = url.split('embed/')[1]?.split('?')[0];
    }
    
    // controls=1 → enables speed selector + CC button. cc_load_policy=1 turns
    // captions on by default when a track is available. hl=en forces the UI to
    // English (so menu items stay in English regardless of viewer locale).
    return videoId ? `https://www.youtube.com/embed/${videoId}?controls=1&modestbranding=1&rel=0&showinfo=0&cc_load_policy=1&hl=en` : null;
  };
  
  const progress = step === "quiz" ? ((currentQuestion + 1) / 10) * 100 : 100;






  // Use database questions with randomized selection
  const questions = React.useMemo(() => {
    if (dbQuestions.length === 0) return [];
    
    // Already randomized 10 questions from loadData
    return dbQuestions.map(q => {
      const choices = [q.choice_1, q.choice_2, q.choice_3, q.choice_4];
      const correctChoice = q.correct_choice - 1;
      
      // Shuffle choices and track new correct index
      const shuffledIndices = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      const shuffledChoices = shuffledIndices.map(i => choices[i]);
      const newCorrectIndex = shuffledIndices.indexOf(correctChoice);
      
      return {
        id: q.id,
        question: q.question_text,
        options: shuffledChoices,
        correctIndex: newCorrectIndex,
        explanation: q.explanation,
        difficulty: q.difficulty
      };
    });
  }, [dbQuestions]);



  const handleAnswerSubmit = async () => {
    const correct = selectedAnswer === questions[currentQuestion].correctIndex;
    setAnsweredCorrectly(correct);
    setResults([...results, { question: currentQuestion, mcqCorrect: correct, frqSubmitted: false, selectedChoice: selectedAnswer }]);
    
    // Save question response with the actual text shown (choices are shuffled
    // per attempt, so the stored index alone can't be resolved later).
    if (user && quiz && questions[currentQuestion]) {
      const q = questions[currentQuestion];
      try {
        // On the first question of a fresh attempt, clear this review's prior
        // responses so a redo REPLACES the old ones (teacher sees the latest /
        // passing attempt, not a pile of attempts).
        if (currentQuestion === 0) {
          const priors = await quest.entities.QuestionResponse.filter({
            student_id: user.id,
            subunit_id: subunitId,
            session_type: "review",
            review_number: reviewNumber,
          });
          await Promise.all((priors || []).map((p) => quest.entities.QuestionResponse.delete(p.id)));
        }
        await quest.entities.QuestionResponse.create({
          student_id: user.id,
          quiz_id: quiz.id,
          question_id: q.id,
          selected_choice: selectedAnswer + 1,
          is_correct: correct,
          session_type: "review",
          review_number: reviewNumber,
          subunit_id: subunitId,
          question_text: q.question,
          selected_choice_text: q.options?.[selectedAnswer] ?? "",
          correct_choice_text: q.options?.[q.correctIndex] ?? "",
        });
      } catch (err) {
        console.error("Failed to save question response:", err);
      }
    }
    
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      setStep("results");
    }
  };

  const handleVideoComplete = () => {
    setStep("quiz");
  };


  // Review sessions are quiz-only — standardized scorer, clamped 0–100.
  const mcCorrect = results.filter(r => r.mcqCorrect).length;
  const finalScore = computeSessionScore({ quizCorrect: mcCorrect, quizTotal: questions.length }) ?? 0;

  // Post-score review: page through every question (right + wrong) with its
  // explanation before finishing — skipped on a perfect score.
  const quizReviewItems = results.map((r, i) => {
    const q = questions[r.question ?? i] || {};
    return {
      question: q.question,
      picked: q.options?.[r.selectedChoice] ?? "—",
      correct: q.options?.[q.correctIndex] ?? "—",
      isCorrect: !!r.mcqCorrect,
      explanation: q.explanation || "",
    };
  });
  const needsReview = quizReviewItems.some((q) => !q.isCorrect);

  const handleCompleteSession = async () => {
    if (!user || !subunitId) {
      navigate(createPageUrl("LearningHub"));
      return;
    }

    try {
      if (quiz) {
        await quest.entities.QuizResult.create({
          student_id: user.id,
          quiz_id: quiz.id,
          score: finalScore,
          correct_answers: mcCorrect,
          total_questions: questions.length,
          completed_at: new Date().toISOString()
        });
      }

      const sessionEnd = new Date();
      const sessionStart = new Date(sessionEnd.getTime() - 10 * 60 * 1000);
      const sessionRow = {
        student_id: user.id,
        subunit_id: subunitId,
        session_type: "review",
        start_time: sessionStart.toISOString(),
        end_time: sessionEnd.toISOString(),
        total_time_seconds: 10 * 60,
        completed: finalScore >= PASS_THRESHOLD,
        review_number: reviewNumber,
        score: finalScore
      };
      // One row per review slot — update on a redo so the teacher view shows
      // the latest grade instead of stacking up old attempts.
      const existingReviewSessions = await quest.entities.LearningSession.filter({
        student_id: user.id,
        subunit_id: subunitId,
        session_type: "review",
        review_number: reviewNumber
      });
      if (existingReviewSessions.length > 0) {
        await quest.entities.LearningSession.update(existingReviewSessions[0].id, sessionRow);
      } else {
        await quest.entities.LearningSession.create(sessionRow);
      }

      const progress = await quest.entities.StudentProgress.filter({
        student_id: user.id,
        subunit_id: subunitId
      });

      const currentReviewCount = progress[0]?.review_count || 0;
      // Unified spaced-repetition engine: pass advances the ladder, borderline
      // retries this review soon, fail resets the topic to relearn.
      const review = gradeReview(finalScore, currentReviewCount);

      if (progress.length > 0) {
        const now = new Date().toISOString();
        if (review.outcome === "pass") {
          await quest.entities.StudentProgress.update(progress[0].id, {
            learned_status: true,
            last_review_date: now,
            last_review_score: finalScore,
            next_review_date: review.nextReviewDate.toISOString(),
            review_count: review.reviewCount,
            urgency_status: review.urgency
          });
        } else if (review.outcome === "borderline") {
          await quest.entities.StudentProgress.update(progress[0].id, {
            last_review_date: now,
            last_review_score: finalScore,
            next_review_date: review.nextReviewDate.toISOString(),
            urgency_status: review.urgency
          });
        } else {
          await quest.entities.StudentProgress.update(progress[0].id, {
            new_session_completed: false,
            learned_status: false,
            last_review_date: now,
            last_review_score: finalScore,
            next_review_date: review.nextReviewDate.toISOString(),
            review_count: 0,
            urgency_status: review.urgency
          });
        }
      }
      const mustRedoLearn = review.mustRelearn;

      // Clear the resume snapshot — session is done.
      try { clearResume(user.id, subunitId, "review"); } catch { /* ignore */ }
      // Below 60%: send them straight into the learn session to relearn the
      // topic today; otherwise back to the hub. Force refresh either way.
      window.location.href = mustRedoLearn
        ? createPageUrl("NewSession") + `?topic=${encodeURIComponent(subunitId)}`
        : createPageUrl("LearningHub");
    } catch (err) {
      console.error("Failed to save progress:", err);
      toast.error("Failed to save progress. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#1A1A1A]/60 font-medium">Loading practice session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <PandaChatWidget
        topic={topic}
        phase="review quiz"
        currentPrompt={
          step === "quiz" && questions[currentQuestion]
            ? `Question: ${questions[currentQuestion].question}\nOptions: ${(questions[currentQuestion].options || []).join(" | ")}\nCorrect answer: ${questions[currentQuestion].options?.[questions[currentQuestion].correctIndex] ?? ""}`
            : null
        }
      />
      <LofiMusicPlayer />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {showExitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Exit Session?</h3>
            </div>
            <p className="text-gray-700 mb-6">Are you sure you want to exit? You'll need to restart this session from the beginning.</p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowExitModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => navigate(createPageUrl("LearningHub"))}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                Exit Session
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto" style={{fontFamily: '"Inter", sans-serif'}}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowExitModal(true)} className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-[#1A1A1A]">
              Exit
            </button>
            <div>
              <h1 className="text-xl font-semibold text-[#1A1A1A]">{unitName}</h1>
              <p className="text-sm text-[#1A1A1A]/60">{topic}</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-[#C4B5FD]/20 rounded-full">
            <span className="text-sm font-medium text-[#1A1A1A]">Review #{reviewNumber}</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#1A1A1A]/60">Progress</span>
            <span className="text-sm font-medium text-[#1A1A1A]">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-[#C4B5FD]/20 rounded-full overflow-hidden">
            <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>



        {step === "video" && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Play className="w-6 h-6 text-[#2563EB]" />
                  <h2 className="text-xl font-semibold text-[#1A1A1A]">Review the Video</h2>
                </div>
              </div>
              <p className="text-sm text-[#1A1A1A]/70 mb-6" style={{fontWeight: 450}}>
                Watch this video to refresh your memory on <strong>{topic}</strong>
              </p>

              <div className="relative bg-black aspect-video mb-6">
                {getYouTubeEmbedUrl(video?.video_url) ? (
                  <>
                    <iframe
                      src={getYouTubeEmbedUrl(video.video_url)}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                    <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-xs">Video Progress</span>
                        <span className="text-white text-xs font-medium">{Math.floor(videoProgress)}s / {videoTotalDuration}s</span>
                      </div>
                      <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all" style={{ width: `${(videoProgress / videoTotalDuration) * 100}%` }}></div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Play className="w-10 h-10 text-white" />
                      </div>
                      <p className="text-white text-lg font-medium">No video available</p>
                      <p className="text-white/70 text-sm">Loading video for: {topic}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#1A1A1A]/60" />
                    <span className="text-sm text-[#1A1A1A]/60">Video Progress</span>
                  </div>
                  <span className="text-sm font-medium text-[#1A1A1A]">{Math.floor((videoProgress / videoTotalDuration) * 100)}%</span>
                </div>
                <div className="h-2 bg-[#C4B5FD]/20 rounded-full overflow-hidden">
                  <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${(videoProgress / videoTotalDuration) * 100}%` }}></div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={handleVideoComplete} 
                  disabled={!canProceed}
                  className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-3 disabled:opacity-50 font-semibold rounded-full"
                >
                  {canProceed ? "Continue to Recall" : "Watch video to continue"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}





        {step === "quiz" && (
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

              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-6">{questions[currentQuestion].question}</h3>

              <div className="space-y-3 mb-6">
              {questions[currentQuestion].options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedAnswer(index)}
                  className={`w-full p-4 text-left border-2 rounded-[20px] transition-all ${
                    selectedAnswer === index
                      ? "border-[#3B82F6] bg-[#3B82F6]/10"
                      : "border-[#C4B5FD]/30 hover:border-[#C4B5FD]/50 bg-white"
                  }`}
                >
                  <span className="text-sm text-[#1A1A1A]" style={{fontWeight: 450}}>{option.replace(/\.$/, '')}</span>
                </button>
              ))}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleAnswerSubmit}
                  disabled={selectedAnswer === null}
                  className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full"
                >
                  Submit Answer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}



        {step === "results" && reviewStep && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-8">
              <SessionReview
                quizItems={quizReviewItems}
                completeLabel="Done reviewing"
                onComplete={() => { setReviewDone(true); setReviewStep(false); }}
              />
            </CardContent>
          </Card>
        )}

        {step === "results" && !reviewStep && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Award className="w-6 h-6 text-[#2563EB]" />
                  <h2 className="text-xl font-semibold text-[#1A1A1A]">Quiz Results</h2>
                </div>
              </div>

              <div className="text-center mb-8">
                <p className="text-6xl font-bold text-[#1A1A1A] mb-2">{finalScore}%</p>
                <p className="text-sm text-[#1A1A1A]/70" style={{fontWeight: 450}}>
                  {finalScore >= PASS_THRESHOLD
                    ? "Great job! You've successfully completed this review"
                    : finalScore >= RELEARN_THRESHOLD
                    ? "Close — you need 80% to pass. You'll repeat this review soon."
                    : "Below 60% — let's relearn this topic from the start today, then restart your reviews."}
                </p>
                <div className="mt-4 h-2 bg-[#C4B5FD]/20 rounded-full overflow-hidden max-w-md mx-auto">
                  <div className={`h-full rounded-full ${finalScore >= PASS_THRESHOLD ? 'bg-[#3B82F6]' : 'bg-red-500'}`} style={{ width: `${finalScore}%` }}></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-[20px] p-6 mb-6 space-y-4">
                <h3 className="font-semibold text-[#1A1A1A] mb-4">Score Breakdown</h3>
                
                <div className="border-t-2 border-[#1A1A1A]/20 pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#1A1A1A]">Final Score</p>
                    <p className={`text-3xl font-bold ${finalScore >= PASS_THRESHOLD ? 'text-[#3B82F6]' : 'text-red-500'}`}>
                      {finalScore}%
                    </p>
                  </div>
                  <p className="text-xs text-[#1A1A1A]/50 mt-1">
                    {finalScore >= PASS_THRESHOLD ? "Passing (80% required)" : "Below passing threshold (80% required)"}
                  </p>
                </div>
              </div>

              {needsReview && !reviewDone ? (
                <Button onClick={() => setReviewStep(true)} className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full">
                  Review my answers
                </Button>
              ) : (
                <Button onClick={handleCompleteSession} className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full">
                  {finalScore < RELEARN_THRESHOLD ? "Relearn this topic" : "Complete Review Session"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>


    </div>
  );
}