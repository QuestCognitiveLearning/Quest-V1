import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TeacherLayout from "../components/teacher/TeacherLayout";
import { 
  Video, 
  Users, 
  Play, 
  Square, 
  Loader2, 
  Copy, 
  CheckCircle,
  AlertCircle,
  Trophy,
  TrendingUp,
  Eye
} from "lucide-react";
import NotificationModal from "../components/shared/NotificationModal";
import { useNotification } from "../components/shared/useNotification";
import { LLM_MODELS } from "@/lib/llmModels";

export default function TeacherLiveSession() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Session creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [subunitName, setSubunitName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [questionDifficulty, setQuestionDifficulty] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(10);
  
  // Active session state
  const [activeSession, setActiveSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [responses, setResponses] = useState([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [lastErrorTime, setLastErrorTime] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { notification, showError, showSuccess, showWarning, closeNotification } = useNotification();

  useEffect(() => {
    loadTeacher();
  }, []);

  useEffect(() => {
    if (activeSession) {
      const interval = setInterval(() => {
        loadSessionData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeSession]);

  const loadTeacher = async () => {
    try {
      const user = await quest.auth.me();
      setTeacher(user);
      
      // Check if teacher has an active session. The custom-sdk's filter
      // turns array values into Postgres .in() — Mongo-style {$in:[…]}
      // is silently treated as eq() and matches nothing. Pass an array
      // directly so a session-just-launched (status='waiting') is found.
      const sessions = await quest.entities.LiveSession.filter({
        teacher_id: user.id,
        status: ["waiting", "active"],
      });

      if (sessions.length > 0) {
        // Prefer the most recently created session if there are multiples.
        const latest = sessions.sort(
          (a, b) =>
            new Date(b.created_date || 0).getTime() -
            new Date(a.created_date || 0).getTime()
        )[0];
        setActiveSession(latest);
        setSessionStarted(latest.status === "active");
        await loadSessionData();
      }
    } catch (err) {
      showError("Error Loading", "Failed to load teacher data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const loadSessionData = async () => {
    if (!activeSession || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const [parts, resps] = await Promise.all([
        // live_session_participants / live_session_responses key by
        // live_session_id (the FK), not session_code (which only lives on
        // live_sessions). Filtering by session_code returned PGRST42703
        // 'column does not exist' and the leaderboard never populated.
        quest.entities.LiveSessionParticipant.filter({ live_session_id: activeSession.id }),
        quest.entities.LiveSessionResponse.filter({ live_session_id: activeSession.id }),
      ]);
      
      setParticipants(parts.sort((a, b) => b.score - a.score));
      setResponses(resps);
    } catch (err) {
      const now = Date.now();
      if (now - lastErrorTime > 10000) {
        showError("Error", "Failed to load session data. You can still end the session.");
        setLastErrorTime(now);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const generateSessionCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
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

  const parseYouTubeDuration = (duration) => {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return hours * 3600 + minutes * 60 + seconds;
  };

  const handleCreateSession = async () => {
    if (!sessionName || !subunitName || !videoUrl) {
      showWarning("Missing Information", "Please fill in all fields to create a session.");
      return;
    }

    setGenerating(true);
    try {
      const videoId = extractYouTubeVideoId(videoUrl);
      if (!videoId) {
        showError("Invalid URL", "Please enter a valid YouTube URL.");
        setGenerating(false);
        return;
      }

      // Get video duration via the backend (API key is server-side + rate-limited).
      const durationResponse = await quest.functions.invoke('youtubeSearch', {
        action: 'durations',
        videoIds: videoId,
      });
      const durationData = durationResponse.data || {};
      let durationSeconds = 600;
      if (durationData.items && durationData.items[0]) {
        durationSeconds = parseYouTubeDuration(durationData.items[0].contentDetails.duration);
      }

      // Fetch transcript
      const transcriptResponse = await quest.functions.invoke('fetchTranscript', { videoId });
      const transcript = transcriptResponse.data?.transcript || "";

      // Generate content with AI
      const difficultyInstructions = questionDifficulty === "easy" 
        ? `All ${questionCount} questions should be EASY difficulty (basic recall and understanding).`
        : questionDifficulty === "medium"
        ? `All ${questionCount} questions should be MEDIUM difficulty (application and analysis).`
        : questionDifficulty === "hard"
        ? `All ${questionCount} questions should be HARD difficulty (synthesis, evaluation, complex scenarios).`
        : questionCount === 10
        ? `Create 4 EASY, 4 MEDIUM, and 2 HARD questions.`
        : questionCount === 20
        ? `Create 8 EASY, 8 MEDIUM, and 4 HARD questions.`
        : `Create 12 EASY, 12 MEDIUM, and 6 HARD questions.`;

      const [questionsData, attentionChecksData, caseStudyData, inquiryData] = await Promise.all([
        quest.integrations.Core.InvokeLLM({
          model: LLM_MODELS.QUIZ_GENERATION,
          prompt: `Create ${questionCount} multiple-choice quiz questions for a live learning session about "${subunitName}".

${difficultyInstructions}

EASY questions: Direct recall of facts, basic conceptual understanding, simple identification
MEDIUM questions: Application to new situations, comparison/contrast, cause-and-effect
HARD questions: Multi-step reasoning, evaluation/justification, complex real-world applications

Return JSON with this structure:
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
      "difficulty": "${questionDifficulty === 'mixed' ? 'easy or medium or hard as appropriate' : questionDifficulty}"
    }
  ]
}

Make questions engaging and suitable for a competitive live session.`,
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
                    difficulty: { type: "string" }
                  }
                }
              }
            }
          }
        }),
        
        quest.integrations.Core.InvokeLLM({
          model: LLM_MODELS.ATTENTION_CHECKS,
          prompt: `Generate multiple-choice attention check questions for a ${durationSeconds} second video about "${subunitName}".

VIDEO TRANSCRIPT:
${transcript}

Instructions:
1. Place ONE attention check approximately every 60 seconds of video (so a 10-min video = ~10 checks)
2. Start first check around 60 seconds, then space them evenly throughout
3. Make each question specific to what's discussed at that timestamp in the transcript
4. Each question must test comprehension of key concepts mentioned at that moment
5. Questions should be literal recall or direct comprehension of what was just explained
6. Provide 4 multiple-choice options with exactly one correct answer

Example: If at 65 seconds the transcript discusses "photosynthesis converts sunlight to glucose", ask:
"What does photosynthesis convert?" with options like "sunlight to glucose", "glucose to sunlight", etc.

Return JSON with timestamps and complete multiple-choice questions:
{
  "checks": [
    {
      "timestamp": 65,
      "question": "What is being explained right now?",
      "choice_a": "Option 1",
      "choice_b": "Option 2",
      "choice_c": "Option 3",
      "choice_d": "Option 4",
      "correct_choice": "A"
    }
  ]
}`,
          response_json_schema: {
            type: "object",
            properties: {
              checks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timestamp: { type: "number" },
                    question: { type: "string" },
                    choice_a: { type: "string" },
                    choice_b: { type: "string" },
                    choice_c: { type: "string" },
                    choice_d: { type: "string" },
                    correct_choice: { type: "string" }
                  }
                }
              }
            }
          }
        }),
        
        quest.integrations.Core.InvokeLLM({
          model: LLM_MODELS.CASE_STUDY_GENERATION,
          prompt: `Create a case study scenario with one free-response question for "${subunitName}".

Return JSON:
{
  "scenario": "A realistic scenario description...",
  "question": "A thought-provoking question about the scenario..."
}`,
          response_json_schema: {
            type: "object",
            properties: {
              scenario: { type: "string" },
              question: { type: "string" }
            }
          }
        }),
        
        quest.integrations.Core.InvokeLLM({
          model: LLM_MODELS.INQUIRY_CONTENT,
          prompt: `Create an inquiry-based learning introduction for "${subunitName}".

This is the FIRST step before students watch the video. The goal is to spark curiosity and activate prior knowledge.

Generate:
1. A DALL-E 3 prompt for a curiosity-inducing image (no text in image)
2. A hook question that makes students wonder about the topic
3. A Socratic tutor system prompt that guides students through inquiry
4. The tutor's first welcoming message

Return JSON:
{
  "hook_image_prompt": "Detailed DALL-E 3 prompt for an engaging image...",
  "hook_question": "What do you think causes...?",
  "socratic_system_prompt": "You are a Socratic tutor helping students explore ${subunitName}. Guide them with questions, never give direct answers...",
  "tutor_first_message": "Welcome! Let's think about this together..."
}`,
          response_json_schema: {
            type: "object",
            properties: {
              hook_image_prompt: { type: "string" },
              hook_question: { type: "string" },
              socratic_system_prompt: { type: "string" },
              tutor_first_message: { type: "string" }
            }
          }
        })
      ]);

      const sessionCode = generateSessionCode();
      
      // Ensure each question has a unique ID
      const questionsWithIds = (questionsData.questions || []).map((q, index) => ({
        ...q,
        id: q.id || `q${index + 1}`
      }));
      
      // Generate hook image
      const hookImageResult = await quest.integrations.Core.GenerateImage({
        prompt: inquiryData.hook_image_prompt
      });
      
      const session = await quest.entities.LiveSession.create({
        teacher_id: teacher.id,
        session_code: sessionCode,
        session_name: sessionName,
        subunit_name: subunitName,
        subunit_id: null, // For live sessions, no specific curriculum subunit
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
        video_duration: durationSeconds,
        status: "waiting",
        questions: questionsWithIds,
        attention_checks: attentionChecksData.checks || [],
        case_study: caseStudyData,
        inquiry_content: {
          hook_image_url: hookImageResult.url,
          hook_question: inquiryData.hook_question,
          socratic_system_prompt: inquiryData.socratic_system_prompt,
          tutor_first_message: inquiryData.tutor_first_message
        }
      });

      setActiveSession(session);
      setShowCreateModal(false);
      setSessionName("");
      setSubunitName("");
      setVideoUrl("");
      showSuccess("Session Created", "Your live session is ready! Share the code with students.");
    } catch (err) {
      showError("Creation Failed", "Failed to create session. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleStartSession = async () => {
    try {
      await quest.entities.LiveSession.update(activeSession.id, { status: "active" });
      setSessionStarted(true);
      setActiveSession({ ...activeSession, status: "active" });
      showSuccess("Session Started", "Students can now proceed with the learning activities!");
    } catch (err) {
      showError("Start Failed", "Failed to start session. Please try again.");
    }
  };

  const handleEndSession = async () => {
    try {
      // Delete all session data
      await Promise.all([
        quest.entities.LiveSession.delete(activeSession.id),
        ...participants.map(p => quest.entities.LiveSessionParticipant.delete(p.id)),
        ...responses.map(r => quest.entities.LiveSessionResponse.delete(r.id))
      ]);

      setActiveSession(null);
      setParticipants([]);
      setResponses([]);
      setSessionStarted(false);
      showSuccess("Session Ended", "The session has been ended and all data has been cleared.");
    } catch (err) {
      showError("End Failed", "Failed to end session. Please try again.");
    }
  };

  const copySessionCode = () => {
    navigator.clipboard.writeText(activeSession.session_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const getQuestionStats = () => {
    if (!activeSession || !activeSession.questions) return [];
    
    return activeSession.questions.map(q => {
      const questionResponses = responses.filter(r => r.question_id === q.id);
      const correctCount = questionResponses.filter(r => r.is_correct).length;
      const totalCount = questionResponses.length;
      const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
      
      return {
        ...q,
        totalResponses: totalCount,
        correctResponses: correctCount,
        accuracy: accuracy,
        needsReview: totalCount >= participants.length / 2 && accuracy < 70
      };
    });
  };

  const handleSignOut = () => {
    quest.auth.logout();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <TeacherLayout activeNav="live" user={teacher} onSignOut={handleSignOut}>
      <div className="max-w-7xl mx-auto p-8">
        {!activeSession ? (
        // No Active Session - Show Create Button
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Video className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Live Sessions</h1>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Create engaging live learning experiences for your students with real-time leaderboards and instant feedback.
          </p>
          <Button
            onClick={() => navigate(createPageUrl("CreateLiveSession"))}
            className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6"
          >
            <Play className="w-5 h-5 mr-2" />
            Create Live Session
          </Button>
        </div>
        ) : !sessionStarted ? (
          // Waiting Room
          <div className="max-w-3xl mx-auto">
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <CardTitle className="text-2xl">Waiting Room</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">{activeSession.session_name}</h2>
                  <p className="text-gray-600">{activeSession.subunit_name}</p>
                </div>

                <div className="bg-gray-900 rounded-2xl p-8 mb-8">
                  <p className="text-sm text-gray-400 text-center mb-2">Session Code</p>
                  <div className="flex items-center justify-center gap-4">
                    <h1 className="text-6xl font-bold text-white tracking-widest">{activeSession.session_code}</h1>
                    <Button
                      onClick={copySessionCode}
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                    >
                      {codeCopied ? <CheckCircle className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                    </Button>
                  </div>
                </div>

                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-3 bg-blue-50 px-6 py-3 rounded-full">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-2xl font-bold text-blue-600">{participants.length}</span>
                    <span className="text-gray-600">participants joined</span>
                  </div>
                </div>

                {participants.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-semibold text-gray-900 mb-3">Participants:</h3>
                    <div className="flex flex-wrap gap-2">
                      {participants.map(p => (
                        <Badge key={p.id} variant="outline" className="text-sm">
                          {p.display_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={handleStartSession}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-lg py-6"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Session
                  </Button>
                  <Button
                    onClick={() => setShowEndSessionModal(true)}
                    variant="outline"
                    className="px-6 border-2 border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Active Session - Dashboard
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{activeSession.session_name}</h1>
                <p className="text-gray-600">{activeSession.subunit_name}</p>
              </div>
              <Button
                onClick={handleEndSession}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Square className="w-4 h-4 mr-2" />
                End Session
              </Button>
            </div>

            {(() => {
              // Live-mode layout adapts to session size so tutors with one or
              // a few learners don't feel like they're staring at a classroom
              // leaderboard.
              //   1 participant  → one_on_one — analytics fills the row, no leaderboard
              //   2-5 participants → small_group — compact "mini" leaderboard
              //   6+ participants → classroom — full leaderboard alongside analytics
              const liveMode =
                participants.length <= 1
                  ? "one_on_one"
                  : participants.length <= 5
                  ? "small_group"
                  : "classroom";
              const showLeaderboard = liveMode !== "one_on_one";
              const compact = liveMode === "small_group";
              return (
            <div className={showLeaderboard ? "grid md:grid-cols-2 gap-6 mb-8" : "mb-8"}>
              {/* Leaderboard — hidden in one_on_one mode so the single learner
                  isn't ranked against themselves. */}
              {showLeaderboard && (
              <Card className="border-2 border-indigo-200">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    Live Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {participants.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p>Waiting for participants...</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {participants.map((p, index) => (
                        <div key={p.id} className={`${compact ? "p-2.5" : "p-4"} flex items-center gap-4 ${index < 3 && !compact ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : ''}`}>
                          <div className={`${compact ? "w-7 h-7 text-xs" : "w-10 h-10"} rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-400 text-yellow-900' :
                            index === 1 ? 'bg-gray-300 text-gray-700' :
                            index === 2 ? 'bg-orange-400 text-orange-900' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className={`font-semibold text-gray-900 ${compact ? "text-sm" : ""}`}>{p.display_name}</p>
                            {!compact && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                p.current_phase === "completed" ? "bg-green-100 text-green-700 border-green-300" :
                                p.current_phase === "quiz" ? "bg-purple-100 text-purple-700 border-purple-300" :
                                p.current_phase === "video" ? "bg-blue-100 text-blue-700 border-blue-300" :
                                p.current_phase === "inquiry" ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
                                "bg-gray-100 text-gray-600 border-gray-300"
                              }`}
                            >
                              {p.current_phase === "completed" ? "✓ Completed" :
                               p.current_phase === "quiz" ? "Quiz" :
                               p.current_phase === "video" ? "Watching Video" :
                               p.current_phase === "inquiry" ? "Inquiry" :
                               "Waiting"}
                            </Badge>
                            )}
                          </div>
                          <div className={`${compact ? "text-lg" : "text-2xl"} font-bold text-blue-600`}>
                            {p.score}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              )}

              {/* Question Analytics */}
              <Card className="border-2 border-blue-200">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Question Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 max-h-[500px] overflow-y-auto">
                  {getQuestionStats().map((stat, index) => (
                    <div key={stat.id} className={`mb-4 p-4 rounded-lg border-2 ${
                      stat.needsReview ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900 flex-1">
                          Q{index + 1}: {stat.question_text}
                        </p>
                        {stat.needsReview && (
                          <Badge className="bg-red-600 text-white ml-2">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Review
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${stat.accuracy >= 70 ? 'bg-green-500' : stat.accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${stat.accuracy}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${stat.accuracy >= 70 ? 'text-green-600' : stat.accuracy >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {stat.accuracy.toFixed(0)}%
                          </p>
                          <p className="text-xs text-gray-600">{stat.totalResponses}/{participants.length}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getQuestionStats().length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Eye className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p>No responses yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
              );
            })()}


          </div>
        )}

        {showCreateModal && teacher?.subscription_tier === "premium" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <CardTitle className="text-2xl">Create Live Session</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Session Name
                    </label>
                    <Input
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="e.g., Friday Quiz - Newton's Laws"
                      className="text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topic / Subunit
                    </label>
                    <Input
                      value={subunitName}
                      onChange={(e) => setSubunitName(e.target.value)}
                      placeholder="e.g., Newton's First Law of Motion"
                      className="text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      YouTube Video URL
                    </label>
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Question Difficulty
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: "mixed", label: "Mixed", color: "blue" },
                        { value: "easy", label: "Easy", color: "green" },
                        { value: "medium", label: "Medium", color: "yellow" },
                        { value: "hard", label: "Hard", color: "red" }
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setQuestionDifficulty(option.value)}
                          className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                            questionDifficulty === option.value
                              ? `bg-${option.color}-600 text-white border-${option.color}-600`
                              : `bg-white text-gray-700 border-gray-300 hover:border-${option.color}-400`
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Number of Questions
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[10, 20, 30].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setQuestionCount(count)}
                          className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                            questionCount === count
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400"
                          }`}
                        >
                          {count} Questions
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={() => setShowCreateModal(false)}
                      variant="outline"
                      className="flex-1 border-2"
                      disabled={generating}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateSession}
                      disabled={generating || !sessionName || !subunitName || !videoUrl}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-lg py-6"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Generating Content...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Create Session
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <NotificationModal
          isOpen={notification.isOpen}
          onClose={closeNotification}
          type={notification.type}
          title={notification.title}
          message={notification.message}
        />

        {showEndSessionModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowEndSessionModal(false)}>
            <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">End Session?</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to end this session? All participant data will be cleared.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowEndSessionModal(false)} className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
                  Cancel
                </button>
                <button onClick={() => { setShowEndSessionModal(false); handleEndSession(); }} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">
                  End Session
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
        </TeacherLayout>
        );
        }