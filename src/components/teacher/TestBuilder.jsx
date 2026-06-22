/**
 * TestBuilder — teacher builds and assigns a test. They pick which subunits to
 * pull from and how many easy / medium / hard questions; the questions are
 * drawn from the curriculum question bank and frozen onto the assignment so
 * every student takes the same test. Replaces the old Pre-Test/Post-Test idea.
 */
import React, { useMemo, useState } from "react";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { X, Loader2, ClipboardList, Calendar, CheckSquare, Square, Rocket } from "lucide-react";

const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);

export default function TestBuilder({ open, onClose, classId, curriculumId, units, subunits, onCreated }) {
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [easy, setEasy] = useState(5);
  const [medium, setMedium] = useState(3);
  const [hard, setHard] = useState(2);
  const [dueDate, setDueDate] = useState("");
  const [working, setWorking] = useState(false);

  // Group subunits under their unit for a scannable picker.
  const grouped = useMemo(() => {
    return (units || []).map((u) => ({
      unit: u,
      subs: (subunits || []).filter((s) => s.unit_id === u.id),
    })).filter((g) => g.subs.length > 0);
  }, [units, subunits]);

  if (!open) return null;

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const total = (Number(easy) || 0) + (Number(medium) || 0) + (Number(hard) || 0);
  const canCreate = !working && title.trim() && picked.size > 0 && total > 0;

  const handleCreate = async () => {
    if (!canCreate) {
      toast.error("Add a title, pick at least one subunit, and set a question count.");
      return;
    }
    setWorking(true);
    try {
      const me = await quest.auth.me();
      const chosenSubs = (subunits || []).filter((s) => picked.has(s.id));

      // Pull the question bank for each selected subunit's new-topic quiz and
      // bucket question ids by difficulty.
      const pools = { easy: [], medium: [], hard: [] };
      for (const su of chosenSubs) {
        const quizzes = await quest.entities.Quiz.filter({ subunit_id: su.id, quiz_type: "new_topic" }).catch(() => []);
        if (!quizzes || quizzes.length === 0) continue;
        const qs = await quest.entities.Question.filter({ quiz_id: quizzes[0].id }).catch(() => []);
        for (const q of qs || []) {
          if (pools[q.difficulty]) pools[q.difficulty].push(q.id);
        }
      }

      const want = { easy: Number(easy) || 0, medium: Number(medium) || 0, hard: Number(hard) || 0 };
      const chosen = [
        ...shuffle(pools.easy).slice(0, want.easy),
        ...shuffle(pools.medium).slice(0, want.medium),
        ...shuffle(pools.hard).slice(0, want.hard),
      ];

      if (chosen.length === 0) {
        toast.error("No questions found for the selected subunits. Generate their content first.");
        setWorking(false);
        return;
      }

      const short =
        chosen.length < total
          ? ` (only ${chosen.length} of ${total} available)`
          : "";

      const { error } = await supabase.from("test_assignments").insert({
        teacher_id: me.id,
        class_id: classId,
        curriculum_id: curriculumId || null,
        title: title.trim(),
        subunit_ids: [...picked],
        easy_count: want.easy,
        medium_count: want.medium,
        hard_count: want.hard,
        question_ids: chosen,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
      });
      if (error) throw error;

      toast.success(`Test assigned — ${chosen.length} question${chosen.length === 1 ? "" : "s"}${short}`);
      onCreated?.();
      onClose?.();
    } catch (err) {
      console.error("Create test failed:", err);
      toast.error(err?.message || "Could not create the test.");
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => !working && onClose?.()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-indigo-600 text-white p-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Assign a test</h2>
              <p className="text-indigo-100 text-sm mt-0.5">
                Pick subunits and how many questions; we build it from the question bank.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !working && onClose?.()}
            disabled={working}
            className="p-1.5 hover:bg-white/20 rounded-lg disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Test title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit 1 checkpoint"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Pull questions from these subunits
            </label>
            {grouped.length === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                This class has no curriculum subunits with questions yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                {grouped.map(({ unit, subs }) => (
                  <div key={unit.id}>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {unit.unit_name}
                    </div>
                    <div className="space-y-1.5">
                      {subs.map((s) => {
                        const on = picked.has(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggle(s.id)}
                            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border-2 text-left transition-colors ${
                              on ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {on ? (
                              <CheckSquare className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300 flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium text-slate-900">{s.subunit_name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {picked.size > 0 && (
              <p className="text-xs text-slate-500 mt-2">{picked.size} subunit{picked.size === 1 ? "" : "s"} selected</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              How many questions (by difficulty)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Easy", easy, setEasy],
                ["Medium", medium, setMedium],
                ["Hard", hard, setHard],
              ].map(([label, val, set]) => (
                <div key={label}>
                  <div className="text-[11px] font-semibold text-slate-500 mb-1">{label}</div>
                  <Input
                    type="number"
                    min="0"
                    max="40"
                    value={val}
                    onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">{total} question{total === 1 ? "" : "s"} total</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 inline-flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Due date (optional)
            </label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="p-6 pt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => !working && onClose?.()} disabled={working}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!canCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Create &amp; assign
          </Button>
        </div>
      </div>
    </div>
  );
}
