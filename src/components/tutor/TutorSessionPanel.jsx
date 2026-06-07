/**
 * TutorSessionPanel — shown above the existing class detail view for tutors.
 * Three states:
 *   - scheduled (session_started_at IS NULL)  → Begin button + metadata
 *   - active    (started, not ended)          → live timer + notes textarea
 *   - completed (ended)                       → summary + "Generate report"
 *
 * Notes auto-save every 5s to classes.session_notes (JSONB array). End-of-
 * session optionally triggers the generate-parent-report Edge Function
 * (Phase 3); when that function isn't deployed yet, the session still ends.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Play, StopCircle, Clock, FileText, X } from "lucide-react";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { generatePDF } from "@/lib/pdf/generatePDF";

function fmtClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TutorSessionPanel({ classId, enrollments, onChanged }) {
  const [klass, setKlass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [tick, setTick] = useState(0);
  const [prep, setPrep] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await quest.entities.Class.get(classId);
        if (alive) {
          setKlass(c);
          // Pre-fill the textarea with the most recent free-form note
          const lastNote =
            Array.isArray(c?.session_notes) && c.session_notes.length
              ? c.session_notes[c.session_notes.length - 1]?.text || ""
              : "";
          setNotes(lastNote);
        }
      } catch (err) {
        console.error("TutorSessionPanel load:", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId]);

  // Tick the live timer
  useEffect(() => {
    if (!klass?.session_started_at || klass?.session_ended_at) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [klass?.session_started_at, klass?.session_ended_at]);

  // Debounced notes auto-save (every 5s once dirty)
  useEffect(() => {
    if (!klass?.session_started_at || klass?.session_ended_at) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const prev = Array.isArray(klass.session_notes) ? klass.session_notes : [];
        const next = [
          ...prev.filter((n) => n.kind !== "draft"),
          { kind: "draft", text: notes, at: new Date().toISOString() },
        ];
        await supabase.from("classes").update({ session_notes: next }).eq("id", klass.id);
      } catch (err) {
        console.warn("Notes auto-save failed:", err);
      }
    }, 5000);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [notes, klass?.session_notes, klass?.session_started_at, klass?.session_ended_at, klass?.id]);

  const beginSession = async () => {
    setBusy(true);
    try {
      const startedAt = new Date().toISOString();
      const { error } = await supabase
        .from("classes")
        .update({ session_started_at: startedAt, session_ended_at: null })
        .eq("id", classId);
      if (error) throw error;
      setKlass((k) => ({ ...k, session_started_at: startedAt, session_ended_at: null }));
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Could not start session.");
    } finally {
      setBusy(false);
    }
  };

  const endSession = async ({ sendReport, personalNote }) => {
    setBusy(true);
    try {
      const endedAt = new Date().toISOString();
      const prev = Array.isArray(klass.session_notes) ? klass.session_notes : [];
      const finalNotes = [
        ...prev.filter((n) => n.kind !== "draft"),
        { kind: "final", text: notes, at: endedAt },
      ];
      const { error } = await supabase
        .from("classes")
        .update({ session_ended_at: endedAt, session_notes: finalNotes })
        .eq("id", classId);
      if (error) throw error;
      setKlass((k) => ({
        ...k,
        session_ended_at: endedAt,
        session_notes: finalNotes,
      }));
      setShowEndModal(false);

      if (sendReport) {
        try {
          await orchestrateParentReport({
            classId,
            triggerType: "session_end",
            personalNote: personalNote || null,
          });
          toast.success("Report sent to the parent.");
        } catch (fnErr) {
          // Edge functions may not be deployed yet (Phase 3 rollout in progress)
          console.warn("Parent report flow failed:", fnErr);
          toast.error(fnErr?.message || "Could not send the report. Session is still ended.");
        }
      } else {
        toast.success("Session ended.");
      }
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Could not end session.");
    } finally {
      setBusy(false);
    }
  };

  const elapsedSec = useMemo(() => {
    if (!klass?.session_started_at) return 0;
    const start = new Date(klass.session_started_at).getTime();
    const end = klass.session_ended_at
      ? new Date(klass.session_ended_at).getTime()
      : Date.now();
    return Math.max(0, Math.floor((end - start) / 1000)) + tick * 0;
  }, [klass?.session_started_at, klass?.session_ended_at, tick]);

  if (loading || !klass) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
        <span className="text-sm text-slate-500">Loading session…</span>
      </div>
    );
  }

  // STATE 3: Completed
  if (klass.session_ended_at) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Session completed
            </p>
            <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
              {klass.class_name}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Ended {new Date(klass.session_ended_at).toLocaleString()} ·{" "}
              {fmtClock(elapsedSec)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={beginSession} disabled={busy}>
              Start another session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // STATE 2: Active
  if (klass.session_started_at) {
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-blue-700">
              Session in progress
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-xl font-mono font-semibold text-slate-900">
                {fmtClock(elapsedSec)}
              </span>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowEndModal(true)}
            disabled={busy}
            className="gap-2"
          >
            <StopCircle className="w-4 h-4" />
            End session
          </Button>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-semibold text-slate-900 mb-1.5">
            Session notes (auto-saves)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="What did you cover? Where did the student get stuck? Anything to follow up on next time?"
            className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
        </div>

        {showEndModal && (
          <EndSessionModal
            klass={klass}
            enrollments={enrollments}
            elapsedSec={elapsedSec}
            onCancel={() => setShowEndModal(false)}
            onConfirm={endSession}
            busy={busy}
          />
        )}
      </div>
    );
  }

  // STATE 1: Scheduled / not started
  const scheduledLine = klass.scheduled_for
    ? `Scheduled ${new Date(klass.scheduled_for).toLocaleString()} · ${
        klass.scheduled_duration_minutes || 60
      } min`
    : "Not scheduled";
  const studentId = (enrollments || [])[0]?.student_id;
  const studentName = (enrollments || [])[0]?.student_full_name;

  const loadPrep = async () => {
    if (!studentId) return;
    setPrepLoading(true);
    setPrepError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generateSessionPrep", {
        body: {
          student_id: studentId,
          class_id: classId,
          target_minutes: klass.scheduled_duration_minutes || 60,
        },
      });
      if (error) throw error;
      setPrep(data);
    } catch (err) {
      setPrepError(err?.message || "Could not generate a plan.");
    } finally {
      setPrepLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Next session</p>
          <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
            {klass.class_name}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{scheduledLine}</p>
        </div>
        <Button onClick={beginSession} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Begin session
        </Button>
      </div>

      <SessionPrepPanel
        prep={prep}
        loading={prepLoading}
        error={prepError}
        onLoad={loadPrep}
        studentName={studentName}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <PrepCard
          title="Generate content"
          body="Drop a video or PDF and Quest writes the quiz, case study, and attention checks."
          ctaLabel="Open Generate"
          href="/Generate"
        />
        <PrepCard
          title="Last session"
          body={
            Array.isArray(klass.session_notes) && klass.session_notes.length
              ? klass.session_notes
                  .filter((n) => n.kind === "final")
                  .slice(-1)[0]?.text?.slice(0, 240) || "No notes yet."
              : "No notes yet."
          }
        />
      </div>
    </div>
  );
}

function SessionPrepPanel({ prep, loading, error, onLoad, studentName }) {
  if (!prep && !loading && !error) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Want a suggested plan?
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Quest picks 1-2 review topics and 1-2 new ones from{" "}
            {studentName || "this student"}&rsquo;s recent work.
          </p>
        </div>
        <Button variant="outline" onClick={onLoad}>
          Suggest a plan
        </Button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <div className="h-3 w-1/3 bg-slate-100 rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
        <div className="h-3 w-5/6 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}{" "}
        <button onClick={onLoad} className="underline ml-1">
          Try again
        </button>
      </div>
    );
  }
  const plan = Array.isArray(prep?.suggested_plan) ? prep.suggested_plan : [];
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-900">
          Suggested plan ({prep?.total_estimated_minutes || 0} min)
        </p>
        <button
          onClick={onLoad}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          Regenerate
        </button>
      </div>
      {prep?.context_summary && (
        <p className="text-xs text-slate-500 mb-3">{prep.context_summary}</p>
      )}
      <ul className="space-y-2">
        {plan.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50"
          >
            <span
              className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                item.type === "review"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {item.type}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900">{item.topic}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {item.suggested_minutes} min · {item.suggested_question_count} questions ·{" "}
                {item.difficulty}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Three-step orchestration: server summarizes -> client renders + uploads PDF -> server emails.
async function orchestrateParentReport({ classId, triggerType, personalNote }) {
  const { data, error } = await supabase.functions.invoke("generateParentReport", {
    body: { class_id: classId, trigger_type: triggerType, personal_note: personalNote },
  });
  if (error) throw error;
  if (!data?.report_id) throw new Error("Report generation returned no id.");

  const branding = data.branding
    ? {
        logoUrl: data.branding.logo_url,
        businessName: data.branding.business_name,
        tutorName: data.branding.tutor_name,
        contactInfo: [data.branding.contact_email, data.branding.contact_phone]
          .filter(Boolean)
          .join(" · "),
        accentColor: data.branding.accent_color,
      }
    : null;

  const pdfBlob = await generatePDF({
    type: "parentReport",
    branding,
    data: {
      studentName: data.student?.full_name || "Student",
      dateRangeStart: data.report.date_range_start,
      dateRangeEnd: data.report.date_range_end,
      topicsCovered: data.report.topics_covered || [],
      accuracySummary: data.report.accuracy_summary || {},
      strengths: data.report.strengths || "",
      areasToPractice: data.report.areas_to_practice || "",
      tutorNotes: data.report.tutor_notes || "",
      questionsForParent: data.report.questions_for_parent || [],
    },
  });

  const path = `${data.tutor.id}/${data.report_id}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("parent-reports")
    .upload(path, pdfBlob, { upsert: true, contentType: "application/pdf" });
  if (upErr) throw upErr;

  const { error: sendErr } = await supabase.functions.invoke("sendParentReport", {
    body: { report_id: data.report_id },
  });
  if (sendErr) throw sendErr;
}

function PrepCard({ title, body, ctaLabel, href }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{body}</p>
      {ctaLabel && (
        <a
          href={href}
          className="inline-block mt-3 text-xs font-medium text-blue-700 hover:text-blue-900"
        >
          {ctaLabel} →
        </a>
      )}
    </div>
  );
}

function EndSessionModal({ klass, enrollments, elapsedSec, onCancel, onConfirm, busy }) {
  const enrollment = (enrollments || [])[0];
  const studentName = enrollment?.student_full_name || "this student";
  const parentEmail = enrollment?.parent_email;
  const parentOpt = enrollment?.parent_email_opted_in !== false; // default ON
  const hasParent = !!parentEmail && parentOpt;
  const [sendReport, setSendReport] = useState(hasParent);
  const [personalNote, setPersonalNote] = useState("");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 bg-slate-900/40 flex items-center justify-center px-4"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              End session with {studentName}?
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Duration: {Math.round(elapsedSec / 60)} minutes
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {hasParent ? (
          <div className="mt-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-1.5">
                Send parent report?
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={sendReport}
                  onChange={() => setSendReport(true)}
                />
                <span className="text-sm">
                  Yes — to <span className="font-mono">{parentEmail}</span>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="radio"
                  checked={!sendReport}
                  onChange={() => setSendReport(false)}
                />
                <span className="text-sm">End without sending</span>
              </label>
            </div>
            {sendReport && (
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Personal note for parent (optional)
                </label>
                <textarea
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="One or two warm sentences — Quest writes the rest."
                />
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No parent email on file, so no report will go out. Add one in
            the student row to enable automatic reports.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          {hasParent && sendReport ? (
            <Button
              onClick={() => onConfirm({ sendReport: true, personalNote })}
              disabled={busy}
              className="gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <FileText className="w-4 h-4" />
              End and send report
            </Button>
          ) : (
            <Button
              onClick={() => onConfirm({ sendReport: false })}
              disabled={busy}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              End session
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
