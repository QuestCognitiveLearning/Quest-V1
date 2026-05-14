import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TeacherLayout from "../components/teacher/TeacherLayout";
import { ArrowRight, ArrowLeft, Sparkles, Loader2 } from "lucide-react";

export default function CreateLiveSession() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [sessionName, setSessionName] = useState("");
  const [subunitName, setSubunitName] = useState("");
  const [questionDifficulty, setQuestionDifficulty] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(10);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    loadTeacher();
  }, []);

  const loadTeacher = async () => {
    try {
      const user = await quest.auth.me();
      setTeacher(user);
    } catch (err) {
      console.error("Failed to load teacher:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!sessionName.trim() || !subunitName.trim()) {
      alert("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      // Generate session code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Create temporary live session record
      const session = await quest.entities.LiveSession.create({
        teacher_id: teacher.id,
        session_code: code,
        session_name: sessionName,
        subunit_name: subunitName,
        video_url: "",
        video_duration: 0,
        status: "waiting",
        questions: [],
        attention_checks: [],
        question_difficulty: questionDifficulty,
        question_count: questionCount
      });

      // Navigate to video selection with session ID
      navigate(createPageUrl("ManageLiveSession") + `?sessionId=${session.id}&difficulty=${questionDifficulty}&count=${questionCount}`);
    } catch (err) {
      console.error("Failed to create session:", err);
      alert("Failed to create session");
      setSaving(false);
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

  return (
    <TeacherLayout activeNav="live" user={teacher} onSignOut={handleSignOut}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => navigate(createPageUrl("TeacherLiveSession"))}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Live Sessions
          </button>

          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Live Session</h1>
            <p className="text-gray-600">Set up an engaging real-time learning experience</p>
          </div>

          <Card className="border-2 border-blue-200 shadow-xl">
            <CardContent className="p-8">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-bold">
                    1
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Session Details</h2>
                  <Badge className="bg-green-100 text-green-700 border-green-300">
                    Live Session
                  </Badge>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Session Name
                    </label>
                    <Input
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="e.g., Friday Live - Newton's Laws"
                      className="text-lg p-6 border-2 border-gray-200 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Give your live session a descriptive name
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Topic / Subunit Name
                    </label>
                    <Input
                      value={subunitName}
                      onChange={(e) => setSubunitName(e.target.value)}
                      placeholder="e.g., Newton's First Law of Motion"
                      className="text-lg p-6 border-2 border-gray-200 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      What concept will students learn in this session?
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Question Difficulty
                    </label>
                    <div className="grid grid-cols-4 gap-3">
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
                          className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                            questionDifficulty === option.value
                              ? option.value === "mixed" 
                                ? "bg-blue-600 text-white border-blue-600"
                                : option.value === "easy"
                                ? "bg-green-600 text-white border-green-600"
                                : option.value === "medium"
                                ? "bg-yellow-600 text-white border-yellow-600"
                                : "bg-red-600 text-white border-red-600"
                              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Choose the difficulty level for all quiz questions
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Number of Questions
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[10, 20, 30].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setQuestionCount(count)}
                          className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                            questionCount === count
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          {count} Questions
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      How many quiz questions to generate for this session
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-6 border-t">
                <p className="text-sm text-gray-500">
                  Next: Select video and generate content
                </p>
                <Button
                  onClick={handleContinue}
                  disabled={!sessionName.trim() || !subunitName.trim() || saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>


        </div>
      </div>
    </TeacherLayout>
  );
}