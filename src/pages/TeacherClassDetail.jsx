import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import TestBuilder from "@/components/teacher/TestBuilder";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  Users, 
  BookOpen, 
  TrendingUp,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  Trophy,
  Medal,
  Award,
  Sparkles,
  Calendar,
  ChevronRight,
} from "lucide-react";
import SubunitProgressModal from "../components/teacher/SubunitProgressModal";
import DownloadPDFButton from "@/components/shared/pdf/DownloadPDFButton";

export default function TeacherClassDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const classId = urlParams.get("id");

  const [classData, setClassData] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveSessionData, setLiveSessionData] = useState({});
  const [questionResponses, setQuestionResponses] = useState([]);
  const [sessionFeedbacks, setSessionFeedbacks] = useState([]);
  // Assigned learning sessions for this class + per-student completion rows.
  // Loaded alongside curriculum data so the teacher sees both axes (subunit
  // progress and one-off assigned sessions) on a single page.
  const [assignedBundles, setAssignedBundles] = useState([]); // [{ id, bundle_title, due_at, completions: [...] }]
  // Assigned tests for this class + per-student completion rows.
  const [testAssignments, setTestAssignments] = useState([]); // [{ id, title, due_at, completions: [...] }]
  const [testBuilderOpen, setTestBuilderOpen] = useState(false);

  useEffect(() => {
    loadClassData();
  }, []);

  // Subscribe to real-time updates for StudentProgress
  useEffect(() => {
    const unsubscribe = quest.entities.StudentProgress.subscribe((event) => {
      setProgressData(prev => {
        const filtered = prev.filter(p => p.id !== event.id);
        if (event.type !== 'delete') {
          return [...filtered, event.data];
        }
        return filtered;
      });
    });
    return unsubscribe;
  }, []);

  // Subscribe to real-time updates for StudentEnrollment
  useEffect(() => {
    if (!classId) return;
    const unsubscribe = quest.entities.StudentEnrollment.subscribe((event) => {
      console.log("📍 [StudentEnrollment Event]", event.type, event.data?.class_id, "classId:", classId);
      if (event.data?.class_id === classId && event.type === 'create') {
        console.log("✅ [StudentEnrollment] New enrollment detected, reloading class data");
        loadClassData();
      }
    });
    return unsubscribe;
  }, [classId]);

  // Subscribe to real-time updates for QuestionResponses
  useEffect(() => {
    const unsubscribe = quest.entities.QuestionResponse.subscribe((event) => {
      setQuestionResponses(prev => {
        const filtered = prev.filter(p => p.id !== event.id);
        if (event.type !== 'delete') {
          return [...filtered, event.data];
        }
        return filtered;
      });
    });
    return unsubscribe;
  }, []);

  // Subscribe to real-time updates for SessionFeedback
  useEffect(() => {
    const unsubscribe = quest.entities.SessionFeedback.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        // Only add if student is enrolled in this class
        setSessionFeedbacks(prev => {
          const filtered = prev.filter(f => f.id !== event.id);
          return [...filtered, event.data];
        });
      } else if (event.type === 'delete') {
        setSessionFeedbacks(prev => prev.filter(f => f.id !== event.id));
      }
    });
    return unsubscribe;
  }, []);

  const loadClassData = async () => {
    try {
      const [cls, allCurricula, allUnits, allSubunits, enrollmentsData, allProgress, responses, feedbacks] = await Promise.all([
        quest.entities.Class.filter({ id: classId }),
        quest.entities.Curriculum.list(),
        quest.entities.Unit.list(),
        quest.entities.Subunit.list(),
        quest.entities.StudentEnrollment.filter({ class_id: classId }),
        quest.entities.StudentProgress.list(),
        quest.entities.QuestionResponse.list(),
        quest.entities.SessionFeedback.list()
      ]);
      
      if (!cls || cls.length === 0) return;
      
      const classInfo = cls[0];
      setClassData(classInfo);

      const curr = allCurricula.find(c => c.id === classInfo.curriculum_id);
      if (curr) {
        setCurriculum(curr);
        
        const unitsData = allUnits
          .filter(u => u.curriculum_id === curr.id)
          .sort((a, b) => a.unit_order - b.unit_order);
        setUnits(unitsData);

        const filteredSubunits = allSubunits
          .filter(sub => unitsData.some(unit => unit.id === sub.unit_id))
          .sort((a, b) => a.subunit_order - b.subunit_order);
        setSubunits(filteredSubunits);
      }

      setEnrollments(enrollmentsData);
      setQuestionResponses(responses);

      // Filter feedbacks by students enrolled in this class
      const enrolledStudentIds = enrollmentsData.map(e => e.student_id);
      const classFeedbacks = (feedbacks || []).filter(f => enrolledStudentIds.includes(f.student_id));
      setSessionFeedbacks(classFeedbacks);

      if (enrollmentsData.length > 0) {
        // Create student objects from enrollment data (no need to fetch User list)
        const classStudents = enrollmentsData.map(enrollment => ({
          id: enrollment.student_id,
          full_name: enrollment.student_full_name,
          email: enrollment.student_email
        }));
        setStudents(classStudents);

        const studentIds = enrollmentsData.map(e => e.student_id);
        const relevantProgress = allProgress.filter(p => studentIds.includes(p.student_id));
        setProgressData(relevantProgress);
      }

      // Assigned learning sessions for this class + per-student completions.
      // RLS scopes student_bundle_completion to assignments the teacher owns.
      try {
        const bundleAssns = await quest.entities.LearningSessionAssignment.filter(
          { class_id: classId },
          "-assigned_at"
        );
        const bundleIds = [...new Set((bundleAssns || []).map(a => a.bundle_id))];
        if (bundleIds.length > 0) {
          const [bundles, completions] = await Promise.all([
            quest.entities.LessonBundle.filter({ id: bundleIds }, "-created_at"),
            quest.entities.StudentBundleCompletion.filter({
              assignment_id: (bundleAssns || []).map(a => a.id),
            }).catch(() => []),
          ]);
          const bundleMap = new Map((bundles || []).map(b => [b.id, b]));
          const byAssignment = new Map();
          for (const c of (completions || [])) {
            if (!byAssignment.has(c.assignment_id)) byAssignment.set(c.assignment_id, []);
            byAssignment.get(c.assignment_id).push(c);
          }
          setAssignedBundles(
            (bundleAssns || []).map(a => ({
              ...a,
              bundle_title: bundleMap.get(a.bundle_id)?.title || "Learning session",
              completions: byAssignment.get(a.id) || [],
            }))
          );
        } else {
          setAssignedBundles([]);
        }
      } catch (err) {
        console.warn("Could not load assigned bundles for class:", err);
        setAssignedBundles([]);
      }

      await loadTests();

      setLoading(false);
    } catch (err) {
      console.error("Failed to load class data:", err);
      setLoading(false);
    }
  };

  // Assigned tests for this class + per-student completions. Standalone so the
  // TestBuilder can refresh it after assigning a new test.
  const loadTests = async () => {
    try {
      const { data: tas } = await supabase
        .from("test_assignments")
        .select("*")
        .eq("class_id", classId)
        .order("assigned_at", { ascending: false });
      const ids = (tas || []).map((t) => t.id);
      let comps = [];
      if (ids.length > 0) {
        const { data } = await supabase.from("test_completions").select("*").in("assignment_id", ids);
        comps = data || [];
      }
      const byA = new Map();
      for (const c of comps) {
        if (!byA.has(c.assignment_id)) byA.set(c.assignment_id, []);
        byA.get(c.assignment_id).push(c);
      }
      setTestAssignments((tas || []).map((t) => ({ ...t, completions: byA.get(t.id) || [] })));
    } catch (err) {
      console.warn("Could not load tests for class:", err);
      setTestAssignments([]);
    }
  };

  const getAverageProgress = (subunitId) => {
    const subunitProgress = progressData.filter(p => p.subunit_id === subunitId);
    if (subunitProgress.length === 0) return 0;
    const total = subunitProgress.reduce((sum, p) => sum + (p.progress_percentage || 0), 0);
    return Math.round(total / subunitProgress.length);
  };

  const getStudentProgress = (studentId, subunitId) => {
    const progress = progressData.find(p => p.student_id === studentId && p.subunit_id === subunitId);
    return progress?.progress_percentage || 0;
  };

  const getStudentTotalProgress = (studentId) => {
    const studentProgressItems = progressData.filter(p => p.student_id === studentId);
    if (studentProgressItems.length === 0) return 0;
    const total = studentProgressItems.reduce((sum, p) => sum + (p.progress_percentage || 0), 0);
    return Math.round(total / studentProgressItems.length);
  };

  const getLeaderboardData = () => {
    return students.map(student => ({
      ...student,
      totalProgress: getStudentTotalProgress(student.id),
      completedSubunits: progressData.filter(p => 
        p.student_id === student.id && p.progress_percentage >= 100
      ).length
    })).sort((a, b) => b.totalProgress - a.totalProgress);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading class data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ fontFamily: '"Inter", sans-serif' }}>
        <div className="bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  onClick={() => navigate(createPageUrl("TeacherClasses"))}
                  className="gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-blue-600">
                      {classData?.class_name}
                    </h1>
                    <p className="text-sm text-gray-600">{curriculum?.subject_name} • {enrollments.length} Students</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {classId ? (
                  <DownloadPDFButton
                    type="classWorkbook"
                    contentId={classId}
                    label={classData?.class_name}
                    size="md"
                  >
                    Download Workbook
                  </DownloadPDFButton>
                ) : null}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg px-4 py-2">
                  <p className="text-xs text-gray-600">Join Code</p>
                  <p className="text-xl font-bold text-blue-600 tracking-wider">{classData?.join_code}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <Tabs defaultValue="mindmap" className="w-full">
            {/* 4 tabs distributed evenly across the full width. Was `grid-cols-6`
                which left two empty columns on the right. */}
            <TabsList className="grid w-full grid-cols-6 bg-white/80 backdrop-blur-sm p-1.5 rounded-xl shadow-md mb-8 h-12">
              <TabsTrigger
                value="mindmap"
                className="h-9 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all text-sm font-medium"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Progress
              </TabsTrigger>
              <TabsTrigger
                value="students"
                className="h-9 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all text-sm font-medium"
              >
                <Users className="w-4 h-4 mr-2" />
                Students
              </TabsTrigger>
              <TabsTrigger
                value="leaderboard"
                className="h-9 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all text-sm font-medium"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Leaderboard
              </TabsTrigger>
              <TabsTrigger
                value="feedback"
                className="h-9 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all text-sm font-medium"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Feedback
              </TabsTrigger>
              <TabsTrigger
                value="sessions"
                className="h-9 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all text-sm font-medium"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Sessions
              </TabsTrigger>
              <TabsTrigger
                value="tests"
                className="h-9 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all text-sm font-medium"
              >
                <Target className="w-4 h-4 mr-2" />
                Tests
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mindmap">
              <ClassProgressMindmap 
                units={units}
                subunits={subunits}
                students={students}
                progressData={progressData}
              />
            </TabsContent>

            <TabsContent value="students">
              <StudentProgressBlocks 
                students={students}
                subunits={subunits}
                units={units}
                progressData={progressData}
                classId={classId}
              />
            </TabsContent>

            <TabsContent value="leaderboard">
              <ClassLeaderboard
                students={students}
                progressData={progressData}
                subunits={subunits}
              />
            </TabsContent>

            <TabsContent value="feedback">
              <ClassFeedbackTab feedbacks={sessionFeedbacks} />
            </TabsContent>

            <TabsContent value="sessions">
              <AssignedSessionsTab assignedBundles={assignedBundles} students={students} />
            </TabsContent>

            <TabsContent value="tests">
              <div className="flex justify-end mb-4">
                <Button
                  onClick={() => setTestBuilderOpen(true)}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Target className="w-4 h-4" /> Assign a test
                </Button>
              </div>
              <TestsTab testAssignments={testAssignments} students={students} />
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {testBuilderOpen && (
        <TestBuilder
          open={testBuilderOpen}
          onClose={() => setTestBuilderOpen(false)}
          classId={classId}
          curriculumId={curriculum?.id}
          units={units}
          subunits={subunits}
          onCreated={loadTests}
        />
      )}
    </div>
  );
}

