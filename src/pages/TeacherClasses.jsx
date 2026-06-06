import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TeacherLayout from "../components/teacher/TeacherLayout";
import { 
  Users, 
  Plus, 
  Trash2,
  BookOpen,
  Copy,
  ChevronRight,
  GraduationCap
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TeacherClasses() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClass, setNewClass] = useState({
    class_name: "",
    curriculum_id: ""
  });

  const tryOpenCreate = () => setShowCreateForm(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await quest.auth.me();
      setTeacher(user);
      const [classData, curriculaData, allEnrollments] = await Promise.all([
        quest.entities.Class.filter({ teacher_id: user.id }),
        quest.entities.Curriculum.filter({ teacher_id: user.id }),
        quest.entities.StudentEnrollment.list()
      ]);
      
      const enrollmentCounts = {};
      allEnrollments.forEach(e => {
        enrollmentCounts[e.class_id] = (enrollmentCounts[e.class_id] || 0) + 1;
      });
      
      const classesWithCounts = classData.map(cls => ({
        ...cls,
        studentCount: enrollmentCounts[cls.id] || 0
      }));
      
      setClasses(classesWithCounts);
      setCurricula(curriculaData);
      setLoading(false);
    } catch (err) {
      console.error("❌ [CLASSES] Failed to load data:", err);
      setLoading(false);
    }
  };

  const generateJoinCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateClass = async () => {
    try {
      const user = await quest.auth.me();
      const joinCode = generateJoinCode();
      await quest.entities.Class.create({
        ...newClass,
        teacher_id: user.id,
        join_code: joinCode
      });
      setShowCreateForm(false);
      setNewClass({ class_name: "", curriculum_id: "" });
      loadData();
    } catch (err) {
      console.error("Failed to create class:", err);
    }
  };

  const handleDeleteClass = async (id) => {
    if (!confirm("Are you sure you want to delete this class?")) return;
    try {
      await quest.entities.Class.delete(id);
      loadData();
    } catch (err) {
      console.error("Failed to delete class:", err);
    }
  };

  const getCurriculumName = (curriculumId) => {
    const curriculum = curricula.find(c => c.id === curriculumId);
    return curriculum ? curriculum.subject_name : "Unknown";
  };

  const handleSignOut = () => {
    quest.auth.logout();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading classes...</p>
        </div>
      </div>
    );
  }

  const cardColors = [
    { grad: 'from-[#2563EB] to-[#3b82f6]', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', shadow: 'shadow-blue-100' },
    { grad: 'from-[#2563EB] to-[#3b82f6]', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', shadow: 'shadow-blue-100' },
    { grad: 'from-[#2563EB] to-[#3b82f6]', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', shadow: 'shadow-blue-100' },
  ];

  return (
    <TeacherLayout activeNav="classes" user={teacher} onSignOut={handleSignOut}>
      <div className="max-w-7xl mx-auto p-8">

        {/* Hero Header */}
        <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-r from-[#1d4ed8] via-[#2563EB] to-[#3b82f6] p-7 shadow-lg">
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 right-32 w-32 h-32 rounded-full bg-white/5 translate-y-1/2" />
          <div className="absolute top-4 right-56 w-16 h-16 rounded-full bg-white/10" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">Manage</p>
              <h1 className="text-3xl font-bold text-white mb-1">My Classes</h1>
              <p className="text-blue-100/80 text-sm">Manage your classes and student enrollment</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/20">
                <GraduationCap className="w-5 h-5 text-blue-200" />
                <div>
                  <p className="text-2xl font-bold text-white leading-none">{classes.length}</p>
                  <p className="text-blue-200 text-xs mt-0.5">Classes</p>
                </div>
              </div>
              <Button
                onClick={tryOpenCreate}
                disabled={curricula.length === 0}
                className="bg-white text-[#2563EB] hover:bg-blue-50 font-semibold shadow-md border-0"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create Class
              </Button>
            </div>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 bg-white rounded-2xl border border-blue-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-white" />
              </div>
              Create New Class
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Class Name</label>
                <Input
                  value={newClass.class_name}
                  onChange={(e) => setNewClass({...newClass, class_name: e.target.value})}
                  placeholder="e.g., Period 3 Biology"
                  className="border-gray-200 focus:border-blue-400 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Curriculum</label>
                <Select
                  value={newClass.curriculum_id}
                  onValueChange={(value) => setNewClass({...newClass, curriculum_id: value})}
                >
                  <SelectTrigger className="border-gray-200 rounded-xl">
                    <SelectValue placeholder="Select a curriculum" />
                  </SelectTrigger>
                  <SelectContent>
                    {curricula.map((curriculum) => (
                      <SelectItem key={curriculum.id} value={curriculum.id}>
                        {curriculum.subject_name} ({curriculum.curriculum_difficulty})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button
                onClick={handleCreateClass}
                disabled={!newClass.class_name || !newClass.curriculum_id}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                Create Class
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowCreateForm(false); setNewClass({ class_name: "", curriculum_id: "" }); }}
                className="rounded-xl border-gray-200"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* No curriculum warning */}
        {curricula.length === 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">No curriculum found</p>
              <p className="text-xs text-amber-600 mt-0.5">You need to create a curriculum before creating a class.</p>
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex-shrink-0"
              onClick={() => navigate(createPageUrl("TeacherCurricula"))}
            >
              Create Curriculum →
            </Button>
          </div>
        )}

        {/* Classes Grid */}
        {classes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#2563EB] to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No classes yet</h3>
            <p className="text-gray-400 text-sm mb-6">Create your first class to get started</p>
            {curricula.length > 0 && (
              <Button onClick={tryOpenCreate} className="bg-blue-600 hover:bg-blue-700 rounded-xl">
                <Plus className="w-4 h-4 mr-2" /> Create Class
              </Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {classes.map((cls, index) => {
              const color = cardColors[index % cardColors.length];
              return (
                <div
                  key={cls.id}
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group overflow-hidden`}
                  onClick={() => navigate(createPageUrl("TeacherClassDetail") + `?id=${cls.id}`)}
                >
                  {/* Top accent bar */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${color.grad}`} />
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color.grad} flex items-center justify-center shadow-md ${color.shadow}`}>
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className={`text-base font-bold text-gray-900 mb-3 group-hover:${color.text} transition-colors`}>{cls.class_name}</h3>

                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${color.light} ${color.text} text-xs font-semibold rounded-lg border ${color.border}`}>
                        <BookOpen className="w-3 h-3" />
                        {getCurriculumName(cls.curriculum_id)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-lg border border-green-100">
                        <Users className="w-3 h-3" />
                        {cls.studentCount || 0} students
                      </span>
                    </div>

                    {/* Join Code Box */}
                    <div
                      className={`${color.light} border ${color.border} rounded-xl p-3.5 mb-4`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-xs text-gray-400 font-medium mb-1.5">Student Join Code</p>
                      <div className="flex items-center justify-between">
                        <p className={`text-2xl font-black tracking-widest ${color.text}`}>{cls.join_code}</p>
                        <button
                          className={`w-7 h-7 rounded-lg ${color.light} border ${color.border} flex items-center justify-center hover:opacity-60 transition-opacity`}
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(cls.join_code); }}
                        >
                          <Copy className={`w-3.5 h-3.5 ${color.text}`} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">Created {new Date(cls.created_date).toLocaleDateString()}</p>
                      <span className={`flex items-center gap-0.5 text-xs font-semibold ${color.text} group-hover:gap-1.5 transition-all`}>
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}