import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { REVIEW_INTERVALS } from "@/lib/spacedRepetition";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronLeft, 
  ChevronDown, 
  ChevronRight, 
  BookOpen, 
  CheckCircle, 
  XCircle,
  MessageCircle,
  Video,
  FileText,
  HelpCircle,
  Lightbulb,
  PenTool
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Resolve a stored choice value (could be 1–4 or "A"/"a" depending on era /
// quiz schema) into the actual choice text. Mirrors the attention-check
// helper so quiz responses display the chosen answer reliably.
const resolveChoice = (question, value) => {
  if (!question || value === undefined || value === null || value === "") return "";
  const v = String(value).toLowerCase().trim();
  const letterToNum = { a: "1", b: "2", c: "3", d: "4" };
  const numToLetter = { "1": "a", "2": "b", "3": "c", "4": "d" };
  if (question[`choice_${v}`] != null) return question[`choice_${v}`];
  if (letterToNum[v] && question[`choice_${letterToNum[v]}`] != null) return question[`choice_${letterToNum[v]}`];
  if (numToLetter[v] && question[`choice_${numToLetter[v]}`] != null) return question[`choice_${numToLetter[v]}`];
  return String(value);
};

export default function TeacherStudentDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get("studentId");
  const classId = urlParams.get("classId");

  const [student, setStudent] = useState(null);
  const [classData, setClassData] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [questionResponses, setQuestionResponses] = useState([]);
  const [inquiryResponses, setInquiryResponses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [learningSessions, setLearningSessions] = useState([]);
  const [caseStudyResponses, setCaseStudyResponses] = useState([]);
  const [caseStudies, setCaseStudies] = useState([]);
  const [videoQuestionResponses, setVideoQuestionResponses] = useState([]);
  const [attentionChecks, setAttentionChecks] = useState([]);
  const [attentionCheckResponses, setAttentionCheckResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedUnits, setExpandedUnits] = useState({});
  const [expandedSubunits, setExpandedSubunits] = useState({});
  const [subunitSessionType, setSubunitSessionType] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load student from enrollment (no need to access User list)
      const enrollments = await quest.entities.StudentEnrollment.filter({ student_id: studentId, class_id: classId });
      if (enrollments.length > 0) {
        setStudent({
          id: enrollments[0].student_id,
          full_name: enrollments[0].student_full_name,
          email: enrollments[0].student_email
        });
      }

      // Load class
      const classes = await quest.entities.Class.filter({ id: classId });
      if (classes.length > 0) {
        setClassData(classes[0]);

        // Load curriculum
        const curriculumData = await quest.entities.Curriculum.filter({ id: classes[0].curriculum_id });
        if (curriculumData.length > 0) {
          setCurriculum(curriculumData[0]);

          // Load units and subunits
          const unitsData = await quest.entities.Unit.filter({ curriculum_id: curriculumData[0].id }, "unit_order");
          setUnits(unitsData);

          const allSubunits = await quest.entities.Subunit.list();
          const relevantSubunits = allSubunits.filter(sub => 
            unitsData.some(unit => unit.id === sub.unit_id)
          ).sort((a, b) => a.subunit_order - b.subunit_order);
          setSubunits(relevantSubunits);
        }
      }

      // Load student progress
      const progress = await quest.entities.StudentProgress.filter({ student_id: studentId });
      setProgressData(progress);

      // Load question responses
      const responses = await quest.entities.QuestionResponse.filter({ student_id: studentId });
      setQuestionResponses(responses);

      // Load inquiry responses
      const inquiries = await quest.entities.InquiryResponse.filter({ student_id: studentId });
      setInquiryResponses(inquiries);

      // Load only the questions referenced by this student's responses, by id.
      // A blanket .list() is capped at ~1000 rows by PostgREST, so for a large
      // curriculum the needed questions can fall outside the page and the
      // lookup silently fails. (Newer responses also carry denormalized text,
      // so this is just a fallback for older rows.)
      const neededQuestionIds = [...new Set(responses.map((r) => r.question_id).filter(Boolean))];
      const allQuestions = neededQuestionIds.length
        ? await quest.entities.Question.filter({ id: neededQuestionIds })
        : [];
      setQuestions(allQuestions);

      const allQuizzes = await quest.entities.Quiz.list();
      setQuizzes(allQuizzes);

      // Load learning sessions
      const sessions = await quest.entities.LearningSession.filter({ student_id: studentId });
      setLearningSessions(sessions);

      // Load case study responses
      const csResponses = await quest.entities.CaseStudyResponse.filter({ student_id: studentId });
      setCaseStudyResponses(csResponses);

      // Load case studies
      const allCaseStudies = await quest.entities.CaseStudy.list();
      setCaseStudies(allCaseStudies);

      // Load video question responses
      const vqResponses = await quest.entities.VideoQuestionResponse.filter({ student_id: studentId });
      setVideoQuestionResponses(vqResponses);

      // Load attention checks
      const allChecks = await quest.entities.AttentionCheck.list();
      setAttentionChecks(allChecks);

      // Load attention check responses
      const acResponses = await quest.entities.AttentionCheckResponse.filter({ student_id: studentId });
      setAttentionCheckResponses(acResponses);

    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUnit = (unitId) => {
    setExpandedUnits(prev => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  const toggleSubunit = (subunitId) => {
    setExpandedSubunits(prev => ({ ...prev, [subunitId]: !prev[subunitId] }));
  };

  const getSubunitProgress = (subunitId) => {
    return progressData.find(p => p.subunit_id === subunitId);
  };

  const getSessionData = (subunitId, sessionType) => {
    const progress = getSubunitProgress(subunitId);
    const isReview = sessionType !== "new_topic";
    const reviewNum = isReview ? parseInt(sessionType.replace("review_", "")) : 0;

    // Attempts for THIS specific session (a review counts only its own review
    // number, not every review). Failed sessions still create a row, so a count
    // > 1 means it had to be redone.
    const allAttempts = learningSessions.filter(
      (ls) =>
        ls.subunit_id === subunitId &&
        ls.session_type === (isReview ? "review" : "new_topic") &&
        (!isReview || ls.review_number === reviewNum),
    );
    const attemptCount = allAttempts.length;
    const failedAttempts = allAttempts.filter((a) => !a.completed).length;
    const bestAttemptScore = allAttempts.length
      ? Math.max(...allAttempts.map((a) => a.score || 0))
      : null;

    if (!progress) {
      return { completed: false, score: bestAttemptScore, attemptCount, failedAttempts };
    }

    if (!isReview) {
      return {
        completed: progress.new_session_completed || false,
        score: progress.new_session_score || bestAttemptScore,
        attemptCount,
        failedAttempts,
      };
    }
    const completed = (progress.review_count || 0) >= reviewNum;
    const score = reviewNum === progress.review_count ? progress.last_review_score : bestAttemptScore;
    return { completed, score, attemptCount, failedAttempts };
  };

  const getSubunitResponses = (subunitId, sessionType) => {
    if (sessionType === "new_topic") {
      return questionResponses.filter(
        (r) => r.subunit_id === subunitId && r.session_type === "new_topic",
      );
    }
    // A specific review only — match its review number so reviews don't merge.
    const reviewNum = parseInt(sessionType.replace("review_", ""));
    return questionResponses.filter(
      (r) => r.subunit_id === subunitId && r.session_type === "review" && r.review_number === reviewNum,
    );
  };

  const getInquiryResponse = (subunitId) => {
    return inquiryResponses.find(r => r.subunit_id === subunitId);
  };

  const getCaseStudyResponse = (subunitId) => {
    return caseStudyResponses.find(r => r.subunit_id === subunitId);
  };

  const getCaseStudy = (subunitId) => {
    return caseStudies.find(cs => cs.subunit_id === subunitId);
  };

  const getVideoCheckResponses = (subunitId) => {
    return videoQuestionResponses.filter(vq => vq.subunit_id === subunitId);
  };

  const getAttentionCheckResponses = (subunitId) => {
    return attentionCheckResponses.filter(ac => ac.subunit_id === subunitId);
  };

  const getOverallAvgScore = () => {
    // Only include progress for subunits in the current class
    const classSubunitIds = subunits.map(s => s.id);
    let scores = [];
    progressData.forEach(p => {
      if (classSubunitIds.includes(p.subunit_id)) {
        if (p.new_session_completed && p.new_session_score) {
          scores.push(p.new_session_score);
        }
        if (p.last_review_score) {
          scores.push(p.last_review_score);
        }
      }
    });
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const avgScore = getOverallAvgScore();

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
              <div className="flex items-center gap-4">
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
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Student Info Card */}
          <Card className="border-0 shadow-xl bg-white mb-8 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl font-bold">
                  {student?.full_name?.charAt(0) || "?"}
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold mb-1">{student?.full_name}</h1>
                  <p className="text-indigo-100">{student?.email}</p>
                  <p className="text-indigo-200 text-sm mt-1">{classData?.class_name} • {curriculum?.subject_name}</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">{avgScore !== null ? `${avgScore}%` : '—'}</div>
                  <p className="text-indigo-100 text-sm">Overall Average</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Units and Subunits */}
          <div className="space-y-4">
            {units.map(unit => {
              const unitSubunits = subunits.filter(s => s.unit_id === unit.id);
              const completedCount = unitSubunits.filter(s => 
                getSubunitProgress(s.id)?.new_session_completed
              ).length;

              return (
                <Card key={unit.id} className="border-0 shadow-lg bg-white overflow-hidden">
                  <Collapsible 
                    open={expandedUnits[unit.id]} 
                    onOpenChange={() => toggleUnit(unit.id)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-all">
                        <div className="flex items-center gap-4">
                          {expandedUnits[unit.id] ? (
                            <ChevronDown className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-indigo-600" />
                          )}
                          <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div className="text-left">
                            <h2 className="text-lg font-bold text-gray-900">{unit.unit_name}</h2>
                            <p className="text-sm text-gray-500">{unitSubunits.length} topics</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">
                          {completedCount}/{unitSubunits.length} completed
                        </Badge>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t border-gray-100 p-4 space-y-3">
                        {unitSubunits.map(subunit => {
                          const progress = getSubunitProgress(subunit.id);
                          const currentSessionType = subunitSessionType[subunit.id] || "new_topic";
                          const sessionData = getSessionData(subunit.id, currentSessionType);
                          const responses = getSubunitResponses(subunit.id, currentSessionType);
                          const inquiry = getInquiryResponse(subunit.id);
                          // Count both the learn session and any review sessions.
                          const sessionCount =
                            (progress?.new_session_completed ? 1 : 0) + (progress?.review_count || 0);

                          return (
                            <Card key={subunit.id} className="border border-gray-200 shadow-sm">
                              <Collapsible
                                open={expandedSubunits[subunit.id]}
                                onOpenChange={() => toggleSubunit(subunit.id)}
                              >
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-all">
                                    <div className="flex items-center gap-3">
                                      {expandedSubunits[subunit.id] ? (
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                      )}
                                      <span className="font-medium text-gray-900">{subunit.subunit_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {progress?.new_session_completed ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                      ) : (
                                        <XCircle className="w-5 h-5 text-gray-300" />
                                      )}
                                      <Badge variant="outline" className="text-xs">
                                        {sessionCount} session{sessionCount === 1 ? "" : "s"}
                                      </Badge>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                                    {/* Session Selector */}
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-medium text-gray-700">View Session:</span>
                                      <Select
                                        value={currentSessionType}
                                        onValueChange={(val) => setSubunitSessionType(prev => ({ ...prev, [subunit.id]: val }))}
                                      >
                                        <SelectTrigger className="w-48 h-9 text-sm bg-white">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="new_topic">Learn Session</SelectItem>
                                          {REVIEW_INTERVALS.map((days, i) => (
                                            <SelectItem key={i} value={`review_${i + 1}`}>
                                              Review {i + 1} · {days} {days === 1 ? "day" : "days"}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      
                                      <div className="ml-auto flex items-center gap-2">
                                        {sessionData.completed ? (
                                          <Badge className="bg-green-600 text-white">Completed</Badge>
                                        ) : sessionData.attemptCount > 0 ? (
                                          <Badge className="bg-orange-500 text-white">
                                            Attempted ({sessionData.attemptCount})
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-gray-500">Not Yet Attempted</Badge>
                                        )}
                                        {sessionData.score !== null && (
                                          <Badge className={`${sessionData.score >= 70 ? 'bg-green-600' : 'bg-orange-500'} text-white`}>
                                            {sessionData.score}%
                                          </Badge>
                                        )}
                                      </div>
                                    </div>

                                    {/* Content Tabs — show whenever there's been at least one attempt
                                        (failed sessions still create responses + LearningSession rows). */}
                                    {currentSessionType === "new_topic" && (sessionData.completed || sessionData.attemptCount > 0) && (
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

                                    <TabsContent value="attention">
                                    {(() => {
                                    const acResps = getAttentionCheckResponses(subunit.id);
                                    if (acResps.length === 0) {
                                    return (
                                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-xl">
                                      <Video className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                      <p className="text-sm">No attention check responses recorded</p>
                                    </div>
                                    );
                                    }

                                    // Sort: incorrect first (matches the quiz tab's ordering).
                                    const sortedChecks = [...acResps].sort((a, b) => {
                                      if (a.is_correct === b.is_correct) return 0;
                                      return a.is_correct ? 1 : -1;
                                    });

                                    // Resolve a stored choice value (could be "A"/"B"/"C"/"D"
                                    // or 1–4 depending on era) into the actual choice text.
                                    const choiceText = (check, value) => {
                                      if (!check || value === undefined || value === null) return String(value ?? '');
                                      const v = String(value).toLowerCase().trim();
                                      const map = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' };
                                      const letter = map[v] || v;
                                      return check[`choice_${letter}`] ?? value;
                                    };

                                    return (
                                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-3">
                                    <Video className="w-5 h-5 text-blue-500" />
                                    <h4 className="font-semibold text-gray-900">Attention Checks</h4>
                                    <Badge variant="outline" className="ml-auto">
                                      {acResps.filter(v => v.is_correct).length}/{acResps.length} correct
                                    </Badge>
                                    </div>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {sortedChecks.map((acResp, idx) => {
                                      const check = attentionChecks.find(c => c.id === acResp.attention_check_id);
                                      return (
                                        <div
                                          key={idx}
                                          className={`p-3 rounded-lg ${
                                            acResp.is_correct
                                              ? 'bg-green-50 border border-green-200'
                                              : 'bg-red-50 border border-red-200'
                                          }`}
                                        >
                                          <div className="flex items-start gap-2">
                                            {acResp.is_correct ? (
                                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                            ) : (
                                              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1">
                                              <p className="text-sm text-gray-900 font-medium">
                                                {check?.question || `Check ${idx + 1}`}
                                              </p>
                                              {check && (
                                                <p className="text-xs text-gray-600 mt-1">
                                                  Selected: {choiceText(check, acResp.selected_choice)}
                                                  {!acResp.is_correct && (
                                                    <span className="text-green-600 ml-2">
                                                      (Correct: {choiceText(check, check.correct_choice)})
                                                    </span>
                                                  )}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    </div>
                                    </div>
                                    );
                                    })()}
                                    </TabsContent>

                                    <TabsContent value="quiz">
                                    {(() => {
                                    if (responses.length === 0) {
                                    return (
                                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-xl">
                                    <HelpCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">No quiz responses recorded</p>
                                    </div>
                                    );
                                    }

                                    // Sort by incorrect first
                                    const sortedResponses = [...responses].sort((a, b) => {
                                      if (a.is_correct === b.is_correct) return 0;
                                      return a.is_correct ? 1 : -1;
                                    });

                                    return (
                                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-3">
                                    <HelpCircle className="w-5 h-5 text-blue-500" />
                                    <h4 className="font-semibold text-gray-900">Quiz Responses</h4>
                                    <Badge variant="outline" className="ml-auto">
                                      {responses.filter(r => r.is_correct).length}/{responses.length} correct
                                    </Badge>
                                    </div>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {sortedResponses.map((response, idx) => {
                                      const question = questions.find(q => q.id === response.question_id);
                                      return (
                                        <div 
                                          key={response.id || idx} 
                                          className={`p-3 rounded-lg ${
                                            response.is_correct 
                                              ? 'bg-green-50 border border-green-200' 
                                              : 'bg-red-50 border border-red-200'
                                          }`}
                                        >
                                          <div className="flex items-start gap-2">
                                            {response.is_correct ? (
                                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                            ) : (
                                              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1">
                                              <p className="text-sm text-gray-900 font-medium">
                                                {response.question_text || question?.question_text || `Question ${idx + 1}`}
                                              </p>
                                              {(response.selected_choice_text || question) && (
                                                <p className="text-xs text-gray-600 mt-1">
                                                  Selected: {response.selected_choice_text || resolveChoice(question, response.selected_choice)}
                                                  {!response.is_correct && (
                                                    <span className="text-green-600 ml-2">
                                                      (Correct: {response.correct_choice_text || resolveChoice(question, question?.correct_choice)})
                                                    </span>
                                                  )}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    </div>
                                    </div>
                                    );
                                    })()}
                                    </TabsContent>

                                    <TabsContent value="casestudy">
                                    {(() => {
                                    const csResponse = getCaseStudyResponse(subunit.id);
                                    const caseStudy = getCaseStudy(subunit.id);

                                    if (!csResponse) {
                                    return (
                                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-xl">
                                     <PenTool className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                     <p className="text-sm">No case study response recorded</p>
                                    </div>
                                    );
                                    }

                                    return (
                                    <div className="bg-white rounded-xl p-4 border border-purple-200">
                                    <div className="flex items-center justify-between mb-4">
                                     <div className="flex items-center gap-2">
                                       <PenTool className="w-5 h-5 text-purple-500" />
                                       <h4 className="font-semibold text-gray-900">Case Study Responses</h4>
                                     </div>
                                     <Badge className={`${csResponse.total_score >= 2.8 ? 'bg-green-600' : 'bg-orange-500'} text-white`}>
                                       {csResponse.total_score}/4
                                     </Badge>
                                    </div>

                                    <div className="space-y-4 max-h-80 overflow-y-auto">
                                     {['a', 'b', 'c', 'd'].map((letter) => {
                                       const questionKey = `question_${letter}`;
                                       const answerKey = `answer_${letter}`;
                                       const scoreKey = `score_${letter}`;
                                       const feedbackKey = `feedback_${letter}`;

                                       const questionText = caseStudy?.[questionKey] || `Question ${letter.toUpperCase()}`;
                                       const correctAnswer = caseStudy?.[`answer_${letter}`] || "";
                                       const studentAnswer = csResponse[answerKey];
                                       const score = csResponse[scoreKey] || 0;
                                       const feedback = csResponse[feedbackKey] || "";
                                       const isCorrect = score >= 0.7;

                                       return (
                                         <div key={letter} className={`rounded-lg p-3 border-2 ${
                                           isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                                         }`}>
                                           <div className="flex items-start justify-between mb-2">
                                             <p className="text-xs font-semibold text-gray-900 mb-1">
                                               ({letter.toUpperCase()}) {questionText}
                                             </p>
                                             <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                               {isCorrect ? (
                                                 <CheckCircle className="w-5 h-5 text-green-600" />
                                               ) : (
                                                 <XCircle className="w-5 h-5 text-red-500" />
                                               )}
                                               <Badge className={`${isCorrect ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                                                 {score.toFixed(1)}/1
                                               </Badge>
                                             </div>
                                           </div>

                                           <div className="space-y-2">
                                             <div className="bg-white p-2 rounded border border-gray-200">
                                               <p className="text-xs font-medium text-gray-600 mb-1">Student Answer:</p>
                                               <p className="text-sm text-gray-900">
                                                 {studentAnswer || <span className="italic text-gray-400">No answer provided</span>}
                                               </p>
                                             </div>

                                             {!isCorrect && correctAnswer && (
                                               <div className="bg-green-50 p-2 rounded border border-green-200">
                                                 <p className="text-xs font-medium text-green-700 mb-1">Expected Answer:</p>
                                                 <p className="text-sm text-green-900">{correctAnswer}</p>
                                               </div>
                                             )}

                                             {feedback && (
                                               <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                                 <p className="text-xs font-medium text-blue-700 mb-1">AI Feedback:</p>
                                                 <p className="text-sm text-blue-900">{feedback}</p>
                                               </div>
                                             )}
                                           </div>
                                         </div>
                                       );
                                     })}
                                    </div>
                                    </div>
                                    );
                                    })()}
                                    </TabsContent>
                                    </Tabs>
                                    )}

                                        {/* Review Session Quiz Responses — for THIS review only */}
                                        {currentSessionType !== "new_topic" && responses.length === 0 && (
                                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                                        <HelpCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                        <p className="text-sm font-medium">Not Yet Attempted</p>
                                        </div>
                                        )}
                                        {currentSessionType !== "new_topic" && responses.length > 0 && (
                                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                                        <div className="flex items-center gap-2 mb-3">
                                        <HelpCircle className="w-5 h-5 text-blue-500" />
                                        <h4 className="font-semibold text-gray-900">Review Quiz Responses</h4>
                                        <Badge variant="outline" className="ml-auto">
                                        {responses.filter(r => r.is_correct).length}/{responses.length} correct
                                        </Badge>
                                        </div>
                                        {sessionData.attemptCount > 1 && (
                                        <p className="text-xs text-amber-600 mb-2">
                                        Took {sessionData.attemptCount} attempts — showing the latest{sessionData.completed ? " (passing)" : ""} attempt.
                                        </p>
                                        )}
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {responses.map((response, idx) => {
                                        const question = questions.find(q => q.id === response.question_id);
                                        return (
                                        <div 
                                        key={response.id || idx} 
                                        className={`p-3 rounded-lg ${
                                          response.is_correct 
                                            ? 'bg-green-50 border border-green-200' 
                                            : 'bg-red-50 border border-red-200'
                                        }`}
                                        >
                                        <div className="flex items-start gap-2">
                                          {response.is_correct ? (
                                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                          ) : (
                                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                          )}
                                          <div className="flex-1">
                                            <p className="text-sm text-gray-900 font-medium">
                                              {response.question_text || question?.question_text || `Question ${idx + 1}`}
                                            </p>
                                            {(response.selected_choice_text || question) && (
                                              <p className="text-xs text-gray-600 mt-1">
                                                Selected: {response.selected_choice_text || resolveChoice(question, response.selected_choice)}
                                                {!response.is_correct && (
                                                  <span className="text-green-600 ml-2">
                                                    (Correct: {response.correct_choice_text || resolveChoice(question, question?.correct_choice)})
                                                  </span>
                                                )}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        </div>
                                        );
                                        })}
                                        </div>
                                        </div>
                                        )}

                                        {/* No Data Message — learn session only (reviews show "Not Yet Attempted" above) */}
                                        {currentSessionType === "new_topic" && !sessionData.completed && sessionData.attemptCount === 0 && !inquiry && (
                                        <div className="text-center py-6 text-gray-500">
                                        <p>Not Yet Attempted</p>
                                        </div>
                                        )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </Card>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}