function ClassProgressMindmap({ units, subunits, students, progressData }) {
  const [sessionFilter, setSessionFilter] = useState("new_topic");

  // Calculate max review count in class
  const maxReviewCount = Math.max(
    0,
    ...progressData.map(p => p.review_count || 0)
  );
  const [selectedSubunit, setSelectedSubunit] = useState(null);

  const getCompletionRate = (subunitId) => {
    if (students.length === 0) return 0;
    
    let completedCount = 0;
    students.forEach(student => {
      const progress = progressData.find(p => p.student_id === student.id && p.subunit_id === subunitId);
      if (!progress) return;
      
      if (sessionFilter === "new_topic") {
        if (progress.new_session_completed) completedCount++;
      } else {
        const reviewNum = parseInt(sessionFilter.replace("review_", ""));
        if (progress.review_count >= reviewNum) completedCount++;
      }
    });
    
    return Math.round((completedCount / students.length) * 100);
  };

  const sessionLabel = sessionFilter === "new_topic" ? "Learn Session" : `Review ${sessionFilter.replace("review_", "")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Class Completion by Session Type</h2>
        <Select value={sessionFilter} onValueChange={setSessionFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new_topic">Learn Session</SelectItem>
              {Array.from({ length: Math.max(5, maxReviewCount) }, (_, i) => (
                <SelectItem key={`review_${i + 1}`} value={`review_${i + 1}`}>
                  Review {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>

      <div className="grid gap-6">
        {units.map((unit, index) => {
          const unitSubunits = subunits.filter(s => s.unit_id === unit.id);
          const avgCompletion = unitSubunits.length > 0
            ? Math.round(unitSubunits.reduce((sum, s) => sum + getCompletionRate(s.id), 0) / unitSubunits.length)
            : 0;

          return (
            <Card key={unit.id} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="bg-blue-600 p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{unit.unit_name}</h2>
                      <p className="text-blue-100 text-sm">{sessionLabel} Completion Rate</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold">{avgCompletion}%</div>
                    <div className="text-blue-100 text-sm">{unitSubunits.length} topics</div>
                  </div>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-500 shadow-lg"
                    style={{ width: `${avgCompletion}%` }}
                  />
                </div>
              </div>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unitSubunits.map((subunit) => {
                    const completionRate = getCompletionRate(subunit.id);
                    const completedStudents = students.filter(student => {
                      const progress = progressData.find(p => p.student_id === student.id && p.subunit_id === subunit.id);
                      if (!progress) return false;
                      if (sessionFilter === "new_topic") return progress.new_session_completed;
                      const reviewNum = parseInt(sessionFilter.replace("review_", ""));
                      return progress.review_count >= reviewNum;
                    }).length;

                    return (
                      <div 
                        key={subunit.id} 
                        onClick={() => setSelectedSubunit(subunit)}
                        className="bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-blue-100 rounded-xl p-4 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-gray-900 text-sm">{subunit.subunit_name}</h3>
                          <div className="text-2xl font-bold text-blue-600">{completionRate}%</div>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                          <div 
                            className={`h-full rounded-full transition-all ${completionRate >= 70 ? 'bg-green-500' : completionRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500">{completedStudents}/{students.length} students completed</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <SubunitProgressModal
        open={!!selectedSubunit}
        onClose={() => setSelectedSubunit(null)}
        subunit={selectedSubunit}
        sessionType={sessionFilter}
        students={students}
        progressData={progressData}
      />
    </div>
  );
}

