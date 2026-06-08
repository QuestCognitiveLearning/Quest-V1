import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TeacherLayout from "../components/teacher/TeacherLayout";
import DemoOverlay from "../components/teacher/DemoOverlay";
import { stringsFor } from "@/lib/i18n/role-strings";
import { getUserRole } from "@/lib/tier";
import { format } from "date-fns";
import {
  BookOpen,
  Users,
  Plus,
  ChevronRight,
  GraduationCap,
  CalendarIcon,
  CheckCircle,
  Trash2,
  Sparkles,
  Clock,
  TrendingUp
} from "lucide-react";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const strings = stringsFor(teacher);
  const [classes, setClasses] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [resourceStats, setResourceStats] = useState({
    generatedHandouts: 0,
    quizzes: 0,
    caseStudies: 0,
    inquirySessions: 0,
    subunits: 0,
  });
  // Lesson bundle assignments — generated learning sessions pushed to a
  // class via Generate's "Assign learning session" button.
  const [bundleAssignments, setBundleAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedSubunit, setSelectedSubunit] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDashboardData();
    // Carry over any /try handouts the user generated under their email
    // before signup. Idempotent + best-effort — server returns imported=0
    // when there's nothing pending so repeat dashboard loads are cheap.
    (async () => {
      try {
        const res = await quest.functions.invoke("claimLeadHandouts");
        if ((res?.data?.imported || 0) > 0) {
          loadDashboardData();
        }
      } catch (err) {
        console.warn("claimLeadHandouts failed (non-fatal):", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedClass && classes.length > 0 && curricula.length > 0) {
      loadClassSubunits(selectedClass);
    }
  }, [selectedClass, classes, curricula]);

  const loadDashboardData = async () => {
    try {
      const currentUser = await quest.auth.me();
      // Router-level RequireAuth now blocks tutors and Studio-tier users from
      // ever mounting this page, so by the time we get here, currentUser is
      // guaranteed to be a teacher. No page-level redirect needed.
      setTeacher(currentUser);

      // Demo gate — fire ONCE per teacher, ever. Three layered guards:
      //   1. SERVER FLAG `users.onboarding_demo_seen` — durable across
      //      browsers/devices/localStorage clears. Canonical source of truth.
      //   2. localStorage flag — synchronous fallback within the same session.
      //   3. `created_date` < 24h — hard ceiling so accounts older than 24h
      //      never see the demo regardless of either flag state.
      // Same pattern as KnowledgeMap.jsx (student side) — kept in sync.
      const demoKey = `demo_shown_${currentUser.id}`;
      const isPremium = currentUser.subscription_status === 'premium' || currentUser.subscription_status === 'trial';
      const createdAt = currentUser.created_date ? new Date(currentUser.created_date).getTime() : null;
      const ageHours = createdAt ? (Date.now() - createdAt) / 3_600_000 : null;
      const isBrandNew = createdAt && (Date.now() - createdAt) < 24 * 60 * 60 * 1000;
      const serverAlreadyShown = !!currentUser.onboarding_demo_seen;
      const localAlreadyShown = !!localStorage.getItem(demoKey);
      const willShow = isPremium && isBrandNew && !serverAlreadyShown && !localAlreadyShown;

      // Mirror of KnowledgeMap.jsx's verbose log so the teacher path is
      // easy to diagnose too.
      console.groupCollapsed(
        `%c[demo-gate] teacher %c${willShow ? 'SHOW' : 'SKIP'}`,
        'color:#2563EB;font-weight:bold',
        willShow
          ? 'color:#16A34A;font-weight:bold'
          : 'color:#64748B;font-weight:bold',
      );
      console.log('user.id              =', currentUser.id);
      console.log('account age (hours)  =', ageHours?.toFixed(2) ?? '(unknown)');
      console.log('isBrandNew (<24h)    =', isBrandNew);
      console.log('isPremium (paid/trial)=', isPremium, '  (status:', currentUser.subscription_status + ')');
      console.log('server flag          =', serverAlreadyShown, '  (users.onboarding_demo_seen)');
      console.log('localStorage flag    =', localAlreadyShown,  '  (key:', demoKey + ')');
      console.log('→ teacher has seen demo =', serverAlreadyShown || localAlreadyShown);
      console.log('→ DECISION              =', willShow ? 'SHOW (and burn flags)' : 'SKIP');
      console.groupEnd();

      if (willShow) {
        setShowDemo(true);
        localStorage.setItem(demoKey, 'true');
        // Fire-and-forget server write. If it fails, the localStorage flag
        // still prevents replay this session and we retry on next mount.
        quest.auth
          .updateMe({ onboarding_demo_seen: true })
          .then(() => console.log('[demo-gate] teacher server flag → true'))
          .catch((err) =>
            console.warn('[demo-gate] server flag write failed:', err)
          );
      }

      const teacherClasses = await quest.entities.Class.filter({ teacher_id: currentUser.id });
      setClasses(teacherClasses);

      // Load all curricula (both created by teacher and referenced by their classes)
      const allCurricula = await quest.entities.Curriculum.list();
      const classCurriculumIds = teacherClasses.map(c => c.curriculum_id);
      const relevantCurricula = allCurricula.filter(
        c => c.teacher_id === currentUser.id || classCurriculumIds.includes(c.id)
      );
      setCurricula(relevantCurricula);

      // Auto-select first class
      if (teacherClasses.length > 0) {
        setSelectedClass(teacherClasses[0].id);

        const classIds = teacherClasses.map(c => c.id);
        const allAssignments = await quest.entities.Assignment.list();
        const teacherAssignments = allAssignments.filter(a => classIds.includes(a.class_id));
        setAssignments(teacherAssignments);

        // Lesson bundle assignments — pulled with their parent bundle for
        // the title. Filtered to this teacher's classes. Uses .in() since
        // the SDK's filter converts arrays to Postgres IN().
        // Explicit orderBy: lesson_bundle_assignments has assigned_at, not
        // the SDK-default created_date; lesson_bundles has created_at.
        // Passing the wrong column 400s and the catch silently zeroes the
        // dashboard — assignments stop showing up.
        try {
          const assignments = await quest.entities.LearningSessionAssignment.filter(
            { class_id: classIds },
            "-assigned_at"
          );
          const bundleIds = [...new Set((assignments || []).map(a => a.bundle_id))];
          if (bundleIds.length > 0) {
            const bundles = await quest.entities.LessonBundle.filter(
              { id: bundleIds },
              "-created_at"
            );
            const bundleMap = new Map((bundles || []).map(b => [b.id, b]));
            setBundleAssignments(
              (assignments || []).map(a => ({
                ...a,
                bundle_title: bundleMap.get(a.bundle_id)?.title || "Learning session",
              }))
            );
          } else {
            setBundleAssignments([]);
          }
        } catch (err) {
          console.warn("Could not load bundle assignments:", err);
          setBundleAssignments([]);
        }
      }

      // Resource stats — every entity fetched independently so a single
      // failure doesn't zero out the whole row. Uses .list() which is
      // RLS-scoped to the teacher (their own rows + nothing else).
      const counts = {
        generatedHandouts: 0,
        quizzes: 0,
        caseStudies: 0,
        inquirySessions: 0,
        subunits: 0,
      };

      const safeCount = async (name, fetcher) => {
        try {
          const rows = await fetcher();
          return Array.isArray(rows) ? rows.length : 0;
        } catch (err) {
          console.warn(`[dashboard] ${name} count failed:`, err);
          return 0;
        }
      };

      // Library handouts (no curriculum link) — explicit teacher_id filter
      // because the underlying table is jsonb-heavy and we want only this
      // teacher's rows.
      // generated_handouts uses created_at, NOT the platform-default
      // created_date — pass explicit orderBy so PGRST doesn't 400 with
      // 'column created_date does not exist'.
      counts.generatedHandouts = await safeCount(
        "generated handouts",
        () =>
          quest.entities.GeneratedHandout.filter(
            { teacher_id: currentUser.id },
            "-created_at",
            null
          )
      );

      // Quizzes / case studies / inquiry sessions / subunits — scope strictly
      // to rows this teacher created. .list() returns anything RLS permits,
      // which on these tables can include other teachers' rows reachable via
      // shared curricula or class membership — that would inflate Hours Saved
      // by crediting work this teacher didn't do.
      counts.quizzes = await safeCount("quizzes", () =>
        quest.entities.Quiz.filter({ created_by_id: currentUser.id })
      );
      counts.caseStudies = await safeCount("case studies", () =>
        quest.entities.CaseStudy.filter({ created_by_id: currentUser.id })
      );
      counts.inquirySessions = await safeCount("inquiry sessions", () =>
        quest.entities.InquirySession.filter({ created_by_id: currentUser.id })
      );
      counts.subunits = await safeCount("subunits", () =>
        quest.entities.Subunit.filter({ created_by_id: currentUser.id })
      );

      console.log("[dashboard] resource stats:", counts);
      setResourceStats(counts);

      setLoading(false);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setLoading(false);
    }
  };

  // Hours-saved algorithm — calibrated against teacher interviews on how long
  // each piece actually takes to build from scratch:
  //   Quiz (10 MCQs + answer key + explanations) ≈ 1.5 hrs
  //   Case study (scenario + 4 prompts + model answers) ≈ 1.0 hr
  //   Inquiry session (hook + Socratic prompts + image direction) ≈ 0.75 hr
  //   Subunit (writing standards + scaffolding) ≈ 0.5 hr per subunit
  //   Curriculum (top-level structure + sequencing) ≈ 3 hrs per curriculum
  //   Standalone library handout (~1 video → full bundle) ≈ 1 hr
  //
  // A typical full curriculum with 5 units × 4 subunits comes out to roughly:
  //   3 (curriculum) + 20 × 0.5 (subunits) + 20 × (1.5 + 1.0 + 0.75)
  //   = 3 + 10 + 65 = 78 hours
  // Which is in line with the 60–80 hour Sunday-prep estimates teachers give.
  // Only count curricula this teacher *created* — not ones they reference
  // via a class. Sharing a curriculum someone else built didn't save them
  // the time of building it.
  const ownCurriculaCount = curricula.filter((c) => c.teacher_id === teacher?.id).length;

  const hoursSaved = Math.max(
    0,
    Math.round(
      resourceStats.quizzes * 1.5 +
      resourceStats.caseStudies * 1.0 +
      resourceStats.inquirySessions * 0.75 +
      resourceStats.subunits * 0.5 +
      ownCurriculaCount * 3.0 +
      resourceStats.generatedHandouts * 1.0
    )
  );

  const totalResources =
    resourceStats.quizzes +
    resourceStats.caseStudies +
    resourceStats.inquirySessions +
    resourceStats.generatedHandouts;

  const loadClassSubunits = async (classId) => {
    try {
      const cls = classes.find(c => c.id === classId);
      if (!cls) return;

      // Fetch curriculum directly
      const curriculumData = await quest.entities.Curriculum.filter({ id: cls.curriculum_id });
      if (curriculumData.length === 0) return;

      const unitsData = await quest.entities.Unit.filter({ curriculum_id: cls.curriculum_id }, "unit_order");
      setUnits(unitsData);

      const allSubunits = [];
      for (const unit of unitsData) {
        const unitSubunits = await quest.entities.Subunit.filter({ unit_id: unit.id }, "subunit_order");
        allSubunits.push(...unitSubunits);
      }
      setSubunits(allSubunits);
    } catch (err) {
      console.error("Failed to load subunits:", err);
    }
  };

  const handleCreateAssignment = async () => {
    if (!selectedClass || !selectedSubunit || !selectedDate) return;
    
    setSaving(true);
    try {
      // Check if assignment already exists
      const existing = assignments.find(
        a => a.class_id === selectedClass && a.subunit_id === selectedSubunit
      );
      
      if (existing) {
        await quest.entities.Assignment.update(existing.id, {
          due_date: format(selectedDate, 'yyyy-MM-dd')
        });
      } else {
        await quest.entities.Assignment.create({
          class_id: selectedClass,
          subunit_id: selectedSubunit,
          due_date: format(selectedDate, 'yyyy-MM-dd')
        });
      }
      
      // Reload assignments
      const classIds = classes.map(c => c.id);
      const allAssignments = await quest.entities.Assignment.list();
      const teacherAssignments = allAssignments.filter(a => classIds.includes(a.class_id));
      setAssignments(teacherAssignments);
      
      setSelectedSubunit(null);
      setSelectedDate(null);
    } catch (err) {
      console.error("Failed to create assignment:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await quest.entities.Assignment.delete(assignmentId);
      setAssignments(assignments.filter(a => a.id !== assignmentId));
    } catch (err) {
      console.error("Failed to delete assignment:", err);
    }
  };

  const getSubunitName = (subunitId) => {
    const sub = subunits.find(s => s.id === subunitId);
    return sub?.subunit_name || "Unknown";
  };

  const getClassName = (classId) => {
    const cls = classes.find(c => c.id === classId);
    return cls?.class_name || "Unknown";
  };



  const handleSignOut = () => {
    quest.auth.logout();
  };

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeKey, setUpgradeKey] = useState("");
  const [showDemo, setShowDemo] = useState(false);

  const handleUpgrade = async () => {
    if (upgradeKey === 'admin') {
      await quest.auth.updateMe({ subscription_tier: 'premium' });
      window.location.reload();
    } else {
      alert('Invalid teacher key');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading curriculum...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showDemo && <DemoOverlay onClose={() => setShowDemo(false)} />}
      <TeacherLayout activeNav="dashboard" user={teacher} onSignOut={handleSignOut} onUpgrade={() => setShowUpgradeModal(true)}>
        <div className="max-w-7xl mx-auto p-8" data-tour="assignments-section">
          {showUpgradeModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
              <Card className="w-full max-w-md">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">Upgrade to Premium</h3>
                  <p className="text-gray-600 mb-6">
                    Enter your teacher key to unlock full curriculum builder, class management, and analytics.
                  </p>
                  <Input
                    value={upgradeKey}
                    onChange={(e) => setUpgradeKey(e.target.value)}
                    placeholder="Enter teacher key"
                    className="mb-4"
                    onKeyPress={(e) => e.key === 'Enter' && handleUpgrade()}
                  />
                  <div className="flex gap-3">
                    <Button onClick={() => setShowUpgradeModal(false)} variant="outline" className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={handleUpgrade} className="flex-1 bg-blue-600 hover:bg-blue-700">
                      Unlock
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-[34px] font-bold text-slate-900 tracking-tight leading-tight">
                Welcome back{teacher?.full_name ? `, ${teacher.full_name.split(" ")[0]}` : ""}.
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Here's what Quest has handled for you so far.
              </p>
            </div>
            <Button
              onClick={() => navigate(createPageUrl("Generate"))}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2 h-11 px-5 shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              Generate something new
            </Button>
          </div>

        {/* Hero stat: Hours saved */}
        <div
          className="rounded-3xl p-7 mb-6 text-white relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #2563EB 0%, #1D4ED8 50%, #1E40AF 100%)",
          }}
        >
          <div className="absolute -right-10 -top-10 opacity-20">
            <Clock className="w-40 h-40" />
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider mb-3">
              <TrendingUp className="w-3.5 h-3.5" />
              Hours saved with Quest
            </div>
            <p className="text-6xl font-extrabold tracking-tight leading-none">
              {hoursSaved.toLocaleString()}
              <span className="text-2xl font-semibold opacity-80 ml-2">hrs</span>
            </p>
            <p className="text-sm text-white/80 mt-2 max-w-md">
              Based on {totalResources.toLocaleString()} AI-generated resources across
              your curricula, library, and live sessions. Rough math from teacher
              interviews — actual mileage varies.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active classes"
            value={classes.length}
            icon={Users}
            color="blue"
          />
          <StatCard
            label="Curriculums"
            value={curricula.length}
            icon={GraduationCap}
            color="emerald"
          />
          <StatCard
            label="Resources generated"
            value={totalResources}
            icon={Sparkles}
            color="violet"
            sublabel={`${resourceStats.quizzes} quizzes · ${resourceStats.caseStudies} case studies`}
          />
          <StatCard
            label="Library handouts"
            value={resourceStats.generatedHandouts}
            icon={BookOpen}
            color="amber"
            sublabel="One-off generations saved for reuse"
          />
        </div>

        {/* Assign Section */}
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-black mb-4">Assign Learn Dates</h2>
            {classes.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-gray-600 mb-4">No {strings.nav_classes.toLowerCase()} created yet</p>
                <Button
                  data-tour="create-class-btn"
                  onClick={() => navigate(createPageUrl("TeacherClasses"))}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {strings.create_class_cta}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Assignment Form */}
                <div className="grid md:grid-cols-5 gap-4 items-end">
                  <div data-tour="curriculum-select">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Class</label>
                    <Select value={selectedClass || ""} onValueChange={(val) => {
                      setSelectedClass(val);
                      setSelectedUnit(null);
                      setSelectedSubunit(null);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Unit</label>
                    <Select 
                      value={selectedUnit || ""} 
                      onValueChange={(val) => {
                        setSelectedUnit(val);
                        setSelectedSubunit(null);
                      }}
                      disabled={!selectedClass}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>{unit.unit_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Topic</label>
                    <Select 
                      value={selectedSubunit || ""} 
                      onValueChange={setSelectedSubunit}
                      disabled={!selectedUnit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select topic" />
                      </SelectTrigger>
                      <SelectContent>
                        {subunits.filter(sub => sub.unit_id === selectedUnit).map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>{sub.subunit_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Due Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                          <span className="truncate text-sm">{selectedDate ? format(selectedDate, 'PP') : 'Pick a date'}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start" sideOffset={5}>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <Button 
                    onClick={handleCreateAssignment}
                    disabled={!selectedClass || !selectedSubunit || !selectedDate || saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {saving ? "Saving..." : "Assign"}
                  </Button>
                </div>

                {/* Assigned learning sessions (lesson_bundles) */}
                {bundleAssignments.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                      Assigned Learning Sessions
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {bundleAssignments.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between p-3 bg-violet-50 border border-violet-100 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-black">{a.bundle_title}</p>
                              <p className="text-xs text-gray-500">
                                {getClassName(a.class_id)}
                                {a.due_at && (
                                  <> • Due {format(new Date(a.due_at), 'MMM d, yyyy')}</>
                                )}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (!confirm("Unassign this learning session?")) return;
                              try {
                                await quest.entities.LearningSessionAssignment.delete(a.id);
                                setBundleAssignments((prev) => prev.filter((x) => x.id !== a.id));
                              } catch (err) {
                                console.error("Unassign failed:", err);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Assignments */}
                {assignments.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Current Assignments</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <div>
                              <p className="text-sm font-medium text-black">{getSubunitName(assignment.subunit_id)}</p>
                              <p className="text-xs text-gray-500">{getClassName(assignment.class_id)} • Due {format(new Date(assignment.due_date + 'T00:00:00'), 'MMM d, yyyy')}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAssignment(assignment.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
      </TeacherLayout>
    </>
  );
}

const COLOR_MAP = {
  blue:    { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-100" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  violet:  { bg: "bg-violet-50",  text: "text-violet-600",  border: "border-violet-100" },
  amber:   { bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-100" },
};

function StatCard({ label, value, icon: Icon, color = "blue", sublabel }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className={`bg-white rounded-2xl border ${c.border} p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[12px] font-semibold tracking-wider uppercase text-slate-500">
          {label}
        </p>
        <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
      </div>
      <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
        {Number(value || 0).toLocaleString()}
      </p>
      {sublabel ? (
        <p className="text-xs text-slate-500 mt-1.5">{sublabel}</p>
      ) : null}
    </div>
  );
}