import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TeacherLayout from "../components/teacher/TeacherLayout";
import VideoSearchModal from "../components/teacher/VideoSearchModal";
import { ArrowLeft, Video, Loader2, Rocket } from "lucide-react";

export default function ManageLiveSession() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [questionDifficulty, setQuestionDifficulty] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(10);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const user = await quest.auth.me();
      setTeacher(user);

      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('sessionId');
      const difficulty = params.get('difficulty') || 'mixed';
      const count = parseInt(params.get('count')) || 10;
      
      setQuestionDifficulty(difficulty);
      setQuestionCount(count);
      
      if (!sessionId) {
        navigate(createPageUrl("TeacherLiveSession"));
        return;
      }

      const sessions = await quest.entities.LiveSession.filter({ id: sessionId });
      if (sessions.length === 0) {
        navigate(createPageUrl("TeacherLiveSession"));
        return;
      }

      const sessionData = sessions[0];
      setSession(sessionData);
      
      // Check if content is complete
      const contentComplete = sessionData.video_url && 
                            sessionData.questions && 
                            sessionData.questions.length > 0;
      setHasContent(contentComplete);
      
      if (!contentComplete) {
        setShowVideoModal(true);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelected = async () => {
    if (refreshing) return;
    setShowVideoModal(false);
    setRefreshing(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('sessionId');
      if (sessionId) {
        const sessions = await quest.entities.LiveSession.filter({ id: sessionId });
        if (sessions.length > 0) {
          const updated = sessions[0];
          setSession(updated);
          setHasContent(!!(updated.video_url && updated.questions?.length > 0));
        }
      }
    } catch (err) {
      console.error("Failed to reload session:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLaunchSession = async () => {
    setLaunching(true);
    try {
      // Update session status to active
      await quest.entities.LiveSession.update(session.id, { status: "waiting" });
      
      // Navigate to live session page
      navigate(createPageUrl("TeacherLiveSession"));
    } catch (err) {
      console.error("Failed to launch session:", err);
      alert("Failed to launch session");
      setLaunching(false);
    }
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

  if (!session) {
    return null;
  }

  return (
    <TeacherLayout activeNav="live" user={teacher} onSignOut={handleSignOut}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate(createPageUrl("TeacherLiveSession"))}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Live Sessions
          </button>

          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{session.session_name}</h1>
            <p className="text-gray-600">{session.subunit_name}</p>
          </div>

          {!hasContent ? (
            <Card className="border-2 border-blue-200">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Video className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Video & Generate Content</h2>
                <p className="text-gray-600 mb-6">
                  Choose a YouTube video and let AI generate quiz questions, case study, and attention checks
                </p>
                <Button
                  onClick={() => setShowVideoModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6"
                >
                  <Video className="w-5 h-5 mr-2" />
                  Select Video
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardContent className="p-8">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <Badge className="bg-green-600 text-white text-sm px-3 py-1">
                          Ready to Launch
                        </Badge>
                        <Badge variant="outline" className="text-sm">
                          {session.questions?.length || 0} Questions
                        </Badge>
                        <Badge variant="outline" className="text-sm">
                          {session.attention_checks?.length || 0} Attention Checks
                        </Badge>
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Content Generated Successfully</h2>
                      <p className="text-gray-700 mb-6">
                        Your live session is ready with video, quiz questions, case study, and attention checks.
                      </p>
                      <div className="flex gap-4">
                        <Button
                          onClick={handleLaunchSession}
                          disabled={launching}
                          className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-6"
                        >
                          {launching ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              Launching...
                            </>
                          ) : (
                            <>
                              <Rocket className="w-5 h-5 mr-2" />
                              Launch Live Session
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => setShowVideoModal(true)}
                          variant="outline"
                          className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 px-6"
                        >
                          Review & Edit Content
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Session Details</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Session Code</p>
                      <p className="text-2xl font-bold text-blue-600">{session.session_code}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Topic</p>
                      <p className="text-lg font-semibold text-gray-900">{session.subunit_name}</p>
                    </div>
                  </div>

                  {session.video_url && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Video Preview</h3>
                      <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
                        <iframe
                          src={`https://www.youtube.com/embed/${session.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] || session.video_url}`}
                          className="w-full h-full"
                          title="Video preview"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>

                      {session.attention_checks && session.attention_checks.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Badge className="bg-blue-600 text-white px-3 py-1">
                              Attention Checks ({session.attention_checks.length})
                            </Badge>
                          </div>
                          <div className="space-y-4">
                            {session.attention_checks.map((check, idx) => (
                              <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1">
                                    <Badge variant="outline" className="text-xs mb-2">
                                      {Math.floor(check.timestamp / 60)}:{String(check.timestamp % 60).padStart(2, '0')}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="font-medium text-gray-900 mb-3 ml-11">{check.question}</p>
                                <div className="space-y-2 ml-11">
                                  {[
                                    { letter: 'A', text: check.choice_a },
                                    { letter: 'B', text: check.choice_b },
                                    { letter: 'C', text: check.choice_c },
                                    { letter: 'D', text: check.choice_d }
                                  ].filter(c => c.text).map((choice) => (
                                    <div
                                      key={choice.letter}
                                      className={`p-3 rounded-lg border flex items-center gap-3 ${
                                        choice.letter === check.correct_choice
                                          ? 'bg-green-100 border-green-400'
                                          : 'bg-white border-gray-300'
                                      }`}
                                    >
                                      {choice.letter === check.correct_choice ? (
                                        <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </div>
                                      ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-gray-400 flex-shrink-0"></div>
                                      )}
                                      <span className="text-sm text-gray-900">
                                        <span className="font-semibold">{choice.letter}</span> {choice.text}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {showVideoModal && session && (
            <VideoSearchModal
              subunit={{ id: session.id, subunit_name: session.subunit_name }}
              curriculumName={session.session_name}
              onClose={() => setShowVideoModal(false)}
              onVideoSelected={handleVideoSelected}
              existingContent={hasContent ? {
                video: {
                  videoId: session.video_url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1],
                  title: session.subunit_name,
                  summary: session.subunit_name,
                  url: session.video_url
                },
                questions: session.questions || [],
                inquiryContent: {
                  hook_image_prompt: "",
                  hook_question: "",
                  hook_image_url: "",
                  socratic_system_prompt: "",
                  tutor_first_message: ""
                },
                caseStudy: session.case_study || {}
              } : null}
              isLiveSession={true}
              sessionId={session.id}
              liveSessionDifficulty={questionDifficulty}
              liveSessionQuestionCount={questionCount}
            />
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}