import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Sparkles } from "lucide-react";
import NotificationModal from "../components/shared/NotificationModal";
import { useNotification } from "../components/shared/useNotification";

export default function JoinClass() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { notification, showError: showNotifError, closeNotification } = useNotification();



  const handleJoinClass = async () => {
    if (!joinCode.trim()) {
      setError("Please enter a join code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const user = await quest.auth.me();
      const classes = await quest.entities.Class.list();
      const classToJoin = classes.find(c => c.join_code === joinCode.toUpperCase().trim());
      
      if (!classToJoin) {
        setError("Invalid join code. Please check and try again.");
        setLoading(false);
        return;
      }

      const allEnrollments = await quest.entities.StudentEnrollment.list();
      const existingEnrollment = allEnrollments.find(e => 
        e.student_id === user.id && e.class_id === classToJoin.id
      );

      if (existingEnrollment) {
        setError("You're already enrolled in this class!");
        setLoading(false);
        return;
      }

      await quest.entities.StudentEnrollment.create({
        student_id: user.id,
        class_id: classToJoin.id,
        student_full_name: user.full_name,
        student_email: user.email,
        enrollment_date: new Date().toISOString()
      });

      const allCurricula = await quest.entities.Curriculum.list();
      const curriculum = allCurricula.find(c => c.id === classToJoin.curriculum_id);
      
      if (curriculum) {
        const allUnits = await quest.entities.Unit.list();
        const units = allUnits.filter(u => u.curriculum_id === curriculum.id);
        
        if (units.length > 0) {
          const allSubunits = await quest.entities.Subunit.list();
          const subunits = allSubunits.filter(sub => units.some(unit => unit.id === sub.unit_id));

          if (subunits.length > 0) {
            const progressRecords = subunits.map(subunit => ({
              student_id: user.id,
              subunit_id: subunit.id,
            }));

            // Don't let a duplicate-key collision (student already has a
            // row for this subunit from a previous enrollment) surface as a
            // visible error — the enrollment INSERT above already succeeded.
            try {
              await quest.entities.StudentProgress.bulkCreate(progressRecords);
            } catch (progressErr) {
              console.warn("StudentProgress seed skipped (likely duplicates):", progressErr);
            }
          }
        }
      }

      // Redirect to KnowledgeMap
      navigate(createPageUrl("KnowledgeMap"));
    } catch (err) {
      setError(err.message || "Failed to join class. Please try again.");
      showNotifError("Join Failed", err.message || "Failed to join class. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-white/10 rounded-full blur-3xl -top-32 -left-32 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-white/10 rounded-full blur-3xl -bottom-32 -right-32 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:40px_40px]"></div>
      </div>

      {/* Single-card centered modal. The outer `flex items-center justify-center`
          on the page is responsible for centering — we just need a width cap
          so the card doesn't stretch full-page on wide monitors. */}
      <div className="w-full max-w-md relative z-10">
        <Card className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">

          <CardContent className="p-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="w-8 h-8 text-white" strokeWidth={2} />
              </div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 bg-gradient-to-br from-gray-900 to-gray-700 bg-clip-text text-transparent" style={{fontFamily: '"Poppins", sans-serif'}}>
                Join Your Class
              </h2>
              <p className="text-gray-600 text-sm font-light" style={{fontFamily: '"Poppins", sans-serif'}}>
                Enter the code provided by your teacher
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center" style={{fontFamily: '"Poppins", sans-serif'}}>
                {error}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block" style={{fontFamily: '"Poppins", sans-serif'}}>
                  Class Join Code
                </label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character code"
                  maxLength={6}
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 px-4 py-6 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-center text-2xl font-bold tracking-widest uppercase"
                  style={{fontFamily: '"Poppins", sans-serif'}}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinClass()}
                />
              </div>

              <Button
                onClick={handleJoinClass}
                disabled={loading || !joinCode.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-6 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.01] flex items-center justify-center gap-2"
                style={{fontFamily: '"Poppins", sans-serif'}}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    Joining...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Join Class
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => navigate(createPageUrl("KnowledgeMap"))}
                className="w-full text-gray-600 hover:text-gray-900"
                style={{fontFamily: '"Poppins", sans-serif'}}
              >
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <NotificationModal
        isOpen={notification.isOpen}
        onClose={closeNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
    </div>
  );
}