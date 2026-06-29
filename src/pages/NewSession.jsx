/**
 * NewSession — the curriculum "learn session". Renders through the SHARED
 * SessionFlow engine (the same one used by single + live sessions) so the UI,
 * steps, and flow are identical everywhere. The only curriculum-specific bits
 * are the data source (Quest entities) and persistence (QuizResult /
 * LearningSession / StudentProgress + spaced repetition + the feedback modal).
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { toast } from "sonner";
import { gradeLearnSession } from "@/lib/spacedRepetition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { resolveTranscript } from "@/lib/transcript";
import SessionFeedbackModal from "../components/newSession/SessionFeedbackModal";
import SessionFlow from "@/components/session/SessionFlow";

export default function NewSession() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const subunitId = urlParams.get("topic");

  const [user, setUser] = useState(null);
  const [subunit, setSubunit] = useState(null);
  const [video, setVideo] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [dbQuestions, setDbQuestions] = useState([]);
  const [attentionChecks, setAttentionChecks] = useState([]);
  const [inquirySession, setInquirySession] = useState(null);
  const [caseStudyEntity, setCaseStudyEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unitName, setUnitName] = useState("Unit");
  const [sessionStartTime] = useState(new Date());
  const [isQuestathonClass, setIsQuestathonClass] = useState(false);
  const [questathonClassId, setQuestathonClassId] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const finalResultRef = useRef(null);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const getYouTubeVideoId = (url) => {
    if (!url) return null;
    if (url.includes("youtube.com/watch?v=")) return url.split("watch?v=")[1]?.split("&")[0];
    if (url.includes("youtu.be/")) return url.split("youtu.be/")[1]?.split("?")[0];
    if (url.includes("youtube.com/embed/")) return url.split("embed/")[1]?.split("?")[0];
    return null;
  };

  const loadData = async () => {
    try {
      const isAuthenticated = await quest.auth.isAuthenticated();
      if (!isAuthenticated) {
        quest.auth.redirectToLogin(window.location.pathname + window.location.search);
        return;
      }
      const currentUser = await quest.auth.me();
      setUser(currentUser);

      // Questathon class detection (drives the feedback modal).
      try {
        const enrollments = await quest.entities.StudentEnrollment.filter({ student_id: currentUser.id });
        if (enrollments.length > 0) {
          const allClasses = await quest.entities.Class.list();
          const studentClasses = enrollments.map((e) => allClasses.find((c) => c.id === e.class_id)).filter(Boolean);
          const qClass = studentClasses.find((c) => c.is_questathon);
          if (qClass) { setIsQuestathonClass(true); setQuestathonClassId(qClass.id); }
        }
      } catch (e) { console.error("Failed to check questathon class:", e); }

      if (!subunitId) { setLoading(false); return; }

      const subunitData = await quest.entities.Subunit.filter({ id: subunitId });
      if (subunitData.length > 0) setSubunit(subunitData[0]);

      const videoData = await quest.entities.Video.filter({ subunit_id: subunitId });
      if (videoData.length > 0) {
        let checksData = await quest.entities.AttentionCheck.filter({ video_id: videoData[0].id }, "check_order");
        videoData[0] = { ...videoData[0], video_transcript: await resolveTranscript(videoData[0].video_transcript) };

        // Generate attention checks if none exist yet.
        if (checksData.length === 0) {
          const transcript = videoData[0].video_transcript || "";
          const durationSeconds = videoData[0].duration_seconds || 120;
          const { data: checksResponse } = await quest.functions.invoke("generateAttentionChecks", { transcript, videoDuration: durationSeconds });
          const generated = checksResponse?.attention_checks || [];
          await Promise.all(generated.map((check) =>
            quest.entities.AttentionCheck.create({
              video_id: videoData[0].id, timestamp: check.timestamp, question: check.question,
              choice_a: check.choice_a, choice_b: check.choice_b, choice_c: check.choice_c, choice_d: check.choice_d,
              correct_choice: check.correct_choice, check_order: check.check_order,
            })
          ));
          checksData = generated;
        }
        setVideo(videoData[0]);
        setAttentionChecks(checksData);
      }

      const inquiryData = await quest.entities.InquirySession.filter({ subunit_id: subunitId });
      if (inquiryData.length > 0) setInquirySession(inquiryData[0]);

      const csData = await quest.entities.CaseStudy.filter({ subunit_id: subunitId });
      if (csData.length > 0) setCaseStudyEntity(csData[0]);

      const quizData = await quest.entities.Quiz.filter({ subunit_id: subunitId, quiz_type: "new_topic" });
      if (quizData.length > 0) {
        setQuiz(quizData[0]);
        const questionsData = await quest.entities.Question.filter({ quiz_id: quizData[0].id }, "question_order");
        setDbQuestions(questionsData);
      }
    } catch (err) {
      console.error("Error loading session data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadUnitName = async () => {
      if (subunit?.unit_id) {
        try {
          const units = await quest.entities.Unit.filter({ id: subunit.unit_id });
          if (units.length > 0) setUnitName(units[0].unit_name);
        } catch (err) { console.error("Failed to load unit name:", err); }
      }
    };
    loadUnitName();
  }, [subunit]);

  const topic = subunit?.subunit_name || "Topic";

  // Select 4 easy / 4 medium / 2 hard at random, shuffle the choices.
  const questions = useMemo(() => {
    if (dbQuestions.length === 0) return [];
    const byDiff = (d) => dbQuestions.filter((q) => q.difficulty === d).sort(() => Math.random() - 0.5);
    const selected = [...byDiff("easy").slice(0, 4), ...byDiff("medium").slice(0, 4), ...byDiff("hard").slice(0, 2)];
    return selected.map((q) => {
      const choices = [q.choice_1, q.choice_2, q.choice_3, q.choice_4];
      const correctChoice = q.correct_choice - 1;
      const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      const options = order.map((i) => choices[i]);
      return {
        id: q.id,
        question: q.question_text,
        options,
        correctIndex: order.indexOf(correctChoice),
        explanation: q.explanation,
      };
    });
  }, [dbQuestions]);

  const content = useMemo(() => ({
    topic,
    unitName,
    badgeLabel: "New Topic",
    videoId: getYouTubeVideoId(video?.video_url),
    videoDurationSeconds: video?.duration_seconds,
    attentionChecks,
    questions,
    caseStudy: caseStudyEntity?.scenario
      ? {
          scenario: caseStudyEntity.scenario,
          question_a: caseStudyEntity.question_a, question_b: caseStudyEntity.question_b,
          question_c: caseStudyEntity.question_c, question_d: caseStudyEntity.question_d,
          answer_a: caseStudyEntity.answer_a, answer_b: caseStudyEntity.answer_b,
          answer_c: caseStudyEntity.answer_c, answer_d: caseStudyEntity.answer_d,
        }
      : null,
    inquiry: inquirySession?.hook_question
      ? { hook_question: inquirySession.hook_question, hook_image_url: inquirySession.hook_image_url }
      : null,
  }), [topic, unitName, video, attentionChecks, questions, caseStudyEntity, inquirySession]);

  // ---- Persistence (curriculum-specific) -------------------------------
  const events = {
    onQuizAnswer: async ({ question, selectedIndex, isCorrect, index }) => {
      if (!user || !quiz) return;
      try {
        if (index === 0) {
          const priors = await quest.entities.QuestionResponse.filter({ student_id: user.id, subunit_id: subunitId, session_type: "new_topic" });
          await Promise.all((priors || []).map((p) => quest.entities.QuestionResponse.delete(p.id)));
        }
        await quest.entities.QuestionResponse.create({
          student_id: user.id, quiz_id: quiz.id, question_id: question.id,
          selected_choice: selectedIndex + 1, is_correct: isCorrect, session_type: "new_topic", review_number: 0,
          subunit_id: subunitId, question_text: question.question,
          selected_choice_text: question.options?.[selectedIndex] ?? "",
          correct_choice_text: question.options?.[question.correctIndex] ?? "",
        });
      } catch (err) { console.error("Failed to save question response:", err); }
    },
    onAttentionCheck: async ({ check, selectedChoice, isCorrect }) => {
      if (!user || !video) return;
      try {
        await quest.entities.AttentionCheckResponse.create({
          student_id: user.id, attention_check_id: check.id, video_id: video.id, subunit_id: subunitId,
          selected_choice: selectedChoice, is_correct: isCorrect, session_type: "new_topic", timestamp: new Date().toISOString(),
        });
      } catch (err) { console.error("Failed to save attention check response:", err); }
    },
  };

  const handleCaseStudySave = async (payload) => {
    if (!user) return;
    try {
      await quest.entities.CaseStudyResponse.create({
        student_id: user.id, subunit_id: subunitId, case_study_id: caseStudyEntity?.id || "", ...payload,
      });
    } catch (err) { console.error("Failed to save case study response:", err); }
  };

  const handleInquiryResponse = async (history) => {
    if (!user || !inquirySession?.id) return;
    try {
      await quest.entities.InquiryResponse.create({
        student_id: user.id, subunit_id: subunitId, inquiry_session_id: inquirySession.id,
        initial_guess: history?.find?.((m) => m.role === "user")?.content || "",
        conversation_history: history || [],
      });
    } catch (err) { console.error("Failed to save inquiry response:", err); }
  };

  const handleCompleteSession = async (result) => {
    if (!user || !subunitId) { navigate(createPageUrl("LearningHub")); return; }
    const score = result?.score ?? 0;
    const mcCorrect = result?.mcCorrect ?? 0;
    const quizTotal = result?.quizTotal ?? questions.length;
    try {
      const sessionEndTime = new Date();
      const totalTimeSeconds = Math.floor((sessionEndTime - sessionStartTime) / 1000);
      const learn = gradeLearnSession(score);
      const isCompleted = learn.passed;

      if (quiz) {
        await quest.entities.QuizResult.create({
          student_id: user.id, quiz_id: quiz.id, score, correct_answers: mcCorrect,
          total_questions: quizTotal, completed_at: sessionEndTime.toISOString(),
        });
      }

      const learnRow = {
        student_id: user.id, subunit_id: subunitId, session_type: "new_topic",
        start_time: sessionStartTime.toISOString(), end_time: sessionEndTime.toISOString(),
        total_time_seconds: totalTimeSeconds, completed: isCompleted, review_number: 0, score,
      };
      const existing = await quest.entities.LearningSession.filter({ student_id: user.id, subunit_id: subunitId, session_type: "new_topic" });
      if (existing.length > 0) {
        await quest.entities.LearningSession.update(existing[0].id, learnRow);
        for (const extra of existing.slice(1)) { try { await quest.entities.LearningSession.delete(extra.id); } catch { /* ignore */ } }
        try {
          const oldReviews = await quest.entities.LearningSession.filter({ student_id: user.id, subunit_id: subunitId, session_type: "review" });
          for (const rev of oldReviews) await quest.entities.LearningSession.delete(rev.id);
        } catch { /* ignore */ }
      } else {
        await quest.entities.LearningSession.create(learnRow);
      }

      const existingProgress = await quest.entities.StudentProgress.filter({ student_id: user.id, subunit_id: subunitId });
      const progressData = {
        new_session_completed: isCompleted, new_session_score: score, learned_status: false,
        last_review_date: isCompleted ? sessionEndTime.toISOString() : null,
        next_review_date: isCompleted ? learn.nextReviewDate.toISOString() : null,
        review_count: 0, urgency_status: learn.urgency,
      };
      if (existingProgress.length > 0) await quest.entities.StudentProgress.update(existingProgress[0].id, progressData);
      else await quest.entities.StudentProgress.create({ student_id: user.id, subunit_id: subunitId, ...progressData });

      window.location.href = createPageUrl("LearningHub");
    } catch (err) {
      console.error("Failed to save progress:", err);
      toast.error("Failed to save progress. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!video || !inquirySession || !quiz || dbQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Content Not Available</h2>
            <p className="text-gray-600 mb-4">This topic doesn't have learning materials yet.</p>
            <Button onClick={() => navigate(createPageUrl("LearningHub"))} className="bg-blue-600 hover:bg-blue-700">
              Return to Learning Hub
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SessionFlow
        content={content}
        inquiryMode="inline"
        events={events}
        onCaseStudySave={handleCaseStudySave}
        onInquiryResponse={handleInquiryResponse}
        onFinish={(result) => { finalResultRef.current = result; setShowFeedbackModal(true); }}
        onExit={() => navigate(createPageUrl("LearningHub"))}
      />
      <SessionFeedbackModal
        isOpen={showFeedbackModal}
        subunitName={topic}
        sessionType="new_topic"
        subunitId={subunitId}
        classId={questathonClassId}
        userId={user?.id}
        userName={user?.full_name || user?.email || ""}
        isQuestathonClass={isQuestathonClass}
        questathonClassId={questathonClassId}
        onDone={() => { setShowFeedbackModal(false); handleCompleteSession(finalResultRef.current); }}
      />
    </>
  );
}
