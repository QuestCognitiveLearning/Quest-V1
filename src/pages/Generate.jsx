/**
 * Generate — top-level teacher dashboard surface for content generation.
 * Tabs: YouTube, PDF. Same AI pipeline. Result page lets the teacher save
 * the output to a class/subunit, download as PDF/Word, or start a live
 * session pre-populated with the new quiz.
 */
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Youtube,
  FileText,
  Sparkles,
  Upload,
  Loader2,
  ArrowRight,
  CheckCircle,
  Save,
  PlayCircle,
  Library,
  Plus,
  Download,
  Search,
  Send,
  Users,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TeacherLayout from "../components/teacher/TeacherLayout";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import CustomizePanel, { DEFAULT_OPTIONS, defaultOptionsForRole } from "@/components/try/CustomizePanel";
import { getUserRole } from "@/lib/tier";
import { generateTryPDF } from "@/lib/pdf/generatePDF";
import { downloadTryWord } from "@/lib/pdf/generateWord";
import { createPageUrl } from "@/utils";

function downloadBlobLocally(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function extractVideoId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[A-Za-z0-9_-]{6,15}$/.test(trimmed)) return trimmed;
  const patterns = [
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,15})/,
    /youtu\.be\/([A-Za-z0-9_-]{6,15})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,15})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,15})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

