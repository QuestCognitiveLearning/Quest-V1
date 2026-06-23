import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { calculateDayStreak } from "@/lib/streak";
import { quest } from "@/api/questClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Target,
  Filter,
  BookOpen,
  Home,
  BarChart3,
  FileText,
  Flame,
  LogOut,
  ChevronLeft,
  Clock,
  TrendingUp,
  User,
  Award,
  Users
} from "lucide-react";
import StudentPageShell from "@/components/shared/StudentPageShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NotificationModal from "../components/shared/NotificationModal";
import { useNotification } from "../components/shared/useNotification";

export default function Progress() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("progress");
  const [filterCritical, setFilterCritical] = useState(false);
  const [hasClass, setHasClass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [user, setUser] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [studentProgress, setStudentProgress] = useState([]);
  const [learnedTopics, setLearnedTopics] = useState(0);
  const [achievements, setAchievements] = useState([]);
  const [newAchievement, setNewAchievement] = useState(null);
  const [dayStreak, setDayStreak] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [quizAvg, setQuizAvg] = useState(0);
  const [classLearningSessions, setClassLearningSessions] = useState([]);
  const { notification, closeNotification } = useNotification();

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

     const enrollmentsData = await quest.entities.StudentEnrollment.filter({ student_id: currentUser.id });
     setEnrollments(enrollmentsData);
     setHasClass(enrollmentsData.length > 0);

     if (enrollmentsData.length > 0) {
       const allClasses = await quest.entities.Class.list();
       const classesData = enrollmentsData
         .map(e => allClasses.find(c => c.id === e.class_id))
         .filter(Boolean);
       setClasses(classesData);

       const savedClassId = localStorage.getItem('selectedClassId');
       if (savedClassId && enrollmentsData.some(e => e.class_id === savedClassId)) {
         setSelectedClassId(savedClassId);
       } else {
         setSelectedClassId(enrollmentsData[0].class_id);
         localStorage.setItem('selectedClassId', enrollmentsData[0].class_id);
       }

       // Load achievements
       const achievementsData = await quest.entities.Achievement.filter({ student_id: currentUser.id });
       setAchievements(achievementsData);
     }
   } catch (err) {
     console.error("Failed to load data:", err);
   } finally {
     setLoading(false);
   }
  };

  const loadClassData = async () => {
    try {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      if (!selectedClass) return;

      const [curriculumData, allUnits, allSubunits, progress] = await Promise.all([
        quest.entities.Curriculum.filter({ id: selectedClass.curriculum_id }),
        quest.entities.Unit.list(),
        quest.entities.Subunit.list(),
        quest.entities.StudentProgress.filter({ student_id: user.id })
      ]);
      
      if (curriculumData.length > 0) {
        setCurriculum(curriculumData[0]);

        const unitsData = allUnits
          .filter(u => u.curriculum_id === curriculumData[0].id)
          .sort((a, b) => a.unit_order - b.unit_order);
        setUnits(unitsData);

        const relevantSubunits = allSubunits
          .filter(sub => unitsData.some(unit => unit.id === sub.unit_id))
          .sort((a, b) => a.subunit_order - b.subunit_order);
        setSubunits(relevantSubunits);

        setStudentProgress(progress);

        // Calculate learned topics (subunits with new session completed in this class)
        const classSubunitIds = relevantSubunits.map(s => s.id);
        const learned = progress.filter(p => 
          classSubunitIds.includes(p.subunit_id) && p.new_session_completed === true
        ).length;
        setLearnedTopics(learned);

        // Calculate day streak (class specific)
        const allLearningSessions = await quest.entities.LearningSession.filter({ student_id: user.id, completed: true }, "-start_time");
        const classSessions = allLearningSessions.filter(session => classSubunitIds.includes(session.subunit_id));
        setClassLearningSessions(classSessions);
        setDayStreak(calculateDayStreak(classSessions));

        // Calculate time spent and quiz average (class specific)
        const time = await getTimeSpent(classSubunitIds, user);
        const quiz = await getQuizAverage(classSubunitIds, user);
        setTimeSpent(time);
        setQuizAvg(quiz);
      }
    } catch (err) {
      console.error("Failed to load class data:", err);
    }
  };

  const getUnitsWithProgress = () => {
    if (!units || !subunits || !studentProgress) return [];
    
    return units.map(unit => {
      const unitSubunits = subunits.filter(s => s.unit_id === unit.id);
      const completedCount = unitSubunits.filter(sub => {
        const progress = studentProgress.find(p => p.subunit_id === sub.id);
        return progress && progress.new_session_completed === true;
      }).length;
      const percentage = unitSubunits.length > 0 ? Math.round((completedCount / unitSubunits.length) * 100) : 0;
      
      return {
        name: unit.unit_name,
        subunitsLearned: completedCount,
        totalSubunits: unitSubunits.length,
        percentage
      };
    });
  };




  const getWeeklyActivity = (sessions) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    return days.map((day, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);
      dayDate.setHours(0, 0, 0, 0);
      const sessionsOnDay = (sessions || []).filter(p => {
        if (!p.start_time) return false;
        const sessionDate = new Date(p.start_time);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === dayDate.getTime();
      }).length;
      return {
        day,
        active: sessionsOnDay > 0,
        concepts: sessionsOnDay
      };
    });
  };

  const getTimeSpent = async (classSubunitIds, user) => {
    if (!user || !classSubunitIds) return 0;
    try {
      const sessions = await quest.entities.LearningSession.filter({ student_id: user.id, completed: true });
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekSessions = sessions.filter(s => new Date(s.start_time) >= weekAgo && classSubunitIds.includes(s.subunit_id));
      const totalSeconds = weekSessions.reduce((sum, s) => sum + (s.total_time_seconds || 0), 0);
      return (totalSeconds / 3600).toFixed(1);
    } catch {
      return 0;
    }
  };

  const getQuizAverage = async (classSubunitIds, user) => {
    if (!user || !classSubunitIds) return 0;
    try {
      const quizResults = await quest.entities.QuizResult.filter({ student_id: user.id });
      const quizzes = await quest.entities.Quiz.list();
      const relevantQuizIds = quizzes.filter(q => classSubunitIds.includes(q.subunit_id)).map(q => q.id);
      const classQuizResults = quizResults.filter(qr => relevantQuizIds.includes(qr.quiz_id));
      if (classQuizResults.length === 0) return 0;
      const avgScore = classQuizResults.reduce((sum, r) => sum + r.score, 0) / classQuizResults.length;
      return Math.round(avgScore);
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    const checkForNewAchievements = async () => {
      if (!user || achievements.length === 0) return;
      
      const lastViewedAchievements = localStorage.getItem('viewedAchievements') ? JSON.parse(localStorage.getItem('viewedAchievements')) : [];
      const newAch = achievements.find(a => !lastViewedAchievements.includes(a.id));
      
      if (newAch) {
        setNewAchievement(newAch);
        const updated = [...lastViewedAchievements, newAch.id];
        localStorage.setItem('viewedAchievements', JSON.stringify(updated));
      }
    };

    checkForNewAchievements();
  }, [achievements, user]);

  const weeklyActivity = getWeeklyActivity(classLearningSessions);
  const unitsWithProgress = getUnitsWithProgress();
  // Filter by current class subunits
  const classSubunitIds = subunits?.map(s => s.id) || [];
  const totalMastered = studentProgress?.filter(p => 
    classSubunitIds.includes(p.subunit_id) && p.new_session_completed === true
  ).length || 0;
  const totalSubunits = subunits?.length || 0;

  const handleSignOut = () => {
    quest.auth.logout();
  };

  const handleNavigation = (tab, route) => {
    setActiveNav(tab);
    if (route) {
      navigate(createPageUrl(route));
    }
  };

  return (
    <StudentPageShell
      activeNav={activeNav}
      classes={classes}
      selectedClassId={selectedClassId}
      setSelectedClassId={setSelectedClassId}
      user={user}
      bg="bg-[#F0F4FF]"
    >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !hasClass ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 bg-[#2563EB]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <BarChart3 className="w-12 h-12 text-[#2563EB]" />
              </div>
              <h2 className="text-3xl font-bold text-[#1A1A1A] mb-3">No progress yet</h2>
              <p className="text-[#1A1A1A]/70 mb-8" style={{fontWeight: 450}}>Join a class to start tracking your learning progress</p>
              <button
                onClick={() => navigate(createPageUrl("JoinClass"))}
                className="bg-[#2563EB] hover:bg-[#2563EB]/90 text-white px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all font-semibold"
              >
                Join a Class
              </button>
            </div>
          </div>
        ) : (
        <div className="max-w-7xl mx-auto px-8 py-8">

          {/* Hero Header Banner */}
          <div className="rounded-2xl overflow-hidden mb-8 bg-white border border-gray-200 p-8">
            <p className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">Your Learning Progress</p>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Progress Dashboard</h1>
            <p className="text-gray-500 text-sm">Track your learning milestones and improvements</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 flex items-center gap-4 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalMastered}</p>
                <p className="text-xs text-gray-500 mt-0.5">Topics Mastered</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 flex items-center gap-4 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <Flame className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{dayStreak}</p>
                <p className="text-xs text-gray-500 mt-0.5">Day Streak</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 flex items-center gap-4 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{timeSpent}h</p>
                <p className="text-xs text-gray-500 mt-0.5">Time This Week</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 flex items-center gap-4 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{quizAvg}%</p>
                <p className="text-xs text-gray-500 mt-0.5">Quiz Average</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Unit Progress */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Target className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Unit Progress</h2>
                    <p className="text-xs text-gray-500">{totalMastered} of {totalSubunits} topics complete</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {unitsWithProgress.map((unit, index) => (
                    <div key={index} className="p-4 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                            {index + 1}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">{unit.name}</h3>
                            <p className="text-xs text-gray-500">{unit.subunitsLearned}/{unit.totalSubunits} topics</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full border border-gray-200">{unit.percentage}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-700"
                          style={{ width: `${unit.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insights */}
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">Insights</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-blue-600 text-xs font-semibold mb-2 uppercase tracking-wide">Strongest Unit</p>
                    <p className="font-bold text-gray-900 text-sm">
                      {unitsWithProgress.length > 0 ? unitsWithProgress.reduce((max, u) => u.percentage > max.percentage ? u : max).name : "N/A"}
                    </p>
                    <p className="text-blue-600 text-xs mt-2 font-medium">
                      {unitsWithProgress.length > 0 ? unitsWithProgress.reduce((max, u) => u.percentage > max.percentage ? u : max).percentage : 0}% mastery
                    </p>
                  </div>
                  <div className="p-5 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-amber-600 text-xs font-semibold mb-2 uppercase tracking-wide">Focus Area</p>
                    <p className="font-bold text-gray-900 text-sm">
                      {unitsWithProgress.length > 0 ? unitsWithProgress.reduce((min, u) => u.percentage < min.percentage ? u : min).name : "N/A"}
                    </p>
                    <p className="text-amber-600 text-xs mt-2 font-medium">
                      {unitsWithProgress.length > 0 ? unitsWithProgress.reduce((min, u) => u.percentage < min.percentage ? u : min).percentage : 0}% complete
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Weekly Activity */}
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">Weekly Activity</h2>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {weeklyActivity.map((day, index) => (
                    <div key={index} className="text-center">
                      <p className="text-[10px] text-gray-500 mb-2 font-medium">{day.day}</p>
                      <div className={`w-full aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                        day.active
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {day.active ? day.concepts : '·'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Achievements */}
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Award className="w-4 h-4 text-amber-600" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">Achievements ({achievements.length})</h2>
                </div>
                {achievements.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {achievements.map(ach => (
                      <div key={ach.id} className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Award className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-xs">{ach.name}</p>
                          <p className="text-xs text-gray-500">{ach.criteria}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                    <p className="text-xs text-gray-500">Start learning to unlock achievements</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
      {newAchievement && (
        <NotificationModal
          isOpen={!!newAchievement}
          onClose={() => setNewAchievement(null)}
          type="success"
          title="Achievement Unlocked"
          message={`You earned "${newAchievement.name}" - ${newAchievement.criteria}`}
        />
      )}
    </StudentPageShell>
  );
}