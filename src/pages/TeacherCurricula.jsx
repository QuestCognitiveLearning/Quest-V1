import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeacherLayout from "../components/teacher/TeacherLayout";
import MindmapPreview from "../components/teacher/MindmapPreview";
import {
  BookOpen,
  Plus,
  Trash2,
  GraduationCap,
  Sparkles,
} from "lucide-react";

export default function TeacherCurricula() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [curricula, setCurricula] = useState([]);
  const [curriculaData, setCurriculaData] = useState({});

  const [loading, setLoading] = useState(true);
  // Modal asks which kind of content the teacher wants to build before
  // routing them — full-year curriculum (multi-unit, multi-subunit) vs
  // a single subunit-style learning session (one video → quiz/case study).
  const [chooserOpen, setChooserOpen] = useState(false);
  const openCreateChooser = () => setChooserOpen(true);

  useEffect(() => {
    loadCurricula();
  }, []);

  const loadCurricula = async () => {
    try {
      const user = await quest.auth.me();
      setTeacher(user);
      
      const data = await quest.entities.Curriculum.filter({ teacher_id: user.id });
      setCurricula(data);
      
      // Load all units and subunits in parallel for better performance
      const [allUnits, allSubunits] = await Promise.all([
        quest.entities.Unit.list(),
        quest.entities.Subunit.list()
      ]);
      
      const dataMap = {};
      data.forEach(curriculum => {
        const curriculumUnits = allUnits
          .filter(u => u.curriculum_id === curriculum.id)
          .sort((a, b) => a.unit_order - b.unit_order);
        
        const unitsWithSubunits = curriculumUnits.map(unit => ({
          ...unit,
          subunits: allSubunits
            .filter(s => s.unit_id === unit.id)
            .sort((a, b) => a.subunit_order - b.subunit_order)
        }));
        
        dataMap[curriculum.id] = { units: unitsWithSubunits };
      });
      setCurriculaData(dataMap);
      
      setLoading(false);
    } catch (err) {
      console.error("Failed to load curriculum:", err);
      setLoading(false);
    }
  };

  const handleDeleteCurriculum = async (id) => {
    if (!confirm("Are you sure you want to delete this curriculum?")) return;
    try {
      await quest.entities.Curriculum.delete(id);
      loadCurricula();
    } catch (err) {
      console.error("Failed to delete curriculum:", err);
    }
  };

  const handleSignOut = () => {
    quest.auth.logout();
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
    <TeacherLayout activeNav="curricula" user={teacher} onSignOut={handleSignOut}>
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-black mb-1">Curriculum</h1>
            <p className="text-sm text-gray-600">Create and manage your curriculum content</p>
          </div>
          <Button 
            onClick={openCreateChooser}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Curriculum with Quest
          </Button>
        </div>

        {curricula.length === 0 ? (
          <Card className="border border-gray-200">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-black mb-2">No curriculum yet</h3>
                <p className="text-gray-600 mb-6 text-lg">Create your first curriculum to get started</p>
                <Button 
                  onClick={openCreateChooser}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Curriculum with Quest
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {curricula.map((curriculum) => (
              <Card 
                key={curriculum.id}
                className="group border border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden"
                onClick={() => navigate(createPageUrl("ManageCurriculum") + `?id=${curriculum.id}`)}
              >
                <CardContent className="p-0">
                  <div className="p-6 pb-3">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-black mb-1">{curriculum.subject_name}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                            {curriculum.curriculum_difficulty}
                          </span>
                          <span className="text-xs text-gray-500">
                            {curriculaData[curriculum.id]?.units.length || 0} units
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCurriculum(curriculum.id);
                        }}
                        className="h-8 w-8 p-0 hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Mindmap Preview */}
                  {curriculaData[curriculum.id] && curriculaData[curriculum.id].units.length > 0 && (
                    <div className="px-6 pb-6">
                      <MindmapPreview curriculum={curriculaData[curriculum.id]} />
                      <p className="text-xs text-gray-500 mt-3">Created {new Date(curriculum.created_date).toLocaleDateString()}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {chooserOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setChooserOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-1">What do you want to build?</h2>
            <p className="text-sm text-slate-500 mb-6">
              Pick one — you can always build more later.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setChooserOpen(false);
                  navigate(createPageUrl("CreateCurriculum"));
                }}
                className="text-left p-5 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">Full year curriculum</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Multi-unit course. Quest generates units, subunits, and content for the whole arc.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setChooserOpen(false);
                  // /Generate is the one-shot subunit-style flow: paste a
                  // video or PDF, get a quiz + case study + inquiry + checks.
                  navigate(createPageUrl("Generate"));
                }}
                className="text-left p-5 rounded-xl border-2 border-slate-200 hover:border-violet-500 hover:bg-violet-50/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">One subunit</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Single learning session from a video or PDF — quiz, case study, inquiry hook, attention checks.
                </p>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setChooserOpen(false)}
              className="mt-5 text-xs text-slate-400 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}