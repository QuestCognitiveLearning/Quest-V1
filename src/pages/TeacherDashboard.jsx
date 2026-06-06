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
import { format } from "date-fns";
import { 
  BookOpen, 
  Users, 
  Plus,
  ChevronRight,
  GraduationCap,
  CalendarIcon,
  CheckCircle,
  Trash2
} from "lucide-react";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [assignments, setAssignments] = useState([]);
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
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setLoading(false);
    }
  };

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

          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-black mb-1">Dashboard</h1>
            <p className="text-sm text-gray-600">Overview of your teaching activities</p>
          </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Total Classes</p>
                  <p className="text-4xl font-bold text-black">{classes.length}</p>
                </div>
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Curriculum Created</p>
                  <p className="text-4xl font-bold text-black">{curricula.length}</p>
                </div>
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-7 h-7 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
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
                <p className="text-gray-600 mb-4">No classes created yet</p>
                <Button 
                  data-tour="create-class-btn"
                  onClick={() => navigate(createPageUrl("TeacherClasses"))}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Class
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