function StudentProgressBlocks({ students, subunits, units, progressData, classId }) {
  const navigate = useNavigate();

  const handleStudentClick = (student) => {
    navigate(createPageUrl("TeacherStudentDetail") + `?studentId=${student.id}&classId=${classId}`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Students</h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map((student) => {
          return (
            <Card 
              key={student.id} 
              onClick={() => handleStudentClick(student)}
              className="border-0 shadow-lg bg-white hover:shadow-xl transition-all cursor-pointer overflow-hidden"
              >
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-lg text-white">
                    {student.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{student.full_name}</h3>
                    <p className="text-sm text-gray-500 truncate">{student.email}</p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {students.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No students enrolled</h3>
            <p className="text-gray-600">Share the join code with students to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ClassFeedbackTab({ feedbacks }) {
  const submitted = feedbacks.filter(f => !f.skipped);
  const skipped = feedbacks.filter(f => f.skipped).length;

  const avgEmoji = submitted.length > 0
    ? (submitted.reduce((s, f) => s + (f.emoji_score || 0), 0) / submitted.length).toFixed(1)
    : null;

  const avgDifficulty = submitted.length > 0
    ? (submitted.reduce((s, f) => s + (f.difficulty || 3), 0) / submitted.length).toFixed(1)
    : null;

  const DIFFICULTY_LABELS = ["Too easy", "Fairly easy", "Just right", "Fairly hard", "Too hard"];
  const EMOJI_MAP = { 1: "😴", 2: "😐", 3: "🙂", 4: "😄", 5: "🤩" };

  // Tag frequency
  const tagCounts = {};
  submitted.forEach(f => (f.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Text feedbacks only (non-empty)
  const textEntries = submitted.filter(f => f.text_feedback && f.text_feedback.trim().length > 0);

  if (feedbacks.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No feedback yet</h3>
          <p className="text-gray-600">Feedback will appear here once students complete sessions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Session Feedback</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-bold text-blue-600">{submitted.length}</p>
            <p className="text-sm text-gray-500 mt-1">Responses</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-bold text-gray-900">{skipped}</p>
            <p className="text-sm text-gray-500 mt-1">Skipped</p>
          </CardContent>
        </Card>
        {avgEmoji && (
          <Card className="border-0 shadow-md bg-white">
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-gray-900">{EMOJI_MAP[Math.round(avgEmoji)]} {avgEmoji}</p>
              <p className="text-sm text-gray-500 mt-1">Avg Enjoyment</p>
            </CardContent>
          </Card>
        )}
        {avgDifficulty && (
          <Card className="border-0 shadow-md bg-white">
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-gray-900">{avgDifficulty}</p>
              <p className="text-sm text-gray-500 mt-1">Avg Difficulty ({DIFFICULTY_LABELS[Math.round(avgDifficulty) - 1]})</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Written feedback (anonymous) */}
      {textEntries.length > 0 && (
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-800 mb-1">Written Feedback <span className="text-gray-400 font-normal text-sm">(anonymous)</span></h3>
            <p className="text-xs text-gray-400 mb-4">Students' own words — shown anonymously</p>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {textEntries.map((f) => (
                <div key={f.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-700">{f.subunit_name || "Unknown subunit"}</span>
                    <Badge variant="outline" className="text-xs">{f.session_type === "new_topic" ? "Learn" : "Review"}</Badge>
                    {f.emoji_score && <span className="text-lg">{EMOJI_MAP[f.emoji_score]}</span>}
                  </div>
                  <p className="text-sm text-gray-600 italic">"{f.text_feedback}"</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ClassLeaderboard({ students, progressData, subunits }) {
  const getStudentStats = (studentId) => {
    const subunitIds = subunits.map(s => s.id);
    const studentProgress = progressData.filter(p => p.student_id === studentId && subunitIds.includes(p.subunit_id));
    const completedCount = studentProgress.filter(p => p.new_session_completed === true).length;

    let scores = [];
    studentProgress.forEach(p => {
      if (p.new_session_completed === true && p.new_session_score) {
        scores.push(p.new_session_score);
      }
      if (p.last_review_score) {
        scores.push(p.last_review_score);
      }
    });

    const avgScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
      : 0;

    return { completedCount, avgScore };
  };

  const leaderboard = students
    .map(student => {
      const stats = getStudentStats(student.id);
      return {
        ...student,
        completedSubunits: stats.completedCount,
        avgScore: stats.avgScore
      };
    })
    .sort((a, b) => b.completedSubunits - a.completedSubunits || b.avgScore - a.avgScore);

  if (leaderboard.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No students yet</h3>
          <p className="text-gray-600">Students will appear here once they join and start learning</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Leaderboard</h2>
      
      {leaderboard.map((student, index) => (
        <Card key={student.id} className={`border-0 shadow-lg transition-all ${index < 3 ? 'bg-gradient-to-r from-yellow-50 to-white' : 'bg-white'}`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl ${
                index === 0 ? 'bg-yellow-100 text-yellow-700' :
                index === 1 ? 'bg-gray-200 text-gray-700' :
                index === 2 ? 'bg-orange-100 text-orange-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {index === 0 ? <Trophy className="w-7 h-7" /> :
                 index === 1 ? <Medal className="w-7 h-7" /> :
                 index === 2 ? <Award className="w-7 h-7" /> :
                 index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-black text-lg truncate">{student.full_name}</h3>
                <p className="text-sm text-gray-600 truncate">{student.email}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-black">{student.completedSubunits}</p>
                <p className="text-sm text-gray-600">topics completed</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{student.avgScore}%</p>
                <p className="text-sm text-gray-600">avg score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Per-class view of every assigned learning session + the per-student grade
// roll-up. Expand a session to see who finished it, when, and what they
// scored. Mirrors the dashboard's progress block but scoped to one class.
function AssignedSessionsTab({ assignedBundles, students }) {
  const [openId, setOpenId] = useState(null);

  if (!assignedBundles || assignedBundles.length === 0) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="py-12 text-center">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            No learning sessions assigned to this class yet
          </h3>
          <p className="text-sm text-gray-500">
            Use <strong>Curriculum → Create Curriculum with Quest → Create one learning session</strong> to assign one.
          </p>
        </CardContent>
      </Card>
    );
  }

  const rosterSize = students?.length || 0;

  return (
    <div className="space-y-3">
      {assignedBundles.map((a) => {
        const completions = a.completions || [];
        const scored = completions.filter((c) => c.quiz_score_pct !== null && c.quiz_score_pct !== undefined);
        const avgPct = scored.length
          ? Math.round(scored.reduce((s, r) => s + Number(r.quiz_score_pct), 0) / scored.length)
          : null;
        const ratioPct = rosterSize > 0 ? Math.round((completions.length / rosterSize) * 100) : 0;
        const isOpen = openId === a.id;
        const completionByStudent = new Map(completions.map((c) => [c.student_id, c]));
        return (
          <Card key={a.id} className="border border-gray-200">
            <CardContent className="p-0">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : a.id)}
                className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{a.bundle_title}</p>
                    <p className="text-xs text-slate-500 inline-flex items-center gap-3 mt-0.5">
                      <span>
                        <strong>{completions.length}/{rosterSize}</strong> done
                      </span>
                      {avgPct !== null && (
                        <span>· {avgPct}% avg</span>
                      )}
                      {a.due_at && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due {new Date(a.due_at).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>

              <div className="px-4 pb-3">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 transition-all" style={{ width: `${ratioPct}%` }} />
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/40">
                  {rosterSize === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-4">
                      No students enrolled in this class yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {students.map((s) => {
                        const c = completionByStudent.get(s.id);
                        const pct = c?.quiz_score_pct !== null && c?.quiz_score_pct !== undefined
                          ? Math.round(Number(c.quiz_score_pct))
                          : null;
                        const pctColor =
                          c === undefined ? "text-slate-400" :
                          pct === null ? "text-slate-500" :
                          pct >= 75 ? "text-emerald-700" :
                          pct >= 50 ? "text-amber-700" :
                          "text-red-700";
                        return (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-slate-100"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {s.full_name || s.email || "Student"}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {c?.completed_at
                                  ? `Done ${new Date(c.completed_at).toLocaleString(undefined, {
                                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                                    })}`
                                  : "Not started"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-base font-bold tabular-nums ${pctColor}`}>
                                {c === undefined ? "—" : pct !== null ? `${pct}%` : "—"}
                              </p>
                              {c?.quiz_total !== null && c?.quiz_total !== undefined && (
                                <p className="text-[10px] text-slate-400 tabular-nums">
                                  {c.quiz_correct ?? 0}/{c.quiz_total}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Per-test analytics: completion ratio, average score, and an expandable
// per-student breakdown. Mirrors AssignedSessionsTab.
function TestsTab({ testAssignments, students }) {
  const [openId, setOpenId] = useState(null);

  if (!testAssignments || testAssignments.length === 0) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="py-12 text-center">
          <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No tests assigned yet</h3>
          <p className="text-sm text-gray-500">
            Click <strong>Assign a test</strong> to build one from this class's curriculum.
          </p>
        </CardContent>
      </Card>
    );
  }

  const rosterSize = students?.length || 0;

  return (
    <div className="space-y-3">
      {testAssignments.map((a) => {
        const completions = a.completions || [];
        const scored = completions.filter((c) => c.score_pct !== null && c.score_pct !== undefined);
        const avgPct = scored.length
          ? Math.round(scored.reduce((s, r) => s + Number(r.score_pct), 0) / scored.length)
          : null;
        const ratioPct = rosterSize > 0 ? Math.round((completions.length / rosterSize) * 100) : 0;
        const isOpen = openId === a.id;
        const byStudent = new Map(completions.map((c) => [c.student_id, c]));
        const qCount = Array.isArray(a.question_ids) ? a.question_ids.length : 0;
        return (
          <Card key={a.id} className="border border-gray-200">
            <CardContent className="p-0">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : a.id)}
                className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{a.title}</p>
                    <p className="text-xs text-slate-500 inline-flex items-center gap-3 mt-0.5 flex-wrap">
                      <span><strong>{completions.length}/{rosterSize}</strong> done</span>
                      <span>· {qCount} question{qCount === 1 ? "" : "s"}</span>
                      {avgPct !== null && <span>· {avgPct}% avg</span>}
                      {a.due_at && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due {new Date(a.due_at).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>

              <div className="px-4 pb-3">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${ratioPct}%` }} />
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/40">
                  {rosterSize === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-4">
                      No students enrolled in this class yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {students.map((s) => {
                        const c = byStudent.get(s.id);
                        const pct =
                          c?.score_pct !== null && c?.score_pct !== undefined
                            ? Math.round(Number(c.score_pct))
                            : null;
                        const pctColor =
                          c === undefined ? "text-slate-400" :
                          pct === null ? "text-slate-500" :
                          pct >= 75 ? "text-emerald-700" :
                          pct >= 50 ? "text-amber-700" :
                          "text-red-700";
                        return (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-slate-100"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {s.full_name || s.email || "Student"}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {c?.completed_at
                                  ? `Done ${new Date(c.completed_at).toLocaleString(undefined, {
                                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                                    })}`
                                  : "Not started"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-base font-bold tabular-nums ${pctColor}`}>
                                {c === undefined ? "—" : pct !== null ? `${pct}%` : "—"}
                              </p>
                              {c?.total !== null && c?.total !== undefined && (
                                <p className="text-[10px] text-slate-400 tabular-nums">
                                  {c.correct ?? 0}/{c.total}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
