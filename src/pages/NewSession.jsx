import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { toast } from "sonner";
import { PASS_THRESHOLD, gradeLearnSession } from "@/lib/spacedRepetition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, CheckCircle, X } from "lucide-react";
import SocraticTutor from "../components/newSession/SocraticTutor";
import CaseStudyChat from "../components/newSession/CaseStudyChat";
import LofiMusicPlayer from "../components/shared/LofiMusicPlayer";
import AttentionCheckDisplay from "../components/shared/AttentionCheckDisplay";
import PandaChatWidget from "../components/shared/PandaChatWidget";
import MathRenderer from "@/components/utils/MathRenderer";
import { resolveTranscript } from "@/lib/transcript";
import SessionFeedbackModal from "../components/newSession/SessionFeedbackModal";
import SessionReview from "../components/student/SessionReview";
import { loadResume, saveResume, clearResume } from "@/lib/sessionResume";


export default function NewSession() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const skipInquiry = urlParams.get("skipInquiry") === "true";
  const [step, setStep] = useState(skipInquiry ? "video" : "inquiry");
  const [videoProgress, setVideoProgress] = useState(0);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);
  const [currentCheck, setCurrentCheck] = useState(null);
  const [selectedCheckAnswer, setSelectedCheckAnswer] = useState(null);
  const [showCheckFeedback, setShowCheckFeedback] = useState(false);
  const [checksCompleted, setChecksCompleted] = useState([]);
  const [canProceed, setCanProceed] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [results, setResults] = useState([]);
  const [termsChecked, setTermsChecked] = useState({});
  const [user, setUser] = useState(null);
  const [subunit, setSubunit] = useState(null);

  const [video, setVideo] = useState(null);
  const [article, setArticle] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [dbQuestions, setDbQuestions] = useState([]);
  const [attentionChecks, setAttentionChecks] = useState([]);
  const [inquirySession, setInquirySession] = useState(null);
  const [studentGuess, setStudentGuess] = useState("");
  const [showSocraticTutor, setShowSocraticTutor] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [sessionStartTime] = useState(new Date());
  const [lastKnownTime, setLastKnownTime] = useState(0);
  const [actualVideoDuration, setActualVideoDuration] = useState(null);
  const [showFailAlert, setShowFailAlert] = useState(false);
  const [failAlertMessage, setFailAlertMessage] = useState("");
  const [reflectionText, setReflectionText] = useState("");
  const [showExitModal, setShowExitModal] = useState(false);
  const [frqScore, setFrqScore] = useState(null);
  const [isQuestathonClass, setIsQuestathonClass] = useState(false);
  const [questathonClassId, setQuestathonClassId] = useState(null);
  const [pandaPointsEarned, setPandaPointsEarned] = useState(0);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const videoRef = useRef(null);

  const subunitId = urlParams.get("topic");

  useEffect(() => {
    loadData();
    
    // Load YouTube IFrame API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube API Ready");
      };
    }
  }, []);

  // Initialize YouTube player
  useEffect(() => {
    if (video?.video_url && step === "video" && !youtubePlayer) {
      const videoId = getYouTubeVideoId(video.video_url);
      if (!videoId) return;
      
      const initializePlayer = () => {
        const playerElement = document.getElementById('youtube-player');
        if (!playerElement) {
          setTimeout(initializePlayer, 100);
          return;
        }
        
        if (window.YT && window.YT.Player) {
          try {
            // Clear old player content if any
            playerElement.innerHTML = '';
            const player = new window.YT.Player('youtube-player', {
              height: '100%',
              width: '100%',
              videoId: videoId,
              playerVars: {
                // Native controls ON — exposes speed (1×/1.25×/1.5×/2×) and CC.
                // The interval below still snaps forward-seeks back, so anti-cheat holds.
                controls: 1,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                autoplay: 1,
                enablejsapi: 1,
                fs: 0,
                iv_load_policy: 3,
                cc_load_policy: 1, // captions on by default when a track is available
                hl: 'en',
              },
              events: {
                onReady: (event) => {
                  setYoutubePlayer(event.target);
                  const duration = event.target.getDuration();
                  if (duration) {
                    setActualVideoDuration(Math.floor(duration));
                  }
                  // Resume video playback at the saved position (if any).
                  try {
                    if (user?.id && subunitId) {
                      const resume = loadResume(user.id, subunitId, "new_topic");
                      if (resume?.videoTime && resume.videoTime > 5) {
                        event.target.seekTo(resume.videoTime, true);
                      }
                    }
                  } catch { /* ignore */ }
                  event.target.playVideo();
                  setIsVideoPlaying(true);
                },
                onStateChange: (event) => {
                  setIsVideoPlaying(event.data === 1); // 1 = playing, 2 = paused
                }
              }
            });
          } catch (err) {
            console.error("Failed to initialize YouTube player:", err);
          }
        } else {
          setTimeout(initializePlayer, 200);
        }
      };
      
      // If YT API already loaded, init immediately; otherwise wait
      if (window.YT && window.YT.Player) {
        setTimeout(initializePlayer, 300);
      } else {
        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevReady) prevReady();
          setTimeout(initializePlayer, 300);
        };
      }
    }
  }, [video, step, youtubePlayer]);

  const loadData = async () => {
    try {
      // Check if user is authenticated first
      const isAuthenticated = await quest.auth.isAuthenticated();
      if (!isAuthenticated) {
        console.log("⚠️ User not authenticated, redirecting to login...");
        quest.auth.redirectToLogin(window.location.pathname + window.location.search);
        return;
      }
      
      console.log("🔄 Loading session data for subunitId:", subunitId);
      const currentUser = await quest.auth.me();
      setUser(currentUser);
      console.log("✅ User loaded:", currentUser.id, currentUser.email);

      // Restore prior in-progress session for this subunit (step + video time)
      // so the student picks up where they left off after a refresh / timeout.
      //
      // Important: when the URL has ?skipInquiry=true (set by SocraticInquiry
      // after the student completes the inquiry flow on the separate page),
      // we must NOT let an older resume snapshot whose step is still
      // "inquiry" override that. Otherwise the student gets sent back to the
      // inquiry hook the moment they return to /NewSession — a no-progress
      // loop. In that case we upgrade the saved step to "video" so the
      // resume still honors any video-time / quiz progress they had.
      const resume = loadResume(currentUser.id, subunitId, "new_topic");
      if (resume && resume.step) {
        const restoredStep = skipInquiry && resume.step === "inquiry" ? "video" : resume.step;
        setStep(restoredStep);
        if (typeof resume.videoTime === "number" && resume.videoTime > 5) {
          setLastKnownTime(resume.videoTime);
          setVideoProgress(Math.floor(resume.videoTime));
        }
      }

      // Check if student is in a questathon class for this subunit
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
      } catch (e) {
        console.error("Failed to check questathon class:", e);
      }

      if (subunitId) {
        const subunitData = await quest.entities.Subunit.filter({ id: subunitId });
        console.log("📚 SUBUNIT QUERY RESULT:", JSON.stringify(subunitData, null, 2));
        if (subunitData.length > 0) {
          setSubunit(subunitData[0]);
          console.log("✅ Subunit SET:", subunitData[0].subunit_name);
        } else {
          console.error("❌ NO SUBUNIT FOUND for id:", subunitId);
        }

        const videoData = await quest.entities.Video.filter({ subunit_id: subunitId });
        console.log("🎥 VIDEO QUERY RESULT:", JSON.stringify(videoData, null, 2));
        if (videoData.length > 0) {
          setVideo(videoData[0]);
          console.log("✅ Video SET - ID:", videoData[0].id, "URL:", videoData[0].video_url);
          
          // Load attention checks for this video
          let checksData = await quest.entities.AttentionCheck.filter({ video_id: videoData[0].id }, "check_order");
          console.log("🔔 ATTENTION CHECKS RESULT:", JSON.stringify(checksData, null, 2));
          
          // Resolve transcript — may be a URL for large transcripts. The
          // helper handles fetch + error fallback consistently across the app.
          videoData[0] = {
            ...videoData[0],
            video_transcript: await resolveTranscript(videoData[0].video_transcript),
          };

          // Generate attention checks if none exist (using live session logic)
          if (checksData.length === 0) {
            console.log("\n🔔 [ATTENTION CHECKS] ═══════════════════════════════════");
            console.log("🔔 [ATTENTION CHECKS] No checks found - generating now");
            console.log("🔔 [ATTENTION CHECKS] Video Duration:", videoData[0].duration_seconds, "seconds");
            console.log("🔔 [ATTENTION CHECKS] Transcript Length:", videoData[0].video_transcript?.length || 0, "characters");
            console.log("🔔 [ATTENTION CHECKS] Expected Checks:", Math.floor(videoData[0].duration_seconds / 60), "(1 per minute)");
            
            const transcript = videoData[0].video_transcript || "";
            const durationSeconds = videoData[0].duration_seconds || 120;
            
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
            
            // Save attention checks to database
            console.log("💾 [DATABASE SAVE] Saving", checksResponse.attention_checks?.length || 0, "attention checks to AttentionCheck entity...");
            const savedChecks = await Promise.all((checksResponse.attention_checks || []).map(check =>
              quest.entities.AttentionCheck.create({
                video_id: videoData[0].id,
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
            checksData = checksResponse.attention_checks || [];
          }
          
          setAttentionChecks(checksData);
        } else {
          console.error("❌ NO VIDEO FOUND for subunit_id:", subunitId);
        }

        const articleData = await quest.entities.Article.filter({ subunit_id: subunitId });
        console.log("📄 ARTICLE QUERY RESULT:", JSON.stringify(articleData, null, 2));
        if (articleData.length > 0) {
          setArticle(articleData[0]);
        }

        const inquiryData = await quest.entities.InquirySession.filter({ subunit_id: subunitId });
        console.log("🔍 INQUIRY SESSION QUERY RESULT:", JSON.stringify(inquiryData, null, 2));
        if (inquiryData.length > 0) {
          setInquirySession(inquiryData[0]);
          console.log("✅ Inquiry SET - Hook:", inquiryData[0].hook_question?.substring(0, 50) + "...");
        } else {
          console.error("❌ NO INQUIRY SESSION FOUND for subunit_id:", subunitId);
        }

        const quizData = await quest.entities.Quiz.filter({ subunit_id: subunitId, quiz_type: "new_topic" });
        console.log("📝 QUIZ QUERY RESULT:", JSON.stringify(quizData, null, 2));
        if (quizData.length > 0) {
          setQuiz(quizData[0]);
          console.log("✅ Quiz SET - ID:", quizData[0].id);
          
          const questionsData = await quest.entities.Question.filter({ quiz_id: quizData[0].id }, "question_order");
          console.log("❓ QUESTIONS QUERY RESULT:", JSON.stringify(questionsData, null, 2));
          setDbQuestions(questionsData);
          console.log("✅ Questions SET - Count:", questionsData.length);
        } else {
          console.error("❌ NO QUIZ FOUND for subunit_id:", subunitId, "and quiz_type: new_topic");
        }
        
        console.log("\n📊 FINAL CONTENT AVAILABILITY SUMMARY:");
        console.log("  Video:", videoData.length > 0 ? "✅" : "❌ MISSING");
        console.log("  Inquiry:", inquiryData.length > 0 ? "✅" : "❌ MISSING");
        console.log("  Quiz:", quizData.length > 0 ? "✅" : "❌ MISSING");
      } else {
        console.error("❌ NO SUBUNIT ID in URL parameters");
      }
    } catch (err) {
      console.error("❌ CRITICAL ERROR loading data:", err);
      console.error("Error details:", err.message, err.stack);
    } finally {
      setLoading(false);
      console.log("🏁 Loading complete. State:", {
        hasVideo: !!video,
        hasInquiry: !!inquirySession,
        hasQuiz: !!quiz,
        questionsCount: dbQuestions.length
      });
    }
  };

  const topic = subunit?.subunit_name || "Topic";
  const [unitName, setUnitName] = useState("Unit");

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

  const videoTotalDuration = actualVideoDuration || video?.duration_seconds || 120;
  
  const getYouTubeVideoId = (url) => {
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
    
    return videoId;
  }; 
  


  const keyTerms = article?.text?.split('\n\n')[0]?.split('\n').filter(Boolean).slice(0, 5) || [
    `Key concept in ${topic}`,
    `Important principle`,
    `Core methodology`,
    `Application area`,
    `Related theory`
  ];

  const resources = [
    { title: `Understanding ${topic}`, type: "Article", url: "#" },
    { title: "Additional Reading", type: "Interactive", url: "#" },
    { title: "Practice Exercises", type: "Article", url: "#" }
  ];

  // Select 4 easy, 4 medium, 2 hard questions randomly
  const questions = useMemo(() => {
    if (dbQuestions.length === 0) return [];
    
    const easyQuestions = dbQuestions.filter(q => q.difficulty === 'easy');
    const mediumQuestions = dbQuestions.filter(q => q.difficulty === 'medium');
    const hardQuestions = dbQuestions.filter(q => q.difficulty === 'hard');
    
    // Randomly select questions
    const selectedEasy = easyQuestions.sort(() => Math.random() - 0.5).slice(0, 4);
    const selectedMedium = mediumQuestions.sort(() => Math.random() - 0.5).slice(0, 4);
    const selectedHard = hardQuestions.sort(() => Math.random() - 0.5).slice(0, 2);
    
    const selectedQuestions = [...selectedEasy, ...selectedMedium, ...selectedHard];
    
    return selectedQuestions.map(q => {
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
        difficulty: q.difficulty,
        bonusQuestion: `Explain in detail the concept tested in this question about ${topic}. In your answer, provide specific examples, discuss real-world applications, explain the underlying principles, and describe how this relates to other concepts in the subject. Provide comprehensive reasoning for at least 100 words.`
      };
    });
  }, [dbQuestions]);

  const progress = 
    step === "inquiry" ? 25 :
    step === "video" ? 25 + (canProceed ? 25 : (videoProgress / videoTotalDuration) * 25) : 
    step === "quiz" ? 50 + (currentQuestion / questions.length) * 25 : 
    step === "article" ? 75 :
    100;

  // Persist `step` to localStorage whenever it changes so a refresh resumes
  // mid-session. The "results" step is terminal (post-quiz screen) — clear the
  // snapshot there so a refresh / Retry restarts the session from the top
  // rather than dropping back onto the results screen.
  useEffect(() => {
    if (!user?.id || !subunitId || !step) return;
    if (step === "results" || step === "done") {
      try { clearResume(user.id, subunitId, "new_topic"); } catch { /* ignore */ }
    } else {
      saveResume(user.id, subunitId, "new_topic", { step, videoTime: lastKnownTime });
    }
  }, [step, user?.id, subunitId, lastKnownTime]);

  // Watch progress + attention checks. We let YouTube's native controls drive
  // play/pause/scrub; we only step in to (a) hold the video paused while a
  // check is open and (b) stop the student from skipping PAST an unanswered
  // check (snap back to it). Scrubbing anywhere before the next check is fine.
  useEffect(() => {
    if (step !== "video" || !youtubePlayer) return;
    const interval = setInterval(() => {
      if (!youtubePlayer || typeof youtubePlayer.getCurrentTime !== "function") return;
      const playerState = typeof youtubePlayer.getPlayerState === "function" ? youtubePlayer.getPlayerState() : -1;
      const currentTime = youtubePlayer.getCurrentTime();

      // Keep the video paused while a check is open.
      if (currentCheck) {
        if (playerState === 1) youtubePlayer.pauseVideo();
        return;
      }

      // Block skipping past an unanswered check: if playback or a scrub
      // reaches/passes it, pause, snap back to the check, and open it.
      if (attentionChecks && attentionChecks.length > 0) {
        const nextCheck = attentionChecks[currentCheckIndex];
        if (nextCheck && !checksCompleted.includes(currentCheckIndex) && currentTime >= nextCheck.timestamp - 0.3) {
          youtubePlayer.pauseVideo();
          if (currentTime > nextCheck.timestamp + 0.75) youtubePlayer.seekTo(nextCheck.timestamp, true);
          setCurrentCheck(nextCheck);
          setSelectedCheckAnswer(null);
          setShowCheckFeedback(false);
          return;
        }
      }

      setVideoProgress(Math.floor(currentTime));
      setLastKnownTime(currentTime);
      try {
        if (user?.id && subunitId) saveResume(user.id, subunitId, "new_topic", { step, videoTime: currentTime });
      } catch { /* ignore */ }

      const totalChecks = attentionChecks?.length || 0;
      if (currentTime >= videoTotalDuration - 2 && checksCompleted.length === totalChecks) {
        setCanProceed(true);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [step, currentCheckIndex, checksCompleted, currentCheck, youtubePlayer, videoTotalDuration, attentionChecks, user?.id, subunitId]);

  // Pause when the student leaves the page (switches tab / minimizes).
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

    try {
      const isCorrect = selectedCheckAnswer === currentCheck.correct_choice;

      console.log("\n" + "-".repeat(80));
      console.log("📝 ATTENTION CHECK RESPONSE SUBMITTED");
      console.log("-".repeat(80));
      console.log(`👤 Student: ${user?.id}`);
      console.log(`❓ Check #${currentCheckIndex + 1}/${attentionChecks.length}`);
      console.log(`📌 Selected: ${selectedCheckAnswer}`);
      console.log(`✓ Correct: ${currentCheck.correct_choice}`);
      console.log(`🎯 Result: ${isCorrect ? "✅ CORRECT" : "❌ INCORRECT"}`);
      console.log("-".repeat(80) + "\n");

      // Save to database
      await quest.entities.AttentionCheckResponse.create({
        student_id: user.id,
        attention_check_id: currentCheck.id,
        video_id: video.id,
        subunit_id: subunitId,
        selected_choice: selectedCheckAnswer,
        is_correct: isCorrect,
        session_type: "new_topic",
        timestamp: new Date().toISOString()
      });

      console.log("✅ Attention check response saved to database");

      // Wait 2 seconds to show feedback, then resume video
      setTimeout(() => {
        setChecksCompleted(prev => [...prev, currentCheckIndex]);
        setCurrentCheck(null);
        setSelectedCheckAnswer(null);
        setShowCheckFeedback(false);
        setCurrentCheckIndex(currentCheckIndex + 1);
        
        // Resume video playback
        if (youtubePlayer) {
          youtubePlayer.playVideo();
        }
      }, 2000);
    } catch (err) {
      console.error("❌ Submission Error:", err);
      setShowCheckFeedback(false);
    }
  };

  const handleVideoComplete = () => {
    setStep("quiz");
  };

  const handleGuessSubmit = () => {
    // Navigate to separate Socratic page without requiring initial guess
    navigate(createPageUrl("SocraticInquiry") + `?topic=${subunitId}`);
  };

  const handleSocraticComplete = async (conversationHistory) => {
    // Save inquiry response
    if (user && inquirySession && studentGuess) {
      try {
        await quest.entities.InquiryResponse.create({
          student_id: user.id,
          subunit_id: subunitId,
          inquiry_session_id: inquirySession.id,
          initial_guess: studentGuess,
          conversation_history: conversationHistory || []
        });
      } catch (err) {
        console.error("Failed to save inquiry response:", err);
      }
    }
    // Don't auto-advance, let the component show continue button
  };

  const handleQuizComplete = () => {
    setStep("article");
  };

  const handleArticleComplete = async (frqScoreFromChat) => {
    if (frqScoreFromChat !== undefined) {
      setFrqScore(frqScoreFromChat);
    }
    setStep("results");
  };

  const handleAnswerSubmit = async () => {
    const correct = selectedAnswer === questions[currentQuestion].correctIndex;
    setResults([...results, { correct, selectedChoice: selectedAnswer }]);
    
    // Save question response. Store the actual text the student saw — choices
    // are shuffled per attempt (so the index can't be resolved later) and the
    // displayed question (`questions[currentQuestion]`) is a selected/shuffled
    // entry, not `dbQuestions[currentQuestion]`.
    if (user && quiz && questions[currentQuestion]) {
      const q = questions[currentQuestion];
      try {
        await quest.entities.QuestionResponse.create({
          student_id: user.id,
          quiz_id: quiz.id,
          question_id: q.id,
          selected_choice: selectedAnswer + 1,
          is_correct: correct,
          session_type: "new_topic",
          subunit_id: subunitId,
          question_text: q.question,
          selected_choice_text: q.options?.[selectedAnswer] ?? "",
          correct_choice_text: q.options?.[q.correctIndex] ?? "",
        });
      } catch (err) {
        console.error("Failed to save question response:", err);
      }
    }
    
    // Move to next question or complete quiz
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      handleQuizComplete();
    }
  };

  const toggleTerm = (index) => {
    setTermsChecked({ ...termsChecked, [index]: !termsChecked[index] });
  };

  const mcCorrect = results.filter(r => r.correct).length;
  const totalScore = mcCorrect;
  const termsComplete = Object.values(termsChecked).filter(Boolean).length;
  const correctAnswers = totalScore;
  
  // Calculate final score including FRQ (FRQ is out of 4, weighted as 40% of total)
  const mcPercent = questions.length > 0 ? (mcCorrect / questions.length) * 100 : 0;
  const frqPercent = frqScore !== null ? (frqScore / 4) * 100 : 0;
  // Final score: 60% MC + 40% FRQ
  const finalScore = frqScore !== null ? Math.round(mcPercent * 0.6 + frqPercent * 0.4) : Math.round(mcPercent);

  // Post-score review: page through every quiz question (right + wrong) with
  // its explanation before leaving — skipped if every MC answer was correct.
  const quizReviewItems = results.map((r, i) => {
    const q = questions[i] || {};
    return {
      question: q.question,
      picked: q.options?.[r.selectedChoice] ?? "—",
      correct: q.options?.[q.correctIndex] ?? "—",
      isCorrect: !!r.correct,
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
      const sessionEndTime = new Date();
      const totalTimeSeconds = Math.floor((sessionEndTime - sessionStartTime) / 1000);
      const scorePercent = finalScore;
      const learn = gradeLearnSession(finalScore);
      const isCompleted = learn.passed;
      const nextReviewDate = learn.nextReviewDate;

      // Save quiz result
      if (quiz) {
        await quest.entities.QuizResult.create({
          student_id: user.id,
          quiz_id: quiz.id,
          score: scorePercent,
          correct_answers: totalScore,
          total_questions: questions.length,
          completed_at: sessionEndTime.toISOString()
        });
      }

      // One learn-session row per subunit — update on a redo so the teacher
      // view shows the latest grade instead of stacking attempts.
      const learnRow = {
        student_id: user.id,
        subunit_id: subunitId,
        session_type: "new_topic",
        start_time: sessionStartTime.toISOString(),
        end_time: sessionEndTime.toISOString(),
        total_time_seconds: totalTimeSeconds,
        completed: isCompleted,
        review_number: 0,
        score: scorePercent
      };
      const existingLearnSessions = await quest.entities.LearningSession.filter({
        student_id: user.id, subunit_id: subunitId, session_type: "new_topic"
      });
      const isRedo = existingLearnSessions.length > 0;
      if (isRedo) {
        await quest.entities.LearningSession.update(existingLearnSessions[0].id, learnRow);
        // Remove any duplicate learn rows left by older attempts.
        for (const extra of existingLearnSessions.slice(1)) {
          try { await quest.entities.LearningSession.delete(extra.id); } catch { /* ignore */ }
        }
        // Redoing the learn session restarts spaced repetition — clear the old
        // cycle's review grades so the teacher view shows a clean restart.
        try {
          const oldReviews = await quest.entities.LearningSession.filter({
            student_id: user.id, subunit_id: subunitId, session_type: "review"
          });
          for (const rev of oldReviews) {
            await quest.entities.LearningSession.delete(rev.id);
          }
        } catch { /* ignore */ }
      } else {
        await quest.entities.LearningSession.create(learnRow);
      }

      // Update or create student progress
      const existingProgress = await quest.entities.StudentProgress.filter({ 
        student_id: user.id, 
        subunit_id: subunitId 
      });

      const progressData = {
        new_session_completed: isCompleted,
        new_session_score: scorePercent,
        learned_status: false,
        last_review_date: isCompleted ? sessionEndTime.toISOString() : null,
        next_review_date: isCompleted ? nextReviewDate.toISOString() : null,
        review_count: 0,
        urgency_status: learn.urgency
      };

      if (existingProgress.length > 0) {
        await quest.entities.StudentProgress.update(existingProgress[0].id, progressData);
      } else {
        await quest.entities.StudentProgress.create({
          student_id: user.id,
          subunit_id: subunitId,
          ...progressData
        });
      }

      // Panda Points + referral awards removed.
      if (isCompleted) {
        // Session done — clear any resume snapshot so they don't get bounced
        // back into the middle of a completed session.
        try { clearResume(user.id, subunitId, "new_topic"); } catch { /* ignore */ }
      }

      // Navigate and force refresh
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
    console.log("⚠️ CONTENT NOT AVAILABLE - Missing required materials:");
    console.log("  Video:", video ? "✅" : "❌ MISSING");
    console.log("  Inquiry Session:", inquirySession ? "✅" : "❌ MISSING");
    console.log("  Quiz:", quiz ? "✅" : "❌ MISSING");
    console.log("  Questions:", dbQuestions.length > 0 ? `✅ (${dbQuestions.length})` : "❌ MISSING");
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Content Not Available</h2>
            <p className="text-gray-600 mb-4">This topic doesn't have learning materials yet.</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left text-sm">
              <p className="font-semibold mb-2">Missing:</p>
              <ul className="space-y-1">
                {!video && <li className="text-red-600">• Video</li>}
                {!inquirySession && <li className="text-red-600">• Inquiry Session</li>}
                {!quiz && <li className="text-red-600">• Quiz</li>}
                {dbQuestions.length === 0 && <li className="text-red-600">• Questions</li>}
              </ul>
            </div>
            <Button onClick={() => navigate(createPageUrl("LearningHub"))} className="bg-blue-600 hover:bg-blue-700">
              Return to Learning Hub
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ask-Panda chat — mounted at the root so the conversation persists
          across the inquiry → video → quiz → case study phases. */}
      <PandaChatWidget
        topic={topic}
        phase={step}
        currentPrompt={
          step === "quiz" && questions[currentQuestion]
            ? `Question: ${questions[currentQuestion].question}\nOptions: ${(questions[currentQuestion].options || []).join(" | ")}\nCorrect answer: ${questions[currentQuestion].options?.[questions[currentQuestion].correctIndex] ?? ""}`
            : null
        }
      />
      {/* Clean white background */}
      <div className="fixed inset-0 bg-white"></div>
      
      <LofiMusicPlayer />

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {showFailAlert && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Needs More Detail</h3>
            </div>
            <p className="text-gray-700 mb-6 whitespace-pre-line">{failAlertMessage}</p>
            <Button
              onClick={() => setShowFailAlert(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
            >
              Continue Learning
            </Button>
          </div>
        </div>
      )}

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

      <div className="max-w-4xl mx-auto relative z-10 py-8" style={{fontFamily: '"Inter", sans-serif', fontWeight: 450}}>
        <div className="flex items-center justify-between mb-6 px-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowExitModal(true)} 
              className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-[#1A1A1A]"
            >
              Exit
            </button>
            <div>
              <h1 className="text-xl font-semibold text-[#1A1A1A]">{unitName}</h1>
              <p className="text-sm text-[#1A1A1A]/60">{topic}</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-[#3B82F6]/20 rounded-full">
            <span className="text-sm font-medium text-[#1A1A1A]">New Topic</span>
          </div>
        </div>

        <div className="mb-6 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#1A1A1A]/60">Phase {step === "inquiry" ? "1" : step === "video" ? "2" : step === "quiz" ? "3" : step === "article" ? "4" : "5"} of 5</span>
            <span className="text-sm font-medium text-[#1A1A1A]">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-[#C4B5FD]/20 rounded-full overflow-hidden">
            <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        {step === "video" && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-0">
              <div className="p-6 border-b border-[#C4B5FD]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Play className="w-6 h-6 text-[#2563EB]" />
                    <div>
                      <h2 className="text-xl font-semibold text-[#1A1A1A]">Introduction to {topic}</h2>
                      <p className="text-sm text-[#1A1A1A]/60" style={{fontWeight: 450}}>Interactive Learning Video • {Math.floor(videoTotalDuration / 60)}:{String(Math.floor(videoTotalDuration % 60)).padStart(2, '0')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative bg-black aspect-video">
                {getYouTubeVideoId(video?.video_url) ? (
                  <>
                    {/* Native YouTube controls only — no custom overlay. */}
                    <div id="youtube-player" className="w-full h-full"></div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Play className="w-10 h-10 text-white" />
                      </div>
                      <p className="text-white text-lg font-medium">Loading Video: {topic}</p>
                      <p className="text-white/70 text-sm">Progress: {Math.floor(videoProgress)}s / {videoTotalDuration}s</p>
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
                  <p className="text-xs text-[#1A1A1A]/70" style={{fontWeight: 450}}>Watch completely and answer all attention checks to proceed</p>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={() => setShowExitModal(true)}
                    variant="outline"
                    className="px-6 py-3 rounded-full"
                  >
                    Exit
                  </Button>
                  <Button 
                    onClick={handleVideoComplete} 
                    disabled={!canProceed}
                    className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-3 disabled:opacity-50 font-semibold rounded-full"
                  >
                    {canProceed ? "Continue to Quiz" : "Complete video to continue"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "inquiry" && inquirySession && !showSocraticTutor && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px] mx-4">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-[#1A1A1A] mb-6">Let's Think About This...</h2>
              
              {inquirySession.hook_image_url && (
                <div className="mb-6 rounded-2xl overflow-hidden bg-white border-2 border-gray-200">
                  <img 
                    src={inquirySession.hook_image_url} 
                    alt="Hook Image"
                    onLoad={() => setImageLoaded(true)}
                    className="w-full h-auto"
                  />
                </div>
              )}

              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 mb-6">
                <p className="text-lg font-semibold text-[#1A1A1A]">
                  <MathRenderer text={inquirySession.hook_question} />
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleGuessSubmit}
                  disabled={!imageLoaded}
                  className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full"
                >
                  Start Discussion with Panda 🐼
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "inquiry" && showSocraticTutor && inquirySession && (
          <SocraticTutor
            inquirySession={inquirySession}
            studentGuess={studentGuess}
            subunit={subunit}
            unitName={unitName}
            onComplete={(conversationHistory) => {
              handleSocraticComplete(conversationHistory);
              setStep("video");
            }}
            user={user}
          />
        )}

        {step === "article" && (
          <CaseStudyChat
            subunitName={topic}
            subunitId={subunitId}
            studentId={user?.id}
            onComplete={(score) => handleArticleComplete(score)}
          />
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

              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-6">
                <MathRenderer text={questions[currentQuestion].question} />
              </h3>

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
                  <span className="text-sm text-[#1A1A1A]" style={{fontWeight: 450}}>
                    <MathRenderer text={option.replace(/\.$/, '')} />
                  </span>
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



        {step === "results" && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                {finalScore >= PASS_THRESHOLD ? (
                  <CheckCircle className="w-6 h-6 text-[#3B82F6]" />
                ) : (
                  <X className="w-6 h-6 text-red-500" />
                )}
                <h2 className="text-xl font-semibold text-[#1A1A1A]">
                  {finalScore >= PASS_THRESHOLD ? "Session Complete" : "Session Incomplete"}
                </h2>
              </div>

              <div className="text-center mb-8">
                <p className="text-6xl font-bold text-[#1A1A1A] mb-2">{finalScore}%</p>
                <p className="text-sm text-[#1A1A1A]/70" style={{fontWeight: 450}}>
                  {finalScore >= PASS_THRESHOLD
                    ? "Great job! Your first review is scheduled for tomorrow"
                    : "You need 80% or higher to pass. Please redo the lesson."}
                </p>
                <div className="mt-4 h-2 bg-[#C4B5FD]/20 rounded-full overflow-hidden max-w-md mx-auto">
                  <div className={`h-full rounded-full ${finalScore >= PASS_THRESHOLD ? 'bg-[#3B82F6]' : 'bg-red-500'}`} style={{ width: `${finalScore}%` }}></div>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="bg-gray-50 rounded-[20px] p-6 mb-6 space-y-4">
                <h3 className="font-semibold text-[#1A1A1A] mb-4">Score Breakdown</h3>
                
                {/* Multiple Choice */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#1A1A1A]">Multiple Choice</p>
                    <p className="text-sm text-[#1A1A1A]/60">{mcCorrect} of {questions.length} correct</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${mcPercent >= PASS_THRESHOLD ? 'text-[#3B82F6]' : 'text-red-500'}`}>
                      {Math.round(mcPercent)}%
                    </p>
                    <p className="text-xs text-[#1A1A1A]/50">60% weight</p>
                  </div>
                </div>

                {/* Case Study FRQ */}
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <div>
                    <p className="font-medium text-[#1A1A1A]">Case Study (FRQ)</p>
                    <p className="text-sm text-[#1A1A1A]/60">4 questions graded</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${frqScore !== null && frqScore >= 2.8 ? 'text-[#3B82F6]' : frqScore !== null ? 'text-orange-500' : 'text-gray-400'}`}>
                      {frqScore !== null ? `${frqScore}/4` : '—'}
                    </p>
                    <p className="text-xs text-[#1A1A1A]/50">40% weight</p>
                  </div>
                </div>

                {/* Divider and Total */}
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
                <div className="border-t border-gray-100 pt-6">
                  <SessionReview
                    quizItems={quizReviewItems}
                    completeLabel="Done reviewing"
                    onComplete={() => setReviewDone(true)}
                  />
                </div>
              ) : finalScore >= PASS_THRESHOLD ? (
                <Button onClick={() => setShowFeedbackModal(true)} className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full">
                  Return to Learning Hub
                </Button>
              ) : (
                <div className="space-y-3">
                  <Button onClick={() => {
                    // Drop any saved resume snapshot so a refresh restarts the
                    // session from the inquiry/video step, not the results screen.
                    try { if (user?.id && subunitId) clearResume(user.id, subunitId, "new_topic"); } catch { /* ignore */ }
                    window.location.reload();
                  }} className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full">
                    Retry Lesson
                  </Button>
                  <Button onClick={() => { setShowFeedbackModal(true); }} variant="outline" className="w-full rounded-full">
                    Exit to Learning Hub
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Only show feedback for new_topic sessions */}
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
        onDone={(earnedPoints) => {
          setShowFeedbackModal(false);
          handleCompleteSession();
        }}
      />
    </div>
  );
}