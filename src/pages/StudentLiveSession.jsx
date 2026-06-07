import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Users, 
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  RefreshCw
} from "lucide-react";
import LofiMusicPlayer from "../components/shared/LofiMusicPlayer";
import NotificationModal from "../components/shared/NotificationModal";
import AttentionCheckDisplay from "../components/shared/AttentionCheckDisplay";
import { useNotification } from "../components/shared/useNotification";
import MathRenderer from "@/components/utils/MathRenderer";
import { loadResume, saveResume, clearResume } from "@/lib/sessionResume";

export default function StudentLiveSession() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Join state
  const [sessionCode, setSessionCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);
  
  // Session state
  const [session, setSession] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [allParticipants, setAllParticipants] = useState([]);
  const [phase, setPhase] = useState("join"); // join, waiting, inquiry, video, quiz, completed
  
  // Inquiry state
  const [viewedHook, setViewedHook] = useState(false);
  
  // Video state
  const [videoProgress, setVideoProgress] = useState(0);
  const [canProceed, setCanProceed] = useState(false);
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [lastKnownTime, setLastKnownTime] = useState(0);
  const [actualVideoDuration, setActualVideoDuration] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);
  const [currentCheck, setCurrentCheck] = useState(null);
  const [selectedCheckAnswer, setSelectedCheckAnswer] = useState(null);
  const [showCheckFeedback, setShowCheckFeedback] = useState(false);
  const [checksCompleted, setChecksCompleted] = useState([]);
  
  // Quiz state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [results, setResults] = useState([]);
  const { notification, showError, showWarning, closeNotification } = useNotification();

  useEffect(() => {
    loadUserAndCheckRejoin();
    
    // Load YouTube IFrame API
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

  useEffect(() => {
    if (session && participant && phase !== "join") {
      const interval = setInterval(() => {
        loadSessionUpdates();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [session, participant, phase]);

  // Initialize YouTube player
  useEffect(() => {
    if (session?.video_url && phase === "video" && !youtubePlayer) {
      const videoId = getYouTubeVideoId(session.video_url);
      if (!videoId) return;
      
      const initializePlayer = () => {
        const playerElement = document.getElementById('youtube-player');
        if (!playerElement) {
          setTimeout(initializePlayer, 100);
          return;
        }
        
        if (window.YT && window.YT.Player) {
          try {
            const player = new window.YT.Player('youtube-player', {
              height: '100%',
              width: '100%',
              videoId: videoId,
              playerVars: {
                // Native controls ON — exposes speed and CC.
                controls: 1,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                autoplay: 1,
                enablejsapi: 1,
                fs: 0,
                iv_load_policy: 3,
                cc_load_policy: 1,
                hl: 'en',
              },
              events: {
                onReady: (event) => {
                  setYoutubePlayer(event.target);
                  const duration = event.target.getDuration();
                  if (duration) {
                    setActualVideoDuration(Math.floor(duration));
                  }
                  // Resume from saved video position if the student refreshed.
                  try {
                    if (user?.id && session?.id) {
                      const r = loadResume(user.id, session.id, "live");
                      if (r?.videoTime && r.videoTime > 5) event.target.seekTo(r.videoTime, true);
                    }
                  } catch { /* ignore */ }
                  event.target.playVideo();
                  setIsVideoPlaying(true);
                },
                onStateChange: (event) => {
                  setIsVideoPlaying(event.data === 1);
                  if (event.data === 0) {
                    handleVideoComplete();
                  }
                }
              }
            });
          } catch (err) {
            showError("Video Error", "Failed to load video player. Please refresh the page.");
          }
        } else {
          setTimeout(initializePlayer, 200);
        }
      };
      
      setTimeout(initializePlayer, 500);
    }
  }, [session, phase, youtubePlayer]);

  // Track video progress and attention checks
  useEffect(() => {
    if (phase === "video" && youtubePlayer) {
      const interval = setInterval(() => {
        if (youtubePlayer && typeof youtubePlayer.getCurrentTime === 'function' && typeof youtubePlayer.getPlayerState === 'function') {
          const playerState = youtubePlayer.getPlayerState();
          const currentTime = youtubePlayer.getCurrentTime();
          
          // If there's an active check, keep video paused
          if (currentCheck) {
            if (playerState === 1) {
              youtubePlayer.pauseVideo();
            }
            return;
          }
          
          // Check if user tried to seek forward
          if (currentTime > lastKnownTime + 1.5) {
            youtubePlayer.seekTo(lastKnownTime, true);
            return;
          }
          
          // Only update progress if video is playing (playerState === 1)
          if (playerState === 1) {
            setVideoProgress(Math.floor(currentTime));
            setLastKnownTime(currentTime);
            // Persist resume state every tick (cheap localStorage write).
            try {
              if (user?.id && session?.id) {
                saveResume(user.id, session.id, "live", { videoTime: currentTime });
              }
            } catch { /* ignore */ }

            // Check if we need to show an attention check
              if (session?.attention_checks && session.attention_checks.length > 0) {
                const nextCheck = session.attention_checks[currentCheckIndex];
                // Trigger when within ±1 second of exact timestamp
                if (nextCheck && Math.abs(currentTime - nextCheck.timestamp) <= 1 && !checksCompleted.includes(currentCheckIndex)) {
                  console.log("Triggering attention check at:", currentTime, "Target:", nextCheck.timestamp);
                  youtubePlayer.pauseVideo();
                  setCurrentCheck(nextCheck);
                  setSelectedCheckAnswer(null);
                  setShowCheckFeedback(false);
                  return;
                }
              }
            
            // Video complete - require all checks AND completion
            const videoDuration = actualVideoDuration || session?.video_duration || 120;
            const totalChecks = session?.attention_checks?.length || 0;
            if (currentTime >= videoDuration - 2 && checksCompleted.length === totalChecks) {
              setCanProceed(true);
              clearInterval(interval);
            }
          }
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, [phase, currentCheckIndex, checksCompleted, canProceed, currentCheck, youtubePlayer, actualVideoDuration, lastKnownTime, session]);

  const getYouTubeVideoId = (url) => {
    if (!url) return null;
    let videoId = null;
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('watch?v=')[1]?.split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('youtube.com/embed/')) {
      videoId = url.split('embed/')[1]?.split('?')[0];
    }
    return videoId;
  };

  const loadUserAndCheckRejoin = async () => {
    try {
      const currentUser = await quest.auth.me();
      setUser(currentUser);
      setDisplayName(currentUser.full_name || "");
      
      // Check for rejoin after user is loaded
      const urlParams = new URLSearchParams(window.location.search);
      const rejoined = urlParams.get("rejoined");
      const code = urlParams.get("code");
      
      if (rejoined === "true" && code) {
        setSessionCode(code);
        await handleAutoRejoin(code, currentUser);
      }
    } catch (err) {
      showError("Error Loading", "Failed to load user data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoRejoin = async (code, currentUser) => {
    try {
      const sessions = await quest.entities.LiveSession.filter({ 
        session_code: code.toUpperCase() 
      });
      
      if (sessions.length === 0) return;

      const sessionData = sessions[0];
      setSession(sessionData);

      // Find existing participant
      const participants = await quest.entities.LiveSessionParticipant.filter({ 
        session_code: code.toUpperCase() 
      });
      
      let myParticipant = participants.find(p => p.student_id === currentUser?.id);
      
      if (myParticipant) {
        // Update existing participant to video phase
        await quest.entities.LiveSessionParticipant.update(myParticipant.id, {
          current_phase: "video"
        });
        setParticipant(myParticipant);
      }

      setPhase("video");
    } catch (err) {
      console.error("Failed to rejoin session:", err);
    }
  };

  const loadSessionUpdates = async () => {
    if (!session || !participant) return;
    
    try {
      const [sessionData, participantData, allParts] = await Promise.all([
        quest.entities.LiveSession.filter({ session_code: session.session_code }),
        quest.entities.LiveSessionParticipant.filter({ id: participant.id }),
        quest.entities.LiveSessionParticipant.filter({ session_code: session.session_code })
      ]);
      
      if (sessionData.length === 0) {
        showWarning("Session Ended", "The teacher has ended this session.");
        setTimeout(() => navigate(createPageUrl("LearningHub")), 2000);
        return;
      }
      
      const updatedSession = sessionData[0];
      setSession(updatedSession);
      
      if (participantData.length > 0) {
        setParticipant(participantData[0]);
      }
      
      setAllParticipants(allParts.sort((a, b) => b.score - a.score));
      
      if (updatedSession.status === "active" && phase === "waiting") {
        setPhase("inquiry");
      }
    } catch (err) {
      // Silent fail for polling
    }
  };

  const handleJoinSession = async () => {
    if (!sessionCode.trim() || !displayName.trim()) {
      showWarning("Missing Information", "Please enter both session code and display name.");
      return;
    }

    setJoining(true);
    try {
      const sessions = await quest.entities.LiveSession.filter({ 
        session_code: sessionCode.toUpperCase().trim() 
      });
      
      if (sessions.length === 0) {
        setSessionCode("");
        setJoining(false);
        return;
      }

      const sessionData = sessions[0];
      setSession(sessionData);

      const newParticipant = await quest.entities.LiveSessionParticipant.create({
        session_code: sessionData.session_code,
        student_id: user?.id || null,
        display_name: displayName,
        score: 0,
        current_phase: "waiting",
        current_question: 0
      });

      setParticipant(newParticipant);
      
      if (sessionData.status === "active") {
        setPhase("inquiry");
      } else {
        setPhase("waiting");
      }
    } catch (err) {
      showError("Join Failed", "Failed to join session. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleCheckSubmit = async () => {
    if (!selectedCheckAnswer || !currentCheck) return;
    setShowCheckFeedback(true);

    try {
      const isCorrect = selectedCheckAnswer === currentCheck.correct_choice;
      const points = isCorrect ? 5 : 2;
      const newScore = participant.score + points;
      
      await quest.entities.LiveSessionParticipant.update(participant.id, { 
        score: newScore 
      });
      setParticipant({ ...participant, score: newScore });
      
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
      showError("Submission Error", "Failed to submit attention check.");
      setShowCheckFeedback(false);
    }
  };

  const handleProceedToSocratic = async () => {
    // Update participant phase before navigating
    await quest.entities.LiveSessionParticipant.update(participant.id, {
      current_phase: "inquiry"
    });
    navigate(createPageUrl("SocraticInquiry") + `?live=true&code=${session.session_code}`);
  };

  const handleVideoComplete = async () => {
    // Update participant phase
    await quest.entities.LiveSessionParticipant.update(participant.id, {
      current_phase: "quiz"
    });
    setPhase("quiz");
  };

  // Tutor-friendly mode: when the session has 5 or fewer participants we
  // assume a 1-on-1 or small-group tutoring context and skip the 1.5s
  // auto-advance — the student (or tutor sitting next to them) taps "Discuss
  // & continue" when they're ready, giving room to talk through the answer.
  const liveMode =
    allParticipants.length <= 1
      ? "one_on_one"
      : allParticipants.length <= 5
      ? "small_group"
      : "classroom";
  const manualAdvance = liveMode !== "classroom";

  const advanceToNext = () => {
    setShowFeedback(false);
    setSelectedAnswer(null);
    if (currentQuestion < session.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleQuizComplete();
    }
  };

  const handleAnswerSubmit = async () => {
    if (selectedAnswer === null) return;

    const question = session.questions[currentQuestion];
    const isCorrect = selectedAnswer === question.correct_choice - 1;

    setResults([...results, { correct: isCorrect }]);
    setShowFeedback(true);

    // Save response to LiveSessionResponse for teacher analytics
    await quest.entities.LiveSessionResponse.create({
      session_code: session.session_code,
      participant_id: participant.id,
      question_id: question.id,
      selected_choice: selectedAnswer + 1,
      is_correct: isCorrect
    });

    if (isCorrect) {
      const newScore = participant.score + 10;
      await quest.entities.LiveSessionParticipant.update(participant.id, {
        score: newScore
      });
      setParticipant({ ...participant, score: newScore });
    }

    if (!manualAdvance) {
      setTimeout(advanceToNext, 1500);
    }
  };

  const handleQuizComplete = async () => {
    await quest.entities.LiveSessionParticipant.update(participant.id, { 
      current_phase: "completed" 
    });
    try { if (user?.id && session?.id) clearResume(user.id, session.id, "live"); } catch { /* ignore */ }
    setPhase("completed");
  };



  const videoTotalDuration = actualVideoDuration || session?.video_duration || 120;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (phase === "join") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="p-8 space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Join Live Session</h2>
              <p className="text-gray-600">Enter the code provided by your teacher</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Code
              </label>
              <Input
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-character code"
                maxLength={6}
                className="text-center text-2xl font-bold tracking-widest uppercase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
                className="text-lg"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => navigate(createPageUrl("LearningHub"))}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleJoinSession}
                disabled={joining || !sessionCode.trim() || !displayName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-lg py-6 rounded-full"
              >
                {joining ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join Session"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-0 shadow-xl">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-blue-600 animate-pulse" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Waiting for teacher to start...</h2>
            <p className="text-xl text-gray-600 mb-8">{session.session_name}</p>
            
            <div className="inline-flex items-center gap-3 bg-blue-50 px-8 py-4 rounded-full mb-8">
              <Users className="w-6 h-6 text-blue-600" />
              <span className="text-3xl font-bold text-blue-600">{allParticipants.length}</span>
              <span className="text-gray-600">participants</span>
            </div>

            {allParticipants.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">In the room:</h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {allParticipants.map(p => (
                    <Badge key={p.id} variant="outline" className="text-sm">
                      {p.display_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-white"></div>
      
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
            <p className="text-gray-700 mb-6">Are you sure you want to exit? The teacher will be notified.</p>
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
              <h1 className="text-xl font-semibold text-[#1A1A1A]">{session?.session_name}</h1>
              <p className="text-sm text-[#1A1A1A]/60">{session?.subunit_name}</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-[#3B82F6]/20 rounded-full">
            <span className="text-sm font-medium text-[#1A1A1A]">Live Session</span>
          </div>
        </div>

        <div className="mb-6 px-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#1A1A1A]/60">
                Phase {phase === "inquiry" ? "1" : phase === "video" ? "2" : phase === "quiz" ? "3" : "4"} of 4
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-[#1A1A1A]">
                Score: {participant?.score || 0}
              </span>
              <span className="text-sm font-medium text-purple-600">
                Rank: #{allParticipants.findIndex(p => p.id === participant?.id) + 1}
              </span>
            </div>
          </div>
          <div className="h-2 bg-[#C4B5FD]/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#3B82F6] rounded-full transition-all duration-300" 
              style={{ 
                width: phase === "inquiry" ? "25%" :
                       phase === "video" ? "50%" : 
                       phase === "quiz" ? "75%" : "100%" 
              }}
            ></div>
          </div>
        </div>

        {phase === "inquiry" && session?.inquiry_content && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px] mx-4">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-[#1A1A1A] mb-6">Let's Think About This...</h2>
              
              {session.inquiry_content.hook_image_url && (
                <div className="mb-6 rounded-2xl overflow-hidden bg-white border-2 border-gray-200">
                  <img 
                    src={session.inquiry_content.hook_image_url} 
                    alt="Hook Image"
                    className="w-full h-auto"
                  />
                </div>
              )}

              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 mb-6">
                <p className="text-lg font-semibold text-[#1A1A1A]">
                  <MathRenderer text={session.inquiry_content.hook_question} />
                </p>
              </div>

              <Button
                onClick={handleProceedToSocratic}
                className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full"
              >
                Start Discussion with Panda 🐼
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "video" && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-0">
              <div className="p-6 border-b border-[#C4B5FD]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Play className="w-6 h-6 text-[#2563EB]" />
                    <div>
                      <h2 className="text-xl font-semibold text-[#1A1A1A]">{session.subunit_name}</h2>
                      <p className="text-sm text-[#1A1A1A]/60" style={{fontWeight: 450}}>Interactive Learning Video • {Math.floor(videoTotalDuration / 60)}:{String(Math.floor(videoTotalDuration % 60)).padStart(2, '0')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative bg-black aspect-video">
                <div id="youtube-player" className="w-full h-full"></div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (youtubePlayer) {
                            if (isVideoPlaying) {
                              youtubePlayer.pauseVideo();
                            } else {
                              youtubePlayer.playVideo();
                            }
                          }
                        }}
                        className="text-white hover:text-gray-300 transition-colors pointer-events-auto p-1"
                      >
                        {isVideoPlaying ? (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <span className="text-white text-xs">
                        {Math.floor(videoProgress / 60)}:{String(Math.floor(videoProgress % 60)).padStart(2, '0')} / {Math.floor(videoTotalDuration / 60)}:{String(Math.floor(videoTotalDuration % 60)).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                  <div className="h-1 bg-white/30 rounded-full overflow-hidden pointer-events-none">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${(videoProgress / videoTotalDuration) * 100}%` }}></div>
                  </div>
                </div>
                <div className="absolute inset-0 pointer-events-auto" style={{cursor: 'default'}}></div>
              </div>

              <div className="p-6">
               <AttentionCheckDisplay
                 currentCheck={currentCheck}
                 currentCheckIndex={currentCheckIndex}
                 totalChecks={session?.attention_checks?.length || 0}
                 selectedCheckAnswer={selectedCheckAnswer}
                 showCheckFeedback={showCheckFeedback}
                 onAnswerSelect={setSelectedCheckAnswer}
                 onSubmit={handleCheckSubmit}
               />

                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-[#1A1A1A]">Progress: {Math.floor((videoProgress / videoTotalDuration) * 100)}%</span>
                  <span className="text-sm text-[#1A1A1A]/60">Checks: {checksCompleted.length}/{session?.attention_checks?.length || 0}</span>
                </div>

                <div className="bg-[#2563EB]/5 border border-[#2563EB]/20 rounded-[20px] p-4 mb-4">
                  <p className="text-sm text-[#1A1A1A] font-medium mb-1">Active Learning Required</p>
                  <p className="text-xs text-[#1A1A1A]/70" style={{fontWeight: 450}}>Watch completely and answer all attention checks (+5 pts correct, +2 pts attempt)</p>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={handleVideoComplete} 
                    disabled={!canProceed}
                    className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 disabled:opacity-50 font-semibold rounded-full"
                  >
                    {canProceed ? "Continue to Quiz" : "Complete video to continue"}
                  </Button>
                  <Button 
                    onClick={() => {
                      const password = prompt("Enter admin password to skip:");
                      if (password === "admin") {
                        setVideoProgress(videoTotalDuration);
                        setLastKnownTime(videoTotalDuration);
                        setChecksCompleted(session?.attention_checks?.map((_, i) => i) || []);
                        setCanProceed(true);
                        if (youtubePlayer) {
                          youtubePlayer.seekTo(videoTotalDuration - 1, true);
                          youtubePlayer.pauseVideo();
                        }
                      }
                    }}
                    variant="outline"
                    className="px-6 py-3 text-xs rounded-full"
                  >
                    Admin Skip
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "quiz" && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2563EB]/10 flex items-center justify-center">
                    <span className="text-[#2563EB] font-semibold">{currentQuestion + 1}</span>
                  </div>
                  <span className="text-sm font-medium text-[#1A1A1A]">Question {currentQuestion + 1} of {session.questions.length}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-[#1A1A1A]/60">Score</p>
                    <p className="text-2xl font-bold text-blue-600">{participant.score}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#1A1A1A]/60">Rank</p>
                    <p className="text-2xl font-bold text-purple-600">
                      #{allParticipants.findIndex(p => p.id === participant.id) + 1}
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-6">
                <MathRenderer text={session.questions[currentQuestion].question_text} />
              </h3>

              <div className="space-y-3 mb-6">
                {[1, 2, 3, 4].map((num) => {
                  const question = session.questions[currentQuestion];
                  const isSelected = selectedAnswer === num - 1;
                  const isCorrect = num === question.correct_choice;
                  
                  return (
                    <button
                      key={num}
                      onClick={() => !showFeedback && setSelectedAnswer(num - 1)}
                      disabled={showFeedback}
                      className={`w-full p-4 text-left border-2 rounded-[20px] transition-all ${
                        isSelected && showFeedback
                          ? isCorrect
                            ? 'border-green-500 bg-green-50'
                            : 'border-red-500 bg-red-50'
                          : isSelected
                          ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                          : showFeedback && isCorrect
                          ? 'border-green-500 bg-green-50'
                          : 'border-[#C4B5FD]/30 hover:border-[#C4B5FD]/50 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          isSelected && showFeedback
                            ? isCorrect
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                            : isSelected
                            ? 'bg-blue-600 text-white'
                            : showFeedback && isCorrect
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {String.fromCharCode(64 + num)}
                        </div>
                        <span className="text-sm text-[#1A1A1A] flex-1" style={{fontWeight: 450}}>
                          <MathRenderer text={question[`choice_${num}`]} />
                        </span>
                        {showFeedback && isCorrect && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                        {showFeedback && isSelected && !isCorrect && (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {!showFeedback && (
                <Button
                  onClick={handleAnswerSubmit}
                  disabled={selectedAnswer === null}
                  className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white py-5 font-semibold rounded-full"
                >
                  Submit Answer (+10 pts if correct)
                </Button>
              )}
              {showFeedback && manualAdvance && (
                <Button
                  onClick={advanceToNext}
                  className="w-full bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white py-5 font-semibold rounded-full"
                >
                  {currentQuestion < session.questions.length - 1
                    ? "Discuss & continue"
                    : "Finish"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}



        {phase === "completed" && (
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-[32px]">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Trophy className="w-6 h-6 text-[#3B82F6]" />
                <h2 className="text-xl font-semibold text-[#1A1A1A]">Session Complete!</h2>
              </div>

              <div className="text-center mb-8">
                <p className="text-6xl font-bold text-[#1A1A1A] mb-2">{participant.score}</p>
                <p className="text-sm text-[#1A1A1A]/70" style={{fontWeight: 450}}>
                  Final Score
                </p>
                <div className="mt-4 inline-flex items-center gap-2 bg-purple-50 px-6 py-3 rounded-full">
                  <Trophy className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-purple-600">
                    Rank #{allParticipants.findIndex(p => p.id === participant.id) + 1}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-[20px] p-6 mb-6">
                <h3 className="font-semibold text-[#1A1A1A] mb-4">Live Leaderboard</h3>
                <div className="space-y-2">
                  {allParticipants.slice(0, 5).map((p, index) => (
                    <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg ${
                      p.id === participant.id ? 'bg-blue-100' : 'bg-white'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-400 text-white' :
                        index === 1 ? 'bg-gray-300 text-white' :
                        index === 2 ? 'bg-orange-400 text-white' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="flex-1 font-medium">{p.display_name}</span>
                      <span className="font-bold text-blue-600">{p.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-[20px] p-4 text-center">
                <p className="text-sm text-gray-700">
                  Waiting for teacher to end session...
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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