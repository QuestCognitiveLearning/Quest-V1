/**
 * @file   VideoSearchModal.jsx
 * @desc   Teacher-facing modal that searches YouTube for educational videos,
 *         picks one, then triggers AI generation of the full subunit content
 *         (inquiry hook, quiz, case study, attention checks, hero image).
 *
 *         TODO [refactor]: this file is ~1,260 LOC — well over the 300-line
 *         ceiling. Planned split:
 *           - VideoSearchList.jsx        (search results grid + custom URL)
 *           - GenerationProgress.jsx     (loading state during AI runs)
 *           - InquiryReviewSection.jsx   (hook image + tutor prompts)
 *           - QuizReviewSection.jsx      (40-question editor)
 *           - CaseStudyReviewSection.jsx (scenario + 4 questions/answers)
 *         The current file becomes the orchestrator (state machine + props).
 *
 * @author Quest Learning core team
 */
import React, { useState, useEffect } from "react";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Loader2, Play, CheckCircle, BookOpen, HelpCircle, FileText, ArrowLeft, Edit, Link as LinkIcon, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { createPageUrl } from "@/utils";
import QuestionEditor from "./QuestionEditor";
import NotificationModal from "../shared/NotificationModal";
import { useNotification } from "../shared/useNotification";
import { invokeLLM, generateImage } from "../utils/openai";
import { LLM_MODELS } from "@/lib/llmModels";

