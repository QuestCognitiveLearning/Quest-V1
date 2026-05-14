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
import { Trophy, Medal, Award } from "lucide-react";

export default function TeacherLeaderboard({ selectedClassId: propClassId }) {
  const [teacher, setTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(propClassId || null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadLeaderboard();
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

  const loadLeaderboard = async () => {
    try {
      const [enrollments, allUsers, allProgress] = await Promise.all([
        quest.entities.StudentEnrollment.filter({ class_id: selectedClassId }),
        quest.entities.User.list(),
        quest.entities.StudentProgress.list()
      ]);
      
      const studentIds = enrollments.map(e => e.student_id);
      
      const students = studentIds.map(studentId => {
        const user = allUsers.find(u => u.id === studentId);
        const progress = allProgress.filter(p => p.student_id === studentId);
        
        const completedCount = progress.filter(p => p.new_session_completed).length;
        const totalProgress = progress.reduce((sum, p) => {
          if (p.new_session_completed) return sum + 100;
          return sum;
        }, 0);

        return {
          id: studentId,
          name: user?.full_name || "Unknown",
          email: user?.email || "",
          completedSubunits: completedCount,
          totalProgress: Math.round(totalProgress / Math.max(progress.length, 1))
        };
      });

      const sorted = students.sort((a, b) => b.completedSubunits - a.completedSubunits || b.totalProgress - a.totalProgress);
      setLeaderboard(sorted);
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
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
          <p className="text-gray-600">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <TeacherLayout activeNav="leaderboard" user={teacher} onSignOut={handleSignOut}>
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-semibold text-black mb-1">Leaderboard</h1>
              <p className="text-sm text-gray-600">Top performing students across your classes</p>
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
        </div>

        {!selectedClassId ? (
          <Card className="border border-gray-200">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-black mb-2">Select a class</h3>
                <p className="text-gray-600">Choose a class to view the leaderboard</p>
              </div>
            </CardContent>
          </Card>
        ) : leaderboard.length === 0 ? (
          <Card className="border border-gray-200">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-black mb-2">No students yet</h3>
                <p className="text-gray-600">Students will appear here once they join and start learning</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {leaderboard.map((student, index) => (
              <Card key={student.id} className={`border transition-all ${index < 3 ? 'border-yellow-300 bg-gradient-to-r from-yellow-50 to-white' : 'border-gray-200'}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-200 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {index === 0 ? <Trophy className="w-7 h-7" /> :
                       index === 1 ? <Medal className="w-7 h-7" /> :
                       index === 2 ? <Award className="w-7 h-7" /> :
                       index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-black text-lg">{student.name}</h3>
                      <p className="text-sm text-gray-600">{student.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-black">{student.completedSubunits}</p>
                      <p className="text-sm text-gray-600">topics completed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{student.totalProgress}%</p>
                      <p className="text-sm text-gray-600">avg progress</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}