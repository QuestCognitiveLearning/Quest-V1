import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";

export default function SubunitProgressModal({ 
  open, 
  onClose, 
  subunit, 
  sessionType, 
  students, 
  progressData, 
  quizResults,
  learningSessions 
}) {
  if (!subunit) return null;

  const getStudentSessionData = (studentId) => {
    const progress = progressData.find(p => p.student_id === studentId && p.subunit_id === subunit.id);
    
    if (sessionType === "new_topic") {
      return {
        completed: progress?.new_session_completed || false,
        score: progress?.new_session_score || null
      };
    } else {
      // Review session
      const reviewNum = parseInt(sessionType.replace("review_", ""));
      const completed = progress?.review_count >= reviewNum;
      const score = reviewNum === progress?.review_count ? progress?.last_review_score : null;
      return { completed, score };
    }
  };

  const completedStudents = students.filter(s => getStudentSessionData(s.id).completed);
  const notCompletedStudents = students.filter(s => !getStudentSessionData(s.id).completed);

  const sessionLabel = sessionType === "new_topic" ? "Learn Session" : `Review ${sessionType.replace("review_", "")}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {subunit.subunit_name} - {sessionLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Completed Students */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Completed ({completedStudents.length})</h3>
            </div>
            {completedStudents.length > 0 ? (
              <div className="space-y-2">
                {completedStudents.map(student => {
                  const data = getStudentSessionData(student.id);
                  return (
                    <div key={student.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{student.full_name}</p>
                        <p className="text-sm text-gray-600">{student.email}</p>
                      </div>
                      {data.score !== null && (
                        <Badge className={`${data.score >= 70 ? 'bg-green-600' : 'bg-orange-500'} text-white`}>
                          {data.score}%
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No students have completed this session yet</p>
            )}
          </div>

          {/* Not Completed Students */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-gray-900">Not Completed ({notCompletedStudents.length})</h3>
            </div>
            {notCompletedStudents.length > 0 ? (
              <div className="space-y-2">
                {notCompletedStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{student.full_name}</p>
                      <p className="text-sm text-gray-600">{student.email}</p>
                    </div>
                    <Badge variant="outline" className="text-gray-500">Pending</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">All students have completed this session!</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}