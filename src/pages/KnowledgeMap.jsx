import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Music, Flame, FileText, BookOpen, Home, BarChart3, LogOut, ChevronLeft, Circle, Dna, Leaf, Users, Beaker, Sprout, User as UserIcon } from "lucide-react";

import RadialMindmap from "../components/mindmap/RadialMindmap";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import StudentSidebar from "../components/shared/StudentSidebar";
import AchievementsDisplay from "../components/student/AchievementsDisplay";
import StudentDemoOverlay from "../components/student/StudentDemoOverlay";

export default function KnowledgeMap() {
  const navigate = useNavigate();
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [activeNav, setActiveNav] = useState("knowledge-map");
  const [hasClass, setHasClass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [curriculum, setCurriculum] = useState(null);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [studentProgress, setStudentProgress] = useState([]);
  const [user, setUser] = useState(null);
  const [dayStreak, setDayStreak] = useState(0);
  const [learnedTopics, setLearnedTopics] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [showStudentDemo, setShowStudentDemo] = useState(false);
  const audioRef = useRef(null);

  const audioOptions = {
    "Lo-fi Beats": "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3",
    "Nature Sounds": "https://cdn.pixabay.com/audio/2022/03/10/audio_4b6ba2c20d.mp3",
    "White Noise": "https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3",
    "Classical Music": "https://cdn.pixabay.com/audio/2022/03/23/audio_23f3e5640c.mp3",
    "Ambient": "https://cdn.pixabay.com/audio/2022/01/18/audio_d1718ab41b.mp3",
    "Rain Sounds": "https://cdn.pixabay.com/audio/2022/03/12/audio_b1c0e6c4e7.mp3"
  };

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

      if (currentUser.account_type === "teacher") {
        navigate(createPageUrl("TeacherDashboard"));
        return;
      }

      setUser(currentUser);

      // Demo gate — fire ONCE per student, ever.
      //
      // Three guards layered (fail-safe ordering):
      //   1. SERVER FLAG `users.onboarding_demo_seen` — durable across
      //      browsers, devices, and localStorage clears. Set via updateMe
      //      the instant we decide to show the demo (NOT on close), so a
      //      Navattic iframe error / accidental close / page navigation
      //      can't cause it to replay. This is the canonical source of truth.
      //   2. localStorage flag — synchronous fallback when the server write
      //      hasn't propagated yet within the same session.
      //   3. `created_date` < 24h — hard ceiling. Even if both flags above
      //      somehow failed, accounts older than 24h never see the demo.
      const demoKey = `student_demo_seen_${currentUser.id}`;
      const createdAt = currentUser.created_date ? new Date(currentUser.created_date).getTime() : null;
      const ageHours = createdAt ? (Date.now() - createdAt) / 3_600_000 : null;
      const isBrandNew = createdAt && (Date.now() - createdAt) < 24 * 60 * 60 * 1000;
      const serverAlreadyShown = !!currentUser.onboarding_demo_seen;
      const localAlreadyShown = !!localStorage.getItem(demoKey);
      const willShow = isBrandNew && !serverAlreadyShown && !localAlreadyShown;

      // Verbose decision log — keep this so we can diagnose any future
      // "demo popped when it shouldn't have" reports without re-instrumenting.
      console.groupCollapsed(
        `%c[demo-gate] student %c${willShow ? "SHOW" : "SKIP"}`,
        "color:#2563EB;font-weight:bold",
        willShow
          ? "color:#16A34A;font-weight:bold"
          : "color:#64748B;font-weight:bold",
      );
      console.log("user.id              =", currentUser.id);
      console.log("account age (hours)  =", ageHours?.toFixed(2) ?? "(unknown)");
      console.log("isBrandNew (<24h)    =", isBrandNew);
      console.log("server flag          =", serverAlreadyShown, "  (users.onboarding_demo_seen)");
      console.log("localStorage flag    =", localAlreadyShown,  "  (key:", demoKey + ")");
      console.log("→ student has seen demo =", serverAlreadyShown || localAlreadyShown);
      console.log("→ DECISION              =", willShow ? "SHOW (and burn flags)" : "SKIP");
      console.groupEnd();

      if (willShow) {
        setShowStudentDemo(true);
        localStorage.setItem(demoKey, "true"); // synchronous fast-path
        // Fire-and-forget server write. If it fails (offline, transient
        // network), the localStorage flag still prevents replay this session
        // and the next page load will re-attempt. Don't block UI on this.
        quest.auth
          .updateMe({ onboarding_demo_seen: true })
          .then(() => console.log("[demo-gate] student server flag → true"))
          .catch((err) =>
            console.warn("[demo-gate] server flag write failed:", err)
          );
      }

      const enrollmentsData = await quest.entities.StudentEnrollment.filter({ student_id: currentUser.id });
      setEnrollments(enrollmentsData);
      setHasClass(enrollmentsData.length > 0);

      if (enrollmentsData.length > 0) {
        const classesData = await Promise.all(
          enrollmentsData.map((e) => quest.entities.Class.filter({ id: e.class_id }).then((c) => c[0]))
        );
        const validClasses = classesData.filter(Boolean);
        setClasses(validClasses);

        const savedClassId = localStorage.getItem('selectedClassId');
        if (savedClassId && validClasses.some((c) => c.id === savedClassId)) {
          setSelectedClassId(savedClassId);
        } else if (validClasses.length > 0) {
          setSelectedClassId(validClasses[0].id);
          localStorage.setItem('selectedClassId', validClasses[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadClassData = async () => {
    try {
      const selectedClass = classes.find((c) => c.id === selectedClassId);
      if (!selectedClass) return;

      const curriculumData = await quest.entities.Curriculum.filter({ id: selectedClass.curriculum_id });

      if (curriculumData.length > 0) {
        setCurriculum(curriculumData[0]);

        const unitsData = await quest.entities.Unit.filter({ curriculum_id: curriculumData[0].id }, "unit_order");
        setUnits(unitsData);

        const allSubunits = await quest.entities.Subunit.list();
        const relevantSubunits = allSubunits.filter((sub) =>
        unitsData.some((unit) => unit.id === sub.unit_id)
        );
        setSubunits(relevantSubunits);

        const progress = await quest.entities.StudentProgress.filter({ student_id: user.id });
        setStudentProgress(progress);

        const classAssignments = await quest.entities.Assignment.filter({ class_id: selectedClassId });
        setAssignments(classAssignments);

        // Calculate learned topics (subunits with new session completed in this class)
        const classSubunitIds = relevantSubunits.map(s => s.id);
        const learned = progress.filter(p => 
          classSubunitIds.includes(p.subunit_id) && p.new_session_completed === true
        ).length;
        setLearnedTopics(learned);

        const sessions = await quest.entities.LearningSession.filter({ student_id: user.id, completed: true }, "-start_time");
        const streak = calculateDayStreak(sessions);
        setDayStreak(streak);
      }
    } catch (err) {
      console.error("Failed to load class data:", err);
    }
  };

  const calculateDayStreak = (sessions) => {
    if (sessions.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessionDates = sessions.
    map((s) => {
      const date = new Date(s.start_time);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }).
    filter((date, index, self) => self.indexOf(date) === index).
    sort((a, b) => b - a);

    if (sessionDates.length === 0) return 0;

    const mostRecentDate = sessionDates[0];
    const daysSinceRecent = Math.floor((today.getTime() - mostRecentDate) / (1000 * 60 * 60 * 24));

    if (daysSinceRecent > 1) return 0;

    let streak = 0;
    let expectedDate = today.getTime();

    for (const sessionDate of sessionDates) {
      const diff = Math.floor((expectedDate - sessionDate) / (1000 * 60 * 60 * 24));

      if (diff === 0 || diff === 1) {
        streak++;
        expectedDate = sessionDate;
      } else {
        break;
      }
    }

    return streak;
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

  const handleAudioSelect = (audio) => {
    if (selectedAudio === audio) {
      setSelectedAudio(null);
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      setSelectedAudio(audio);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.src = audioOptions[audio];
        audioRef.current.loop = true;
        audioRef.current.volume = 0.3;
        audioRef.current.play().catch((err) => console.log("Audio play failed:", err));
      }
    }
  };

  const handleCloseDemoOverlay = () => {
    if (user) {
      localStorage.setItem(`student_demo_seen_${user.id}`, "true");
    }
    setShowStudentDemo(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {showStudentDemo && <StudentDemoOverlay onClose={handleCloseDemoOverlay} />}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <StudentSidebar
        activeNav={activeNav}
        classes={classes}
        selectedClassId={selectedClassId}
        onClassChange={(val) => {
          setSelectedClassId(val);
          localStorage.setItem('selectedClassId', val);
        }}
        user={user} />


      <div className="flex-1 flex flex-col">
        <style>{`
          @keyframes audioWave {
            0%, 100% { height: 8px; }
            50% { height: 24px; }
          }
          @keyframes audioWave2 {
            0%, 100% { height: 12px; }
            50% { height: 20px; }
          }
          @keyframes audioWave3 {
            0%, 100% { height: 6px; }
            50% { height: 22px; }
          }
          .wave-bar:nth-child(1) { animation: audioWave 0.8s ease-in-out infinite; }
          .wave-bar:nth-child(2) { animation: audioWave2 0.9s ease-in-out infinite 0.1s; }
          .wave-bar:nth-child(3) { animation: audioWave3 0.7s ease-in-out infinite 0.2s; }
          .wave-bar:nth-child(4) { animation: audioWave 0.85s ease-in-out infinite 0.3s; }
        `}</style>
        
        <audio ref={audioRef} />
        
        <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-blue-50/30 to-indigo-50/30 flex items-center justify-center" data-tour="knowledge-map">
          {loading ?
          <div className="flex items-center justify-center h-full">
              <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
            </div> :
          hasClass ?
          curriculum && units.length > 0 ?
          <div className="bg-slate-50 w-full h-full flex flex-col overflow-y-auto">
            <div className="flex-1 flex items-center justify-center">
                <div className="w-full max-w-6xl px-4 py-8">
                  <div data-tour="progress-stats" className="mb-8">
                    <AchievementsDisplay studentId={user?.id} />
                  </div>
                  <div className="flex items-center justify-center" data-tour="topic-card">
                    <RadialMindmap
              curriculum={curriculum}
              units={units.filter(u => u.unit_name !== "Assessments")}
              subunits={subunits.filter(s => s.subunit_name !== "Pre-Test" && s.subunit_name !== "Post-Test")}
              studentProgress={studentProgress}
              assignments={assignments}
              curriculumColor={curriculum?.color || "blue"}
              onSubunitClick={(subunit) => {
                const isAssigned = assignments.some((a) => a.subunit_id === subunit.id);
                if (isAssigned) {
                  navigate(createPageUrl("NewSession") + `?topic=${subunit.id}`);
                }
              }} />
                   </div>
                 </div>
               </div>
              </div> :

          <div className="flex items-center justify-center h-full">
                <p className="text-gray-600">Loading curriculum...</p>
              </div> :


          <NoClassState navigate={navigate} />
          }
        </div>
      </div>
    </div>);

}

function NoClassState({ navigate }) {
  return (
    <div className="flex items-center justify-center h-full" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="text-center max-w-md px-8">
        <div className="w-24 h-24 bg-[#2563EB]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
          <BookOpen className="w-12 h-12 text-[#2563EB]" />
        </div>
        <h2 className="text-3xl font-bold text-[#1A1A1A] mb-3">Welcome to Quest Learning</h2>
        <p className="text-[#1A1A1A]/70 mb-8 text-lg" style={{ fontWeight: 450 }}>Join a class to start your learning journey and unlock your knowledge map</p>
        <Button
          onClick={() => navigate(createPageUrl("JoinClass"))}
          className="bg-[#2563EB] hover:bg-[#2563EB]/90 text-white px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all">

          <Users className="w-5 h-5 mr-2" />
          Join a Class
        </Button>
      </div>
    </div>);

}