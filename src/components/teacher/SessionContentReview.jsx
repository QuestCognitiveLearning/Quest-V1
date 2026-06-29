/**
 * Shared content-generation UI so every "generate content" surface (full-year
 * curriculum, one learn session, handout, live session) looks and behaves the
 * same. Visual language matches ManageCurriculum's ContentReviewModal: a
 * progress-bar loader and a green-header tabbed review/edit modal.
 *
 * Both consumers (Generate.jsx, CreateAssignedSessionModal.jsx) work on the
 * same payload shape:
 *   { video, quiz[], case_study{scenario, discussion_questions[]},
 *     inquiry_session{hook_question, tutor_first_message, hook_image_url, ...},
 *     attention_checks[] }
 */
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Save,
  X,
  Sparkles,
  PlayCircle,
  FileText,
  MessageCircle,
  Eye,
  CheckCircle,
  ClipboardList,
  Plus,
  Trash2,
} from "lucide-react";

const LETTERS = ["a", "b", "c", "d"];

// The 0–4 scale the AI uses to grade free-response case-study answers (mirrors
// supabase/functions/scoreCaseStudyAnswer), shown so teachers see how each
// case-study prompt is scored.
const CASE_STUDY_RUBRIC = [
  { score: 4, label: "Exemplary", desc: "Insightful analysis, concrete evidence, complete reasoning." },
  { score: 3, label: "Proficient", desc: "Clear answer with supporting reasoning; minor gaps." },
  { score: 2, label: "Developing", desc: "Partial answer or evidence; reasoning unclear." },
  { score: 1, label: "Emerging", desc: "Off-topic, brief, or unsupported." },
  { score: 0, label: "No attempt", desc: "Blank, gibberish, or refusal." },
];

// ---------------------------------------------------------------------------
// GenerationProgress — the shared "generating…" view. A determinate progress
// bar that fills as each piece lands, plus a slim checklist. Usable inline or
// inside a modal body.
// ---------------------------------------------------------------------------
export function GenerationProgress({
  title = "Generating your content",
  // Optional — the live countdown below already tells the user how long is
  // left, so callers can omit this to keep the header clean.
  subtitle = "",
  steps = [],
  started = true,
  // Rough total duration in seconds, used to seed the countdown. The displayed
  // value self-corrects downward from real step completions, so a slightly
  // generous estimate is safe (it just gets pulled down as pieces land).
  estimateSeconds,
}) {
  const total = steps.length || 1;
  const doneCount = steps.filter((s) => s.done).length;
  const complete = doneCount === steps.length && steps.length > 0;
  const pct = Math.round((doneCount / total) * 100);
  const display = started ? Math.max(pct, 12) : 8;

  // ---- "Time left" countdown. The one hard requirement: it must only ever
  // tick DOWN, smoothly — never jump up or jitter around. We anchor a single
  // total estimate at mount and simply subtract real elapsed time, so the
  // number descends one second at a time with no re-anchoring (re-anchoring is
  // what makes the curriculum/standards ETAs occasionally snap). If generation
  // outruns the estimate we hold on "Finishing up…" until the reveal. The
  // estimate is calibrated from the selected options by the caller, so it lands
  // close; the step checklist below carries the live per-piece progress.
  const estTotal = Math.max(
    15,
    Math.round(estimateSeconds || Math.max(45, steps.length * 28))
  );
  // Anchored once at mount (the component is mounted only while generating, so
  // a fresh mount === a fresh run). lastShownRef enforces monotonic descent in
  // case React re-renders faster than the 1s ticker.
  const startRef = useRef(Date.now());
  const lastShownRef = useRef(estTotal);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (complete) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [complete]);

  const elapsed = (Date.now() - startRef.current) / 1000;
  // Strictly non-increasing: never let the displayed value rise.
  lastShownRef.current = Math.min(lastShownRef.current, estTotal - elapsed);
  const secsLeft = lastShownRef.current;

  const showFinishing = complete || secsLeft <= 2;
  const secs = Math.max(2, Math.round(secsLeft));
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const timeLabel = showFinishing
    ? "Finishing up…"
    : mm > 0
    ? `~${mm} min ${ss} sec left`
    : `~${ss} sec left`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-sm">
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2 text-[#2563EB] mb-3">
          <Sparkles className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Generating</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">{subtitle}</p>
        )}
      </div>

      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
          <span>{timeLabel}</span>
          <span>{display}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] transition-[width] duration-700 ease-out ${
              complete ? "" : "animate-pulse"
            }`}
            style={{ width: `${display}%` }}
          />
        </div>

        <ul className="mt-6 space-y-3">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5 text-sm">
              {s.done ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-slate-200 flex-shrink-0" />
              )}
              <span className={s.done ? "text-slate-900 font-medium" : "text-slate-500"}>
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
      {children}
    </label>
  );
}

// Editable multiple-choice block shared by quiz questions and attention checks.
function ChoiceEditor({ item, onChange }) {
  const correct = String(item.correct_choice || "").toUpperCase();
  return (
    <div className="space-y-2">
      <Input
        value={item.question || ""}
        onChange={(e) => onChange({ question: e.target.value })}
        placeholder="Question"
      />
      <div className="space-y-1.5">
        {LETTERS.map((l) => {
          const isCorrect = correct === l.toUpperCase();
          return (
            <div key={l} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ correct_choice: l.toUpperCase() })}
                title="Mark correct"
                className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0 border ${
                  isCorrect
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:border-emerald-400"
                }`}
              >
                {l.toUpperCase()}
              </button>
              <Input
                value={item[`choice_${l}`] || ""}
                onChange={(e) => onChange({ [`choice_${l}`]: e.target.value })}
                placeholder={`Choice ${l.toUpperCase()}`}
                className="h-9"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionContentReview — the shared green-header tabbed review/edit modal.
