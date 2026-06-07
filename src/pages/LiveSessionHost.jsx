/**
 * LiveSessionHost — teacher's real-time view of a running live session.
 *
 * Two panels, polled every 2.5s:
 *   1. Live leaderboard — every joined student, sorted by total_points,
 *      with the points number live-updating as they earn them.
 *   2. Question performance — for each quiz question, X / Y answered, with
 *      the % correct (e.g. "15/20 · 75%"). Students who haven't answered
 *      yet aren't counted.
 *
 * Plus the hero with the join code + end-session control.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import TeacherLayout from "../components/teacher/TeacherLayout";
import {
  ArrowLeft,
  Copy,
  CheckCircle2,
  Trophy,
  Users,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function LiveSessionHost() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [teacher, setTeacher] = useState(null);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  // ---- Polling ----------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [sessRows, partsRes, respsRes] = await Promise.all([
        quest.entities.LiveSession.filter({ id: sessionId }),
        supabase
          .from("live_session_participants")
          .select("id, display_name, total_points, is_anonymous")
          .eq("live_session_id", sessionId)
          .order("total_points", { ascending: false }),
        supabase
          .from("live_session_responses")
          .select("question_index, question_type, is_correct, student_id")
          .eq("live_session_id", sessionId),
      ]);
      if (sessRows.length === 0) {
        toast.error("Session not found.");
        navigate(createPageUrl("Generate"));
        return;
      }
      setSession(sessRows[0]);
      if (partsRes.data) setParticipants(partsRes.data);
      if (respsRes.data) setResponses(respsRes.data);
    } catch (err) {
      console.warn("refresh failed:", err);
    }
  }, [sessionId, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const me = await quest.auth.me();
        setTeacher(me);
      } catch {
        // teacher-only page; the auth guard handles unauth.
      }
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [sessionId, refresh]);

  // ---- Actions ----------------------------------------------------------
  const copyCode = () => {
    const code = session?.session_code || session?.join_code || "";
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCodeCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleEndSession = async () => {
    if (!session) return;
    setEnding(true);
    try {
      await quest.entities.LiveSession.update(session.id, {
        status: "completed",
        end_time: new Date().toISOString(),
      });
      setSession({ ...session, status: "completed" });
      setConfirmEnd(false);
      toast.success("Session ended.");
    } catch (err) {
      console.error("End session failed:", err);
      toast.error("Could not end session.");
    } finally {
      setEnding(false);
    }
  };

  // ---- Derived ----------------------------------------------------------
  // Per-question accuracy. Only MCQ responses count; we collapse to one
  // response per (student, question) — taking the latest — so a student
  // who answered Q3 twice (e.g. after a reload) doesn't double-count.
  const questionStats = (() => {
    const questions = session?.questions || [];
    return questions.map((q, idx) => {
      const allForQ = responses.filter(
        (r) => r.question_index === idx && r.question_type === "mcq"
      );
      const latestByStudent = new Map();
      for (const r of allForQ) {
        const key = r.student_id || `anon:${idx}`;
        latestByStudent.set(key, r);
      }
      const final = Array.from(latestByStudent.values());
      const answered = final.length;
      const correct = final.filter((r) => r.is_correct).length;
      const pct = answered === 0 ? 0 : Math.round((correct / answered) * 100);
      return {
        index: idx,
        text: q.question_text || q.question || `Question ${idx + 1}`,
        answered,
        correct,
        pct,
      };
    });
  })();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }
  if (!session) return null;

  const code = session.session_code || session.join_code || "—";
  const isEnded = session.status === "completed" || session.status === "ended";
  const totalQuestions = session.questions?.length || 0;
  const totalParticipants = participants.length;

  return (
    <TeacherLayout activeNav="generate" user={teacher} onSignOut={() => quest.auth.logout()}>
      <div className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate(createPageUrl("Generate"))}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Generate
        </button>

        {/* Hero — title + join code */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-3xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold text-blue-100">
                {isEnded ? "Ended" : "Live"}
              </div>
              <h1 className="text-2xl font-bold mt-1 truncate">
                {session.session_name || session.title}
              </h1>
              <p className="text-sm text-blue-100 mt-1">{session.subunit_name}</p>
              <div className="flex items-center gap-3 mt-3 text-sm text-blue-100">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {totalParticipants} joined
                </span>
                <span className="opacity-70">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" />
                  Top {participants[0]?.total_points || 0} pts
                </span>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl px-5 py-3 text-center min-w-[200px]">
              <div className="text-[10px] uppercase tracking-wider text-blue-100 font-bold">
                Join code · questlearning.co/Join
              </div>
              <div className="text-3xl font-extrabold tracking-[0.25em] font-mono mt-1">
                {code}
              </div>
              <button
                onClick={copyCode}
                className="text-[11px] text-blue-100 mt-1 hover:text-white inline-flex items-center gap-1"
              >
                {codeCopied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {codeCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-5">
          {/* Live leaderboard */}
          <Card className="border border-slate-200 h-fit">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-bold text-slate-900">Live leaderboard</h2>
                </div>
                <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>

              {totalParticipants === 0 ? (
                <p className="text-sm text-slate-500 py-10 text-center">
                  Waiting for students to join…
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {participants.map((p, i) => (
                    <li
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-xl ${
                        i === 0
                          ? "bg-amber-50 border border-amber-200"
                          : "bg-slate-50 border border-slate-100"
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          i === 0 ? "bg-amber-500 text-white" :
                          i === 1 ? "bg-slate-400 text-white" :
                          i === 2 ? "bg-amber-700 text-white" :
                          "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm font-semibold text-slate-900">
                        {p.display_name || (p.is_anonymous ? "Anonymous" : "Student")}
                      </span>
                      <span className="text-lg font-extrabold text-slate-900 tabular-nums">
                        {p.total_points || 0}
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              {!isEnded && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmEnd(true)}
                  className="w-full mt-4 text-xs h-8 text-red-600 hover:text-red-700 border-red-200"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  End session
                </Button>
              )}
              {isEnded && (
                <div className="mt-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                  Session ended
                </div>
              )}
            </CardContent>
          </Card>

          {/* Question performance */}
          <Card className="border border-slate-200 h-fit">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900">Question performance</h2>
                <span className="text-xs text-slate-500">
                  {totalQuestions} question{totalQuestions === 1 ? "" : "s"}
                </span>
              </div>

              {totalQuestions === 0 ? (
                <p className="text-sm text-slate-500 py-10 text-center">
                  No quiz in this session.
                </p>
              ) : (
                <ol className="space-y-3">
                  {questionStats.map((s) => (
                    <QuestionRow
                      key={s.index}
                      stat={s}
                      totalParticipants={totalParticipants}
                    />
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {confirmEnd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-2">End this session?</h3>
            <p className="text-sm text-slate-600 mb-5">
              Students still playing will see the final leaderboard and won't be able to score more points.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmEnd(false)}
                className="flex-1"
                disabled={ending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEndSession}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={ending}
              >
                {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : "End session"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}

// A single quiz-question row: text + answered count + accuracy %.
// Color-coded so the teacher can spot trouble spots at a glance.
function QuestionRow({ stat, totalParticipants }) {
  const { index, text, answered, correct, pct } = stat;
  const barColor =
    answered === 0 ? "bg-slate-300" :
    pct >= 75 ? "bg-emerald-500" :
    pct >= 50 ? "bg-amber-500" :
    "bg-red-500";
  const pctColor =
    answered === 0 ? "text-slate-400" :
    pct >= 75 ? "text-emerald-700" :
    pct >= 50 ? "text-amber-700" :
    "text-red-700";

  return (
    <li className="border border-slate-200 rounded-xl p-4 bg-white">
      <div className="flex items-start gap-3 mb-3">
        <span className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
          Q{index + 1}
        </span>
        <p className="text-sm text-slate-900 leading-snug flex-1">{text}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-right min-w-[120px]">
          <p className={`text-lg font-extrabold ${pctColor} tabular-nums`}>
            {answered === 0 ? "—" : `${pct}%`}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {correct}/{answered} got it right
            {totalParticipants > 0 && answered < totalParticipants && (
              <span className="text-slate-400"> · {totalParticipants - answered} not yet</span>
            )}
          </p>
        </div>
      </div>
    </li>
  );
}
