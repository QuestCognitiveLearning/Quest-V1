import React, { useState, useEffect } from "react";
import { quest } from "@/api/questClient";
import { Card, CardContent } from "@/components/ui/card";
import TeacherLayout from "../components/teacher/TeacherLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, CheckCircle, Clock } from "lucide-react";

export default function TeacherProgress({ selectedClassId: propClassId }) {
  const [teacher, setTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(propClassId || null);
  const [students, setStudents] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [activeTab, setActiveTab] = useState("progress");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadProgress();
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (propClassId) {
      setSelectedClassId(propClassId);
    }
  }, [propClassId]);

  const loadData = async () => {
    try {
      const storedUser = localStorage.getItem('currentUser');
      const user = storedUser ? JSON.parse(storedUser) : await quest.auth.me();
      setTeacher(user);

      const classData = await quest.entities.Class.filter({ teacher_id: user.id });
      setClasses(classData);

      const savedClassId = localStorage.getItem('teacherSelectedClassId');
      if (savedClassId && classData.some(c => c.id === savedClassId)) {
        setSelectedClassId(savedClassId);
      } else if (classData.length > 0) {
        setSelectedClassId(classData[0].id);
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to load data:", err);
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const [classData, allCurricula, allUnits, allSubunits, enrollments, allUsers, allProgress, allQuizzes, allQuizResults] = await Promise.all([
        quest.entities.Class.filter({ id: selectedClassId }),
        quest.entities.Curriculum.list(),
        quest.entities.Unit.list(),
        quest.entities.Subunit.list(),
        quest.entities.StudentEnrollment.filter({ class_id: selectedClassId }),
        quest.entities.User.list(),
        quest.entities.StudentProgress.list(),
        quest.entities.Quiz.list(),
        quest.entities.QuizResult.list()
      ]);
      
      if (classData.length === 0) return;

      const curriculum = allCurricula.find(c => c.id === classData[0].curriculum_id);
      if (!curriculum) return;

      const units = allUnits
        .filter(u => u.curriculum_id === curriculum.id)
        .sort((a, b) => a.unit_order - b.unit_order);
      
      const relevantSubunits = allSubunits
        .filter(s => units.some(u => u.id === s.unit_id))
        .sort((a, b) => a.subunit_order - b.subunit_order);
      setSubunits(relevantSubunits);

      const studentIds = enrollments.map(e => e.student_id);

      const studentData = studentIds.map(studentId => {
        const user = allUsers.find(u => u.id === studentId);
        const progress = allProgress.filter(p => p.student_id === studentId);

        const progressMap = {};
        relevantSubunits.forEach(sub => {
          const p = progress.find(pr => pr.subunit_id === sub.id);
          progressMap[sub.id] = {
            completed: p?.new_session_completed || false,
            learned: p?.learned_status || false
          };
        });

        return {
          id: studentId,
          name: user?.full_name || "Unknown",
          email: user?.email || "",
          student_full_name: user?.full_name || "Unknown",
          progressMap
        };
      });

      // Filter quizzes for this class's subunits
      const classQuizzes = allQuizzes.filter(q => relevantSubunits.some(s => s.id === q.subunit_id));
      setQuizzes(classQuizzes);
      setQuizResults(allQuizResults.filter(r => classQuizzes.some(q => q.id === r.quiz_id)));
      setStudents(studentData);
    } catch (err) {
      console.error("Failed to load progress:", err);
    }
  };

  const handleSignOut = () => {
    quest.auth.logout();
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    localStorage.setItem('teacherSelectedClassId', classId);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading progress...</p>
        </div>
      </div>
    );
  }

  return (
    <TeacherLayout activeNav="progress" user={teacher} onSignOut={handleSignOut}>
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-semibold text-black mb-1">Student Progress</h1>
              <p className="text-sm text-gray-600">Track individual student progress across all topics</p>
            </div>
            {classes.length > 0 && (
              <Select value={selectedClassId} onValueChange={handleClassChange}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.class_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("progress")}
              className={`pb-3 text-sm font-medium flex items-center gap-2 relative transition-all ${
                activeTab === "progress" ? "text-black" : "text-gray-500"
              }`}
            >
              <Users className="w-4 h-4" />
              Progress
              {activeTab === "progress" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"></div>}
            </button>
          </div>
        </div>

        {!selectedClassId ? (
          <Card className="border border-gray-200">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-black mb-2">Select a class</h3>
                <p className="text-gray-600">Choose a class to view student progress</p>
              </div>
            </CardContent>
          </Card>
        ) : students.length === 0 ? (
           <Card className="border border-gray-200">
             <CardContent className="py-16">
               <div className="text-center">
                 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Users className="w-8 h-8 text-gray-400" />
                 </div>
                 <h3 className="text-xl font-semibold text-black mb-2">No students yet</h3>
                 <p className="text-gray-600">Students will appear here once they join the class</p>
               </div>
             </CardContent>
           </Card>
         ) : (
           <div className="space-y-6">
            {students.map((student) => {
              const completed = Object.values(student.progressMap).filter(p => p.completed).length;
              const learned = Object.values(student.progressMap).filter(p => p.learned).length;
              const total = subunits.length;

              return (
                <Card key={student.id} className="border border-gray-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-semibold text-lg text-blue-600">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-black text-lg">{student.name}</h3>
                          <p className="text-sm text-gray-600">{student.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">{completed}/{total}</p>
                          <p className="text-xs text-gray-600">Completed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">{learned}/{total}</p>
                          <p className="text-xs text-gray-600">Learned</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-10 gap-2">
                      {subunits.map((subunit) => {
                        const progress = student.progressMap[subunit.id];
                        return (
                          <div
                            key={subunit.id}
                            className={`h-8 rounded flex items-center justify-center text-xs font-semibold ${
                              progress.learned ? 'bg-blue-500 text-white' :
                              progress.completed ? 'bg-green-500 text-white' :
                              'bg-gray-200 text-gray-400'
                            }`}
                            title={`${subunit.subunit_name} - ${progress.learned ? 'Learned' : progress.completed ? 'Completed' : 'Not started'}`}
                          >
                            {progress.learned ? <CheckCircle className="w-4 h-4" /> :
                             progress.completed ? <Clock className="w-4 h-4" /> : ''}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}