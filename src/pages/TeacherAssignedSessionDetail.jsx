import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { computeSessionScore } from "@/lib/spacedRepetition";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Video,
  HelpCircle,
  PenTool,
} from "lucide-react";

// Resolve a stored choice value (letter "a"/"A" or 1–4) into the actual choice
// text on a quiz / attention-check item. Mirrors the helper in
// TeacherStudentDetail so chosen answers render reliably across schema eras.
const choiceText = (item, value) => {
  if (!item || value === undefined || value === null || value === "") return String(value ?? "");
  const v = String(value).toLowerCase().trim();
  const numToLetter = { "1": "a", "2": "b", "3": "c", "4": "d" };
  const letter = numToLetter[v] || v;
  return item[`choice_${letter}`] ?? String(value);
};

// Per-student review of a single assigned learning session (lesson bundle).
// The completion row stores the student's quiz / attention-check / case-study
// responses inline, so we just join them against the bundle payload (which
// carries the question + choice text) to render the same breakdown the student
// saw on their results screen. Reached by clicking a student in the Sessions
// tab of TeacherClassDetail.
export default function TeacherAssignedSessionDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const assignmentId = urlParams.get("assignmentId");
  const studentId = urlParams.get("studentId");
  const classId = urlParams.get("classId");

  const [student, setStudent] = useState(null);
  const [classData, setClassData] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Student name / email from the enrollment (no User list access needed).
      const enrollments = await quest.entities.StudentEnrollment.filter({
        student_id: studentId,
        class_id: classId,
      });
      if (enrollments.length > 0) {
        setStudent({
          id: enrollments[0].student_id,
          full_name: enrollments[0].student_full_name,
          email: enrollments[0].student_email,
        });
      }

      const classes = await quest.entities.Class.filter({ id: classId });
      if (classes.length > 0) setClassData(classes[0]);

      // Assignment → bundle (payload carries the question + choice text).
      const { data: aRow } = await supabase
        .from("lesson_bundle_assignments")
        .select("id, bundle_id, class_id, due_at")
        .eq("id", assignmentId)
        .single();

      if (aRow?.bundle_id) {
        const { data: bRow } = await supabase
          .from("lesson_bundles")
          .select("id, title, payload")
          .eq("id", aRow.bundle_id)
          .single();
        setBundle(bRow);
      }

      // This student's completion row for this assignment.
      const { data: cRow } = await supabase
        .from("student_bundle_completion")
        .select("*")
        .eq("student_id", studentId)
        .eq("assignment_id", assignmentId)
        .maybeSingle();
      setCompletion(cRow || null);
    } catch (err) {
      console.error("Failed to load assigned session detail:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const payload = bundle?.payload || {};
  const quiz = Array.isArray(payload.quiz) ? payload.quiz : [];
  const attentionChecks = Array.isArray(payload.attention_checks) ? payload.attention_checks : [];

  const quizResponses = completion?.quiz_responses || [];
  const acResponses = completion?.attention_check_responses || [];
  const caseResponses = completion?.case_study_responses || [];

  // Standardized session score (quiz + case study, clamped 0–100) — same scorer
  // used everywhere else, so the headline matches the rest of the platform.
  const sessionScore = completion
    ? computeSessionScore({
        quizCorrect: completion.quiz_correct ?? 0,
        quizTotal: completion.quiz_total ?? quiz.length,
        caseScore: completion.case_study_max != null ? completion.case_study_score : null,
        caseMax: completion.case_study_max,
      })
    : null;

  // Sort: incorrect first (mirrors TeacherStudentDetail's ordering).
  const incorrectFirst = (arr) =>
    [...arr].sort((a, b) => (a.is_correct === b.is_correct ? 0 : a.is_correct ? 1 : -1));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ fontFamily: '"Inter", sans-serif' }}>
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => navigate(createPageUrl("TeacherClassDetail") + `?id=${classId}`)}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Class
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Student / session info card */}
          <Card className="border-0 shadow-xl bg-white mb-8 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl font-bold">
                  {student?.full_name?.charAt(0) || "?"}
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold mb-1">{student?.full_name || "Student"}</h1>
                  <p className="text-indigo-100">{student?.email}</p>
                  <p className="text-indigo-200 text-sm mt-1">
                    {bundle?.title || "Single session"}
                    {classData?.class_name ? ` • ${classData.class_name}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">{sessionScore !== null ? `${sessionScore}%` : "—"}</div>
                  <p className="text-indigo-100 text-sm">Session Score</p>
                </div>
              </div>
            </div>
          </Card>

          {!completion ? (
            <Card className="border-0 shadow-lg bg-white">
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HelpCircle className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Not started yet</h3>
                <p className="text-gray-600">This student hasn't completed this session.</p>
              </div>
            </Card>
          ) : (
            <Card className="border-0 shadow-lg bg-white p-6">
              <Tabs defaultValue="attention" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="attention" className="text-sm">
                    <Video className="w-4 h-4 mr-2" />
                    Attention
                  </TabsTrigger>
                  <TabsTrigger value="quiz" className="text-sm">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Quiz
                  </TabsTrigger>
                  <TabsTrigger value="casestudy" className="text-sm">
                    <PenTool className="w-4 h-4 mr-2" />
                    Case Study
                  </TabsTrigger>
                </TabsList>

                {/* ---- Attention checks ---- */}
                <TabsContent value="attention">
                  {acResponses.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-xl">
                      <Video className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No attention check responses recorded</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Video className="w-5 h-5 text-blue-500" />
                        <h4 className="font-semibold text-gray-900">Attention Checks</h4>
                        <Badge variant="outline" className="ml-auto">
                          {acResponses.filter((r) => r.is_correct).length}/{acResponses.length} correct
                        </Badge>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {incorrectFirst(acResponses).map((resp, idx) => {
                          const check = attentionChecks[resp.q_index] || {};
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg ${
                                resp.is_correct
                                  ? "bg-green-50 border border-green-200"
                                  : "bg-red-50 border border-red-200"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {resp.is_correct ? (
                                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <p className="text-sm text-gray-900 font-medium">
                                    {check.question || `Check ${resp.q_index + 1}`}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    Selected: {choiceText(check, resp.picked)}
                                    {!resp.is_correct && (
                                      <span className="text-green-600 ml-2">
                                        (Correct: {choiceText(check, resp.correct ?? check.correct_choice)})
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ---- Quiz ---- */}
                <TabsContent value="quiz">
                  {quizResponses.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-xl">
                      <HelpCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No quiz responses recorded</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <HelpCircle className="w-5 h-5 text-blue-500" />
                        <h4 className="font-semibold text-gray-900">Quiz Responses</h4>
                        <Badge variant="outline" className="ml-auto">
                          {quizResponses.filter((r) => r.is_correct).length}/{quizResponses.length} correct
                        </Badge>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {incorrectFirst(quizResponses).map((resp, idx) => {
                          const q = quiz[resp.q_index] || {};
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg ${
                                resp.is_correct
                                  ? "bg-green-50 border border-green-200"
                                  : "bg-red-50 border border-red-200"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {resp.is_correct ? (
                                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <p className="text-sm text-gray-900 font-medium">
                                    {q.question || `Question ${resp.q_index + 1}`}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    Selected: {choiceText(q, resp.picked)}
                                    {!resp.is_correct && (
                                      <span className="text-green-600 ml-2">
                                        (Correct: {choiceText(q, resp.correct ?? q.correct_choice)})
                                      </span>
                                    )}
                                  </p>
                                  {q.explanation && (
                                    <p className="text-xs text-gray-500 mt-1 italic">{q.explanation}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ---- Case study ---- */}
                <TabsContent value="casestudy">
                  {caseResponses.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-xl">
                      <PenTool className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No case study response recorded</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl p-4 border border-purple-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <PenTool className="w-5 h-5 text-purple-500" />
                          <h4 className="font-semibold text-gray-900">Case Study Responses</h4>
                        </div>
                        {completion.case_study_max != null && (
                          <Badge
                            className={`${
                              (completion.case_study_score ?? 0) >= (completion.case_study_max ?? 1) * 0.7
                                ? "bg-green-600"
                                : "bg-orange-500"
                            } text-white`}
                          >
                            {completion.case_study_score ?? 0}/{completion.case_study_max}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-4 max-h-[28rem] overflow-y-auto">
                        {caseResponses.map((r, idx) => {
                          const max = r.max ?? 1;
                          const score = r.score ?? 0;
                          const isCorrect = score >= max * 0.7;
                          return (
                            <div
                              key={idx}
                              className={`rounded-lg p-3 border-2 ${
                                isCorrect ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-900 mb-1">
                                  ({idx + 1}) {r.question || `Question ${idx + 1}`}
                                </p>
                                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                  {isCorrect ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                  )}
                                  <Badge className={`${isCorrect ? "bg-green-600" : "bg-red-600"} text-white`}>
                                    {Number(score).toFixed(1)}/{max}
                                  </Badge>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <p className="text-xs font-medium text-gray-600 mb-1">Student Answer:</p>
                                  <p className="text-sm text-gray-900">
                                    {r.answer || <span className="italic text-gray-400">No answer provided</span>}
                                  </p>
                                </div>

                                {r.feedback && (
                                  <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                    <p className="text-xs font-medium text-blue-700 mb-1">AI Feedback:</p>
                                    <p className="text-sm text-blue-900">{r.feedback}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
