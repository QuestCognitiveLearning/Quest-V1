/**
 * StudentLiveSessions — authenticated student-side tab for joining a teacher's
 * live session by 6-character code. Mirrors the public /Join flow (calls the
 * joinLiveSession Edge Function, stashes context in sessionStorage, then
 * navigates to /LiveSessionPlay) but renders inside the student sidebar
 * chrome so it lives alongside Knowledge Map / Learning Hub / Progress /
 * Classes.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Radio, Sparkles } from "lucide-react";
import StudentPageShell from "@/components/shared/StudentPageShell";

export default function StudentLiveSessions() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await quest.auth.me();

      if (currentUser.account_type === "teacher") {
        navigate(createPageUrl("TeacherDashboard"));
        return;
      }

      setUser(currentUser);

      const enrollments = await quest.entities.StudentEnrollment.filter({
        student_id: currentUser.id,
      });

      if (enrollments.length > 0) {
        const allClasses = await quest.entities.Class.list();
        const classesData = enrollments
          .map((e) => allClasses.find((c) => c.id === e.class_id))
          .filter(Boolean);
        setClasses(classesData);

        const savedClassId = localStorage.getItem("selectedClassId");
        if (savedClassId && classesData.some((c) => c.id === savedClassId)) {
          setSelectedClassId(savedClassId);
        } else if (classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load student data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e?.preventDefault?.();
    setError("");
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 4) {
      setError("Enter the session code your teacher shared.");
      return;
    }

    const displayName = user?.full_name?.trim() || user?.email?.split("@")[0] || "Student";

    setJoining(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "joinLiveSession",
        { body: { code: cleanCode, displayName } }
      );
      if (fnErr || data?.error) {
        throw new Error(data?.error || fnErr?.message || "Could not join.");
      }
      sessionStorage.setItem(
        "quest_anon_join",
        JSON.stringify({
          code: cleanCode,
          displayName,
          participantId: data.participantId,
          sessionId: data.sessionId,
          anonymous: false,
        })
      );
      navigate(`/LiveSessionPlay?code=${cleanCode}`);
    } catch (err) {
      setError(err?.message || "Could not join. Check the code and try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <StudentPageShell
      activeNav="live-sessions"
      classes={classes}
      selectedClassId={selectedClassId}
      setSelectedClassId={setSelectedClassId}
      user={user}
    >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-black mb-1">Live Sessions</h1>
              <p className="text-sm text-gray-600">
                Join a live session your teacher is running by entering the code they shared.
              </p>
            </div>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-black">Join a live session</h2>
                    <p className="text-xs text-gray-500">
                      Your teacher will share a 6-character code when the session starts.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold tracking-wider uppercase text-slate-500 mb-1.5">
                      Session code
                    </label>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g. EH8Y54"
                      maxLength={8}
                      className="text-center text-2xl tracking-[0.3em] font-bold font-mono h-14"
                      autoFocus
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" role="alert">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={joining}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white gap-2 text-base"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Joining...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" /> Join session
                      </>
                    )}
                  </Button>

                  {user?.full_name && (
                    <p className="text-[11px] text-slate-400 text-center pt-1">
                      You'll join as <span className="font-medium text-slate-600">{user.full_name}</span>.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        )}
    </StudentPageShell>
  );
}
