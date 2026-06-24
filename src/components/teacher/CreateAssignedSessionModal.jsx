/**
 * CreateAssignedSessionModal — opens from TeacherCurricula's "Create one
 * learning session" chooser. UX mirrors LiveSessionBuilder (phase toggles
 * + AI generation from a YouTube URL) but the output is a lesson_bundles
 * row + lesson_bundle_assignments row instead of a live_sessions row, so
 * it shows up in the dashboard's "Assigned Learning Sessions" list like
 * anything else.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl, extractYouTubeId } from "@/utils";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  X,
  Loader2,
  CheckCircle,
  Sparkles,
  PlayCircle,
  FileText,
  MessageCircle,
  Eye,
  Users,
  Calendar,
  Rocket,
  Search,
  Youtube,
} from "lucide-react";
import { GenerationProgress, SessionContentReview } from "@/components/teacher/SessionContentReview";

export default function CreateAssignedSessionModal({ open, onClose }) {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  // YouTube search inside the modal — same publicTryFunnel action used by
  // /Generate. Picking a result fills videoUrl + title.
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  // Track which video the teacher selected from the result list so the row
  // can highlight as "picked" instead of just silently filling the URL.
  const [pickedVideoId, setPickedVideoId] = useState(null);
  const [includes, setIncludes] = useState({
    inquiry: true,
    attentionChecks: true,
    quiz: true,
    caseStudy: true,
  });
  const [questionCount, setQuestionCount] = useState(10);
  const [classId, setClassId] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Async pipeline state
  const [working, setWorking] = useState(false);
  const [enriching, setEnriching] = useState({ inquiry: false, attentionChecks: false });
  const [baseDone, setBaseDone] = useState(false);
  // After generation, the teacher reviews/edits the content before it's
  // assigned (shared review modal, same as Generate / curriculum).
  const [reviewPayload, setReviewPayload] = useState(null);
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await quest.auth.me();
        if (cancelled) return;
        setTeacher(me);
        const cls = await quest.entities.Class.filter({ teacher_id: me.id });
        if (cancelled) return;
        setClasses(cls || []);
        if (cls && cls.length === 1) setClassId(cls[0].id);
      } catch (err) {
        console.warn("Load classes failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "publicTryFunnel",
        { body: { action: "search", query: q } }
      );
      if (fnErr) throw fnErr;
      const items = data?.items || [];
      setSearchResults(items);
      if (items.length === 0) {
        setSearchError("No long-form videos for that search. Try different keywords.");
      }
    } catch (err) {
      console.warn("Video search failed:", err);
      setSearchError(err?.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const pickSearchResult = (r) => {
    setPickedVideoId(r.videoId);
    setVideoUrl(`https://www.youtube.com/watch?v=${r.videoId}`);
    // Auto-fill title from the video if the teacher hasn't typed one yet.
    if (!title.trim() && r.title) setTitle(r.title);
  };

  const canSubmit = () => {
    if (working) return false;
    if (!title.trim()) return false;
    if (!extractYouTubeId(videoUrl)) return false;
    if (!classId) return false;
    return true;
  };

  // ---- Submit pipeline --------------------------------------------------
  const handleSubmit = async () => {
    if (!canSubmit()) {
      toast.error("Fill in title, a valid YouTube URL, and pick a class.");
      return;
    }
    setWorking(true);
    setBaseDone(false);
    setEnriching({ inquiry: !!includes.inquiry, attentionChecks: !!includes.attentionChecks });
    try {
      const videoId = extractYouTubeId(videoUrl);

      // 1. Base content via publicTryFunnel (quiz + optional case study + segments).
      const { data: base, error: fnErr } = await supabase.functions.invoke(
        "publicTryFunnel",
        {
          body: {
            action: "generate",
            videoId,
            options: {
              count: questionCount,
              includeCaseStudy: includes.caseStudy,
              difficulty: "mixed",
            },
          },
        }
      );
      if (fnErr) throw fnErr;
      if (base?.error) throw new Error(base.error);
      if (!base?.quiz?.length) throw new Error("Could not generate questions from that video.");
      setBaseDone(true);

      // 2. Enrichment passes — inquiry + attention checks. Same call pattern
      //    as Generate.jsx's enrichWithCurriculumGeneration but inline so we
      //    don't have to refactor that into a shared helper right now.
      let inquirySession = null;
      let attentionChecks = [];
      const tasks = [];

      if (includes.inquiry) {
        tasks.push((async () => {
          try {
            const { invokeLLM, generateImage } = await import("@/components/utils/openai");
            const { LLM_MODELS } = await import("@/lib/llmModels");
            const inqTranscript = String(base?.transcript || "").slice(0, 8000);
            const inq = await invokeLLM({
              model: LLM_MODELS.INQUIRY_CONTENT,
              prompt:
                `Create a curiosity hook for the topic "${title}". The student has NOT watched the video yet — the hook question should point at the core idea the video will teach but stay answerable through intuition (never require a fact only revealed in the video).\n\n` +
                (inqTranscript
                  ? `Use this video transcript as CONTEXT for what the lesson actually teaches, so the hook and discussion lead directly into the concepts the video covers, at the depth it treats them:\n"""\n${inqTranscript}\n"""\n\n`
                  : "") +
                `Return strict JSON:\n` +
                `{ "hook_image_prompt": "Real-world cartoon illustration of ${title}. Style: cartoon-realistic, minimal, soft pastel, clean thin outlines, white background only, single centered scenario, no text or labels, 1792×1024.",` +
                ` "hook_question": "(8-18 words) intuition-answerable question about ${title}",` +
                ` "socratic_system_prompt": "You are Panda, a Socratic tutor. Guide them to think about ${title} via intuition. Ask, never tell. Max 3 exchanges.",` +
                ` "tutor_first_message": "Warm response with a follow-up question." }`,
              response_json_schema: {
                type: "object",
                properties: {
                  hook_image_prompt: { type: "string" },
                  hook_question: { type: "string" },
                  socratic_system_prompt: { type: "string" },
                  tutor_first_message: { type: "string" },
                },
              },
            });
            inquirySession = {
              hook_image_prompt: inq?.hook_image_prompt || "",
              hook_question: inq?.hook_question || "",
              socratic_system_prompt: inq?.socratic_system_prompt || "",
              tutor_first_message: inq?.tutor_first_message || "",
            };
            if (inq?.hook_image_prompt) {
              try {
                const img = await generateImage({ prompt: inq.hook_image_prompt, quality: "medium" });
                inquirySession.hook_image_url = img?.url || img?.image_url || null;
              } catch (err) {
                console.warn("Hook image failed:", err);
              }
            }
          } catch (err) {
            console.warn("Inquiry generation failed:", err);
          } finally {
            setEnriching((p) => ({ ...p, inquiry: false }));
          }
        })());
      }

      if (includes.attentionChecks && Array.isArray(base?.timestamped_segments) && base.timestamped_segments.length > 0) {
        tasks.push((async () => {
          try {
            const { data: acResp } = await quest.functions.invoke("generateAttentionChecks", {
              videoDuration: base.video_duration || 600,
              timestampedSegments: base.timestamped_segments,
            });
            attentionChecks = acResp?.attention_checks || [];
          } catch (err) {
            console.warn("Attention checks failed:", err);
          } finally {
            setEnriching((p) => ({ ...p, attentionChecks: false }));
          }
        })());
      } else {
        setEnriching((p) => ({ ...p, attentionChecks: false }));
      }

      await Promise.allSettled(tasks);

      // 3. Build the payload and hand off to the review step. Assignment only
      //    happens after the teacher confirms in the review modal.
      const payload = {
        video: base.video,
        timestamped_segments: base.timestamped_segments || [],
        video_duration: base.video_duration || 0,
        quiz: includes.quiz ? base.quiz : [],
        case_study: includes.caseStudy ? base.case_study || null : null,
        inquiry_session: inquirySession,
        attention_checks: attentionChecks,
      };
      setReviewPayload(payload);
    } catch (err) {
      console.error("Create assigned session failed:", err);
      toast.error(err?.message || "Could not create the single session.");
    } finally {
      setWorking(false);
    }
  };

  // Persist the reviewed/edited content as a bundle + assignment to the class.
  const handleConfirmSave = async (draft) => {
    setSavingReview(true);
    try {
      const videoId = extractYouTubeId(videoUrl);
      const { data: bundle, error: bErr } = await supabase
        .from("lesson_bundles")
        .insert({
          teacher_id: teacher.id,
          title,
          source_type: "youtube",
          source_url: `https://www.youtube.com/watch?v=${videoId}`,
          payload: draft,
        })
        .select("id")
        .single();
      if (bErr) throw bErr;

      const { error: aErr } = await supabase
        .from("lesson_bundle_assignments")
        .insert({
          bundle_id: bundle.id,
          class_id: classId,
          due_at: dueDate ? new Date(dueDate).toISOString() : null,
        });
      if (aErr) throw aErr;

      toast.success("Single session assigned");
      onClose?.();
      navigate(createPageUrl("TeacherDashboard"));
    } catch (err) {
      console.error("Assign learning session failed:", err);
      toast.error(err?.message || "Could not assign the single session.");
      setSavingReview(false);
    }
  };

  if (!open) return null;

  // After generation, show the shared review/edit modal. Saving from here
  // creates the bundle + assignment.
  if (reviewPayload) {
    return (
      <SessionContentReview
        title={title}
        subtitle="Review before assigning"
        payload={reviewPayload}
        saving={savingReview}
        saveLabel="Create & assign"
        onClose={() => !savingReview && setReviewPayload(null)}
        onSave={handleConfirmSave}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => !working && onClose?.()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create a single session</h2>
            <p className="text-sm text-slate-500 mt-1">
              Pick a video and which parts to include. Students get it as an assignment on the due date.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !working && onClose?.()}
            disabled={working}
            className="text-slate-400 hover:text-slate-900 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {!working ? (
          <div className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Newton's first law warm-up"
              />
            </div>

            {/* Video search */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 inline-flex items-center gap-1.5">
                <Youtube className="w-3 h-3 text-red-600" /> Find a video by topic
              </label>
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='e.g. "photosynthesis for high school"'
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={searching || !searchQuery.trim()}
                  className="gap-1.5"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </Button>
              </form>
              {searchError && (
                <p className="text-xs text-amber-700 mt-2">{searchError}</p>
              )}
              {searchResults.length > 0 && (
                <div className="mt-3 grid sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
                  {searchResults.map((r) => {
                    const picked = pickedVideoId === r.videoId;
                    return (
                      <button
                        key={r.videoId}
                        type="button"
                        onClick={() => pickSearchResult(r)}
                        className={`text-left group rounded-lg border-2 transition overflow-hidden ${
                          picked
                            ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50/40"
                            : "border-slate-200 hover:border-blue-300 bg-white"
                        }`}
                      >
                        <div className="relative aspect-video bg-slate-100">
                          {r.thumbnail && (
                            <img
                              src={r.thumbnail}
                              alt=""
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          )}
                          {r.duration ? (
                            <span className="absolute bottom-1.5 right-1.5 text-[10px] bg-black/75 text-white px-1.5 py-0.5 rounded">
                              {Math.floor(r.duration / 60)}:{String(Math.floor(r.duration % 60)).padStart(2, "0")}
                            </span>
                          ) : null}
                          {picked && (
                            <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Picked
                            </div>
                          )}
                        </div>
                        <div className="p-2.5">
                          <h4 className="text-xs font-semibold text-slate-900 line-clamp-2">
                            {r.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{r.channelTitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] uppercase tracking-wider text-slate-400">or paste a URL</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* YouTube URL fallback */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                YouTube video URL
              </label>
              <Input
                value={videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  // Clear the "picked" highlight if they're manually typing
                  // a different URL.
                  if (pickedVideoId && extractYouTubeId(e.target.value) !== pickedVideoId) {
                    setPickedVideoId(null);
                  }
                }}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {videoUrl && !extractYouTubeId(videoUrl) && (
                <p className="text-xs text-red-600 mt-1">Doesn't look like a valid YouTube link.</p>
              )}
            </div>

            {/* Phase toggles */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Include in the session
              </label>
              <div className="grid grid-cols-2 gap-2">
                <PhaseToggle
                  Icon={Sparkles}
                  label="Inquiry hook"
                  on={includes.inquiry}
                  onClick={() => setIncludes((p) => ({ ...p, inquiry: !p.inquiry }))}
                />
                <PhaseToggle
                  Icon={Eye}
                  label="Attention checks"
                  on={includes.attentionChecks}
                  onClick={() => setIncludes((p) => ({ ...p, attentionChecks: !p.attentionChecks }))}
                />
                <PhaseToggle
                  Icon={FileText}
                  label="Quiz"
                  on={includes.quiz}
                  onClick={() => setIncludes((p) => ({ ...p, quiz: !p.quiz }))}
                />
                <PhaseToggle
                  Icon={MessageCircle}
                  label="Case study"
                  on={includes.caseStudy}
                  onClick={() => setIncludes((p) => ({ ...p, caseStudy: !p.caseStudy }))}
                />
              </div>
            </div>

            {includes.quiz && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Number of quiz questions
                </label>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQuestionCount(n)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                        questionCount === n
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assign to class */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 inline-flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Assign to class
              </label>
              {loading ? (
                <div className="text-sm text-slate-400 inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading classes…
                </div>
              ) : classes.length === 0 ? (
                <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
                  You don't have any classes yet.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      navigate(createPageUrl("TeacherClasses"));
                    }}
                    className="font-semibold underline"
                  >
                    Create one first
                  </button>.
                </div>
              ) : (
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Pick a class —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Due date */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 inline-flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Due date (optional)
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        ) : (
          // Generation in progress — shared progress bar (matches Generate /
          // curriculum). We'll reveal the review step the moment it's ready.
          <div className="p-6">
            <GenerationProgress
              title="Generating your single session"
              subtitle="This usually takes 30–90 seconds. You'll review it before it's assigned."
              started={baseDone}
              steps={[
                { label: "Quiz + case study", done: baseDone },
                ...(includes.inquiry
                  ? [{ label: "Inquiry hook + Socratic prompt", done: baseDone && !enriching.inquiry }]
                  : []),
                ...(includes.attentionChecks
                  ? [{ label: "Attention checks", done: baseDone && !enriching.attentionChecks }]
                  : []),
              ]}
            />
          </div>
        )}

        {/* Footer */}
        {!working && (
          <div className="p-6 pt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onClose?.()}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit()}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Rocket className="w-4 h-4" />
              Create &amp; assign
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PhaseToggle({ Icon, label, on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left ${
        on
          ? "border-blue-500 bg-blue-50/40"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
        on ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
      }`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className={`text-sm font-medium ${on ? "text-slate-900" : "text-slate-600"}`}>
        {label}
      </span>
    </button>
  );
}