export default function Generate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("youtube"); // youtube | pdf
  const [mode, setMode] = useState("live"); // live | handout
  const [stage, setStage] = useState("input"); // input | generating | result
  const [error, setError] = useState("");
  const [options, setOptions] = useState({ ...DEFAULT_OPTIONS });

  // YouTube state
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // PDF state
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfMeta, setPdfMeta] = useState(null);
  const [pdfTopic, setPdfTopic] = useState("");
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef(null);

  // Result state
  const [result, setResult] = useState(null);
  // Which enrichment passes are still running after the base result lands.
  // Drives "in progress" skeleton sections so the user knows what's coming.
  const [enriching, setEnriching] = useState({ inquiry: false, attentionChecks: false });

  // Library state — teacher's saved handouts
  const [library, setLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Multi-select state for bulk deletion. selectMode flips on the Select UI
  // (checkboxes + bulk-action bar). selectedIds is a Set of handout IDs.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Assign-to-class modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignClasses, setAssignClasses] = useState([]);
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignPayload, setAssignPayload] = useState(null); // payload to assign
  const [classesForAssign, setClassesForAssign] = useState([]);
  const [assigning, setAssigning] = useState(false);

  const loadLibrary = async (teacherId) => {
    try {
      setLibraryLoading(true);
      const rows = await quest.entities.GeneratedHandout?.filter?.(
        { teacher_id: teacherId },
        "-created_at",
        50
      );
      setLibrary(rows || []);
    } catch (err) {
      console.error("Could not load library:", err);
      setLibrary([]);
    } finally {
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await quest.auth.me();
        setUser(me);
        // Switch the customize panel to tutor-tuned defaults (5 MCQs, case
        // study off, Middle grade) when the user is a tutor. Only applies on
        // first load — if the user has already started tweaking, leave their
        // choices alone.
        setOptions((prev) => {
          const stillDefault =
            prev.count === DEFAULT_OPTIONS.count &&
            prev.includeCaseStudy === DEFAULT_OPTIONS.includeCaseStudy;
          return stillDefault ? { ...defaultOptionsForRole(getUserRole(me)) } : prev;
        });
        loadLibrary(me.id);
      } catch (err) {
        console.error("Failed to load teacher context:", err);
        setLibraryLoading(false);
      }
    })();
  }, []);

  // Scroll to the library section when the URL hash is #library — lets the
  // sidebar "Library" link deep-link into Generate without a separate route.
  // Re-runs when the hash changes so clicking Library while already on
  // Generate re-scrolls.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.hash !== "#library") return;
    let tries = 0;
    const interval = setInterval(() => {
      const el = document.getElementById("library");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        clearInterval(interval);
      } else if (++tries > 40) {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [location.hash]);

  const handlePdfPick = async (file) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("PDF must be 25MB or smaller.");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Please upload a .pdf file.");
      return;
    }
    setPdfFile(file);
    setExtracting(true);
    try {
      const { extractPdfText } = await import("@/lib/extractPdfText");
      const meta = await extractPdfText(file);
      setPdfMeta(meta);
      if (!pdfTopic) {
        setPdfTopic(file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " "));
      }
      if (meta.wordCount < 50) {
        toast.warning(
          "We only extracted a few words from this PDF. It may be scanned — try a digital PDF or paste the content into the topic field below."
        );
      }
    } catch (err) {
      console.error("PDF extract failed:", err);
      toast.error("Could not extract text from this PDF.");
      setPdfFile(null);
      setPdfMeta(null);
    } finally {
      setExtracting(false);
    }
  };

  const handleSearchYouTube = async (e) => {
    e?.preventDefault?.();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "publicTryFunnel",
        { body: { action: "search", query: searchQuery.trim() } }
      );
      if (fnErr) throw fnErr;
      setSearchResults(data?.items || []);
      if ((data?.items || []).length === 0) {
        setError("No long-form videos found for that search. Try different keywords.");
      }
    } catch (err) {
      setError(err?.message || "Could not search YouTube.");
    } finally {
      setSearching(false);
    }
  };

  // After publicTryFunnel returns quiz + case_study + segments, fire the
  // heavier inquiry / image / attention checks generation using the EXACT
  // code paths the curriculum builder uses. Each runs independently so a
  // failure on one (e.g. image gen rate-limited) doesn't block the others.
  // Result is set progressively so the user sees content land as it comes.
  const enrichWithCurriculumGeneration = async (baseData, setProgressive) => {
    const topic = baseData?.video?.title || pdfTopic || "this topic";
    const wantInquiry = options.includeInquiry === true;
    const wantAttention =
      options.includeAttentionChecks === true &&
      Array.isArray(baseData?.timestamped_segments) &&
      baseData.timestamped_segments.length > 0;

    const tasks = [];

    // Flip the "in progress" flags up-front so the result panel renders
    // skeleton sections immediately, before the LLM round-trips finish.
    setEnriching({
      inquiry: !!wantInquiry,
      attentionChecks: !!wantAttention,
    });

    if (wantInquiry) {
      const { invokeLLM, generateImage } = await import("@/components/utils/openai");
      const { LLM_MODELS } = await import("@/lib/llmModels");

      tasks.push(
        (async () => {
          try {
            // EXACT inquiry prompt from ManageCurriculum, with topic
            // substituted in. Same response schema + model.
            const inquiry = await invokeLLM({
              model: LLM_MODELS.INQUIRY_CONTENT,
              prompt: `You are the world's best automated inquiry-based learning designer.

LANGUAGE: All generated text (hook question, anchor question, bridge question, transfer scenario, all options, all feedback) must be in clear, natural English. Translate non-English source material — never output non-English text.

        Topic: "${topic}"
        Learning Standard: "Not specified"

        Create a curiosity hook for this topic. IMPORTANT: The student has NOT learned this concept yet - they are encountering it for the first time. The hook question should relate directly to the topic but be answerable through intuition, prior knowledge, or everyday experience.

        The hook_image_prompt should show the ACTUAL REAL-WORLD application or example of "${topic}" (not an analogy). Show what this concept looks like in real life.

        Return strict JSON:
        {
        "hook_image_prompt": "[Describe the real-world application of ${topic}]. Style: cartoon-realistic with simplified forms and accurate physics, minimal and sleek, muted neutral and soft pastel color palette with low saturation (not vibrant), clean thin outlines, modern educational science illustration, pure white background only, single clear centered scenario in ONE UNIFIED SCENE, keep it simple and easy to understand what is happening, no people, no hands, no text, no labels, no arrows, no symbols, no numbers, no multiple panels or stages, calm polished classroom aesthetic, 1792×1024.",
        "hook_question": "Question (8-18 words) directly about ${topic} that students can answer through intuition or everyday experience, even without formal knowledge of the topic",
        "relevant_past_memories": [],
        "socratic_system_prompt": "You are Panda, a Socratic tutor. The student has NOT learned ${topic} yet. Guide them to think about the topic using their intuition and prior knowledge. Ask questions, never explain. Max 3 exchanges. Make sure to stay on topic with the subject of the session. End with: 'Brilliant thinking! Now watch the video.'",
        "tutor_first_message": "Warm response to student's guess, with follow-up question that helps them explore the topic further"
        }`,
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
            setProgressive((prev) => ({
              ...prev,
              inquiry_session: {
                hook_image_prompt: inquiry?.hook_image_prompt || "",
                hook_question: inquiry?.hook_question || "",
                socratic_system_prompt: inquiry?.socratic_system_prompt || "",
                tutor_first_message: inquiry?.tutor_first_message || "",
              },
            }));

            // After we have hook_image_prompt, generate the image.
            if (inquiry?.hook_image_prompt) {
              try {
                const img = await generateImage({
                  prompt: inquiry.hook_image_prompt,
                  quality: "medium",
                });
                const imageUrl = img?.url || img?.image_url || null;
                if (imageUrl) {
                  setProgressive((prev) => ({
                    ...prev,
                    inquiry_session: {
                      ...prev.inquiry_session,
                      hook_image_url: imageUrl,
                    },
                  }));
                }
              } catch (err) {
                console.warn("Hook image failed (non-fatal):", err);
              }
            }
          } catch (err) {
            console.warn("Inquiry generation failed (non-fatal):", err);
          } finally {
            setEnriching((prev) => ({ ...prev, inquiry: false }));
          }
        })()
      );
    }

    if (wantAttention) {
      tasks.push(
        (async () => {
          try {
            const { data: acResp } = await quest.functions.invoke(
              "generateAttentionChecks",
              {
                videoDuration: baseData.video_duration || 600,
                timestampedSegments: baseData.timestamped_segments,
              }
            );
            const ac = acResp?.attention_checks || [];
            setProgressive((prev) => ({ ...prev, attention_checks: ac }));
          } catch (err) {
            console.warn("Attention checks failed (non-fatal):", err);
          } finally {
            setEnriching((prev) => ({ ...prev, attentionChecks: false }));
          }
        })()
      );
    }

    // Block until every enrichment pass settles. We used to fire-and-forget
    // so the user saw the partial handout immediately, but that meant the
    // result page rendered before the inquiry hook + attention checks had
    // arrived. Holding the stage on "generating" until everything is ready
    // is a cleaner reveal.
    await Promise.allSettled(tasks);
  };

  const runYoutubeGenerate = async (videoId) => {
    setStage("generating");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "publicTryFunnel",
        { body: { action: "generate", videoId, options } }
      );
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      if (!data?.quiz?.length) throw new Error("No quiz generated.");
      setResult(data);
      // Wait for inquiry hook + attention checks (when included) before
      // revealing the handout. Keeps the result page from flashing a
      // partial state.
      await enrichWithCurriculumGeneration(data, setResult);
      setStage("result");
    } catch (err) {
      setError(err?.message || "Generation failed.");
      setStage("input");
    }
  };

  const handleGenerate = async () => {
    setError("");
    if (tab === "youtube") {
      const videoId = extractVideoId(url);
      if (!videoId) {
        setError("That doesn't look like a valid YouTube URL.");
        return;
      }
      setStage("generating");
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          "publicTryFunnel",
          { body: { action: "generate", videoId, options } }
        );
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        if (!data?.quiz?.length) throw new Error("No quiz generated.");
        setResult(data);
        await enrichWithCurriculumGeneration(data, setResult);
        setStage("result");
      } catch (err) {
        setError(err?.message || "Generation failed.");
        setStage("input");
      }
    } else {
      if (!pdfMeta?.text || pdfMeta.wordCount < 20) {
        setError(
          "Upload a PDF with extractable text. (Scanned/image-only PDFs aren't supported yet.)"
        );
        return;
      }
      setStage("generating");
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          "publicTryFunnel",
          {
            body: {
              action: "generate",
              pdfText: pdfMeta.text,
              topic: pdfTopic || "Uploaded handout",
              options,
            },
          }
        );
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        if (!data?.quiz?.length) throw new Error("No quiz generated.");
        setResult(data);
        await enrichWithCurriculumGeneration(data, setResult);
        setStage("result");
      } catch (err) {
        setError(err?.message || "Generation failed.");
        setStage("input");
      }
    }
  };

  const startOver = () => {
    setResult(null);
    setUrl("");
    setPdfFile(null);
    setPdfMeta(null);
    setPdfTopic("");
    setStage("input");
    setError("");
  };

  // ---- Library save ------------------------------------------------------
  const saveToLibrary = async (payload) => {
    const me = user || (await quest.auth.me());
    const vid = payload?.video?.videoId;
    const url = vid
      ? `https://www.youtube.com/watch?v=${vid}`
      : (payload?.video?.url || null);
    const row = await quest.entities.GeneratedHandout.create({
      teacher_id: me.id,
      title: payload?.video?.title || "Untitled handout",
      source_type: tab === "pdf" ? "pdf" : "youtube",
      source_url: url,
      payload,
    });
    return row;
  };

  const handleSaveToLibrary = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await saveToLibrary(result);
      toast.success("Saved to your library");
      if (user?.id) loadLibrary(user.id);
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRunLive = async () => {
    if (!result) return;
    setSaving(true);
    try {
      // Auto-save so the live session builder can seed from a real handout id.
      const saved = await saveToLibrary(result);
      if (user?.id) loadLibrary(user.id);
      const handoutId = saved?.id;
      if (!handoutId) throw new Error("No handout id returned");
      navigate(createPageUrl("LiveSessionBuilder") + `?fromHandout=${handoutId}`);
    } catch (err) {
      console.error("Open builder failed:", err);
      toast.error("Could not open the live session builder.");
    } finally {
      setSaving(false);
    }
  };

  const handleRunLiveFromLibrary = (row) => {
    navigate(createPageUrl("LiveSessionBuilder") + `?fromHandout=${row.id}`);
  };

  const handleDeleteFromLibrary = async (rowId) => {
    if (!window.confirm("Delete this handout from your library?")) return;
    try {
      await quest.entities.GeneratedHandout.delete(rowId);
      if (user?.id) loadLibrary(user.id);
    } catch (err) {
      toast.error("Could not delete.");
    }
  };

  // ---- Bulk selection ----------------------------------------------------
  const toggleSelectMode = () => {
    setSelectMode((on) => {
      if (on) setSelectedIds(new Set());
      return !on;
    });
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(library.map((r) => r.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    if (!window.confirm(`Delete ${n} handout${n === 1 ? "" : "s"}? This can't be undone.`)) return;
    setBulkDeleting(true);
    try {
      // Fire deletes in parallel; tolerate per-row failures so a single
      // bad row doesn't abort the rest.
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) => quest.entities.GeneratedHandout.delete(id))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) toast.error(`${failed} delete${failed === 1 ? "" : "s"} failed.`);
      else toast.success(`Deleted ${n} handout${n === 1 ? "" : "s"}.`);
      setSelectedIds(new Set());
      setSelectMode(false);
      if (user?.id) loadLibrary(user.id);
    } catch (err) {
      console.error("Bulk delete failed:", err);
      toast.error("Bulk delete failed.");
    } finally {
      setBulkDeleting(false);
    }
  };

  // Open the assign modal — loads teacher's classes and stashes the payload
  // to assign. Called from the result-page action bar or from any library row.
  const openAssignModal = async (payload, title) => {
    setAssignPayload({ payload, title });
    setAssignClasses([]);
    setAssignDueDate("");
    setAssignModalOpen(true);
    try {
      const me = user || (await quest.auth.me());
      const cls = await quest.entities.Class.filter({ teacher_id: me.id });
      setClassesForAssign(cls || []);
    } catch (err) {
      console.error("Could not load classes:", err);
      setClassesForAssign([]);
    }
  };

  const toggleAssignClass = (classId) => {
    setAssignClasses((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleAssignSubmit = async () => {
    if (!assignPayload?.payload || assignClasses.length === 0) {
      toast.error("Pick at least one class.");
      return;
    }
    setAssigning(true);
    try {
      const me = user || (await quest.auth.me());
      const payload = assignPayload.payload;
      const title = assignPayload.title || payload?.video?.title || "Learning session";

      // One lesson_bundles row + N lesson_bundle_assignments rows (one per
      // class). Reusing the embedded jsonb payload so the student-side flow
      // has everything without joining extra tables.
      const { data: bundle, error: bErr } = await supabase
        .from("lesson_bundles")
        .insert({
          teacher_id: me.id,
          title,
          source_type: tab === "pdf" ? "pdf" : "youtube",
          source_url: payload?.video?.videoId
            ? `https://www.youtube.com/watch?v=${payload.video.videoId}`
            : payload?.video?.url || null,
          grade_level: options.gradeLevel || null,
          payload,
        })
        .select("id")
        .single();
      if (bErr) throw bErr;

      const dueAt = assignDueDate ? new Date(assignDueDate).toISOString() : null;
      const { error: aErr } = await supabase
        .from("lesson_bundle_assignments")
        .insert(
          assignClasses.map((classId) => ({
            bundle_id: bundle.id,
            class_id: classId,
            due_at: dueAt,
          }))
        );
      if (aErr) throw aErr;

      toast.success(
        `Assigned to ${assignClasses.length} class${assignClasses.length === 1 ? "" : "es"}`
      );
      setAssignModalOpen(false);
    } catch (err) {
      console.error("Assign failed:", err);
      toast.error(err?.message || "Could not assign.");
    } finally {
      setAssigning(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
    try {
      const blob = await generateTryPDF(result);
      downloadBlobLocally(
        blob,
        `${(result.video?.title || "Quest-Handout").replace(/[^a-z0-9-]+/gi, "-")}.pdf`
      );
    } catch (err) {
      toast.error("Could not generate PDF");
    }
  };

  const handleDownloadWord = async () => {
    if (!result) return;
    try {
      await downloadTryWord({ result, label: result.video?.title });
    } catch (err) {
      toast.error("Could not generate Word doc");
    }
  };

  // ---- Render ------------------------------------------------------------
  return (
    <TeacherLayout activeNav="generate" user={user}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-[#2563EB]" />
            Generate
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Turn a YouTube video or a PDF into a print-ready quiz, case study,
            and live session in 90 seconds.
          </p>
        </div>

        {/* Mode toggle — pick the outcome up front. */}
        <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm flex gap-1 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode("live");
              setOptions((o) => ({
                ...o,
                includeInquiry: true,
                includeAttentionChecks: true,
              }));
            }}
            className={`flex-1 flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
              mode === "live"
                ? "bg-emerald-50 border-2 border-emerald-500"
                : "border-2 border-transparent hover:bg-slate-50"
            }`}
          >
            <PlayCircle className={`w-5 h-5 mt-0.5 shrink-0 ${mode === "live" ? "text-emerald-600" : "text-slate-400"}`} />
            <div>
              <div className="text-sm font-semibold text-slate-900">Live session</div>
              <div className="text-[11.5px] text-slate-500 mt-0.5">
                Generate then run it as a game. Students join with a code, earn points.
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("handout");
              // Force the live-only toggles off when switching to handout —
              // there's no Socratic dialogue on paper, no mid-video MCQ on a
              // printed sheet.
              setOptions((o) => ({
                ...o,
                includeInquiry: false,
                includeAttentionChecks: false,
              }));
            }}
            className={`flex-1 flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
              mode === "handout"
                ? "bg-blue-50 border-2 border-[#2563EB]"
                : "border-2 border-transparent hover:bg-slate-50"
            }`}
          >
            <FileText className={`w-5 h-5 mt-0.5 shrink-0 ${mode === "handout" ? "text-[#2563EB]" : "text-slate-400"}`} />
            <div>
              <div className="text-sm font-semibold text-slate-900">Handout</div>
              <div className="text-[11.5px] text-slate-500 mt-0.5">
                Print-ready PDF + editable Word. Save to library or assign later.
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("assign");
              // Assigned learning sessions are done online (quiz + case
              // study + inquiry). Attention checks are useful when there's
              // a video; default both inquiry + attention on.
              setOptions((o) => ({
                ...o,
                includeInquiry: true,
                includeAttentionChecks: true,
              }));
            }}
            className={`flex-1 flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
              mode === "assign"
                ? "bg-violet-50 border-2 border-violet-500"
                : "border-2 border-transparent hover:bg-slate-50"
            }`}
          >
            <Send className={`w-5 h-5 mt-0.5 shrink-0 ${mode === "assign" ? "text-violet-600" : "text-slate-400"}`} />
            <div>
              <div className="text-sm font-semibold text-slate-900">Assign learning session</div>
              <div className="text-[11.5px] text-slate-500 mt-0.5">
                Push to your class with a due date. Tracked alongside curriculum progress.
              </div>
            </div>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6 gap-1">
          {[
            { id: "youtube", label: "From YouTube", icon: Youtube },
            { id: "pdf", label: "From PDF", icon: FileText },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
                tab === t.id
                  ? "bg-white text-[#2563EB] border-b-2 border-[#2563EB] -mb-px"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
          <div className="flex-1 flex items-center justify-end px-3 text-xs text-slate-400">
            More sources coming soon
          </div>
        </div>

        {stage === "input" && (
          <div className="space-y-5">
            {/* CustomizePanel sits ABOVE the video picker so the teacher
                picks what to include BEFORE choosing a source — clicking a
                search result then fires generation with the current toggle
                state. */}
            <CustomizePanel
              options={options}
              onChange={setOptions}
              mode={mode}
            />

            {tab === "youtube" ? (
              <div className="space-y-4">
                <form
                  onSubmit={handleSearchYouTube}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
                >
                  <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <Search className="w-4 h-4" /> Search YouTube
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder='e.g. "photosynthesis explained"'
                      disabled={searching}
                    />
                    <Button
                      type="submit"
                      disabled={searching || !searchQuery.trim()}
                      variant="outline"
                      className="gap-2"
                    >
                      {searching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Search
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {searchResults.map((r) => (
                        <button
                          key={r.videoId}
                          type="button"
                          onClick={() => runYoutubeGenerate(r.videoId)}
                          className="text-left group rounded-xl border border-slate-200 hover:border-[#2563EB] hover:shadow-md transition overflow-hidden bg-white"
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
                              <span className="absolute bottom-2 right-2 text-[10px] bg-black/75 text-white px-1.5 py-0.5 rounded">
                                {Math.floor(r.duration / 60)}:
                                {String(Math.floor(r.duration % 60)).padStart(2, "0")}
                              </span>
                            ) : null}
                          </div>
                          <div className="p-3">
                            <h4 className="text-sm font-semibold text-slate-900 line-clamp-2">
                              {r.title}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                              {r.channelTitle}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </form>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs uppercase tracking-wider text-slate-500">
                    or paste a URL
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Paste a YouTube URL
                  </label>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Upload a PDF
                </label>
                {!pdfFile ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 hover:border-[#2563EB] rounded-xl p-10 text-center transition-colors"
                  >
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      Drop a PDF here, or click to browse
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Max 25MB. Digital PDFs only for now.
                    </p>
                  </button>
                ) : (
                  <div className="border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                    <FileText className="w-8 h-8 text-[#2563EB] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {pdfFile.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {extracting
                          ? "Extracting text…"
                          : pdfMeta
                          ? `${pdfMeta.totalPages} page${
                              pdfMeta.totalPages === 1 ? "" : "s"
                            } · ${pdfMeta.wordCount.toLocaleString()} words`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfFile(null);
                        setPdfMeta(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Replace
                    </button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => handlePdfPick(e.target.files?.[0])}
                />
                {pdfMeta && (
                  <>
                    <label className="block text-xs font-semibold tracking-wider uppercase text-slate-500 mt-4 mb-1.5">
                      Topic name
                    </label>
                    <Input
                      value={pdfTopic}
                      onChange={(e) => setPdfTopic(e.target.value)}
                      placeholder="e.g. Photosynthesis (chapter 4)"
                    />
                    {pdfMeta.preview && (
                      <details className="mt-3">
                        <summary className="text-xs text-slate-500 cursor-pointer">
                          Preview extracted text
                        </summary>
                        <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-3 rounded-lg max-h-32 overflow-auto whitespace-pre-wrap">
                          {pdfMeta.preview}…
                        </p>
                      </details>
                    )}
                  </>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={
                  (tab === "youtube" && !url.trim()) ||
                  (tab === "pdf" && (!pdfMeta || extracting))
                }
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white h-11 px-6 gap-2"
              >
                Generate <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {stage === "generating" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm">
            <div className="text-center mb-6">
              <Loader2 className="w-10 h-10 text-[#2563EB] mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-bold text-slate-900">
                Generating your handout
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                This usually takes 30–90 seconds. We'll reveal everything at once when it's ready.
              </p>
            </div>
            <ul className="max-w-md mx-auto space-y-2 text-sm">
              <GenStep
                done={!!result?.quiz?.length}
                running={!result?.quiz?.length}
                label="Quiz + case study"
              />
              {options.includeInquiry && (
                <GenStep
                  done={!!result?.inquiry_session?.hook_question && !enriching.inquiry}
                  running={enriching.inquiry || !result}
                  label="Inquiry hook + Socratic prompt"
                />
              )}
              {options.includeAttentionChecks && (
                <GenStep
                  done={
                    Array.isArray(result?.attention_checks) &&
                    result.attention_checks.length > 0 &&
                    !enriching.attentionChecks
                  }
                  running={enriching.attentionChecks || !result}
                  label="Attention checks"
                />
              )}
            </ul>
          </div>
        )}

        {stage === "result" && result && (
          <div className="space-y-5">
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border border-slate-200 rounded-2xl p-3 flex flex-wrap gap-2 shadow-sm">
              <Button
                onClick={handleSaveToLibrary}
                disabled={saving}
                className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8]"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save to library
              </Button>
              <Button onClick={handleRunLive} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <PlayCircle className="w-4 h-4" /> Use in live session
              </Button>
              <Button
                onClick={() => openAssignModal(result, result?.video?.title)}
                disabled={saving}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Send className="w-4 h-4" /> Assign to class
              </Button>
              <Button onClick={handleDownloadPDF} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> PDF
              </Button>
              <Button onClick={handleDownloadWord} variant="outline" className="gap-2">
                <FileText className="w-4 h-4" /> Word
              </Button>
              <Button onClick={startOver} variant="ghost" className="ml-auto">
                Start over
              </Button>
            </div>

            <ResultPreview result={result} enriching={enriching} />
          </div>
        )}

        {/* Library section — always visible (when not actively generating) */}
        {stage !== "generating" && (
          <section id="library" className="mt-12 scroll-mt-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Library className="w-5 h-5 text-[#2563EB]" />
                  Your library
                </h2>
                <p className="text-sm text-slate-500">
                  Generated handouts you can run live anytime &mdash; no class required.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {library.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {library.length} item{library.length === 1 ? "" : "s"}
                  </span>
                )}
                {library.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectMode}
                    className="h-8 px-3 text-xs gap-1.5"
                  >
                    {selectMode ? (
                      <>Cancel</>
                    ) : (
                      <>
                        <CheckSquare className="w-3.5 h-3.5" /> Select
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {libraryLoading ? (
              <div className="text-center py-10 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              </div>
            ) : library.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
                <Library className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  Nothing saved yet. Generate a quiz above and hit <strong>Save to library</strong>.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {library.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  return (
                    <div
                      key={row.id}
                      onClick={selectMode ? () => toggleSelected(row.id) : undefined}
                      className={`bg-white border rounded-xl p-4 flex flex-col gap-2 transition-colors ${
                        selectMode
                          ? `cursor-pointer ${
                              isSelected
                                ? "border-[#2563EB] ring-2 ring-[#2563EB]/30 bg-blue-50/40"
                                : "border-slate-200 hover:border-slate-300"
                            }`
                          : "border-slate-200 hover:border-[#2563EB]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {selectMode && (
                            isSelected ? (
                              <CheckSquare className="w-5 h-5 text-[#2563EB] mt-0.5 flex-shrink-0" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300 mt-0.5 flex-shrink-0" />
                            )
                          )}
                          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                            {row.title}
                          </h3>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 shrink-0">
                          {row.source_type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {(row.payload?.quiz?.length || 0)} questions{row.payload?.case_study?.scenario ? " · 1 case study" : ""}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Saved {new Date(row.created_at).toLocaleDateString()}
                      </p>
                      {!selectMode && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => handleRunLiveFromLibrary(row)}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs"
                          >
                            <PlayCircle className="w-3.5 h-3.5" /> Use in live session
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignModal(row.payload, row.title)}
                            className="h-8 px-3 text-xs gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" /> Assign
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResult(row.payload) || setStage("result")}
                            className="h-8 px-3 text-xs"
                          >
                            Open
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFromLibrary(row.id)}
                            className="ml-auto text-xs text-slate-400 hover:text-red-600"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Sticky bulk-action bar — only while select mode is on */}
      {selectMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 max-w-[95vw]">
          <span className="text-sm font-semibold">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={selectedIds.size === library.length ? clearSelection : selectAllVisible}
            className="text-xs text-slate-300 hover:text-white underline"
          >
            {selectedIds.size === library.length ? "Clear" : "Select all"}
          </button>
          <Button
            size="sm"
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0 || bulkDeleting}
            className="bg-red-600 hover:bg-red-700 text-white h-8 px-3 text-xs gap-1.5 disabled:opacity-50"
          >
            {bulkDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Delete selected
          </Button>
          <button
            type="button"
            onClick={toggleSelectMode}
            className="text-xs text-slate-300 hover:text-white"
          >
            Done
          </button>
        </div>
      )}

      {/* Assign-to-class modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3">
              <Send className="w-3.5 h-3.5" /> Assign learning session
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {assignPayload?.title || "New learning session"}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Pick the class(es) that should see this and (optionally) when it's due.
            </p>

            <div className="text-[12px] font-semibold tracking-wider uppercase text-slate-500 mb-2">
              Classes
            </div>
            {classesForAssign.length === 0 ? (
              <div className="text-sm text-slate-500 py-4 px-3 bg-slate-50 rounded-lg mb-3">
                You don't have any classes yet.{" "}
                <button
                  type="button"
                  onClick={() => navigate(createPageUrl("TeacherClasses"))}
                  className="text-violet-700 font-semibold underline"
                >
                  Create one
                </button>
                .
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 mb-4">
                {classesForAssign.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleAssignClass(c.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                      assignClasses.includes(c.id)
                        ? "border-violet-500 bg-violet-50"
                        : "border-slate-200 hover:border-violet-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        assignClasses.includes(c.id)
                          ? "bg-violet-600 text-white"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {assignClasses.includes(c.id) ? "✓" : ""}
                    </div>
                    <Users className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {c.class_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Join code {c.join_code}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="text-[12px] font-semibold tracking-wider uppercase text-slate-500 mb-2 mt-2">
              Due date (optional)
            </div>
            <Input
              type="date"
              value={assignDueDate}
              onChange={(e) => setAssignDueDate(e.target.value)}
              className="mb-5"
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setAssignModalOpen(false)}
                disabled={assigning}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignSubmit}
                disabled={assigning || assignClasses.length === 0}
                className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
              >
                {assigning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}

// Step row inside the "Generating…" panel. Three visual states:
//   running = spinner, done = green check, idle = grey dot.
function GenStep({ done, running, label }) {
  return (
    <li className="flex items-center gap-3">
      {done ? (
        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
      ) : running ? (
        <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-slate-200 flex-shrink-0" />
      )}
      <span className={done ? "text-slate-900 font-medium" : "text-slate-600"}>
        {label}
      </span>
    </li>
  );
}

function ResultPreview({ result, enriching = { inquiry: false, attentionChecks: false } }) {
  const { video, quiz, case_study, inquiry_session, attention_checks } = result;
  const showInquiryPending = enriching.inquiry && !inquiry_session?.hook_question;
  const showAttentionPending =
    enriching.attentionChecks && !(Array.isArray(attention_checks) && attention_checks.length > 0);
  const [revealed, setRevealed] = useState({});

  const fmtTime = (s) => {
    const m = Math.floor((s || 0) / 60);
    const ss = String(Math.floor((s || 0) % 60)).padStart(2, "0");
    return `${m}:${ss}`;
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-100">
        <p className="text-xs uppercase tracking-wider text-[#2563EB] font-semibold">
          Generated handout
        </p>
        <h2 className="text-2xl font-bold text-slate-900 leading-tight mt-1">
          {video?.title}
        </h2>
        {video?.channelTitle && (
          <p className="text-sm text-slate-500 mt-1">
            From {video.channelTitle}
          </p>
        )}
      </div>

      {showInquiryPending && (
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">Inquiry hook</h3>
            <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
              Generating…
            </span>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-5 items-start">
            <div className="aspect-video bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-slate-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 bg-slate-200 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-5/6" />
            </div>
          </div>
        </div>
      )}

      {inquiry_session?.hook_question && (
        <details open className="p-6 border-b border-slate-100">
          <summary className="cursor-pointer text-lg font-semibold text-slate-900">
            Inquiry hook
          </summary>
          <div className="mt-4 grid md:grid-cols-2 gap-5 items-start">
            {inquiry_session.hook_image_url ? (
              <img
                src={inquiry_session.hook_image_url}
                alt="Inquiry hook"
                className="w-full rounded-xl border border-slate-200"
              />
            ) : (
              <div className="aspect-video bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-slate-200 flex items-center justify-center text-xs text-slate-500 text-center px-4">
                {inquiry_session.hook_image_prompt
                  ? "Image generating…"
                  : "No hook image"}
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                {inquiry_session.hook_question}
              </h3>
              <p className="text-sm text-slate-600 italic leading-relaxed">
                Panda's opening:&nbsp;
                <span className="not-italic">
                  {inquiry_session.tutor_first_message}
                </span>
              </p>
            </div>
          </div>
        </details>
      )}

      {showAttentionPending && (
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <h3 className="text-lg font-semibold text-slate-900">Attention checks</h3>
            <span className="text-[11px] uppercase tracking-wider font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              Generating…
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-16 bg-amber-50/40 border border-slate-200 rounded-xl animate-pulse" />
            <div className="h-16 bg-amber-50/40 border border-slate-200 rounded-xl animate-pulse" />
          </div>
        </div>
      )}

      {Array.isArray(attention_checks) && attention_checks.length > 0 && (
        <details className="p-6 border-b border-slate-100">
          <summary className="cursor-pointer text-lg font-semibold text-slate-900">
            Attention checks · {attention_checks.length}
          </summary>
          <ol className="mt-4 space-y-3">
            {attention_checks.map((ac, i) => (
              <li
                key={i}
                className="border border-slate-200 rounded-xl p-4 bg-amber-50/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-amber-700">
                    At {fmtTime(ac.timestamp)}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Correct: {ac.correct_choice}
                  </span>
                </div>
                <p className="font-medium text-slate-900 mb-2">{ac.question}</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {["a", "b", "c", "d"].map((l) => (
                    <li key={l} className="flex gap-2">
                      <span className="font-semibold w-5">{l.toUpperCase()}.</span>
                      <span>{ac[`choice_${l}`]}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      )}

      {case_study?.scenario && (
        <details className="p-6 border-b border-slate-100">
          <summary className="cursor-pointer text-lg font-semibold text-slate-900">
            Case Study
          </summary>
          <p className="text-slate-700 leading-relaxed mt-3 mb-4">
            {case_study.scenario}
          </p>
          {case_study.discussion_questions?.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">
                Discussion Questions
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-slate-700">
                {case_study.discussion_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </>
          )}
        </details>
      )}

      {quiz?.length > 0 && (
        <section className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Quiz · {quiz.length} questions
          </h3>
          <ol className="space-y-4">
            {quiz.map((q, i) => (
              <li
                key={i}
                className="border border-slate-200 rounded-xl p-4"
              >
                <p className="font-medium text-slate-900 mb-3">
                  {i + 1}. {q.question}
                </p>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {["a", "b", "c", "d"].map((letter) => {
                    const isCorrect =
                      revealed[i] && q.correct_choice === letter.toUpperCase();
                    return (
                      <li
                        key={letter}
                        className={`flex items-start gap-2 px-2 py-1 rounded ${
                          isCorrect ? "bg-emerald-50 text-emerald-900" : ""
                        }`}
                      >
                        <span className="font-semibold w-5 shrink-0">
                          {letter.toUpperCase()}.
                        </span>
                        <span className="flex-1">{q[`choice_${letter}`]}</span>
                        {isCorrect && (
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        )}
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    setRevealed((prev) => ({ ...prev, [i]: !prev[i] }))
                  }
                  className="mt-3 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  {revealed[i] ? "Hide answer" : "Show answer"}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
