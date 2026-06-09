import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Target,
  Filter,
  ChevronRight,
  BookOpen,
  Home,
  BarChart3,
  FileText,
  Flame,
  LogOut,
  ChevronLeft,
  Clock,
  Calendar,
  CheckCircle2,
  Sparkles,
  User as UserIcon,
  Users
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StudentSidebar from "../components/shared/StudentSidebar";
import NotificationModal from "../components/shared/NotificationModal";
import { useNotification } from "../components/shared/useNotification";

export default function LearningHub() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("today");
  const [hasClass, setHasClass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("learning-hub");
  const [enrollments, setEnrollments] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [user, setUser] = useState(null);
  const [studentProgress, setStudentProgress] = useState([]);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [curriculum, setCurriculum] = useState(null);
  const [dayStreak, setDayStreak] = useState(0);
  const [learnedTopics, setLearnedTopics] = useState(0);
  const [assignments, setAssignments] = useState([]);
  const [assignedBundles, setAssignedBundles] = useState([]);
  // Student-created self-sessions due today (scheduled_for <= today,
  // not yet completed). Includes both the original session and any
  // queued review entries.
  const [selfSessions, setSelfSessions] = useState([]);
  const [todayLearningSessions, setTodayLearningSessions] = useState([]);
  const [allCompletedSessions, setAllCompletedSessions] = useState([]);
  const { notification, showError, closeNotification } = useNotification();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClassId && user && classes.length > 0) {
      loadClassData();
    }
  }, [selectedClassId, user, classes]);

  const loadData = async () => {
    try {
      const currentUser = await quest.auth.me();
      
      // Redirect teachers to teacher dashboard
      if (currentUser.account_type === "teacher") {
        navigate(createPageUrl("TeacherDashboard"));
        return;
      }
      
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      setUser(currentUser);

      // Self-created sessions due today — independent of class enrollment.
      // Reads from student_self_sessions via direct supabase (RLS scopes
      // to the current student). Pull the parent bundle title in one
      // grouped fetch so cards have something to show. Sorted ascending by
      // scheduled_for so the oldest due item appears first.
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: dueSessions } = await import("@/components/lib/supabase-client").then(
          ({ supabase }) =>
            supabase
              .from("student_self_sessions")
              .select("id, bundle_id, scheduled_for, review_number, review_enabled, completed_at, quiz_score_pct")
              .eq("student_id", currentUser.id)
              .is("completed_at", null)
              .lte("scheduled_for", todayStr)
              .order("scheduled_for", { ascending: true })
        );
        const bundleIds = [...new Set((dueSessions || []).map((s) => s.bundle_id))];
        let bundleMap = new Map();
        if (bundleIds.length > 0) {
          const bundles = await quest.entities.LessonBundle.filter(
            { id: bundleIds },
            "-created_at"
          ).catch(() => []);
          bundleMap = new Map((bundles || []).map((b) => [b.id, b]));
        }
        setSelfSessions(
          (dueSessions || []).map((s) => ({
            ...s,
            bundle_title: bundleMap.get(s.bundle_id)?.title || "My learning session",
          }))
        );
      } catch (err) {
        console.warn("Could not load self-sessions:", err);
        setSelfSessions([]);
      }

      const enrollmentsData = await quest.entities.StudentEnrollment.filter({ student_id: currentUser.id });
      setEnrollments(enrollmentsData);
      setHasClass(enrollmentsData.length > 0);

      if (enrollmentsData.length > 0) {
        const allClasses = await quest.entities.Class.list();
        const validClasses = enrollmentsData
          .map(e => allClasses.find(c => c.id === e.class_id))
          .filter(Boolean);
        setClasses(validClasses);
        
        const savedClassId = localStorage.getItem('selectedClassId');
        if (savedClassId && validClasses.some(c => c.id === savedClassId)) {
          setSelectedClassId(savedClassId);
        } else if (validClasses.length > 0) {
          setSelectedClassId(validClasses[0].id);
          localStorage.setItem('selectedClassId', validClasses[0].id);
        }

        const progressData = await quest.entities.StudentProgress.filter({ student_id: currentUser.id });
        setStudentProgress(progressData);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadClassData = async () => {
    try {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      if (!selectedClass) return;

      // Lesson-bundle assignments are class-scoped (no curriculum
      // required), so fetch them BEFORE the curriculum gate below.
      // Otherwise classes with curriculum_id = null (e.g. tutor / Generate-
      // only classes) silently skip the bundle list. The orderBy column
      // must be a real column on the table — the SDK default
      // "-created_date" 400s and the catch zeroes the list.
      try {
        const bundleAssns = await quest.entities.LearningSessionAssignment.filter(
          { class_id: selectedClassId },
          "-assigned_at"
        );
        const bundleIds = [...new Set((bundleAssns || []).map(a => a.bundle_id))];
        if (bundleIds.length > 0) {
          const bundles = await quest.entities.LessonBundle.filter(
            { id: bundleIds },
            "-created_at"
          );
          const bundleMap = new Map((bundles || []).map(b => [b.id, b]));

          // Completion rows for these assignments — one query for the
          // whole list. RLS scopes the result to the current student.
          const assignmentIds = (bundleAssns || []).map(a => a.id);
          const completions = await quest.entities.StudentBundleCompletion.filter(
            { student_id: user.id, assignment_id: assignmentIds },
            "-completed_at"
          ).catch(() => []);
          const completionMap = new Map((completions || []).map(c => [c.assignment_id, c]));

          setAssignedBundles(
            (bundleAssns || []).map(a => ({
              ...a,
              bundle_title: bundleMap.get(a.bundle_id)?.title || "Learning session",
              source_type: bundleMap.get(a.bundle_id)?.source_type || null,
              completion: completionMap.get(a.id) || null,
            }))
          );
        } else {
          setAssignedBundles([]);
        }
      } catch (err) {
        console.warn("Could not load assigned bundles:", err);
        setAssignedBundles([]);
      }

      const curriculumData = selectedClass.curriculum_id
        ? await quest.entities.Curriculum.filter({ id: selectedClass.curriculum_id })
        : [];
      if (curriculumData.length > 0) {
        setCurriculum(curriculumData[0]);

        const unitsData = await quest.entities.Unit.filter({ curriculum_id: curriculumData[0].id }, "unit_order");
        setUnits(unitsData);

        const allSubunits = await quest.entities.Subunit.list();
        const relevantSubunits = allSubunits
          .filter(sub => unitsData.some(unit => unit.id === sub.unit_id))
          .sort((a, b) => a.subunit_order - b.subunit_order);
        setSubunits(relevantSubunits);

        // Load assignments for this class
        const classAssignments = await quest.entities.Assignment.filter({ class_id: selectedClassId });
        setAssignments(classAssignments);

        // Calculate learned topics (subunits with new session completed in this class)
        const classSubunitIds = relevantSubunits.map(s => s.id);
        const learned = studentProgress.filter(p => 
          classSubunitIds.includes(p.subunit_id) && p.new_session_completed === true
        ).length;
        setLearnedTopics(learned);

        // Calculate day streak from completed learning sessions
         const allUserSessions = await quest.entities.LearningSession.filter({ student_id: user.id, completed: true }, "-start_time");
         const classLearningSessions = allUserSessions.filter(session =>
             classSubunitIds.includes(session.subunit_id)
         );
         const streak = calculateDayStreak(classLearningSessions);
         setDayStreak(streak);

         // Store all completed sessions for the Completed tab
         setAllCompletedSessions(classLearningSessions);

         // Store today's sessions for later stats calculation
         const today = new Date();
         const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
         const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

         const todaySessions = classLearningSessions.filter(s => {
           const sessionEnd = new Date(s.end_time);
           return sessionEnd >= todayStart && sessionEnd < todayEnd;
         });
         setTodayLearningSessions(todaySessions);
        }
        } catch (err) {
        console.error("Error loading class data:", err);
        }
        };

        const calculateDayStreak = (sessions) => {
          if (sessions.length === 0) return 0;

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const sessionDates = sessions
            .map(s => {
              const date = new Date(s.start_time);
              date.setHours(0, 0, 0, 0);
              return date.getTime();
            })
            .filter((date, index, self) => self.indexOf(date) === index)
            .sort((a, b) => b - a);

          if (sessionDates.length === 0) return 0;

          const mostRecentDate = sessionDates[0];
          const daysSinceRecent = Math.floor((today.getTime() - mostRecentDate) / (1000 * 60 * 60 * 24));

          if (daysSinceRecent > 1) return 0;

          let streak = 0;
          let expectedDate = today.getTime();
          if (daysSinceRecent === 1) { 
              expectedDate = today.getTime() - (1000 * 60 * 60 * 24);
          }

          for (const sessionDate of sessionDates) {
            const diff = Math.floor((expectedDate - sessionDate) / (1000 * 60 * 60 * 24));

            if (diff === 0) {
                streak++;
                expectedDate = sessionDate - (1000 * 60 * 60 * 24);
            } else if (diff > 0) {
                break;
            }
          }

          return streak;
        };

  const getAssignmentDueDate = (subunitId) => {
    const assignment = assignments.find(a => a.subunit_id === subunitId);
    return assignment?.due_date ? new Date(assignment.due_date) : null;
  };

  const isSubunitAssigned = (subunitId) => {
    return assignments.some(a => a.subunit_id === subunitId);
  };

  const isAssessmentSubunit = () => false;

  const getTodayNewSessions = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Only show new topics that have an assignment with due date <= today
    return subunits
      .filter(sub => {
        const progress = studentProgress.find(p => p.subunit_id === sub.id);
        
        // Skip assessment subunits that are already completed
        if (isAssessmentSubunit(sub.id) && progress?.new_session_completed) return false;
        
        // For non-assessment subunits, skip if completed
        if (!isAssessmentSubunit(sub.id) && progress?.new_session_completed) return false;
        
        // Must have an assignment
        const assignment = assignments.find(a => a.subunit_id === sub.id);
        if (!assignment?.due_date) return false;
        
        // Due date must be today or earlier
        const dueDate = new Date(assignment.due_date + 'T00:00:00');
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        return dueDateOnly <= today;
      })
      .map(sub => {
        const unit = units.find(u => u.id === sub.unit_id);
        const assignment = assignments.find(a => a.subunit_id === sub.id);
        const dueDate = new Date(assignment.due_date + 'T00:00:00');
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const daysLate = Math.max(0, Math.floor((today - dueDateOnly) / (1000 * 60 * 60 * 24)));
        
        return {
          id: sub.id,
          topic: sub.subunit_name,
          unit: unit?.unit_name || "Unit",
          type: "New Topic",
          status: daysLate > 0 ? "overdue" : "available",
          subunitId: sub.id,
          dueDate: dueDate.toISOString(),
          daysLate
        };
      });
  };

  const getReviewSessions = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const subunitReviews = studentProgress
      .filter(p => p.new_session_completed && p.next_review_date)
      .map(p => {
        const subunit = subunits.find(s => s.id === p.subunit_id);
        if (!subunit) return null;

        const unit = units.find(u => u.id === subunit.unit_id);
        const nextReview = new Date(p.next_review_date);
        const dueDate = new Date(nextReview.getFullYear(), nextReview.getMonth(), nextReview.getDate());
        const daysLate = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));

        return {
          id: p.id,
          topic: subunit.subunit_name,
          unit: unit?.unit_name || "Unit",
          reviewNumber: p.review_count + 1,
          daysLate,
          dueDate: p.next_review_date,
          status: daysLate > 0 ? "overdue" : (dueDate.getTime() === today.getTime() ? "due" : "upcoming"),
          subunitId: subunit.id,
          nextReviewDate: dueDate,
          source: "subunit",
        };
      })
      .filter(Boolean);

    // Bundle-based reviews — assigned learning sessions written by the
    // chooser modal. student_bundle_completion gets next_review_date set
    // on first save (see AssignedSessionPlay), so reviews work the same
    // way as subunit-anchored ones.
    const bundleReviews = (assignedBundles || [])
      .filter(b => b.completion?.next_review_date)
      .map(b => {
        const nextReview = new Date(b.completion.next_review_date);
        const dueDate = new Date(nextReview.getFullYear(), nextReview.getMonth(), nextReview.getDate());
        const daysLate = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
        return {
          id: `bundle_${b.id}`,
          topic: b.bundle_title,
          unit: "Assigned session",
          reviewNumber: (b.completion.review_count || 0) + 1,
          daysLate,
          dueDate: b.completion.next_review_date,
          status: daysLate > 0 ? "overdue" : (dueDate.getTime() === today.getTime() ? "due" : "upcoming"),
          assignmentId: b.id,
          nextReviewDate: dueDate,
          source: "bundle",
        };
      });

    return [...subunitReviews, ...bundleReviews]
      .filter(r => r.status === "overdue" || r.status === "due")
      .sort((a, b) => b.daysLate - a.daysLate || a.nextReviewDate - b.nextReviewDate);
  };

  const getUpcomingSessions = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = [];

    // Get review sessions
    const reviews = studentProgress
      .filter(p => p.new_session_completed && p.next_review_date)
      .map(p => {
        const subunit = subunits.find(s => s.id === p.subunit_id);
        if (!subunit) return null;

        const unit = units.find(u => u.id === subunit.unit_id);
        const nextReview = new Date(p.next_review_date);
        const dueDate = new Date(nextReview.getFullYear(), nextReview.getMonth(), nextReview.getDate());

        if (dueDate <= today) return null;

        return {
          id: p.id,
          topic: subunit.subunit_name,
          unit: unit?.unit_name || "Unit",
          reviewNumber: p.review_count + 1,
          dueDate: p.next_review_date,
          status: "scheduled",
          nextReviewDate: dueDate,
          type: "review"
        };
      })
      .filter(Boolean);

    upcoming.push(...reviews);

    // Get future assigned new topics (due date > today)
    const futureNewTopics = subunits
      .filter(sub => {
        const progress = studentProgress.find(p => p.subunit_id === sub.id);
        if (progress?.new_session_completed) return false;
        
        const assignment = assignments.find(a => a.subunit_id === sub.id);
        if (!assignment?.due_date) return false;
        
        const dueDate = new Date(assignment.due_date + 'T00:00:00');
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        return dueDateOnly > today;
      })
      .map(sub => {
        const unit = units.find(u => u.id === sub.unit_id);
        const assignment = assignments.find(a => a.subunit_id === sub.id);
        const dueDate = new Date(assignment.due_date + 'T00:00:00');
        
        return {
          id: sub.id,
          topic: sub.subunit_name,
          unit: unit?.unit_name || "Unit",
          dueDate: dueDate.toISOString(),
          status: "scheduled",
          nextReviewDate: dueDate,
          type: "new"
        };
      });

    upcoming.push(...futureNewTopics);

    return upcoming.sort((a, b) => a.nextReviewDate - b.nextReviewDate);
  };

  const getCompletedSessions = () => {
    if (!subunits || !allCompletedSessions) return [];

    const progressMap = {};
    studentProgress.forEach(p => { progressMap[p.subunit_id] = p; });

    return allCompletedSessions.map(s => {
      const subunit = subunits.find(sub => sub.id === s.subunit_id);
      if (!subunit) return null;
      const unit = units.find(u => u.id === subunit.unit_id);
      const p = progressMap[s.subunit_id];

      // Score is stored directly on the LearningSession (new field)
      const score = s.score ?? (s.session_type === "review" ? (p?.last_review_score || 0) : (p?.new_session_score || 0));
      let type = "New Session";
      if (s.session_type === "review") {
        type = "Review";
      } else {
        const name = subunit.subunit_name?.toLowerCase() || "";
        if (name.includes("pre-test") || name.includes("pre test")) type = "Pre-Test";
        else if (name.includes("post-test") || name.includes("post test")) type = "Post-Test";
        else type = "New Session";
      }

      return {
        id: s.id,
        topic: subunit.subunit_name,
        unit: unit?.unit_name || "Unit",
        completedDate: s.end_time || s.start_time,
        score,
        type
      };
    }).filter(Boolean).sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate));
  };

  const newSessions = getTodayNewSessions();
  const reviewSessions = getReviewSessions();
  const upcomingSessions = getUpcomingSessions();
  const completedSessions = getCompletedSessions();

  const getTodayStats = (todayLearningSessions, studentProgress, classSubunitIds) => {
    if (!todayLearningSessions || !studentProgress || !classSubunitIds) return { masteredToday: 0, timeSpentToday: 0 };

    const masteredToday = todayLearningSessions.filter(s => {
      const progress = studentProgress.find(p => p.subunit_id === s.subunit_id);
      return classSubunitIds.includes(s.subunit_id) && progress?.new_session_completed === true;
    }).length;

    const timeSpentToday = todayLearningSessions.reduce((sum, s) => sum + (s.total_time_seconds || 0), 0);

    return {
      masteredToday,
      timeSpentToday: Math.round(timeSpentToday / 60)
    };
  };

  const todayStats = getTodayStats(todayLearningSessions, studentProgress, subunits.map(s => s.id));
  const sessionsDueToday = newSessions.length + reviewSessions.filter(s => s.status === "due" || s.status === "overdue").length;

  const handleSignOut = () => {
    quest.auth.logout();
  };

  const handleNavigation = (tab, route) => {
    setActiveNav(tab);
    if (route) {
      navigate(createPageUrl(route));
    }
  };

  const handleNewSessionClick = (session) => {
    navigate(createPageUrl("NewSession") + `?topic=${encodeURIComponent(session.subunitId)}`);
  };

  const handleReviewSessionClick = (session) => {
    // Bundle-based reviews → replay the assigned session via AssignedSessionPlay.
    // Subunit-based reviews → PracticeSession with the SM2 review counter.
    if (session.source === "bundle" && session.assignmentId) {
      navigate(createPageUrl("AssignedSessionPlay") + `?assignment_id=${session.assignmentId}&review=${session.reviewNumber}`);
      return;
    }
    const subunitId = session.subunitId || session.id;
    navigate(createPageUrl("PracticeSession") + `?topic=${encodeURIComponent(subunitId)}&review=${session.reviewNumber}`);
  };

  const todaySessions = [
    ...newSessions.map(s => ({ ...s, category: "new" })),
    ...reviewSessions.filter(s => s.status === "due" || s.status === "overdue").map(s => ({ ...s, category: "review" }))
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <StudentSidebar
        activeNav={activeNav}
        classes={classes}
        selectedClassId={selectedClassId}
        onClassChange={(val) => {
          setSelectedClassId(val);
          localStorage.setItem('selectedClassId', val);
        }}
        user={user}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-white" style={{fontFamily: '"Inter", sans-serif'}}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !hasClass && selfSessions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 bg-[#2563EB]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Home className="w-12 h-12 text-[#2563EB]" />
              </div>
              <h2 className="text-3xl font-bold text-[#1A1A1A] mb-3">Get started</h2>
              <p className="text-[#1A1A1A]/70 mb-8" style={{fontWeight: 450}}>
                Join a class with the code your teacher shared.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate(createPageUrl("JoinClass"))}
                  className="bg-[#2563EB] hover:bg-[#2563EB]/90 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all font-semibold"
                >
                  Join a class
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div className="max-w-7xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-black mb-1">Learning Hub</h1>
            <p className="text-sm text-gray-600">Your personalized learning journey</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {selfSessions.length > 0 && (
                <Card className="border border-blue-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-black">My sessions due today</h2>
                      </div>
                      <Badge variant="secondary" className="text-xs">{selfSessions.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {selfSessions.map((s) => {
                        const isReview = (s.review_number ?? 0) > 0;
                        const scheduledDate = new Date(`${s.scheduled_for}T00:00:00`);
                        const overdue = scheduledDate < new Date(new Date().setHours(0, 0, 0, 0));
                        return (
                          <div
                            key={s.id}
                            onClick={() => navigate(createPageUrl(`SelfSessionPlay?session_id=${s.id}`))}
                            className={`flex items-center justify-between p-4 border rounded-lg hover:border-blue-400 transition-all cursor-pointer ${
                              overdue ? "border-amber-200 bg-amber-50" : "border-blue-100 bg-blue-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${overdue ? "bg-amber-100" : "bg-blue-100"}`}>
                                <Sparkles className={`w-5 h-5 ${overdue ? "text-amber-700" : "text-blue-600"}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-black text-sm">{s.bundle_title}</h3>
                                  {isReview && (
                                    <Badge className="text-xs bg-blue-100 text-blue-700">
                                      Review #{s.review_number}
                                    </Badge>
                                  )}
                                  {overdue && (
                                    <Badge className="text-xs bg-amber-100 text-amber-700">Overdue</Badge>
                                  )}
                                </div>
                                <p className={`text-xs ${overdue ? "text-amber-700" : "text-blue-700"}`}>
                                  Scheduled {scheduledDate.toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {assignedBundles.length > 0 && (
                <Card className="border border-violet-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-violet-600" />
                        <h2 className="text-lg font-semibold text-black">Assigned by your teacher</h2>
                      </div>
                      <Badge variant="secondary" className="text-xs">{assignedBundles.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {assignedBundles.map((a) => {
                        const isDone = !!a.completion;
                        const overdue = !isDone && a.due_at && new Date(a.due_at) < new Date();
                        const cardBg = isDone
                          ? "border-emerald-200 bg-emerald-50"
                          : overdue
                          ? "border-red-200 bg-red-50"
                          : "border-violet-100 bg-violet-50";
                        const iconBg = isDone
                          ? "bg-emerald-100"
                          : overdue
                          ? "bg-red-100"
                          : "bg-violet-100";
                        const iconColor = isDone
                          ? "text-emerald-600"
                          : overdue
                          ? "text-red-600"
                          : "text-violet-600";
                        const Icon = isDone ? CheckCircle2 : Sparkles;
                        return (
                          <div
                            key={a.id}
                            onClick={() => navigate(createPageUrl(`AssignedSessionPlay?assignment_id=${a.id}`))}
                            className={`flex items-center justify-between p-4 border rounded-lg hover:border-violet-400 transition-all cursor-pointer ${cardBg}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
                                <Icon className={`w-5 h-5 ${iconColor}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-black text-sm">{a.bundle_title}</h3>
                                  {isDone && (
                                    <Badge className="text-xs bg-emerald-100 text-emerald-700">
                                      {a.completion.quiz_total
                                        ? `${a.completion.quiz_score_pct}%`
                                        : "Done"}
                                    </Badge>
                                  )}
                                  {!isDone && overdue && (
                                    <Badge className="text-xs bg-red-100 text-red-700">Overdue</Badge>
                                  )}
                                </div>
                                <p className={`text-xs ${isDone ? "text-emerald-700" : overdue ? "text-red-600" : "text-gray-500"}`}>
                                  {isDone
                                    ? `Submitted ${new Date(a.completion.completed_at).toLocaleDateString()}`
                                    : a.due_at
                                    ? `Due ${new Date(a.due_at).toLocaleDateString()}`
                                    : "No due date"}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5" />
                      <h2 className="text-lg font-semibold text-black">Learning Sessions</h2>
                    </div>
                    <Badge variant="secondary" className="text-xs">{todaySessions.length} due</Badge>
                  </div>

                  <div className="flex gap-6 mb-6 border-b border-gray-200">
                    <button onClick={() => setActiveTab("today")} className={`pb-3 text-sm font-medium flex items-center gap-1.5 relative transition-all ${activeTab === "today" ? "text-black" : "text-gray-500"}`}>
                      <Clock className="w-4 h-4" />
                      Today
                      {activeTab === "today" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"></div>}
                    </button>
                    <button onClick={() => setActiveTab("upcoming")} className={`pb-3 text-sm font-medium flex items-center gap-1.5 relative transition-all ${activeTab === "upcoming" ? "text-black" : "text-gray-500"}`}>
                      <Calendar className="w-4 h-4" />
                      Upcoming
                      {activeTab === "upcoming" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"></div>}
                    </button>
                    <button onClick={() => setActiveTab("completed")} className={`pb-3 text-sm font-medium flex items-center gap-1.5 relative transition-all ${activeTab === "completed" ? "text-black" : "text-gray-500"}`}>
                      <CheckCircle2 className="w-4 h-4" />
                      Completed
                      {activeTab === "completed" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"></div>}
                    </button>
                  </div>

                  {activeTab === "today" && (
                    <div className="space-y-4">
                      {newSessions.length === 0 && reviewSessions.length === 0 && (
                        <div className="text-center py-12">
                          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                          <h3 className="font-semibold text-gray-700 mb-1">You're all caught up!</h3>
                          <p className="text-sm text-gray-500">No sessions due today. Check the Upcoming tab to see what's next.</p>
                        </div>
                      )}
                      {newSessions.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Topics</h3>
                          <div className="space-y-3">
                            {newSessions.map((session) => (
                                    <div 
                                      key={session.id} 
                                      onClick={() => handleNewSessionClick(session)}
                                      className={`flex items-center justify-between p-4 border rounded-lg hover:border-gray-400 transition-all cursor-pointer ${session.status === "overdue" ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 border rounded-lg flex items-center justify-center ${session.status === "overdue" ? "bg-red-100 border-red-200" : "bg-green-100 border-green-200"}`}>
                                          <BookOpen className={`w-5 h-5 ${session.status === "overdue" ? "text-red-600" : "text-green-600"}`} />
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-black text-sm">{session.topic}</h3>
                                            {session.status === "overdue" ? (
                                              <Badge className="text-xs bg-red-100 text-red-700">{session.daysLate}d late</Badge>
                                            ) : (
                                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">New</Badge>
                                            )}
                                          </div>
                                          <p className={`text-xs ${session.status === "overdue" ? "text-red-600" : "text-gray-500"}`}>
                                            {session.unit}{session.dueDate && ` • Due ${new Date(session.dueDate).toLocaleDateString()}`}
                                          </p>
                                        </div>
                                      </div>
                                      <ChevronRight className="w-4 h-4 text-gray-400" />
                                    </div>
                                  ))}
                          </div>
                        </div>
                      )}

                      {reviewSessions.filter(s => s.status === "overdue").length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-red-600 mb-3">Overdue Reviews</h3>
                          <div className="space-y-3">
                            {reviewSessions.filter(s => s.status === "overdue").map((session) => (
                              <div 
                                key={session.id} 
                                onClick={() => handleReviewSessionClick(session)}
                                className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg hover:border-red-400 transition-all cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-red-100 border border-red-200 rounded-lg flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-red-600" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-semibold text-black text-sm">{session.topic}</h3>
                                      <Badge className="text-xs bg-red-100 text-red-700">Review #{session.reviewNumber}</Badge>
                                    </div>
                                    <p className="text-xs text-red-600">{session.unit} • {session.daysLate}d overdue</p>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {reviewSessions.filter(s => s.status === "due").length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Due Today</h3>
                          <div className="space-y-3">
                            {reviewSessions.filter(s => s.status === "due").map((session) => (
                              <div 
                                key={session.id} 
                                onClick={() => handleReviewSessionClick(session)}
                                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-400 transition-all cursor-pointer bg-white"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-center">
                                    <BookOpen className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-semibold text-black text-sm">{session.topic}</h3>
                                      <Badge variant="secondary" className="text-xs">Review #{session.reviewNumber}</Badge>
                                    </div>
                                    <p className="text-xs text-gray-500">{session.unit} • Due today</p>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "upcoming" && (
                    <div className="space-y-3">
                      {upcomingSessions.length === 0 && (
                        <div className="text-center py-12">
                          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <h3 className="font-semibold text-gray-700 mb-1">Nothing scheduled yet</h3>
                          <p className="text-sm text-gray-500">Future assignments and review sessions will appear here.</p>
                        </div>
                      )}
                      {upcomingSessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center">
                              <Calendar className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-black text-sm">{session.topic}</h3>
                                {session.type === "review" ? (
                                  <Badge variant="secondary" className="text-xs">Review #{session.reviewNumber}</Badge>
                                ) : (
                                  <Badge className="text-xs bg-green-100 text-green-700">New</Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{session.unit} • Due {new Date(session.dueDate).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "completed" && (
                    <div className="space-y-3">
                      {completedSessions.length === 0 && (
                        <div className="text-center py-12">
                          <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <h3 className="font-semibold text-gray-700 mb-1">No completed sessions yet</h3>
                          <p className="text-sm text-gray-500">Sessions you complete will appear here with your scores.</p>
                        </div>
                      )}
                      {completedSessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 border border-green-200 rounded-lg flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-black text-sm">{session.topic}</h3>
                                <Badge variant="secondary" className="text-xs">{session.type}</Badge>
                                <Badge className={`text-xs ${session.score >= 70 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{session.score}%</Badge>
                              </div>
                              <p className="text-xs text-gray-500">{session.unit} • {session.completedDate ? new Date(session.completedDate).toLocaleDateString() : ''}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border border-gray-200">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-black mb-4">Today's Summary</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Topics Mastered Today</span>
                      <span className="text-sm font-semibold text-green-600">{todayStats.masteredToday}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Time Spent Today</span>
                      <span className="text-sm font-semibold text-black">{todayStats.timeSpentToday}m</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Sessions Due Today</span>
                      <span className="text-sm font-semibold text-black">{sessionsDueToday}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-gray-600">Current Streak</span>
                      <span className="text-sm font-semibold text-black">{dayStreak} days</span>
                    </div>
                  </div>
                </CardContent>
              </Card>


            </div>
          </div>
        </div>
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