/**
 * @file   ManageCurriculum.jsx
 * @desc   Teacher's curriculum editor — list of units + subunits, with the
 *         "Generate All" pipeline that runs AI content generation in parallel
 *         per subunit.
 *
 *         TODO [refactor]: ~780 LOC, exceeds 300-line ceiling. Planned split:
 *           - UnitList.jsx (renders the units + subunit cards)
 *           - GenerationQueue.jsx (the progress UI during bulk gen)
 *           - useCurriculumData.js (data loading hook, replaces the giant
 *             useEffect block)
 *           - curriculum-service.js (move all quest.entities.X calls here)
 *         Currently a single component doing data fetch + state + render +
 *         AI orchestration.
 *
 * @author Quest Learning core team
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ChevronLeft, Video, CheckCircle, Clock, Sparkles, Zap, BookOpen, Paperclip } from "lucide-react";
import VideoOnlyModal from "@/components/teacher/VideoOnlyModal";
import ContentReviewModal from "@/components/teacher/ContentReviewModal";
import { invokeLLM, generateImage } from "@/components/utils/openai";
import DownloadPDFButton from "@/components/shared/pdf/DownloadPDFButton";
import { LLM_MODELS } from "@/lib/llmModels";
import { resolveTranscript } from "@/lib/transcript";

export default function ManageCurriculum() {
  const navigate = useNavigate();
  const [curriculum, setCurriculum] = useState(null);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [videos, setVideos] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [inquirySessions, setInquirySessions] = useState([]);
  const [caseStudies, setCaseStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubunit, setSelectedSubunit] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewContent, setReviewContent] = useState(null);
  const [generatingQueue, setGeneratingQueue] = useState(false);
  // Per-subunit PDF context (extracted client-side via pdfjs-dist). Held in
  // component state — not persisted to DB. Teacher can attach a PDF before
  // hitting Generate, and the extracted text is concatenated with the video
  // transcript when the prompt runs. Re-attach after a refresh.
  const [pdfContextBySubunit, setPdfContextBySubunit] = useState({});
  const [extractingForSubunit, setExtractingForSubunit] = useState(null);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [currentGeneratingSubunit, setCurrentGeneratingSubunit] = useState(null);
  const [generatingTests, setGeneratingTests] = useState(false);
  // Live ETA for bulk generation: timestamp when it started + a 1s ticker so
  // the remaining-time estimate recomputes from real throughput.
  const [queueStartedAt, setQueueStartedAt] = useState(null);
  const [, setEtaTick] = useState(0);
  const GEN_CONCURRENCY = 2;

  useEffect(() => {
    if (!generatingQueue) return;
    const id = setInterval(() => setEtaTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [generatingQueue]);

  // Estimate remaining time from how long completed subunits actually took
  // (wall-clock per completed subunit already accounts for the concurrency).
  const estimateRemaining = () => {
    const { current, total } = queueProgress;
    const remaining = Math.max(0, total - current);
    if (remaining === 0) return "finishing up…";
    const perSubunitMs =
      current > 0 && queueStartedAt
        ? (Date.now() - queueStartedAt) / current
        : 45000 / GEN_CONCURRENCY; // initial guess before the first one lands
    const secs = Math.max(5, Math.round((remaining * perSubunitMs) / 1000));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0
      ? `~${m} min ${String(s).padStart(2, "0")} sec remaining`
      : `~${s} sec remaining`;
  };


  const urlParams = new URLSearchParams(window.location.search);
  const curriculumId = urlParams.get("id");

  useEffect(() => {
    loadCurriculumData();
  }, []);

  const loadCurriculumData = async () => {
    try {
      const [curriculumData, unitsData, allSubunits, videosData, quizzesData, questionsData, inquiryData, caseStudyData] = await Promise.all([
        quest.entities.Curriculum.filter({ id: curriculumId }),
        quest.entities.Unit.filter({ curriculum_id: curriculumId }, "unit_order"),
        quest.entities.Subunit.list(),
        quest.entities.Video.list(),
        quest.entities.Quiz.list(),
        quest.entities.Question.list(),
        quest.entities.InquirySession.list(),
        quest.entities.CaseStudy.list()
      ]);

      const relevantSubunits = allSubunits
        .filter(sub => unitsData.some(u => u.id === sub.unit_id))
        .sort((a, b) => a.subunit_order - b.subunit_order);

      setCurriculum(curriculumData[0]);
      setUnits(unitsData);
      setSubunits(relevantSubunits);
      setVideos(videosData);
      setQuizzes(quizzesData);
      setQuestions(questionsData);
      setInquirySessions(inquiryData);
      setCaseStudies(caseStudyData);
    } catch (error) {
      console.error("Failed to load curriculum:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSubunitStatus = (subunitId) => {
    const video = videos.find(v => v.subunit_id === subunitId);
    if (!video) return "no_video";
    
    const hasQuiz = quizzes.some(q => q.subunit_id === subunitId);
    const hasInquiry = inquirySessions.some(i => i.subunit_id === subunitId);
    const hasCaseStudy = caseStudies.some(c => c.subunit_id === subunitId);
    
    if (hasQuiz && hasInquiry && hasCaseStudy) return "complete";
    return "video_only";
  };

  const handleAddVideo = (subunit) => {
    setSelectedSubunit(subunit);
    setShowVideoModal(true);
  };

  const handleReviewContent = async (subunit) => {
    const video = videos.find(v => v.subunit_id === subunit.id);
    const videoId = video.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || "";

    const quiz = quizzes.find(q => q.subunit_id === subunit.id && q.quiz_type === "new_topic");
    const quizQuestions = quiz ? questions.filter(q => q.quiz_id === quiz.id) : [];
    const inquiry = inquirySessions.find(i => i.subunit_id === subunit.id);
    const caseStudy = caseStudies.find(c => c.subunit_id === subunit.id);

    // Resolve the transcript value — when it's longer than ~10K chars the
    // pipeline stores a Supabase Storage URL instead of inline text. Fetch
    // the URL so the modal renders the real transcript, never the link.
    const transcriptText = await resolveTranscript(video.video_transcript);

    setReviewContent({
      video: {
        videoId,
        title: subunit.subunit_name,
        url: video.video_url,
        summary: transcriptText,
        transcript: transcriptText,
      },
      inquiryContent: {
        hook_image_prompt: inquiry?.hook_image_prompt || "",
        hook_image_url: inquiry?.hook_image_url || "",
        hook_question: inquiry?.hook_question || "",
        socratic_system_prompt: inquiry?.socratic_system_prompt || "",
        tutor_first_message: inquiry?.tutor_first_message || ""
      },
      questions: quizQuestions,
      caseStudy: {
        scenario: caseStudy?.scenario || "",
        question_a: caseStudy?.question_a || "",
        answer_a: caseStudy?.answer_a || "",
        question_b: caseStudy?.question_b || "",
        answer_b: caseStudy?.answer_b || "",
        question_c: caseStudy?.question_c || "",
        answer_c: caseStudy?.answer_c || "",
        question_d: caseStudy?.question_d || "",
        answer_d: caseStudy?.answer_d || ""
      },
      quiz,
      inquirySession: inquiry,
      caseStudyEntity: caseStudy
    });
    
    setSelectedSubunit(subunit);
    setShowReviewModal(true);
  };

  const handleVideoAdded = async () => {
    setShowVideoModal(false);
    await loadCurriculumData();
  };

  const handleContentSaved = async () => {
    setShowReviewModal(false);
    await loadCurriculumData();
  };

  const handleGenerateAll = async () => {
    const subunitsNeedingContent = subunits.filter(sub => getSubunitStatus(sub.id) === "video_only");
    
    if (subunitsNeedingContent.length === 0) {
      toast("All subunits already have content generated!");
      return;
    }

    setGeneratingQueue(true);
    setQueueProgress({ current: 0, total: subunitsNeedingContent.length });
    setQueueStartedAt(Date.now());

    // Generate a few subunits at a time, not ALL at once. Each subunit fires
    // several heavy gpt-5-mini calls, so running every subunit concurrently
    // overwhelmed the invokeLLM edge function (per-user rate limit + OpenAI
    // capacity → 500/546 worker-killed errors). A small worker pool keeps
    // throughput high while staying under the limits; the LLM client also
    // retries transient failures with backoff.
    const CONCURRENCY = GEN_CONCURRENCY;
    const queue = [...subunitsNeedingContent];
    const worker = async () => {
      while (queue.length > 0) {
        const sub = queue.shift();
        console.log(`\n🚀 Starting generation for: ${sub.subunit_name}`);
        try {
          await generateContentForSubunit(sub);
          console.log(`✅ Completed: ${sub.subunit_name}`);
        } catch (err) {
          console.error(`❌ Failed: ${sub.subunit_name}`, err?.message);
        }
        // Update progress counter as each one finishes
        setQueueProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, subunitsNeedingContent.length) }, worker)
    );

    await loadCurriculumData();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setGeneratingQueue(false);
    setCurrentGeneratingSubunit(null);
    console.log(`\n🎉 All content generation complete!`);
  };

  const generateContentForSubunit = async (subunit) => {
    try {
      console.log(`\n🚀 Starting generation for: ${subunit.subunit_name}`);
      
      const video = videos.find(v => v.subunit_id === subunit.id);
      if (!video) {
        throw new Error(`No video found for subunit: ${subunit.subunit_name}`);
      }

      // Extract video ID from YouTube URL
      const videoId = video.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1];
      
      if (!videoId) {
        throw new Error(`Could not extract video ID from URL: ${video.video_url}`);
      }

      // EXACT logic from TranscriptTester to fetch transcript
      console.log("\n🧪 [TRANSCRIPT TEST] ════════════════════════════════");
      console.log("🧪 [TRANSCRIPT TEST] Starting transcript fetch test");
      console.log("🧪 [TRANSCRIPT TEST] Video ID:", videoId);
      console.log("🧪 [TRANSCRIPT TEST] Full URL:", video.video_url);
      console.log("🧪 [TRANSCRIPT TEST] ════════════════════════════════\n");

      console.log("📝 [TRANSCRIPT TEST] Calling fetchTranscript backend function...");
      const response = await quest.functions.invoke('fetchTranscript', { videoId: videoId });
      
      console.log("📦 [TRANSCRIPT TEST] Response received:");
      console.log(JSON.stringify(response, null, 2));
      
      const fetchedTranscript = response?.data?.transcript || "";
      const timestampedSegments = response?.data?.timestampedSegments || [];
      const transcriptUrl = response?.data?.transcriptUrl || null;
      
      if (fetchedTranscript && fetchedTranscript.length > 0) {
        console.log("✅ [TRANSCRIPT TEST] SUCCESS! Transcript fetched");
        console.log("📏 [TRANSCRIPT TEST] Length:", fetchedTranscript.length, "characters");
        console.log("📏 [TRANSCRIPT TEST] Timestamped segments:", timestampedSegments.length);
        console.log("📄 [TRANSCRIPT TEST] First 500 chars:");
        console.log(fetchedTranscript.substring(0, 500) + "...\n");
      } else {
        console.error("❌ [TRANSCRIPT TEST] FAILED - Empty transcript");
        console.error("❌ [TRANSCRIPT TEST] Response data:", response?.data);
        console.warn("⚠️ [TRANSCRIPT TEST] Using fallback: video summary");
      }
      
      // If video already has a transcript stored (text or URL), resolve to text.
      const existingTranscript = await resolveTranscript(video.video_transcript);
      const hasRealTranscript = !!((fetchedTranscript && fetchedTranscript.length > 0) || (existingTranscript && existingTranscript.length > 0));
      let videoTranscript = fetchedTranscript || existingTranscript || `Educational video about ${subunit.subunit_name}`;

      // Append any PDF context the teacher attached for this subunit.
      const pdfContextText = pdfContextBySubunit?.[subunit.id];
      const hasPdfContext = !!(pdfContextText && pdfContextText.length > 50);
      if (hasPdfContext) {
        const pdfBudget = 12000;
        videoTranscript = `${videoTranscript}\n\n--- ADDITIONAL CONTEXT FROM TEACHER-ATTACHED PDF ---\n${pdfContextText.slice(0, pdfBudget)}`;
        console.log("[GENERATION] Merged PDF context. Combined source length:", videoTranscript.length);
      }

      // No real source material → generation can only lean on the topic name,
      // so the quiz/case study/inquiry may not match the actual video. Warn the
      // teacher so they can add captions or attach a PDF.
      if (!hasRealTranscript && !hasPdfContext) {
        toast.warning(
          `No transcript found for "${subunit.subunit_name}". Content will be based only on the topic name and may not match the video — add captions to the video or attach a PDF for video-specific questions.`,
          { duration: 10000 }
        );
      }
      const videoDuration = video.duration_seconds || 600;
      
      console.log("🎯 [GENERATION] Using transcript for content generation");
      console.log("📊 [GENERATION] Transcript length:", videoTranscript.length, "characters");

      // Save the fetched transcript URL (uploaded server-side) to the video entity
      if (transcriptUrl) {
        console.log("💾 [TRANSCRIPT] Saving transcript URL to video entity...");
        await quest.entities.Video.update(video.id, { video_transcript: transcriptUrl });
        console.log("✅ [TRANSCRIPT] Transcript URL saved to video entity");
      } else if (fetchedTranscript && fetchedTranscript.length > 0) {
        // Fallback: store inline if upload failed
        await quest.entities.Video.update(video.id, { video_transcript: fetchedTranscript.substring(0, 10000) });
      }

      // Generate attention checks for the video using the backend function
      console.log("\n🔔 [ATTENTION CHECKS] ═══════════════════════════════════");
      console.log("🔔 [ATTENTION CHECKS] Starting attention check generation");
      console.log("🔔 [ATTENTION CHECKS] Video Duration:", videoDuration, "seconds");
      console.log("🔔 [ATTENTION CHECKS] Transcript Length:", videoTranscript.length, "characters");
      console.log("🔔 [ATTENTION CHECKS] Expected Checks:", Math.floor(videoDuration / 60), "(1 per minute)");
      
      const { data: attentionCheckResponse } = await quest.functions.invoke('generateAttentionChecks', {
        transcript: videoTranscript,
        videoDuration: videoDuration,
        timestampedSegments: timestampedSegments
      });

      const attentionChecks = attentionCheckResponse || { attention_checks: [] };
      
      console.log("✅ [ATTENTION CHECKS] Generation complete!");
      console.log("📊 [ATTENTION CHECKS] Checks created:", attentionChecks.attention_checks?.length || 0);
      if (attentionChecks.attention_checks && attentionChecks.attention_checks.length > 0) {
        console.log("📍 [ATTENTION CHECKS] Timestamps:", attentionChecks.attention_checks.map(c => `${c.timestamp}s`).join(', '));
        console.log("❓ [ATTENTION CHECKS] Questions & Answer Choices:");
        attentionChecks.attention_checks.forEach((check, idx) => {
          console.log(`\n  ${idx + 1}. [${check.timestamp}s] ${check.question}`);
          console.log(`     A) ${check.choice_a} ${check.correct_choice === 'A' ? '✓' : ''}`);
          console.log(`     B) ${check.choice_b} ${check.correct_choice === 'B' ? '✓' : ''}`);
          console.log(`     C) ${check.choice_c} ${check.correct_choice === 'C' ? '✓' : ''}`);
          console.log(`     D) ${check.choice_d} ${check.correct_choice === 'D' ? '✓' : ''}`);
        });
      }
      console.log("\n🔔 [ATTENTION CHECKS] ═══════════════════════════════════\n");

      // Generate all other content in parallel (faster)
      console.log(`  🔄 Generating inquiry, questions, and case study in parallel...`);
      const [inquiryContent, questionsData, caseStudyContent] = await Promise.all([
        invokeLLM({
          model: LLM_MODELS.INQUIRY_CONTENT,
          prompt: `You are the world's best automated inquiry-based learning designer.

LANGUAGE: All generated text (hook question, anchor question, bridge question, transfer scenario, all options, all feedback) must be in clear, natural English. Translate non-English source material — never output non-English text.

        Topic: "${subunit.subunit_name}"
        Learning Standard: "${subunit.learning_standard || 'Not specified'}"

        Use this video transcript as CONTEXT for what the lesson actually teaches. Craft the introduction (hook) and the discussion so they lead directly into the specific concepts this video covers, at the depth the video treats them:
        """
        ${videoTranscript}
        """

        Create a curiosity hook for this topic. IMPORTANT: The student has NOT watched the video yet - they are encountering these concepts for the first time. The hook question must point at the core idea the video will teach (per the transcript), but stay answerable through intuition, prior knowledge, or everyday experience — never require a fact that is only revealed in the video.

        The hook_image_prompt should show the ACTUAL REAL-WORLD application or example of "${subunit.subunit_name}" as it appears in the video (not an analogy). Show what this concept looks like in real life.

        The socratic discussion (socratic_system_prompt + tutor_first_message) should steer the student toward the specific concepts the transcript covers, so that when they watch, the video answers the very questions they were just wondering about.

        Return strict JSON:
        {
        "hook_image_prompt": "[Describe the real-world application of ${subunit.subunit_name}]. Style: cartoon-realistic with simplified forms and accurate physics, minimal and sleek, muted neutral and soft pastel color palette with low saturation (not vibrant), clean thin outlines, modern educational science illustration, pure white background only, single clear centered scenario in ONE UNIFIED SCENE, keep it simple and easy to understand what is happening, no people, no hands, no text, no labels, no arrows, no symbols, no numbers, no multiple panels or stages, calm polished classroom aesthetic, 1792×1024.",
        "hook_question": "Question (8-18 words) directly about ${subunit.subunit_name} that students can answer through intuition or everyday experience, even without formal knowledge of the topic",
        "relevant_past_memories": [],
        "socratic_system_prompt": "You are Panda, a Socratic tutor. The student has NOT learned ${subunit.subunit_name} yet. Guide them to think about the topic using their intuition and prior knowledge. Ask questions, never explain. Max 3 exchanges. Make sure to stay on topic with the subject of the session. End with: 'Brilliant thinking! Now watch the video.'",
        "tutor_first_message": "Warm response to student's guess, with follow-up question that helps them explore the topic further"
        }`,
          response_json_schema: {
            type: "object",
            properties: {
              hook_image_prompt: { type: "string" },
              hook_question: { type: "string" },
              relevant_past_memories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    subunitTitle: { type: "string" },
                    studentFinalGuess: { type: "string" },
                    completedDateRelative: { type: "string" }
                  }
                }
              },
              socratic_system_prompt: { type: "string" },
              tutor_first_message: { type: "string" }
            }
          }
        }),
        
        invokeLLM({
          model: LLM_MODELS.QUIZ_GENERATION,
          prompt: `LANGUAGE: ALL output (every question and every answer choice) must be in clear, natural English. If the source material is in another language, translate the concepts into English — never output non-English text.

Create 40 multiple-choice quiz questions about the topic "${subunit.subunit_name}" (learning standard: "${subunit.learning_standard || 'Not specified'}").

Base EVERY question strictly on the concepts taught in this video transcript:
"""
${videoTranscript}
"""

GROUNDING RULES (apply to all 40 questions):
- Every question must APPLY a concept the video actually teaches — never test recall of an isolated fact, date, name, or definition, and never introduce material the video does not cover.
- Match the depth at which the video explains each concept. Do not go shallower (trivia) or deeper (advanced content beyond the video).
- Difficulty varies only SLIGHTLY across the set: all 40 questions are application-level at the video's depth, differing only in how the concepts are applied (see distribution below).

DIFFICULTY DISTRIBUTION (all application-level, varying only slightly):
- 15 EASY questions (order 1-15): apply ONE concept from the video directly to a straightforward case.
- 15 MEDIUM questions (order 16-30): combine two or more of the video's concepts, or apply one with a small twist.
- 10 HARD questions (order 31-40): apply the video's concepts to a NEW situation not shown in the video (same depth, fresh context).

Return a JSON object with exactly this structure:
{
  "questions": [
    {
      "question_text": "Question text here?",
      "choice_1": "First option",
      "choice_2": "Second option", 
      "choice_3": "Third option",
      "choice_4": "Fourth option",
      "correct_choice": 1,
      "question_order": 1,
      "difficulty": "easy"
    }
  ]
}

Make sure:
- First 15 questions (order 1-15) have difficulty "easy"
- Next 15 questions (order 16-30) have difficulty "medium"
- Last 10 questions (order 31-40) have difficulty "hard"
- correct_choice is a number (1, 2, 3, or 4)

IMPORTANT: This curriculum is at the ${curriculum?.curriculum_difficulty} level. Write all questions at a vocabulary, complexity, and depth appropriate for ${curriculum?.curriculum_difficulty} students.`,
          response_json_schema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question_text: { type: "string" },
                    choice_1: { type: "string" },
                    choice_2: { type: "string" },
                    choice_3: { type: "string" },
                    choice_4: { type: "string" },
                    correct_choice: { type: "number" },
                    question_order: { type: "number" },
                    difficulty: { type: "string" }
                  }
                }
              }
            }
          }
        }),
        
        invokeLLM({
          model: LLM_MODELS.CASE_STUDY_GENERATION,
          prompt: `LANGUAGE: ALL output (the scenario, every question, and every expected answer) must be in clear, natural English. If the source material is in another language, translate the concepts into English — never output non-English text.

Create a case study for the topic "${subunit.subunit_name}" with 4 free-response questions and expected answers.

Base it strictly on the concepts taught in this video transcript:
"""
${videoTranscript}
"""

REQUIREMENTS:
- The scenario must APPLY the video's central concept(s) to a NEW, realistic situation not shown in the video — never restate the video or ask students to merely recall it.
- Match the depth at which the video explains these concepts; do not require knowledge the video did not cover.
- The four questions vary only slightly in difficulty: (a) applies one concept directly, (b) applies another concept or combines two, (c) extends to a changed condition, (d) asks the student to evaluate or critique a claim using the video's concepts.

Return JSON:
{
  "scenario": "Realistic scenario with specific values...",
  "question_a": "(a) Calculate...",
  "answer_a": "Expected answer...",
  "question_b": "(b) Determine...",
  "answer_b": "Expected answer...",
  "question_c": "(c) If condition changes...",
  "answer_c": "Expected answer...",
  "question_d": "(d) A student claims... Explain why...",
  "answer_d": "Expected answer..."
}

IMPORTANT: This curriculum is at the ${curriculum?.curriculum_difficulty} level. Write the scenario, questions, and expected answers at a vocabulary, complexity, and depth appropriate for ${curriculum?.curriculum_difficulty} students.`,
          response_json_schema: {
            type: "object",
            properties: {
              scenario: { type: "string" },
              question_a: { type: "string" },
              answer_a: { type: "string" },
              question_b: { type: "string" },
              answer_b: { type: "string" },
              question_c: { type: "string" },
              answer_c: { type: "string" },
              question_d: { type: "string" },
              answer_d: { type: "string" }
            }
          }
        })
      ]);

      console.log(`  ✓ All content generated`);

      // Generate the hook image
      console.log(`  🎨 Generating hook image...`);
      const imageResult = await generateImage({
        prompt: inquiryContent.hook_image_prompt
      });
      console.log(`  ✓ Hook image generated`);

      // Save inquiry session
      console.log(`  💾 Saving inquiry session...`);
      await quest.entities.InquirySession.create({
        subunit_id: subunit.id,
        video_id: video.id,
        hook_image_prompt: inquiryContent.hook_image_prompt,
        hook_image_url: imageResult.url,
        hook_question: inquiryContent.hook_question,
        relevant_past_memories: inquiryContent.relevant_past_memories || [],
        socratic_system_prompt: inquiryContent.socratic_system_prompt,
        tutor_first_message: inquiryContent.tutor_first_message
      });
      console.log(`  ✓ Inquiry session saved`);

      // Save both quizzes in parallel
      console.log(`  💾 Saving quizzes...`);
      const [newTopicQuiz, reviewQuiz] = await Promise.all([
        quest.entities.Quiz.create({ subunit_id: subunit.id, quiz_type: "new_topic" }),
        quest.entities.Quiz.create({ subunit_id: subunit.id, quiz_type: "review" })
      ]);

      // Bulk create all questions in a single API call per quiz
      console.log(`  💾 Saving questions (${questionsData.questions?.length || 0} per quiz)...`);
      const questions = questionsData.questions || [];

      await Promise.all([
        quest.entities.Question.bulkCreate(questions.map(q => ({ quiz_id: newTopicQuiz.id, ...q }))),
        quest.entities.Question.bulkCreate(questions.map(q => ({ quiz_id: reviewQuiz.id, ...q })))
      ]);
      console.log(`  ✓ Both quizzes saved (${questions.length} questions each)`);

      // Save case study
      console.log(`  💾 Saving case study...`);
      await quest.entities.CaseStudy.create({
        subunit_id: subunit.id,
        video_id: video.id,
        scenario: caseStudyContent.scenario,
        question_a: caseStudyContent.question_a,
        answer_a: caseStudyContent.answer_a || "",
        question_b: caseStudyContent.question_b,
        answer_b: caseStudyContent.answer_b || "",
        question_c: caseStudyContent.question_c,
        answer_c: caseStudyContent.answer_c || "",
        question_d: caseStudyContent.question_d,
        answer_d: caseStudyContent.answer_d || ""
      });
      console.log(`  ✓ Case study saved`);

      // Save attention checks in parallel
      console.log("💾 [DATABASE SAVE] Saving", attentionChecks.attention_checks?.length || 0, "attention checks to AttentionCheck entity...");
      const savedChecks = await quest.entities.AttentionCheck.bulkCreate(
        (attentionChecks.attention_checks || []).map(check => ({
          video_id: video.id,
          timestamp: check.timestamp,
          question: check.question,
          choice_a: check.choice_a,
          choice_b: check.choice_b,
          choice_c: check.choice_c,
          choice_d: check.choice_d,
          correct_choice: check.correct_choice,
          check_order: check.check_order
        }))
      );
      console.log("✅ [DATABASE SAVE] Successfully saved", savedChecks.length, "AttentionCheck records");
      console.log("🔍 [DATABASE SAVE] Sample saved check:", savedChecks[0] ? {
        id: savedChecks[0].id,
        question: savedChecks[0].question.substring(0, 50) + '...',
        has_choice_a: !!savedChecks[0].choice_a,
        has_choice_b: !!savedChecks[0].choice_b,
        has_choice_c: !!savedChecks[0].choice_c,
        has_choice_d: !!savedChecks[0].choice_d,
        correct_choice: savedChecks[0].correct_choice
      } : 'No checks saved');
      
      console.log(`✅ COMPLETED all 4-phase content for: ${subunit.subunit_name}\n`);

    } catch (error) {
      console.error(`\n❌ ERROR in ${subunit.subunit_name}:`, error);
      console.error('Full error:', JSON.stringify(error, null, 2));
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600 mt-4">Loading curriculum...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="max-w-7xl mx-auto" style={{ fontFamily: '"Inter", sans-serif' }}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl("TeacherCurricula"))}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-black">{curriculum?.subject_name}</h1>
                <p className="text-gray-600">Add videos and content to your curriculum</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {subunits.some(s => getSubunitStatus(s.id) === "video_only") && (
              <Button
                onClick={handleGenerateAll}
                disabled={generatingQueue || generatingTests}
                className="bg-purple-600 hover:bg-purple-700 text-white gap-2 px-4 py-2 text-sm font-semibold shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                Generate Content
              </Button>
            )}
            <Button
              onClick={() => navigate(createPageUrl("TeacherCurricula"))}
              style={{ backgroundColor: '#16a34a' }}
              className="hover:opacity-90 text-white gap-2 px-4 py-2 text-sm font-semibold shadow-lg"
            >
              <CheckCircle className="w-4 h-4" />
              Complete
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {units.map((unit) => {
            const unitSubunits = subunits.filter(s => s.unit_id === unit.id);
            const completedCount = unitSubunits.filter(s => getSubunitStatus(s.id) === "complete").length;

            return (
              <Card key={unit.id} className="border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 bg-white overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{unit.unit_name}</h2>
                      <p className="text-sm text-gray-600">
                        {completedCount} of {unitSubunits.length} subunits completed
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {Math.round((completedCount / unitSubunits.length) * 100)}%
                      </div>
                    </div>
                  </div>

                  <div className="h-3 bg-blue-100 rounded-full mb-6 shadow-inner">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all shadow-lg"
                      style={{ width: `${(completedCount / unitSubunits.length) * 100}%` }}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {unitSubunits.map((subunit) => {
                      const status = getSubunitStatus(subunit.id);
                      return (
                        <div
                          key={subunit.id}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            status === "complete"
                              ? "bg-green-50 border-green-300"
                              : status === "video_only"
                              ? "bg-blue-50 border-blue-300"
                              : "bg-gray-50 border-gray-300"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-gray-900 text-sm">{subunit.subunit_name}</h3>
                            {status === "complete" ? (
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                            ) : status === "video_only" ? (
                              <Zap className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            ) : (
                              <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                          
                          <Button
                            onClick={() => status === "complete" ? handleReviewContent(subunit) : handleAddVideo(subunit)}
                            size="sm"
                            disabled={generatingQueue}
                            className={`w-full shadow-lg ${
                              status === "complete"
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                                : status === "video_only"
                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                : "bg-gray-600 hover:bg-gray-700 text-white"
                            }`}
                          >
                            {status === "complete" ? (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Review Content
                              </>
                            ) : (
                              <>
                                <Video className="w-4 h-4 mr-2" />
                                {status === "video_only" ? "Video Added" : "Add Video"}
                              </>
                            )}
                          </Button>
                          {status === "complete" ? (
                            <div className="mt-2">
                              <DownloadPDFButton
                                type="subunit"
                                contentId={subunit.id}
                                label={subunit.subunit_name}
                                size="sm"
                                variant="secondary"
                              >
                                Download packet
                              </DownloadPDFButton>
                            </div>
                          ) : (
                            <div className="mt-2">
                              <label
                                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                                  pdfContextBySubunit[subunit.id]
                                    ? 'text-emerald-700'
                                    : 'text-slate-500 hover:text-[#2563EB]'
                                }`}
                              >
                                {extractingForSubunit === subunit.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : pdfContextBySubunit[subunit.id] ? (
                                  <CheckCircle className="w-3.5 h-3.5" />
                                ) : (
                                  <Paperclip className="w-3.5 h-3.5" />
                                )}
                                {pdfContextBySubunit[subunit.id]
                                  ? 'PDF attached — click to replace'
                                  : extractingForSubunit === subunit.id
                                  ? 'Extracting…'
                                  : 'Attach PDF for extra context (optional)'}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    if (!file) return;
                                    if (file.size > 25 * 1024 * 1024) {
                                      toast.error('PDF must be 25MB or smaller.');
                                      return;
                                    }
                                    setExtractingForSubunit(subunit.id);
                                    try {
                                      const { extractPdfText } = await import('@/lib/extractPdfText');
                                      const meta = await extractPdfText(file);
                                      if (meta.wordCount < 20) {
                                        toast.error('Could not extract enough text from this PDF (it may be scanned). Try a digital PDF.');
                                      } else {
                                        setPdfContextBySubunit((prev) => ({
                                          ...prev,
                                          [subunit.id]: meta.text,
                                        }));
                                      }
                                    } catch (err) {
                                      console.error('PDF extraction failed:', err);
                                      toast.error('Could not read this PDF.');
                                    } finally {
                                      setExtractingForSubunit(null);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {showVideoModal && selectedSubunit && (
        <VideoOnlyModal
          subunit={selectedSubunit}
          curriculumName={curriculum?.subject_name}
          onClose={() => setShowVideoModal(false)}
          onVideoAdded={handleVideoAdded}
        />
      )}

      {showReviewModal && selectedSubunit && reviewContent && (
        <ContentReviewModal
          subunit={selectedSubunit}
          content={reviewContent}
          onClose={() => setShowReviewModal(false)}
          onSave={handleContentSaved}
        />
      )}

      {generatingQueue && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <Loader2 className="w-16 h-16 animate-spin text-purple-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Generating Content</h3>
                <p className="text-gray-600">Please wait while Quest generates learning materials...</p>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">Overall Progress</span>
                  <span className="text-sm font-medium text-gray-900">{queueProgress.current} of {queueProgress.total} completed</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                    style={{ width: `${(queueProgress.current / queueProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Generating {GEN_CONCURRENCY} at a time so nothing gets rate-limited — {estimateRemaining()}
                </p>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">{queueProgress.total} subunit{queueProgress.total === 1 ? "" : "s"} in the queue</h4>
                {subunits.filter(sub => getSubunitStatus(sub.id) === "video_only").map((sub) => (
                  <div 
                    key={sub.id}
                    className="p-3 rounded-lg border-2 bg-blue-50 border-blue-300"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-700">{sub.subunit_name}</span>
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}