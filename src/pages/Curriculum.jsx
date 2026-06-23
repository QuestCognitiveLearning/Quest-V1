import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { calculateDayStreak } from "@/lib/streak";
import { quest } from "@/api/questClient";
import { Card, CardContent } from "@/components/ui/card";
import { 
  BookOpen,
  Home,
  BarChart3,
  FileText,
  Flame,
  LogOut,
  ChevronLeft,
  Users
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Curriculum() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("curriculum");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [curriculum, setCurriculum] = useState(null);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [studentProgress, setStudentProgress] = useState([]);
  const [unitImages, setUnitImages] = useState({});
  const [generatingImages, setGeneratingImages] = useState(false);
  const [dayStreak, setDayStreak] = useState(0);
  const [learnedTopics, setLearnedTopics] = useState(0);

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
      // Get user from localStorage (custom auth)
      const storedUser = localStorage.getItem('currentUser');
      const currentUser = storedUser ? JSON.parse(storedUser) : await quest.auth.me();
      setUser(currentUser);
      
      const enrollmentsData = await quest.entities.StudentEnrollment.filter({ student_id: currentUser.id });
      setEnrollments(enrollmentsData);

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

      const [curriculumData, allUnits, allSubunits, progress, sessions, images] = await Promise.all([
        quest.entities.Curriculum.filter({ id: selectedClass.curriculum_id }),
        quest.entities.Unit.list(),
        quest.entities.Subunit.list(),
        quest.entities.StudentProgress.filter({ student_id: user.id }),
        quest.entities.LearningSession.filter({ student_id: user.id }, "-start_time"),
        quest.entities.UnitImage.list()
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

      // Calculate learned topics
      const learned = progress.filter(p => p.learned_status === true).length;
      setLearnedTopics(learned);

      // Calculate day streak
      const streak = calculateDayStreak(sessions);
      setDayStreak(streak);

      // Load unit images
      const imageMap = {};
      images.forEach(img => {
        imageMap[img.unit_id] = img.image_url;
      });
      setUnitImages(imageMap);

      // Generate missing images
      const unitsWithoutImages = unitsData.filter(unit => !imageMap[unit.id]);
      if (unitsWithoutImages.length > 0) {
        generateMissingImages(unitsWithoutImages, curriculumData[0].subject_name);
      }
      }
    } catch (err) {
      console.error("Failed to load class data:", err);
    }
  };

  const generateMissingImages = async (units, subjectName) => {
    setGeneratingImages(true);
    try {
      // Generate all images in parallel for faster loading
      const imageResults = await Promise.all(
        units.map(unit => 
          quest.integrations.Core.GenerateImage({
            prompt: `Educational illustration for ${unit.unit_name} in ${subjectName}. Professional, clean, and academic style. No text or labels, just visual representation of the concepts.`
          })
        )
      );
      
      // Save all images in parallel
      await Promise.all(
        units.map((unit, index) =>
          quest.entities.UnitImage.create({
            unit_id: unit.id,
            image_url: imageResults[index].url
          })
        )
      );
      
      // Update state with all images
      const newImages = {};
      units.forEach((unit, index) => {
        newImages[unit.id] = imageResults[index].url;
      });
      setUnitImages(prev => ({ ...prev, ...newImages }));
    } catch (err) {
      console.error("Failed to generate images:", err);
    } finally {
      setGeneratingImages(false);
    }
  };


  const getUnitsWithProgress = () => {
    if (!units || !subunits || !studentProgress) return [];
    
    return units.map(unit => {
      const unitSubunits = subunits.filter(s => s.unit_id === unit.id);
      const learnedCount = unitSubunits.filter(sub => {
        const progress = studentProgress.find(p => p.subunit_id === sub.id);
        return progress && progress.new_session_completed === true;
      }).length;
      const progressPercent = unitSubunits.length > 0 ? Math.round((learnedCount / unitSubunits.length) * 100) : 0;
      
      return {
        id: unit.id,
        name: unit.unit_name,
        description: `${unitSubunits.length} subunit${unitSubunits.length !== 1 ? 's' : ''} • ${learnedCount} mastered`,
        progress: progressPercent,
        image: unitImages[unit.id] || "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&h=300&fit=crop",
        subunits: unitSubunits.map(sub => {
          const subProgress = studentProgress.find(p => p.subunit_id === sub.id);
          return {
            id: sub.id,
            name: sub.subunit_name,
            description: sub.learning_standard || "Learning standard not provided",
            isLearned: subProgress?.new_session_completed || false,
            progress: subProgress?.new_session_score || 0
          };
        })
      };
    });
  };

  const unitsWithProgress = getUnitsWithProgress();
  const totalMastered = studentProgress?.filter(p => p.learned_status === true).length || 0;

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
    <div className="flex h-screen bg-gray-50">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <div className="w-64 bg-[#1E40AF] text-white flex flex-col border-r border-[#1E40AF]" style={{fontFamily: '"Inter", sans-serif'}}>
        <button onClick={() => navigate(createPageUrl("KnowledgeMap"))} className="p-4 hover:bg-white/10 transition-all flex items-center gap-2 m-2">
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="px-5 pb-5 border-b border-white/10">
          {/* Centered lockup with extra horizontal breathing room (gap-5). */}
          <div className="flex items-center gap-1 mb-2 -ml-2">
            <img
              src="/quest-logo-on-blue.png"
              alt="Quest Learning"
              width="80"
              height="80"
              className="w-20 h-20"
            />
            <h1 className="text-lg font-semibold tracking-tight">Quest Learning</h1>
          </div>
        </div>

        {classes.length > 0 && (
          <div className="p-4 border-b border-white/10">
            <Select value={selectedClassId} onValueChange={(val) => {
              setSelectedClassId(val);
              localStorage.setItem('selectedClassId', val);
            }}>
              <SelectTrigger className="w-full bg-white/10 border-0 text-white hover:bg-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.class_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <button onClick={() => handleNavigation("knowledge-map", "KnowledgeMap")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "knowledge-map" ? "bg-white/20" : "hover:bg-white/10"}`}>
            <BookOpen className="w-4 h-4" />
            <span>Knowledge Map</span>
          </button>
          <button onClick={() => handleNavigation("curriculum", "Curriculum")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "curriculum" ? "bg-white/20" : "hover:bg-white/10"}`}>
            <FileText className="w-4 h-4" />
            <span>Curriculum</span>
          </button>
          <button onClick={() => handleNavigation("learning-hub", "LearningHub")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "learning-hub" ? "bg-white/20" : "hover:bg-white/10"}`}>
            <Home className="w-4 h-4" />
            <span>Learning Hub</span>
          </button>
          <button onClick={() => handleNavigation("progress", "Progress")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "progress" ? "bg-white/20" : "hover:bg-white/10"}`}>
            <BarChart3 className="w-4 h-4" />
            <span>Progress</span>
          </button>
          <button onClick={() => handleNavigation("classes", "Classes")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "classes" ? "bg-white/20" : "hover:bg-white/10"}`}>
            <Users className="w-4 h-4" />
            <span>Classes</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="w-full py-2.5 px-3 bg-white/10 rounded-lg flex items-center gap-2 justify-center text-xs font-medium">
            <Flame className="w-4 h-4" />
            <span>{dayStreak} day streak</span>
          </div>
          <div className="w-full py-2.5 px-3 bg-white/10 rounded-lg text-xs font-medium text-center">
            <BookOpen className="w-4 h-4 inline mr-2" />
            {learnedTopics} topics mastered
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-semibold text-sm">
              {user?.full_name?.charAt(0) || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{user?.full_name || "Student"}</p>
              <p className="text-xs text-white/60 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-2 justify-center text-xs font-medium">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-white" style={{fontFamily: '"Inter", sans-serif'}}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : enrollments.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md px-8">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <BookOpen className="w-12 h-12 text-indigo-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">No Class Enrolled</h2>
              <p className="text-gray-600 mb-8 text-lg">Join a class to view your curriculum.</p>
              <button 
                onClick={() => navigate(createPageUrl("JoinClass"))}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                <Users className="w-5 h-5 inline mr-2" />
                Join a Class
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto p-8">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-black mb-2">{curriculum?.subject_name || "Curriculum"}</h1>
                  <p className="text-sm text-gray-600">Master {unitsWithProgress.length} comprehensive units</p>
                </div>
                {generatingImages && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    Generating images...
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {unitsWithProgress.map((unit, index) => (
                <Card key={unit.id} className="border-0 shadow-lg hover:shadow-xl transition-all overflow-hidden group">
                  <CardContent className="p-0">
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={unit.image} 
                        alt={unit.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <h2 className="text-xl font-bold text-white mb-2">{unit.name}</h2>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
                            <div 
                              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500" 
                              style={{ width: `${unit.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold text-white">{unit.progress}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-gradient-to-br from-gray-50 to-white">
                      <p className="text-xs text-gray-600 mb-4 font-medium">{unit.description}</p>
                      
                      <div className="space-y-2">
                        {unit.subunits.map((subunit, idx) => (
                          <div 
                            key={subunit.id} 
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                subunit.isLearned 
                                  ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white' 
                                  : 'bg-gray-200 text-gray-600'
                              }`}>
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm text-black truncate">{subunit.name}</h3>
                                <p className="text-xs text-gray-500 truncate">{subunit.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              {subunit.isLearned ? (
                                <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full whitespace-nowrap">
                                  ✓ Mastered
                                </span>
                              ) : subunit.progress > 0 ? (
                                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full whitespace-nowrap">
                                  {subunit.progress}%
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full whitespace-nowrap">
                                  Not Started
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}