// ---------------------------------------------------------------------------
export function SessionContentReview({
  title,
  subtitle,
  payload,
  saving = false,
  saveLabel = "Save changes",
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(payload || {})));

  const setVideo = (patch) => setDraft((d) => ({ ...d, video: { ...(d.video || {}), ...patch } }));
  const setInquiry = (patch) =>
    setDraft((d) => ({ ...d, inquiry_session: { ...(d.inquiry_session || {}), ...patch } }));
  const setCase = (patch) =>
    setDraft((d) => ({ ...d, case_study: { ...(d.case_study || {}), ...patch } }));
  const setDiscussionQuestion = (i, value) =>
    setDraft((d) => {
      const arr = [...((d.case_study || {}).discussion_questions || [])];
      arr[i] = value;
      return { ...d, case_study: { ...(d.case_study || {}), discussion_questions: arr } };
    });
  const addDiscussionQuestion = () =>
    setDraft((d) => ({
      ...d,
      case_study: {
        ...(d.case_study || {}),
        discussion_questions: [...((d.case_study || {}).discussion_questions || []), ""],
      },
    }));
  const removeDiscussionQuestion = (i) =>
    setDraft((d) => {
      const arr = [...((d.case_study || {}).discussion_questions || [])];
      arr.splice(i, 1);
      return { ...d, case_study: { ...(d.case_study || {}), discussion_questions: arr } };
    });
  const setQuizItem = (i, patch) =>
    setDraft((d) => {
      const quiz = [...(d.quiz || [])];
      quiz[i] = { ...quiz[i], ...patch };
      return { ...d, quiz };
    });
  const setCheckItem = (i, patch) =>
    setDraft((d) => {
      const arr = [...(d.attention_checks || [])];
      arr[i] = { ...arr[i], ...patch };
      return { ...d, attention_checks: arr };
    });

  const quiz = Array.isArray(draft.quiz) ? draft.quiz : [];
  const checks = Array.isArray(draft.attention_checks) ? draft.attention_checks : [];
  const inq = draft.inquiry_session || null;
  const cs = draft.case_study || {};
  const videoId = draft.video?.videoId;

  const hasInquiry = !!(inq && (inq.hook_question != null || inq.tutor_first_message != null));
  const hasVideo = !!videoId || checks.length > 0;
  const hasQuiz = quiz.length > 0;
  const hasCase = !!cs.scenario || (Array.isArray(cs.discussion_questions) && cs.discussion_questions.length > 0);

  const tabs = [];
  if (hasInquiry) tabs.push("inquiry");
  if (hasVideo) tabs.push("video");
  if (hasQuiz) tabs.push("quiz");
  if (hasCase) tabs.push("casestudy");
  const defaultTab = tabs[0] || "quiz";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
        {/* Sticky green header — matches the curriculum content review. */}
        <div className="sticky top-0 z-10 bg-green-600 text-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold">Review Content</h2>
              <p className="text-green-100 text-sm mt-0.5 truncate">
                {title || draft.video?.title || "Generated content"}
                {subtitle ? ` · ${subtitle}` : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {tabs.length === 0 && (
            <p className="text-center text-slate-500 py-8 text-sm">
              Nothing to edit for this item.
            </p>
          )}
          {tabs.length > 0 && (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList
              className="grid w-full bg-gray-100 p-1 rounded-lg mb-6"
              style={{ gridTemplateColumns: `repeat(${tabs.length || 1}, minmax(0, 1fr))` }}
            >
              {hasInquiry && (
                <TabsTrigger value="inquiry" className="gap-1.5">
                  <Sparkles className="w-4 h-4" /> Inquiry
                </TabsTrigger>
              )}
              {hasVideo && (
                <TabsTrigger value="video" className="gap-1.5">
                  <PlayCircle className="w-4 h-4" /> Video
                </TabsTrigger>
              )}
              {hasQuiz && (
                <TabsTrigger value="quiz" className="gap-1.5">
                  <FileText className="w-4 h-4" /> Quiz
                </TabsTrigger>
              )}
              {hasCase && (
                <TabsTrigger value="casestudy" className="gap-1.5">
                  <MessageCircle className="w-4 h-4" /> Case study
                </TabsTrigger>
              )}
            </TabsList>

            {hasInquiry && (
              <TabsContent value="inquiry" className="space-y-4">
                {inq.hook_image_url && (
                  <img
                    src={inq.hook_image_url}
                    alt="Inquiry hook"
                    className="w-full rounded-xl border border-slate-200"
                  />
                )}
                <div>
                  <FieldLabel>Hook question</FieldLabel>
                  <Input
                    value={inq.hook_question || ""}
                    onChange={(e) => setInquiry({ hook_question: e.target.value })}
                    placeholder="A curiosity question to prime thinking"
                  />
                </div>
                <div>
                  <FieldLabel>Tutor's opening message</FieldLabel>
                  <Textarea
                    rows={2}
                    value={inq.tutor_first_message || ""}
                    onChange={(e) => setInquiry({ tutor_first_message: e.target.value })}
                    placeholder="Welcome! Let's think about this together..."
                  />
                </div>
              </TabsContent>
            )}

            {hasVideo && (
              <TabsContent value="video" className="space-y-4">
                {videoId && (
                  <div className="aspect-video rounded-xl overflow-hidden border border-slate-200 bg-black">
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="text-sm font-semibold text-slate-700">
                  Attention checks · {checks.length}
                </div>
                <ol className="space-y-3">
                  {checks.map((ac, i) => (
                    <li key={i} className="border border-slate-200 rounded-xl p-3 bg-amber-50/30">
                      <ChoiceEditor item={ac} onChange={(patch) => setCheckItem(i, patch)} />
                    </li>
                  ))}
                  {checks.length === 0 && (
                    <li className="text-sm text-slate-400">No attention checks.</li>
                  )}
                </ol>
              </TabsContent>
            )}

            {hasQuiz && (
              <TabsContent value="quiz" className="space-y-4">
                <div className="text-sm font-semibold text-slate-700">
                  Quiz · {quiz.length} question{quiz.length === 1 ? "" : "s"}
                </div>
                <ol className="space-y-4">
                  {quiz.map((q, i) => (
                    <li key={i} className="border border-slate-200 rounded-xl p-3">
                      <div className="text-[11px] font-bold text-slate-400 mb-1.5">Q{i + 1}</div>
                      <ChoiceEditor item={q} onChange={(patch) => setQuizItem(i, patch)} />
                    </li>
                  ))}
                </ol>
              </TabsContent>
            )}

            {hasCase && (
              <TabsContent value="casestudy" className="space-y-4">
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/40">
                  <FieldLabel>Scenario</FieldLabel>
                  <Textarea
                    rows={4}
                    value={cs.scenario || ""}
                    onChange={(e) => setCase({ scenario: e.target.value })}
                    placeholder="A realistic scenario students reason through..."
                  />
                </div>
                <div>
                  <FieldLabel>
                    Discussion questions · {(cs.discussion_questions || []).length}
                  </FieldLabel>
                  <ol className="space-y-2">
                    {(cs.discussion_questions || []).map((q, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 border border-slate-200 rounded-xl p-2.5 bg-white"
                      >
                        <span className="text-[11px] font-bold text-slate-400 mt-2.5 w-5 text-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <Textarea
                          rows={2}
                          value={q || ""}
                          onChange={(e) => setDiscussionQuestion(i, e.target.value)}
                          placeholder="A question students discuss..."
                          className="flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeDiscussionQuestion(i)}
                          className="p-1.5 text-slate-400 hover:text-red-600 mt-1 flex-shrink-0"
                          aria-label="Remove question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                    {(cs.discussion_questions || []).length === 0 && (
                      <li className="text-sm text-slate-400">No discussion questions yet.</li>
                    )}
                  </ol>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDiscussionQuestion}
                    className="mt-2 gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add question
                  </Button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Scoring rubric (0–4)
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {CASE_STUDY_RUBRIC.map((r) => (
                      <li key={r.score} className="flex gap-2 text-xs text-slate-600 leading-snug">
                        <span className="font-bold text-slate-900 w-3.5 shrink-0">{r.score}</span>
                        <span>
                          <span className="font-semibold text-slate-800">{r.label}.</span> {r.desc}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>
            )}
          </Tabs>
          )}

          <div className="flex gap-3 pt-6">
            <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1 border-2">
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Drop blank discussion questions added but never filled in.
                const clean = JSON.parse(JSON.stringify(draft));
                if (clean.case_study?.discussion_questions) {
                  clean.case_study.discussion_questions = clean.case_study.discussion_questions
                    .map((s) => (s || "").trim())
                    .filter(Boolean);
                }
                onSave(clean);
              }}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2 py-6 text-base font-semibold"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