export default function VideoSearchModal({ subunit, curriculumName, onClose, onVideoSelected, existingContent = null, isLiveSession = false, sessionId = null, liveSessionDifficulty = "mixed", liveSessionQuestionCount = 10 }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(existingContent ? "preview" : "search");
  const [generatedContent, setGeneratedContent] = useState(existingContent);
  const [regeneratingImage, setRegeneratingImage] = useState(false);
  const [isEditMode, setIsEditMode] = useState(!!existingContent);
  
  const [customUrl, setCustomUrl] = useState("");
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState({
    hook_image_prompt: false,
    hook_question: false,
    socratic_system_prompt: false,
    tutor_first_message: false
  });
  const [editingCaseStudy, setEditingCaseStudy] = useState({
    scenario: false,
    question_a: false,
    question_b: false,
    question_c: false,
    question_d: false
  });
  const { notification, showError, showSuccess, closeNotification } = useNotification();
  useEffect(() => {
    if (!existingContent) {
      searchVideos();
    } else {
      setLoading(false);
    }
  }, []);

  const decodeHTMLEntities = (text) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  const searchVideos = async () => {
    try {
      const searchQuery = `${subunit.subunit_name} educational tutorial`.trim();
      
      const { data } = await quest.functions.invoke('youtubeSearch', { action: "search", query: searchQuery });
      
      if (data.items) {
        const videoIds = data.items.map(item => item.id.videoId).join(',');
        const { data: durationData } = await quest.functions.invoke('youtubeSearch', { action: "durations", videoIds });
        const durationMap = {};
        if (durationData.items) {
          durationData.items.forEach(item => {
            durationMap[item.id] = parseYouTubeDuration(item.contentDetails.duration);
          });
        }

        // For live sessions, use simple summaries from title/description only
        // For curriculum, generate AI summaries from transcripts
        const videoSummaries = await Promise.all(
          data.items.map(async (item) => {
            let summary;
            if (isLiveSession) {
              // Quick summary from title and description only
              summary = decodeHTMLEntities(item.snippet.description).substring(0, 200) || 
                       `Educational content about ${decodeHTMLEntities(item.snippet.title)}`;
            } else {
              // Full transcript-based AI summary for curriculum
              summary = await generateVideoSummaryFromTranscript(item.id.videoId, item.snippet.title);
            }

            return {
              videoId: item.id.videoId,
              title: decodeHTMLEntities(item.snippet.title),
              thumbnail: item.snippet.thumbnails.high.url,
              summary: summary,
              url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
              durationSeconds: durationMap[item.id.videoId] || 0
            };
          })
        );
        
        setVideos(videoSummaries);
      }
    } catch (error) {
      showError("Search Failed", "Failed to search for videos. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateVideoSummaryFromTranscript = async (videoId, title) => {
    try {
      console.log(`📝 [SEARCH SUMMARY] Fetching transcript for video: ${videoId}`);
      // Fetch transcript via backend function
      const { data: transcriptData } = await quest.functions.invoke('fetchTranscript', { videoId });
      
      const transcript = transcriptData?.transcript || "";
      console.log(`📊 [SEARCH SUMMARY] Transcript received - Length: ${transcript.length} characters`);
      
      // If transcript exists, use it for summary
      if (transcript) {
        console.log(`✅ [SEARCH SUMMARY] Generating AI summary from transcript for: ${title}`);
        const response = await invokeLLM({
          model: LLM_MODELS.VIDEO_SUMMARY,
          prompt: `Summarize this educational video in 2-3 sentences focusing on key learning points:

Title: ${title}
Transcript: ${transcript.substring(0, 3000)}`,
        });
        return response;
      } else {
        console.warn(`⚠️ [SEARCH SUMMARY] No transcript available for ${videoId}, using fallback`);
        // Fallback to title-based summary
        return `Educational content about ${title}`;
      }
    } catch (error) {
      console.error(`❌ [SEARCH SUMMARY] Error for ${videoId}:`, error);
      return "Summary unavailable";
    }
  };

  const runGeneration = async (video, transcript) => {
      console.log("🎯 [GENERATION] Using transcript for content generation");
      console.log("📊 [GENERATION] Transcript available:", !!transcript, "Length:", transcript?.length || 0);
      
      // Use the actual transcript or fallback
      const videoTranscript = transcript || `Educational video about ${subunit.subunit_name}. ${video.summary}`;
      
      if (transcript) {
        console.log("✅ [GENERATION] Using full video transcript for AI generation");
      } else {
        console.warn("⚠️ [GENERATION] No transcript available, using video summary as fallback");
      }
      
      // Generate inquiry-based learning content using OpenAI format
      const inquiryPrompt = `You are the world's best automated inquiry-based learning designer.

Topic: "${subunit.subunit_name}"
Video: ${video.title}
Context: ${video.summary}

CRITICAL: The student has NEVER learned "${subunit.subunit_name}" yet, but your hook MUST be directly related to this specific topic. Show them a real-world example OF this topic that makes them curious.

Your goal: Create a curiosity hook showing a real phenomenon DIRECTLY related to "${subunit.subunit_name}" that students may have observed but never understood WHY it happens.

IMAGE MUST:
- Show a REAL-WORLD example that directly demonstrates "${subunit.subunit_name}" in action
- Depict something surprising, counter-intuitive, or puzzling about THIS SPECIFIC TOPIC
- Be a phenomenon students may have SEEN but don't yet understand the science behind
- Style: Clean vibrant cartoon (Duolingo style), bold black outlines, bright pastels, PURE WHITE BACKGROUND ONLY
- Show ONE specific scenario in ONE SINGLE SCENE that makes them wonder about "${subunit.subunit_name}"
- Keep it simple and easy to understand what is happening
- NO text, labels, arrows, diagrams, people, or numbers
- Everything must be in one unified scene, not multiple panels or stages

QUESTION MUST:
- Directly relate to "${subunit.subunit_name}" - make them think about THIS topic
- Ask about something observable that this topic explains
- Use simple language (no jargon) but be ABOUT the topic
- Make them curious about the underlying principle of "${subunit.subunit_name}"
- Be 8-18 words that spark wonder about THIS SPECIFIC concept

Example patterns (question MUST relate to the actual topic):
• Topic: Photosynthesis → "Why can plants make their own food but animals can't?"
• Topic: Newton's Third Law → "When you push against a wall, why does it push back?"
• Topic: Osmosis → "Why do your fingers get wrinkly after a long bath?"
• Topic: Electromagnetic Induction → "How can moving a magnet create electricity?"

Return strict JSON only (no extra text):

{
  "hook_image_prompt": "Image showing real-world example of ${subunit.subunit_name} in action - [specific phenomenon that demonstrates this topic]. Style: cartoon-realistic with simplified forms and accurate physics, minimal and sleek, muted neutral and soft pastel color palette with low saturation (not vibrant), clean thin outlines, modern educational science illustration, pure white background only, single clear centered scenario in ONE UNIFIED SCENE that sparks curiosity, keep it simple and easy to understand what is happening, no people, no hands, no text, no labels, no arrows, no symbols, no numbers, no multiple panels or stages, calm polished classroom aesthetic, 1792×1024.",
  
  "hook_question": "Question (8-18 words) directly about ${subunit.subunit_name} - asks WHY/HOW this phenomenon works, sparking curiosity about the topic",
  
  "relevant_past_memories": [],
  
  "socratic_system_prompt": "You are Panda, a friendly Socratic tutor. Topic: ${subunit.subunit_name}. The student hasn't learned this yet but you're helping them THINK about it. Ask questions that guide them to notice patterns and think about WHY this phenomenon happens. Build each question on their previous answer. Never explain - only ask. Max 5 exchanges. Make sure to stay on topic with the subject of the session. End with: 'Brilliant thinking! Now watch the video to discover how ${subunit.subunit_name} actually works.'",
  
  "tutor_first_message": "Panda's warm response reacting to student's guess about ${subunit.subunit_name}, asking a follow-up question that builds on their idea and guides them deeper into thinking about this topic."
}`;

      console.log("🤖 [AI] Starting parallel AI generation for inquiry, questions, and case study...");
      
      // Run AI generation in parallel (skip case study for live sessions, but include inquiry)
      const generationPromises = [invokeLLM({
            model: LLM_MODELS.INQUIRY_CONTENT,
            prompt: inquiryPrompt,
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
          })];

      const liveSessionCount = isLiveSession ? liveSessionQuestionCount : 40;
      const difficultyInstruction = isLiveSession && liveSessionDifficulty !== "mixed"
        ? `ALL ${liveSessionCount} questions must be ${liveSessionDifficulty.toUpperCase()} difficulty.`
        : isLiveSession
        ? liveSessionQuestionCount === 10
          ? `Create exactly 4 EASY, 4 MEDIUM, and 2 HARD questions.`
          : liveSessionQuestionCount === 20
          ? `Create exactly 8 EASY, 8 MEDIUM, and 4 HARD questions.`
          : `Create exactly 12 EASY, 12 MEDIUM, and 6 HARD questions.`
        : `Create exactly 15 EASY, 15 MEDIUM, and 10 HARD questions.`;

      generationPromises.push(
        invokeLLM({
          model: LLM_MODELS.QUIZ_GENERATION,
          prompt: `Based on the topic "${subunit.subunit_name}", learning standard "${subunit.learning_standard || 'N/A'}", and the following video transcript, create ${liveSessionCount} diverse multiple-choice quiz questions organized by difficulty.

        VIDEO TRANSCRIPT:
        ${videoTranscript.substring(0, 4000)}

        Use the transcript content to create questions that test understanding of what was actually taught in the video.

        ${difficultyInstruction}

        ${isLiveSession && liveSessionDifficulty === "mixed" ? `DIFFICULTY DISTRIBUTION:
        - 4 EASY questions (basic recall and understanding)
        - 4 MEDIUM questions (application and analysis)
        - 2 HARD questions (synthesis, evaluation, complex scenarios)

        EASY questions should test:
        - Direct recall of facts and definitions
        - Basic conceptual understanding
        - Simple identification

        MEDIUM questions should test:
        - Application to new situations
        - Comparison and contrast
        - Cause-and-effect relationships
        - Scenario-based problem solving

        HARD questions should test:
        - Multi-step reasoning
        - Evaluation and justification
        - Complex real-world applications
        - Integration of multiple concepts

        Return a JSON object with exactly this structure:
        {
        "questions": [
        {
        "id": "q1",
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
        - Each question has a unique id (q1, q2, q3, etc.)
        ${liveSessionQuestionCount === 10 ? `- First 4 questions (order 1-4) have difficulty "easy"
        - Next 4 questions (order 5-8) have difficulty "medium"
        - Last 2 questions (order 9-10) have difficulty "hard"` : liveSessionQuestionCount === 20 ? `- First 8 questions (order 1-8) have difficulty "easy"
        - Next 8 questions (order 9-16) have difficulty "medium"
        - Last 4 questions (order 17-20) have difficulty "hard"` : `- First 12 questions (order 1-12) have difficulty "easy"
        - Next 12 questions (order 13-24) have difficulty "medium"
        - Last 6 questions (order 25-30) have difficulty "hard"`}
        - correct_choice is a number (1, 2, 3, or 4)` : liveSessionDifficulty !== "mixed" ? `
        IMPORTANT:
        - ALL ${liveSessionCount} questions must have difficulty: "${liveSessionDifficulty}"
        - Make sure each question's difficulty field is set to "${liveSessionDifficulty}"
        - Vary the complexity within ${liveSessionDifficulty} difficulty to keep it engaging
        - Each question has a unique id (q1, q2, q3, etc.)
        - correct_choice is a number (1, 2, 3, or 4)` : `DIFFICULTY DISTRIBUTION:
        - 15 EASY questions (basic recall and understanding)
        - 15 MEDIUM questions (application and analysis)
        - 10 HARD questions (synthesis, evaluation, complex scenarios)

        EASY questions should test:
        - Direct recall of facts and definitions
        - Basic conceptual understanding
        - Simple identification

        MEDIUM questions should test:
        - Application to new situations
        - Comparison and contrast
        - Cause-and-effect relationships
        - Scenario-based problem solving

        HARD questions should test:
        - Multi-step reasoning
        - Evaluation and justification
        - Complex real-world applications
        - Integration of multiple concepts

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
        - correct_choice is a number (1, 2, 3, or 4)`}`,
          response_json_schema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    question_text: { type: "string" },
                    choice_1: { type: "string" },
                    choice_2: { type: "string" },
                    choice_3: { type: "string" },
                    choice_4: { type: "string" },
                    correct_choice: { type: "number" },
                    question_order: { type: "number" },
                    difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
                  }
                }
              }
            }
          }
        })
      );

      if (!isLiveSession) {
        generationPromises.push(invokeLLM({
          model: LLM_MODELS.CASE_STUDY_GENERATION,
          prompt: `Create a physics/science-style case study for "${subunit.subunit_name}" based on this video transcript:

Video: ${video.title}
Full Transcript: ${videoTranscript.substring(0, 4000)}

Base the case study on the actual content and examples from the video transcript.

        Create a realistic scenario with specific numerical values and 4 free-response questions labeled (a) through (d).
        IMPORTANT: For EACH question, also provide the expected/model answer that a student should give.

        The case study should look like an AP Physics or college-level problem:
        - Scenario: A specific real-world situation with given values (measurements, time, distances, etc.)
        - Question (a): Calculate or determine something basic from the given information
        - Question (b): Apply a formula or concept to find another value
        - Question (c): Analyze what happens when conditions change
        - Question (d): Evaluate a student's claim or misconception and explain why it's incomplete/incorrect

        Example format:
        Scenario: "A bicycle wheel of radius 0.35 m is initially at rest. A rider begins pedaling, causing the wheel to speed up with a constant angular acceleration of α = 2.0 rad/s². After pedaling for 3.0 seconds, the rider stops applying torque."

        Return JSON:
        {
        "scenario": "Full scenario description with specific values...",
        "question_a": "(a) Calculate/determine [specific measurable outcome]...",
        "answer_a": "The expected answer with calculations/reasoning...",
        "question_b": "(b) Determine [related calculation using concepts]...",
        "answer_b": "The expected answer with calculations/reasoning...",
        "question_c": "(c) If [condition changes], how much [time/distance/etc] does it take for [outcome]?",
        "answer_c": "The expected answer with calculations/reasoning...",
        "question_d": "(d) A student claims that '[common misconception].' Explain why this statement is incomplete. Your answer must refer to [specific concepts].",
        "answer_d": "The expected answer explaining the misconception..."
        }`,
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
        }));
      }

      const results = await Promise.all(generationPromises);
      const inquiryContent = results[0];
      const questions = results[1];
      const caseStudyContent = !isLiveSession ? results[2] : null;
      
      console.log("✅ [AI] Inquiry content generated successfully");
      if (!isLiveSession) {
        console.log("✅ [AI] Case study generated successfully");
      }

      // Generate the hook image for both live sessions and curriculum
      console.log("🖼️ [IMAGE] Generating hook image...");
      const imageResult = await generateImage({
        prompt: inquiryContent.hook_image_prompt
      });
      inquiryContent.hook_image_url = imageResult.url;
      console.log("✅ [IMAGE] Hook image generated successfully");
      
      console.log("✅ [AI] Questions generated:", questions.questions?.length || 0);

    const content = {
      video,
      questions: questions.questions || [],
      inquiryContent: inquiryContent,
      caseStudy: caseStudyContent
    };
    return content;
  };

  const handleSelectVideo = async (video) => {
    console.log("\n🎬 [VIDEO SELECT] ═══════════════════════════════════════");
    console.log("🎬 [VIDEO SELECT] Starting video selection process");
    console.log("🎬 [VIDEO SELECT] Video ID:", video.videoId);
    console.log("🎬 [VIDEO SELECT] Video Title:", video.title);
    console.log("🎬 [VIDEO SELECT] ═══════════════════════════════════════\n");
    setSelectedVideo(video);
    setProcessing(true);

    try {
      // EXACT logic from TranscriptTester (lines 38-63)
      console.log("\n🧪 [TRANSCRIPT TEST] ════════════════════════════════");
      console.log("🧪 [TRANSCRIPT TEST] Starting transcript fetch test");
      console.log("🧪 [TRANSCRIPT TEST] Video ID:", video.videoId);
      console.log("🧪 [TRANSCRIPT TEST] Full URL:", `https://youtube.com/watch?v=${video.videoId}`);
      console.log("🧪 [TRANSCRIPT TEST] ════════════════════════════════\n");

      console.log("📝 [TRANSCRIPT TEST] Calling fetchTranscript backend function...");
      const response = await quest.functions.invoke('fetchTranscript', { videoId: video.videoId });
      
      console.log("📦 [TRANSCRIPT TEST] Response received:");
      console.log(JSON.stringify(response, null, 2));
      
      const fetchedTranscript = response?.data?.transcript || "";
      
      if (fetchedTranscript && fetchedTranscript.length > 0) {
        console.log("✅ [TRANSCRIPT TEST] SUCCESS! Transcript fetched");
        console.log("📏 [TRANSCRIPT TEST] Length:", fetchedTranscript.length, "characters");
        console.log("📄 [TRANSCRIPT TEST] First 500 chars:");
        console.log(fetchedTranscript.substring(0, 500) + "...\n");
      } else {
        console.error("❌ [TRANSCRIPT TEST] FAILED - Empty transcript");
        console.error("❌ [TRANSCRIPT TEST] Response data:", response?.data);
        throw new Error("No transcript available for this video. The video may not have captions/subtitles.");
      }
      
      const transcript = fetchedTranscript;
      
      // Generate content using the FULL transcript
      console.log("🔄 [GENERATION] ─────────────────────────────────────────");
      console.log("🔄 [GENERATION] Starting AI content generation");
      console.log("🔄 [GENERATION] Using FULL TRANSCRIPT (", transcript.length, "chars) for all content");
      const content = await runGeneration(video, transcript);
      content.video.transcript = transcript; // Store full transcript
      
      console.log("✅ [GENERATION] Content generation completed successfully");
      console.log("✅ [GENERATION] Transcript stored in content.video.transcript\n");
      setGeneratedContent(content);
      setStep("preview");
      showSuccess("Content Generated", "All learning materials have been successfully created!");
    } catch (error) {
      console.error("\n❌ [ERROR] ═══════════════════════════════════════");
      console.error("❌ [ERROR] Failed during video selection");
      console.error("❌ [ERROR] Error message:", error.message);
      console.error("❌ [ERROR] Stack trace:", error.stack);
      console.error("❌ [ERROR] ═══════════════════════════════════════\n");
      showError("Generation Failed", error.message || "Failed to generate content. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleAddCustomVideo = async () => {
    if (!customUrl.trim()) return;
    
    setLoadingCustom(true);
    try {
      const videoId = extractYouTubeVideoId(customUrl);
      if (!videoId) {
        showError("Invalid URL", "Please enter a valid YouTube URL.");
        setLoadingCustom(false);
        return;
      }

      // Fetch video details from YouTube API
      const { data } = await quest.functions.invoke('youtubeSearch', { action: "videoDetails", videoId });
      
      if (!data.items || data.items.length === 0) {
        showError("Video Not Found", "Could not find this video. Please check the URL.");
        setLoadingCustom(false);
        return;
      }

      const item = data.items[0];
      const summary = await generateVideoSummaryFromTranscript(videoId, item.snippet.title);
      const durationData = data;
      let durationSeconds = 0;
      if (durationData.items && durationData.items[0]) {
        durationSeconds = parseYouTubeDuration(durationData.items[0].contentDetails.duration);
      }

      const video = {
        videoId: videoId,
        title: decodeHTMLEntities(item.snippet.title),
        thumbnail: item.snippet.thumbnails.high.url,
        summary: summary,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        durationSeconds: durationSeconds
      };

      setCustomUrl("");
      setLoadingCustom(false);
      handleSelectVideo(video);
    } catch (error) {
      showError("Load Failed", "Failed to load video. Please try again.");
      setLoadingCustom(false);
    }
  };

  const extractYouTubeVideoId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleApproveContent = async () => {
    setProcessing(true);

    try {
      // Handle live session differently
      if (isLiveSession && sessionId) {
        const durationSeconds = generatedContent.video.durationSeconds || 600;
        const transcript = generatedContent.video.transcript || "";
        
        // Generate attention checks for live session
        console.log("\n🔔 [ATTENTION CHECKS] ═══════════════════════════════════");
        console.log("🔔 [ATTENTION CHECKS] Starting attention check generation");
        console.log("🔔 [ATTENTION CHECKS] Video Duration:", durationSeconds, "seconds");
        console.log("🔔 [ATTENTION CHECKS] Transcript Length:", transcript.length, "characters");
        console.log("🔔 [ATTENTION CHECKS] Expected Checks:", Math.floor(durationSeconds / 60), "(1 per minute)");
        
        const { data: checksResponse } = await quest.functions.invoke('generateAttentionChecks', {
          transcript: transcript,
          videoDuration: durationSeconds
        });
        
        console.log("✅ [ATTENTION CHECKS] Generation complete!");
        console.log("📊 [ATTENTION CHECKS] Checks created:", checksResponse.attention_checks?.length || 0);
        if (checksResponse.attention_checks && checksResponse.attention_checks.length > 0) {
          console.log("📍 [ATTENTION CHECKS] Timestamps:", checksResponse.attention_checks.map(c => `${c.timestamp}s`).join(', '));
          console.log("❓ [ATTENTION CHECKS] Questions & Answer Choices:");
          checksResponse.attention_checks.forEach((check, idx) => {
            console.log(`\n  ${idx + 1}. [${check.timestamp}s] ${check.question}`);
            console.log(`     A) ${check.choice_a} ${check.correct_choice === 'A' ? '✓' : ''}`);
            console.log(`     B) ${check.choice_b} ${check.correct_choice === 'B' ? '✓' : ''}`);
            console.log(`     C) ${check.choice_c} ${check.correct_choice === 'C' ? '✓' : ''}`);
            console.log(`     D) ${check.choice_d} ${check.correct_choice === 'D' ? '✓' : ''}`);
          });
        }
        console.log("\n🔔 [ATTENTION CHECKS] ═══════════════════════════════════\n");

        console.log("💾 [DATABASE SAVE] Saving attention checks to LiveSession...");
        await quest.entities.LiveSession.update(sessionId, {
          video_url: generatedContent.video.url,
          video_duration: durationSeconds,
          questions: generatedContent.questions || [],
          attention_checks: checksResponse.attention_checks || [],
          inquiry_content: {
            hook_image_url: generatedContent.inquiryContent.hook_image_url,
            hook_question: generatedContent.inquiryContent.hook_question,
            socratic_system_prompt: generatedContent.inquiryContent.socratic_system_prompt,
            tutor_first_message: generatedContent.inquiryContent.tutor_first_message
          }
        });
        console.log("✅ [DATABASE SAVE] LiveSession updated with", checksResponse.attention_checks?.length || 0, "attention checks");
        console.log("🔍 [DATABASE SAVE] Each check includes: question, choice_a, choice_b, choice_c, choice_d, correct_choice, timestamp, check_order");
        onVideoSelected();
        return;
      }
      
      // If in edit mode, update existing records instead of creating new ones
      if (isEditMode) {
        await handleUpdateExistingContent();
        return;
      }

      // Get video duration from YouTube API
      const { data: durationData } = await quest.functions.invoke('youtubeSearch', { action: "durations", videoIds: generatedContent.video.videoId });
      
      let durationSeconds = 120;
      if (durationData.items && durationData.items[0]) {
        const duration = durationData.items[0].contentDetails.duration;
        durationSeconds = parseYouTubeDuration(duration);
      }

      const savedVideo = await quest.entities.Video.create({
        subunit_id: subunit.id,
        video_url: generatedContent.video.url,
        video_transcript: generatedContent.video.transcript || "",
        duration_seconds: durationSeconds
      });

      // Generate attention checks (1 per minute) using backend function
      console.log("\n🔔 [ATTENTION CHECKS] ═══════════════════════════════════");
      console.log("🔔 [ATTENTION CHECKS] Starting attention check generation");
      console.log("🔔 [ATTENTION CHECKS] Video Duration:", durationSeconds, "seconds");
      console.log("🔔 [ATTENTION CHECKS] Transcript Length:", generatedContent.video.transcript?.length || 0, "characters");
      console.log("🔔 [ATTENTION CHECKS] Expected Checks:", Math.floor(durationSeconds / 60), "(1 per minute)");
      
      const { data: checksResponse } = await quest.functions.invoke('generateAttentionChecks', {
        transcript: generatedContent.video.transcript || "",
        videoDuration: durationSeconds
      });
      
      console.log("✅ [ATTENTION CHECKS] Generation complete!");
      console.log("📊 [ATTENTION CHECKS] Checks created:", checksResponse.attention_checks?.length || 0);
      if (checksResponse.attention_checks && checksResponse.attention_checks.length > 0) {
        console.log("📍 [ATTENTION CHECKS] Timestamps:", checksResponse.attention_checks.map(c => `${c.timestamp}s`).join(', '));
        console.log("❓ [ATTENTION CHECKS] Questions & Answer Choices:");
        checksResponse.attention_checks.forEach((check, idx) => {
          console.log(`\n  ${idx + 1}. [${check.timestamp}s] ${check.question}`);
          console.log(`     A) ${check.choice_a} ${check.correct_choice === 'A' ? '✓' : ''}`);
          console.log(`     B) ${check.choice_b} ${check.correct_choice === 'B' ? '✓' : ''}`);
          console.log(`     C) ${check.choice_c} ${check.correct_choice === 'C' ? '✓' : ''}`);
          console.log(`     D) ${check.choice_d} ${check.correct_choice === 'D' ? '✓' : ''}`);
        });
      }
      console.log("\n🔔 [ATTENTION CHECKS] ═══════════════════════════════════\n");
      
      // Save attention checks in parallel
      console.log("💾 [DATABASE SAVE] Saving", checksResponse.attention_checks?.length || 0, "attention checks to AttentionCheck entity...");
      const savedChecks = await Promise.all((checksResponse.attention_checks || []).map(check =>
        quest.entities.AttentionCheck.create({
          video_id: savedVideo.id,
          timestamp: check.timestamp,
          question: check.question,
          choice_a: check.choice_a,
          choice_b: check.choice_b,
          choice_c: check.choice_c,
          choice_d: check.choice_d,
          correct_choice: check.correct_choice,
          check_order: check.check_order
        })
      ));
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

      // Save inquiry session
      await quest.entities.InquirySession.create({
        subunit_id: subunit.id,
        video_id: savedVideo.id,
        hook_image_prompt: generatedContent.inquiryContent.hook_image_prompt,
        hook_image_url: generatedContent.inquiryContent.hook_image_url || "",
        hook_question: generatedContent.inquiryContent.hook_question,
        relevant_past_memories: generatedContent.inquiryContent.relevant_past_memories || [],
        socratic_system_prompt: generatedContent.inquiryContent.socratic_system_prompt,
        tutor_first_message: generatedContent.inquiryContent.tutor_first_message
      });

      // Save both quizzes in parallel
      const [newTopicQuiz, reviewQuiz] = await Promise.all([
        quest.entities.Quiz.create({ subunit_id: subunit.id, quiz_type: "new_topic" }),
        quest.entities.Quiz.create({ subunit_id: subunit.id, quiz_type: "review" })
      ]);

      // Create all questions in parallel
      await Promise.all(generatedContent.questions.flatMap(q => [
        quest.entities.Question.create({ quiz_id: newTopicQuiz.id, ...q }),
        quest.entities.Question.create({ quiz_id: reviewQuiz.id, ...q })
      ]));

      // Save case study
      if (generatedContent.caseStudy) {
        await quest.entities.CaseStudy.create({
          subunit_id: subunit.id,
          video_id: savedVideo.id,
          scenario: generatedContent.caseStudy.scenario,
          question_a: generatedContent.caseStudy.question_a,
          answer_a: generatedContent.caseStudy.answer_a || "",
          question_b: generatedContent.caseStudy.question_b,
          answer_b: generatedContent.caseStudy.answer_b || "",
          question_c: generatedContent.caseStudy.question_c,
          answer_c: generatedContent.caseStudy.answer_c || "",
          question_d: generatedContent.caseStudy.question_d,
          answer_d: generatedContent.caseStudy.answer_d || ""
        });
      }

      onVideoSelected();
      window.location.href = createPageUrl("TeacherCurricula");
    } catch (error) {
      showError("Save Failed", "Failed to save content. Please try again.");
      setProcessing(false);
    }
  };

  const parseYouTubeDuration = (duration) => {
    if (!duration) return 0;
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return hours * 3600 + minutes * 60 + seconds;
  };



  const handleUpdateExistingContent = async () => {
    try {
      // Update inquiry session
      if (generatedContent.inquiryContent) {
        const existingInquiry = await quest.entities.InquirySession.filter({ subunit_id: subunit.id });
        if (existingInquiry.length > 0) {
          await quest.entities.InquirySession.update(existingInquiry[0].id, {
            hook_image_prompt: generatedContent.inquiryContent.hook_image_prompt,
            hook_image_url: generatedContent.inquiryContent.hook_image_url || "",
            hook_question: generatedContent.inquiryContent.hook_question,
            socratic_system_prompt: generatedContent.inquiryContent.socratic_system_prompt,
            tutor_first_message: generatedContent.inquiryContent.tutor_first_message
          });
        }
      }

      // Update quiz questions efficiently
      if (generatedContent.questions) {
        const [existingQuiz, reviewQuiz] = await Promise.all([
          quest.entities.Quiz.filter({ subunit_id: subunit.id, quiz_type: "new_topic" }),
          quest.entities.Quiz.filter({ subunit_id: subunit.id, quiz_type: "review" })
        ]);
        
        if (existingQuiz.length > 0) {
          const [oldQuestions, oldReviewQuestions] = await Promise.all([
            quest.entities.Question.filter({ quiz_id: existingQuiz[0].id }),
            reviewQuiz.length > 0 ? quest.entities.Question.filter({ quiz_id: reviewQuiz[0].id }) : Promise.resolve([])
          ]);
          
          // Delete all old questions in parallel
          await Promise.all([
            ...oldQuestions.map(q => quest.entities.Question.delete(q.id)),
            ...oldReviewQuestions.map(q => quest.entities.Question.delete(q.id))
          ]);
          
          // Create all new questions in parallel
          const createPromises = generatedContent.questions.flatMap(q => [
            quest.entities.Question.create({ quiz_id: existingQuiz[0].id, ...q }),
            ...(reviewQuiz.length > 0 ? [quest.entities.Question.create({ quiz_id: reviewQuiz[0].id, ...q })] : [])
          ]);
          
          await Promise.all(createPromises);
        }
      }

      // Update case study
      if (generatedContent.caseStudy) {
        const existingCaseStudy = await quest.entities.CaseStudy.filter({ subunit_id: subunit.id });
        if (existingCaseStudy.length > 0) {
          await quest.entities.CaseStudy.update(existingCaseStudy[0].id, {
            scenario: generatedContent.caseStudy.scenario,
            question_a: generatedContent.caseStudy.question_a,
            answer_a: generatedContent.caseStudy.answer_a || "",
            question_b: generatedContent.caseStudy.question_b,
            answer_b: generatedContent.caseStudy.answer_b || "",
            question_c: generatedContent.caseStudy.question_c,
            answer_c: generatedContent.caseStudy.answer_c || "",
            question_d: generatedContent.caseStudy.question_d,
            answer_d: generatedContent.caseStudy.answer_d || ""
          });
        }
      }

      onVideoSelected();
      window.location.href = createPageUrl("TeacherCurricula");
    } catch (error) {
      showError("Update Failed", "Failed to update content. Please try again.");
      setProcessing(false);
    }
  };

  const handleRegenerateImage = async () => {
    setRegeneratingImage(true);
    try {
      const imageResult = await generateImage({
        prompt: generatedContent.inquiryContent.hook_image_prompt
      });
      
      setGeneratedContent({
        ...generatedContent,
        inquiryContent: {
          ...generatedContent.inquiryContent,
          hook_image_url: imageResult.url
        }
      });
    } catch (error) {
      showError("Regeneration Failed", "Failed to regenerate image. Please try again.");
    } finally {
      setRegeneratingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl" style={{ fontFamily: '"Inter", sans-serif' }}>
        <CardContent className="p-0">
          {/* Header */}
          <div className="sticky top-0 bg-blue-600 text-white p-6 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {step === "preview" && (
                  <button
                    onClick={() => setStep("search")}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 className="text-2xl font-bold">Quest Video Search</h2>
                  <p className="text-blue-100 text-sm">
                    {curriculumName ? `${curriculumName} — ${subunit.subunit_name}` : subunit.subunit_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (processing) {
                    if (confirm("Generation is in progress. Are you sure you want to close?")) {
                      onClose();
                    }
                  } else {
                    onClose();
                  }
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {step === "search" && (
              <>
                {!processing && (
                  <>
                    <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <LinkIcon className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">Add Custom YouTube Video</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">Paste a YouTube URL and Quest will analyze it for you</p>
                      <div className="flex gap-3">
                        <Input
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="flex-1"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddCustomVideo()}
                        />
                        <Button
                          onClick={handleAddCustomVideo}
                          disabled={!customUrl.trim() || loadingCustom}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {loadingCustom ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Analyze Video
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Play className="w-4 h-4" />
                        Or Choose from Quest Recommendations
                      </h3>
                    </div>
                  </>
                )}

                {processing ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Generating Learning Materials</h3>
                    <p className="text-gray-600 text-center max-w-md">
                      Quest is creating inquiry sessions, quiz questions, and reading materials...
                    </p>
                  </div>
                ) : loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                    <p className="text-gray-600 text-lg">Searching YouTube for educational videos...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {videos.map((video) => (
                      <Card key={video.videoId} className="border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all">
                        <CardContent className="p-5">
                          <div className="flex gap-5">
                            <div className="relative flex-shrink-0 group">
                              <img
                                src={video.thumbnail}
                                alt={video.title}
                                className="w-64 h-48 object-cover rounded-xl shadow-md"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                                <Play className="w-16 h-16 text-white drop-shadow-lg" />
                              </div>
                            </div>
                            
                            <div className="flex-1 flex flex-col">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-gray-900 text-lg line-clamp-2">{video.title}</h3>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                  {Math.floor(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, '0')}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-4 line-clamp-3 flex-1">{video.summary}</p>
                              
                              <Button
                                onClick={() => handleSelectVideo(video)}
                                disabled={processing}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg self-start"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Select & Generate Materials
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                </>
            )}

            {step === "preview" && generatedContent && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">Content Generated Successfully</h3>
                      <p className="text-sm text-gray-600">Review the materials below before approving</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-gray-700 ml-15">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span><strong>Inquiry session</strong> generated</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-indigo-600" />
                      <span><strong>{generatedContent.questions.length}</strong> questions ({generatedContent.questions.filter(q => q.difficulty === 'easy').length} easy, {generatedContent.questions.filter(q => q.difficulty === 'medium').length} medium, {generatedContent.questions.filter(q => q.difficulty === 'hard').length} hard)</span>
                    </div>
                    {!isLiveSession && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span><strong>Case study</strong> with 4 questions</span>
                      </div>
                    )}
                  </div>
                </div>

                <Tabs defaultValue="inquiry" className="w-full">
                  <TabsList className={`grid w-full ${isLiveSession ? 'grid-cols-4' : 'grid-cols-5'} bg-gray-100 p-1 rounded-lg`}>
                    <TabsTrigger value="inquiry" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Inquiry
                    </TabsTrigger>
                    <TabsTrigger value="video" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <Play className="w-4 h-4 mr-2" />
                      Video
                    </TabsTrigger>
                    <TabsTrigger value="transcript" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <FileText className="w-4 h-4 mr-2" />
                      Transcript
                    </TabsTrigger>
                    <TabsTrigger value="questions" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Quiz
                    </TabsTrigger>
                    {!isLiveSession && (
                      <TabsTrigger value="casestudy" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <FileText className="w-4 h-4 mr-2" />
                        Case Study
                      </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="inquiry" className="mt-6">
                      <Card className="border-2 border-indigo-100">
                        <CardContent className="p-6 space-y-6">
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-3 text-lg flex items-center justify-between">
                              <span>Generated Hook Image</span>
                              <Button
                                onClick={handleRegenerateImage}
                                disabled={regeneratingImage}
                                variant="outline"
                                size="sm"
                              >
                                {regeneratingImage ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Regenerating...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Regenerate Image
                                  </>
                                )}
                              </Button>
                            </h3>
                            {generatedContent.inquiryContent?.hook_image_url ? (
                            <div className="bg-gray-900 rounded-lg overflow-hidden">
                              <img 
                                src={generatedContent.inquiryContent.hook_image_url} 
                                alt="Hook Image"
                                className="w-full h-auto"
                              />
                            </div>
                          ) : (
                            <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-500">
                              No image generated
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 text-lg">Hook Image Prompt</h3>
                            <Button
                              onClick={() => setEditingInquiry({...editingInquiry, hook_image_prompt: !editingInquiry.hook_image_prompt})}
                              variant="outline"
                              size="sm"
                              className="border-gray-200"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              {editingInquiry.hook_image_prompt ? "Done" : "Edit"}
                            </Button>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mb-3">
                            <p className="text-sm text-blue-800">
                              <strong>Purpose:</strong> This image shows a familiar, everyday scenario that students have seen before. It's designed to spark curiosity by connecting to their existing knowledge - NOT to test what they don't know yet. The student will guess what's happening, then the Socratic tutor will guide them to discover the underlying concept.
                            </p>
                          </div>
                          {editingInquiry.hook_image_prompt ? (
                            <Textarea
                              value={generatedContent.inquiryContent.hook_image_prompt}
                              onChange={(e) => setGeneratedContent({
                                ...generatedContent,
                                inquiryContent: { ...generatedContent.inquiryContent, hook_image_prompt: e.target.value }
                              })}
                              className="min-h-[120px] border-2 border-blue-200"
                            />
                          ) : (
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <p className="text-gray-700">{generatedContent.inquiryContent.hook_image_prompt}</p>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 text-lg">Hook Question</h3>
                            <Button
                              onClick={() => setEditingInquiry({...editingInquiry, hook_question: !editingInquiry.hook_question})}
                              variant="outline"
                              size="sm"
                              className="border-gray-200"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              {editingInquiry.hook_question ? "Done" : "Edit"}
                            </Button>
                          </div>
                          {editingInquiry.hook_question ? (
                            <Input
                              value={generatedContent.inquiryContent.hook_question}
                              onChange={(e) => setGeneratedContent({
                                ...generatedContent,
                                inquiryContent: { ...generatedContent.inquiryContent, hook_question: e.target.value }
                              })}
                              className="border-2 border-indigo-200"
                            />
                          ) : (
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                              <p className="text-gray-900 font-medium text-lg">{generatedContent.inquiryContent.hook_question}</p>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 text-lg">Socratic System Prompt</h3>
                            <Button
                              onClick={() => setEditingInquiry({...editingInquiry, socratic_system_prompt: !editingInquiry.socratic_system_prompt})}
                              variant="outline"
                              size="sm"
                              className="border-gray-200"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              {editingInquiry.socratic_system_prompt ? "Done" : "Edit"}
                            </Button>
                          </div>
                          {editingInquiry.socratic_system_prompt ? (
                            <Textarea
                              value={generatedContent.inquiryContent.socratic_system_prompt}
                              onChange={(e) => setGeneratedContent({
                                ...generatedContent,
                                inquiryContent: { ...generatedContent.inquiryContent, socratic_system_prompt: e.target.value }
                              })}
                              className="min-h-[150px] border-2 border-gray-200"
                            />
                          ) : (
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <p className="text-gray-700 whitespace-pre-wrap">{generatedContent.inquiryContent.socratic_system_prompt}</p>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 text-lg">Tutor First Message</h3>
                            <Button
                              onClick={() => setEditingInquiry({...editingInquiry, tutor_first_message: !editingInquiry.tutor_first_message})}
                              variant="outline"
                              size="sm"
                              className="border-gray-200"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              {editingInquiry.tutor_first_message ? "Done" : "Edit"}
                            </Button>
                          </div>
                          {editingInquiry.tutor_first_message ? (
                            <Textarea
                              value={generatedContent.inquiryContent.tutor_first_message}
                              onChange={(e) => setGeneratedContent({
                                ...generatedContent,
                                inquiryContent: { ...generatedContent.inquiryContent, tutor_first_message: e.target.value }
                              })}
                              className="min-h-[100px] border-2 border-purple-200"
                            />
                          ) : (
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                              <p className="text-gray-900">{generatedContent.inquiryContent.tutor_first_message}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                <TabsContent value="questions" className="mt-6">
                    <QuestionEditor
                      questions={generatedContent.questions}
                      onChange={(updated) => setGeneratedContent({ ...generatedContent, questions: updated })}
                    />
                  </TabsContent>

                  {!isLiveSession && (
                    <TabsContent value="casestudy" className="mt-6">
                      <Card className="border-2 border-green-100">
                      <CardContent className="p-6 space-y-6">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 text-lg">Scenario</h3>
                            <Button
                              onClick={() => setEditingCaseStudy({...editingCaseStudy, scenario: !editingCaseStudy.scenario})}
                              variant="outline"
                              size="sm"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              {editingCaseStudy.scenario ? "Done" : "Edit"}
                            </Button>
                          </div>
                          {editingCaseStudy.scenario ? (
                            <Textarea
                              value={generatedContent.caseStudy?.scenario || ""}
                              onChange={(e) => setGeneratedContent({
                                ...generatedContent,
                                caseStudy: { ...generatedContent.caseStudy, scenario: e.target.value }
                              })}
                              className="min-h-[120px] border-2 border-green-200"
                            />
                          ) : (
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                              <p className="text-gray-700 whitespace-pre-wrap">{generatedContent.caseStudy?.scenario}</p>
                            </div>
                          )}
                        </div>

                        {['a', 'b', 'c', 'd'].map((letter) => (
                          <div key={letter} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-900 text-lg">Question ({letter})</h3>
                              <Button
                                onClick={() => setEditingCaseStudy({...editingCaseStudy, [`question_${letter}`]: !editingCaseStudy[`question_${letter}`]})}
                                variant="outline"
                                size="sm"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                {editingCaseStudy[`question_${letter}`] ? "Done" : "Edit"}
                              </Button>
                            </div>
                            {editingCaseStudy[`question_${letter}`] ? (
                              <Textarea
                                value={generatedContent.caseStudy?.[`question_${letter}`] || ""}
                                onChange={(e) => setGeneratedContent({
                                  ...generatedContent,
                                  caseStudy: { ...generatedContent.caseStudy, [`question_${letter}`]: e.target.value }
                                })}
                                className="min-h-[80px] border-2 border-green-200"
                              />
                            ) : (
                              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="text-gray-700">{generatedContent.caseStudy?.[`question_${letter}`]}</p>
                              </div>
                            )}

                            {/* Expected Answer */}
                            <div className="ml-4 border-l-4 border-green-300 pl-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-green-700">Expected Answer</span>
                                <Button
                                  onClick={() => setEditingCaseStudy({...editingCaseStudy, [`answer_${letter}`]: !editingCaseStudy[`answer_${letter}`]})}
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  {editingCaseStudy[`answer_${letter}`] ? "Done" : "Edit"}
                                </Button>
                              </div>
                              {editingCaseStudy[`answer_${letter}`] ? (
                                <Textarea
                                  value={generatedContent.caseStudy?.[`answer_${letter}`] || ""}
                                  onChange={(e) => setGeneratedContent({
                                    ...generatedContent,
                                    caseStudy: { ...generatedContent.caseStudy, [`answer_${letter}`]: e.target.value }
                                  })}
                                  className="min-h-[60px] border-2 border-green-200 text-sm"
                                />
                              ) : (
                                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                  <p className="text-sm text-green-800">{generatedContent.caseStudy?.[`answer_${letter}`] || "No expected answer provided"}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          ))}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  )}

                  <TabsContent value="video" className="mt-6">
                    <Card className="border-2 border-blue-100">
                      <CardContent className="p-6">
                        <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden mb-4">
                          <iframe
                            src={`https://www.youtube.com/embed/${generatedContent.video.videoId}`}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-2">{generatedContent.video.title}</h3>
                        <p className="text-gray-600 text-sm">{generatedContent.video.summary}</p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="transcript" className="mt-6">
                    <Card className="border-2 border-purple-100">
                      <CardContent className="p-6">
                        <h3 className="font-semibold text-gray-900 text-lg mb-4">Video Transcript</h3>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-[500px] overflow-y-auto">
                          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {generatedContent.video.transcript || "No transcript available"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={() => {
                      setStep("search");
                      setSelectedVideo(null);
                      setGeneratedContent(null);
                    }}
                    variant="outline"
                    className="flex-1 border-2"
                  >
                    Select Different Video
                  </Button>
                  <Button
                    onClick={handleApproveContent}
                    disabled={processing}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-lg py-6 font-semibold"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Finalizing Content...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Complete & Finalize Subunit
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <NotificationModal
        isOpen={notification.isOpen}
        onClose={closeNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
    </div>
  );
}