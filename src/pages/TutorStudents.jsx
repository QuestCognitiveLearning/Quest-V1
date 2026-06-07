/**
 * TutorStudents — flat list of every student a tutor has across all
 * sessions/classes. Tutor-focused columns: parent contact, last session,
 * reports sent. Click a row → opens that student's session detail.
 *
 * Reuses the existing `student_enrollments` table (the per-class link with
 * parent contact fields) and joins lightly against `users` for student name.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TeacherLayout from "../components/teacher/TeacherLayout";
import {
  Loader2,
  Users,
  Mail,
  Phone,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";

export default function TutorStudents() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [reportCounts, setReportCounts] = useState({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await quest.auth.me();
        if (cancelled) return;
        setUser(me);

        const classes = await quest.entities.Class.filter({ teacher_id: me.id });
        if (cancelled) return;
        const classIds = (classes || []).map((c) => c.id);
        const classMap = Object.fromEntries(
          (classes || []).map((c) => [c.id, c]),
        );

        if (classIds.length === 0) {
          if (!cancelled) setRows([]);
          return;
        }

        const enrollments = await quest.entities.StudentEnrollment.filter({
          class_id: classIds,
        });
        if (cancelled) return;

        // Collapse to one row per (student_id, class_id). The most recent
        // enrollment wins for the parent contact fields if a student is
        // enrolled in multiple of this tutor's classes.
        const byKey = new Map();
        for (const e of enrollments || []) {
          const key = e.student_id;
          const klass = classMap[e.class_id];
          const existing = byKey.get(key);
          const lastSessionAt = klass?.session_ended_at || null;
          if (!existing || (lastSessionAt && lastSessionAt > existing.lastSessionAt)) {
            byKey.set(key, {
              ...e,
              class_name: klass?.class_name || "",
              lastSessionAt: lastSessionAt || existing?.lastSessionAt || null,
              class_id: e.class_id,
            });
          }
        }
        const out = [...byKey.values()].sort((a, b) => {
          if (a.lastSessionAt && b.lastSessionAt) {
            return new Date(b.lastSessionAt) - new Date(a.lastSessionAt);
          }
          if (a.lastSessionAt) return -1;
          if (b.lastSessionAt) return 1;
          return (a.student_full_name || "").localeCompare(b.student_full_name || "");
        });
        if (!cancelled) setRows(out);

        // Per-student report counts (last 60 days)
        const studentIds = out.map((r) => r.student_id);
        if (studentIds.length > 0) {
          const sixtyDaysAgo = new Date();
          sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
          const { data: reports } = await supabase
            .from("parent_reports")
            .select("student_id")
            .eq("tutor_id", me.id)
            .gte("created_at", sixtyDaysAgo.toISOString())
            .in("student_id", studentIds);
          const counts = {};
          for (const r of reports || []) {
            counts[r.student_id] = (counts[r.student_id] || 0) + 1;
          }
          if (!cancelled) setReportCounts(counts);
        }
      } catch (err) {
        console.error("TutorStudents load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      [r.student_full_name, r.student_email, r.parent_name, r.parent_email]
        .map((s) => (s || "").toLowerCase())
        .some((s) => s.includes(q)),
    );
  }, [rows, query]);

  return (
    <TeacherLayout user={user} onSignOut={() => quest.auth.logout()} activeNav="students">
      <div className="min-h-screen bg-slate-50" style={{ fontFamily: '"Inter", sans-serif' }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

        <div className="max-w-6xl mx-auto px-6 py-8">
          <header className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Studio</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-0.5">Students</h1>
              <p className="text-slate-500 text-sm mt-1">
                Every student you tutor across every session.
              </p>
            </div>
            <Button onClick={() => navigate(createPageUrl("TeacherClasses"))} className="gap-2">
              <Plus className="w-4 h-4" />
              Add student
            </Button>
          </header>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by student, parent, or email"
                className="border-none focus-visible:ring-0 px-0 h-8"
              />
              <span className="text-xs text-slate-400">{filtered.length} student{filtered.length === 1 ? "" : "s"}</span>
            </div>

            {loading ? (
              <div className="px-5 py-10 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Users className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm text-slate-500 mt-3">
                  {rows.length === 0
                    ? "No students yet. Add one in Sessions."
                    : "No students match your search."}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Student</Th>
                    <Th>Parent</Th>
                    <Th>Last session</Th>
                    <Th>Reports (60d)</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={`${r.student_id}-${r.class_id}`}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() =>
                        navigate(`${createPageUrl("TeacherClassDetail")}?id=${r.class_id}`)
                      }
                    >
                      <Td>
                        <p className="font-medium text-slate-900">
                          {r.student_full_name || "Student"}
                        </p>
                        {r.student_email && (
                          <p className="text-xs text-slate-500">{r.student_email}</p>
                        )}
                      </Td>
                      <Td>
                        {r.parent_name && (
                          <p className="text-slate-700">{r.parent_name}</p>
                        )}
                        {r.parent_email ? (
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {r.parent_email}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400">No parent contact</p>
                        )}
                        {r.parent_phone && (
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {r.parent_phone}
                          </p>
                        )}
                      </Td>
                      <Td>
                        {r.lastSessionAt ? (
                          <span className="text-slate-700">
                            {new Date(r.lastSessionAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">No sessions yet</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-slate-700 font-mono text-xs">
                          {reportCounts[r.student_id] || 0}
                        </span>
                      </Td>
                      <Td>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

function Th({ children }) {
  return (
    <th className="text-left text-xs uppercase tracking-wider text-slate-500 font-medium px-5 py-2.5">
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td className="px-5 py-3 align-top">{children}</td>;
}
