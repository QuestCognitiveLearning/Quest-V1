import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen,
  BarChart3,
  LogOut,
  ChevronLeft,
  Users,
  Plus,
  GraduationCap,
  Trophy,
  Zap
} from "lucide-react";
import StudentPageShell from "@/components/shared/StudentPageShell";

export default function Classes() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("classes");
  const [user, setUser] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joiningClass, setJoiningClass] = useState(false);
  const [error, setError] = useState("");
  const [studentProgress, setStudentProgress] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [learnedTopics, setLearnedTopics] = useState(0);
  const [subunits, setSubunits] = useState([]);
  const [units, setUnits] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClassId && user && classes.length > 0) {
      loadClassData();
    }
  }, [selectedClassId, user, classes, studentProgress]);


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

      if (enrollmentsData.length > 0) {
        const [allClasses, allCurricula, progressData, allUnits, allSubunits] = await Promise.all([
          quest.entities.Class.list(),
          quest.entities.Curriculum.list(),
          quest.entities.StudentProgress.filter({ student_id: currentUser.id }),
          quest.entities.Unit.list(),
          quest.entities.Subunit.list()
        ]);
        
        const classesData = enrollmentsData
          .map(e => allClasses.find(c => c.id === e.class_id))
          .filter(Boolean);
        setClasses(classesData);

        const curriculaIds = [...new Set(classesData.map(c => c.curriculum_id))];
        const curriculaData = curriculaIds
          .map(id => allCurricula.find(c => c.id === id))
          .filter(Boolean);
        setCurricula(curriculaData);
        setStudentProgress(progressData);
        setUnits(allUnits);
        setSubunits(allSubunits);

        const savedClassId = localStorage.getItem('selectedClassId');
        if (savedClassId && classesData.some(c => c.id === savedClassId)) {
          setSelectedClassId(savedClassId);
        } else if (classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
          localStorage.setItem('selectedClassId', classesData[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async () => {
    if (!joinCode.trim()) {
      setError("Please enter a join code");
      return;
    }

    setJoiningClass(true);
    setError("");

    try {
      const foundClasses = await quest.entities.Class.filter({ join_code: joinCode.toUpperCase().trim() });
      
      if (foundClasses.length === 0) {
        setError("Invalid join code. Please check and try again.");
        setJoiningClass(false);
        return;
      }

      const classToJoin = foundClasses[0];

      const existingEnrollment = await quest.entities.StudentEnrollment.filter({
        student_id: user.id,
        class_id: classToJoin.id
      });

      if (existingEnrollment.length > 0) {
        setError("You're already enrolled in this class!");
        setJoiningClass(false);
        return;
      }

      await quest.entities.StudentEnrollment.create({
        student_id: user.id,
        class_id: classToJoin.id,
        student_full_name: user.full_name,
        student_email: user.email,
        enrollment_date: new Date().toISOString()
      });

      const [curriculum, units, allSubunits] = await Promise.all([
        quest.entities.Curriculum.filter({ id: classToJoin.curriculum_id }),
        quest.entities.Unit.filter({ curriculum_id: classToJoin.curriculum_id }),
        quest.entities.Subunit.list()
      ]);
      
      if (curriculum.length > 0 && units.length > 0) {
        const subunits = allSubunits.filter(sub => units.some(unit => unit.id === sub.unit_id));

        // Only include columns that actually exist on `student_progress`.
        // `progress_percentage` was on an older schema and removed; sending
        // it now triggers PGRST204 "column not found".
        const progressRecords = subunits.map(subunit => ({
          student_id: user.id,
          subunit_id: subunit.id,
          learned_status: false,
          urgency_status: "Low",
          review_count: 0,
        }));

        // Bulk insert can throw on a duplicate (student already enrolled in
        // a class with overlapping content). Don't let that surface as
        // "Failed to join class" — enrollment itself already succeeded.
        try {
          await quest.entities.StudentProgress.bulkCreate(progressRecords);
        } catch (progressErr) {
          console.warn("StudentProgress seed skipped (likely duplicates):", progressErr);
        }
      }

      setJoinCode("");
      setError("");
      await loadData();
    } catch (err) {
      console.error("Failed to join class:", err);
      setError("Failed to join class. Please try again.");
    } finally {
      setJoiningClass(false);
    }
  };

  const handleSignOut = () => {
    quest.auth.logout();
  };

  const handleNavigation = (tab, route) => {
    setActiveNav(tab);
    if (route) {
      navigate(createPageUrl(route));
    }
  };

  const getCurriculumName = (curriculumId) => {
    const curriculum = curricula.find(c => c.id === curriculumId);
    return curriculum ? curriculum.subject_name : "Unknown";
  };

  /**
   * Percent of subunits in this class that the student has marked as learned.
   *
   * Previous version had a bug: the inner filter callback ignored `p` and
   * matched against the parent class — so it either returned ALL of the
   * student's progress rows (across every class) or zero, depending on
   * whether the curriculum was loaded. That caused fresh joins to show
   * non-zero progress when the student had any unrelated progress elsewhere.
   *
   * Correct logic:
   *   1. Find the units that belong to this class's curriculum.
   *   2. Find the subunits in those units.
   *   3. Restrict the student's progress rows to that subunit set.
   *   4. Count how many of those have `learned_status = true`.
   *
   * Returns 0 (not NaN) when the class has no subunits yet.
   */
  const getClassProgress = (classId) => {
    const classObj = classes.find(c => c.id === classId);
    if (!classObj) return 0;

    const classUnitIds = units
      .filter(u => u.curriculum_id === classObj.curriculum_id)
      .map(u => u.id);

    const classSubunitIds = subunits
      .filter(s => classUnitIds.includes(s.unit_id))
      .map(s => s.id);

    if (classSubunitIds.length === 0) return 0;

    const completedCount = studentProgress.filter(
      p => classSubunitIds.includes(p.subunit_id) && p.learned_status === true,
    ).length;

    return Math.round((completedCount / classSubunitIds.length) * 100);
  };

  const loadClassData = async () => {
    try {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      if (!selectedClass) return;

      const curriculumData = curricula.find(c => c.id === selectedClass.curriculum_id);
      if (!curriculumData) return;

      const unitsData = units
        .filter(u => u.curriculum_id === curriculumData.id)
        .sort((a, b) => a.unit_order - b.unit_order);
      
      const relevantSubunits = subunits
        .filter(sub => unitsData.some(unit => unit.id === sub.unit_id))
        .sort((a, b) => a.subunit_order - b.subunit_order);
      
      const classSubunitIds = relevantSubunits.map(s => s.id);

      // Calculate learned topics (class specific)
      const learned = studentProgress.filter(p =>
        classSubunitIds.includes(p.subunit_id) && p.new_session_completed === true
      ).length;
      setLearnedTopics(learned);

      // Calculate day streak (class specific)
      const allLearningSessions = await quest.entities.LearningSession.filter({ student_id: user.id, completed: true }, "-start_time");
      const classLearningSessions = allLearningSessions.filter(session =>
          classSubunitIds.includes(session.subunit_id)
      );

    } catch (err) {
      console.error("Failed to load class data for sidebar:", err);
    }
  };

  return (
    <StudentPageShell
      activeNav={activeNav}
      classes={classes}
      selectedClassId={selectedClassId}
      setSelectedClassId={setSelectedClassId}
      user={user}
    >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-black mb-1">My Classes</h1>
              <p className="text-sm text-gray-600">View and manage your enrolled classes</p>
            </div>

            {/* Join Class Card */}
            <Card className="border border-gray-200 mb-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Plus className="w-5 h-5 text-black" />
                  <h2 className="text-lg font-semibold text-black">Join a New Class</h2>
                </div>
                <p className="text-sm text-gray-600 mb-4">Enter the 6-character code provided by your teacher</p>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                  </div>
                )}
                
                <div className="flex gap-3">
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g., ABC123)"
                    maxLength={6}
                    className="flex-1 uppercase tracking-widest font-semibold"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinClass()}
                  />
                  <Button
                    onClick={handleJoinClass}
                    disabled={joiningClass || !joinCode.trim()}
                    className="bg-black hover:bg-black/90 text-white"
                  >
                    {joiningClass ? "Joining..." : "Join Class"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Enrolled Classes */}
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-black mb-4">Enrolled Classes ({classes.length})</h2>
            </div>

            {classes.length === 0 ? (
              <Card className="border border-gray-200">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <GraduationCap className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Classes Yet</h3>
                  <p className="text-gray-600">Use the join code above to enroll in your first class</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {classes.map((classItem) => {
                  const enrollment = enrollments.find(e => e.class_id === classItem.id);
                  const progress = getClassProgress(classItem.id);
                  
                  return (
                    <Card key={classItem.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center shrink-0">
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <h3 className="text-sm font-semibold text-black truncate">{classItem.class_name}</h3>
                              <span className="text-xs font-medium text-gray-500 ml-2 shrink-0">{progress}%</span>
                            </div>
                            <p className="text-xs text-gray-500 mb-1.5">{getCurriculumName(classItem.curriculum_id)} · Joined {new Date(enrollment?.enrollment_date).toLocaleDateString()}</p>
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-black rounded-full transition-all" 
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
    </StudentPageShell>
  );
}