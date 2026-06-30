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
  Users,
  Trash2,
  CheckSquare,
  Square,
  Pencil,
  Eye,
  X,
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
import StudentSidebar from "../components/shared/StudentSidebar";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { studentGenerationsRemaining, canStudentGenerate, getLimits } from "@/lib/tier";
import { invokeLLM } from "@/components/utils/openai";
import { LLM_MODELS } from "@/lib/llmModels";
import CustomizePanel, { DEFAULT_OPTIONS } from "@/components/try/CustomizePanel";
import { generateTryPDF } from "@/lib/pdf/generatePDF";
import { downloadTryWord } from "@/lib/pdf/generateWord";
import { createPageUrl } from "@/utils";
import { GenerationProgress, SessionContentReview } from "@/components/teacher/SessionContentReview";
import { dqText } from "@/lib/caseStudy";
import { REVIEW_OFFSETS } from "@/lib/spacedRepetition";

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
  const [mode, setMode] = useState("live"); // teacher: live | handout
  // Student-only post-generation view. Students create flashcard decks.
  const [studentMode, setStudentMode] = useState("flashcards");
  // Pre-generation toggles + scheduling for student Learning Sessions.
  // includeSummary: prepend a quick 5-bullet summary of the video.
  // includeAttention: pause-on-timestamp attention checks during the video.
  // scheduledFor: date the session appears on the student's Learning Hub.
  // reviewsEnabled: queue spaced-repetition reviews at +1/+3/+7/+14/+30 days.
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeAttention, setIncludeAttention] = useState(true);
  const [scheduledFor, setScheduledFor] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
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
  // Teacher-chosen title for the generated session (defaults to the video
  // title once generation lands, but is fully editable before saving).
  const [resultTitle, setResultTitle] = useState("");

  // Multi-select state for bulk deletion. selectMode flips on the Select UI
  // (checkboxes + bulk-action bar). selectedIds is a Set of handout IDs.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Student-tier gating. Free students cap at 5 lifetime generations;
  // paid student/teacher accounts (classroom tier) are unbounded.
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  // Review/edit modal. `editTarget` = { source: 'library'|'result', id?, payload }.
  // Opened by the library "Review" button and the result-stage "Edit" button.
  const [editTarget, setEditTarget] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  // Once generation finishes, teachers review/edit in the SAME modal used by
  // the assigned/live/curriculum flows (instead of the old inline-only view),
  // so reviewing made content looks identical everywhere. Auto-open it once per
  // generated result; the page's save/PDF/Word/live actions stay behind it.
  const autoReviewRef = useRef(false);

  // In-page confirm dialog (replaces window.confirm for library deletes).
  // { title, message, confirmLabel, onConfirm }.
  const [confirmDialog, setConfirmDialog] = useState(null);

  const isStudent = user?.account_type === "student";
  const studentRemaining = studentGenerationsRemaining(user);
  const studentLimit = getLimits(user).studentGenerationsTotal ?? 0;
  const studentUsed = user?.student_generations_used ?? 0;
  const studentBlocked = isStudent && !canStudentGenerate(user);

  // Auto-open the shared review/edit modal once a teacher's content is ready,
  // so the review experience matches assigned/live/curriculum exactly.
  useEffect(() => {
    if (stage !== "result") {
      autoReviewRef.current = false;
      return;
    }
    if (result && !isStudent && !autoReviewRef.current) {
      autoReviewRef.current = true;
      setEditTarget({ source: "result", title: result?.video?.title, payload: result });
    }
  }, [stage, result, isStudent]);

  // Generate flashcards client-side via invokeLLM. The model decides
  // how many cards to produce — we don't cap or floor. Cards must be
  // self-contained ("What is X?" / "X is …"), no meta-references like
  // "according to the transcript" or "according to the video". Falls
  // back to quiz-derived cards if the call fails.
  const enrichWithFlashcards = async (baseData, setProgressive) => {
    if (!isStudent || studentMode !== "flashcards") return;
    if (baseData?.flashcards?.length) return;
    try {
      const topic = baseData?.video?.title || pdfTopic || "this topic";
      const sourceText = (baseData?.timestamped_segments || [])
        .map((s) => s.text || "")
        .join(" ")
        .slice(0, 12000);
      const schema = {
        type: "object",
        properties: {
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                front: { type: "string" },
                back: { type: "string" },
              },
              required: ["front", "back"],
            },
          },
        },
        required: ["cards"],
      };
      const result = await invokeLLM({
        model: LLM_MODELS.CASE_STUDY_GRADING,
        prompt: `Generate a study flashcard deck about "${topic}" using the source content below.

RULES (strict):
- Generate as many cards as the content requires to cover every important concept, term, mechanism, and relationship — no fixed count, no padding, no skipping. A short video might need 6 cards; a dense one might need 20+.
- Each card stands alone: the front is a clear question, term, or prompt; the back is a concise, complete answer that makes sense without any outside context.
- NEVER use phrases like "according to the transcript", "according to the video", "as mentioned", "the speaker said", or "in this video". The cards must read like they came from a textbook, not from notes about a video.
- Mix card types where helpful: definitions, "what happens when …?", cause→effect, key numbers, compare/contrast.
- Skip filler, intros, and host talk.
- Keep each side under ~30 words.

Source content:
${sourceText}

Return JSON: { cards: [{ front, back }, ...] }`,
        response_json_schema: schema,
      });
      const cards = Array.isArray(result?.cards)
        ? result.cards.filter((c) => c?.front && c?.back)
        : [];
      if (cards.length > 0) {
        setProgressive((prev) => (prev ? { ...prev, flashcards: cards } : prev));
      }
    } catch (err) {
      console.warn("Flashcard generation failed (non-fatal):", err);
    }
  };

  // Generate a 5-bullet summary client-side after the base publicTryFunnel
  // returns. We don't gate on this — if it fails, the Summary phase just
  // gets skipped (the player checks payload.summary.bullets.length).
  const enrichWithSummary = async (baseData, setProgressive) => {
    if (!isStudent || !includeSummary) return;
    if (baseData?.summary?.bullets?.length) return;
    try {
      const topic = baseData?.video?.title || pdfTopic || "this topic";
      const transcriptText = (baseData?.timestamped_segments || [])
        .map((s) => s.text || "")
        .join(" ")
        .slice(0, 6000);
      const schema = {
        type: "object",
        properties: {
          bullets: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["bullets"],
      };
      const result = await invokeLLM({
        model: LLM_MODELS.CASE_STUDY_GRADING,
        prompt: `Write a 5-bullet pre-watch summary for a student about to learn "${topic}". Each bullet should preview ONE key idea — concise, specific, and curiosity-piquing.

Rules: No fluff, no introductions. Do NOT use phrases like "according to the transcript", "in this video", or "the speaker says" — the bullets must read like the previewed material itself, not meta-notes.

${transcriptText ? `Source content:\n${transcriptText}` : ""}

Return JSON: { bullets: [string, string, string, string, string] }`,
        response_json_schema: schema,
      });
      const bullets = Array.isArray(result?.bullets) ? result.bullets.filter(Boolean).slice(0, 5) : [];
      if (bullets.length > 0) {
        setProgressive((prev) =>
          prev ? { ...prev, summary: { bullets } } : prev,
        );
      }
    } catch (err) {
      console.warn("Summary generation failed (non-fatal):", err);
    }
  };

  // Bumps the student counter AFTER a successful generation. Best-effort:
  // a failed bump shouldn't break the user's generation result.
  const incrementStudentGenerations = async () => {
    if (!isStudent || !user) return;
    try {
      const nextCount = (user.student_generations_used ?? 0) + 1;
      const { error: upErr } = await supabase
        .from("users")
        .update({ student_generations_used: nextCount })
        .eq("id", user.id);
      if (upErr) throw upErr;
      setUser((prev) => prev && { ...prev, student_generations_used: nextCount });
    } catch (err) {
      console.warn("Student generation counter bump failed:", err);
    }
  };

  const handleUpgrade = async () => {
    if (upgrading) return;
    setUpgrading(true);
    try {
      const pricesResp = await quest.functions.invoke("getStripePrices", {});
      const priceId =
        pricesResp?.data?.tiers?.student?.monthly ||
        pricesResp?.tiers?.student?.monthly;
      if (!priceId) {
        toast.error("Student plan isn't configured yet — try again shortly.");
        return;
      }
      const successUrl = `${window.location.origin}/Generate?checkout=success`;
      const cancelUrl = `${window.location.origin}/Generate?checkout=canceled`;
      const resp = await quest.functions.invoke("createCheckout", {
        priceId,
        successUrl,
        cancelUrl,
      });
      const url = resp?.data?.url || resp?.url;
      if (!url) throw new Error("Checkout could not be started.");
      window.location.href = url;
    } catch (err) {
      console.error("Upgrade failed:", err);
      toast.error(err?.message || "Couldn't start checkout.");
    } finally {
      setUpgrading(false);
    }
  };

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

      // Transcript context so the hook + discussion lead into what the video
      // actually teaches (not just the title).
      const inquiryTranscript = (baseData?.timestamped_segments || [])
        .map((s) => s.text || "")
        .join(" ")
        .slice(0, 8000);

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
${inquiryTranscript ? `
        Use this video transcript as CONTEXT for what the lesson actually teaches. Craft the introduction (hook) and the discussion so they lead directly into the specific concepts this video covers, at the depth the video treats them:
        """
        ${inquiryTranscript}
        """
` : ""}
        Create a curiosity hook for this topic. IMPORTANT: The student has NOT watched the video yet - they are encountering these concepts for the first time. The hook question must point at the core idea the video will teach, but stay answerable through intuition, prior knowledge, or everyday experience — never require a fact that is only revealed in the video.

        The hook_image_prompt should show the ACTUAL REAL-WORLD application or example of "${topic}" as it appears in the video (not an analogy). Show what this concept looks like in real life.

        The socratic discussion (socratic_system_prompt + tutor_first_message) should steer the student toward the specific concepts the transcript covers, so that when they watch, the video answers the very questions they were just wondering about.

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
    if (isStudent && !canStudentGenerate(user)) {
      setShowUpgrade(true);
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
      incrementStudentGenerations();
      // Wait for inquiry hook + attention checks (when included) before
      // revealing the handout. Keeps the result page from flashing a
      // partial state.
      await Promise.all([
        enrichWithCurriculumGeneration(data, setResult),
        enrichWithSummary(data, setResult),
        enrichWithFlashcards(data, setResult),
      ]);
      setStage("result");
    } catch (err) {
      setError(err?.message || "Generation failed.");
      setStage("input");
    }
  };

  const handleGenerate = async () => {
    setError("");
    if (!resultTitle.trim()) {
      setError("Give this session a title first.");
      return;
    }
    // Free-tier students hit the cap → open upgrade modal instead of
    // calling the LLM. canStudentGenerate is true for teachers and for
    // classroom-tier (paid) students.
    if (isStudent && !canStudentGenerate(user)) {
      setShowUpgrade(true);
      return;
    }
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
        incrementStudentGenerations();
        await Promise.all([
          enrichWithCurriculumGeneration(data, setResult),
          enrichWithSummary(data, setResult),
          enrichWithFlashcards(data, setResult),
        ]);
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
        incrementStudentGenerations();
        await Promise.all([
          enrichWithCurriculumGeneration(data, setResult),
          enrichWithSummary(data, setResult),
          enrichWithFlashcards(data, setResult),
        ]);
        setStage("result");
      } catch (err) {
        setError(err?.message || "Generation failed.");
        setStage("input");
      }
    }
  };

  const startOver = () => {
    setResult(null);
    setResultTitle("");
    setUrl("");
    setPdfFile(null);
    setPdfMeta(null);
    setPdfTopic("");
    setStage("input");
    setError("");
  };

  // ---- Library save ------------------------------------------------------
  const saveToLibrary = async (payload, titleOverride) => {
    const me = user || (await quest.auth.me());
    const vid = payload?.video?.videoId;
    const url = vid
      ? `https://www.youtube.com/watch?v=${vid}`
      : (payload?.video?.url || null);
    const row = await quest.entities.GeneratedHandout.create({
      teacher_id: me.id,
      title: (titleOverride && titleOverride.trim()) || "Untitled handout",
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
      await saveToLibrary(result, resultTitle);
      toast.success("Saved to your library");
      if (user?.id) loadLibrary(user.id);
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Flashcards-only save: strips the result payload down to just the
  // flashcards array + minimal video metadata so the library entry is
  // a pure deck (no quiz / case study / attention checks come back when
  // the student re-opens it later).
  const handleSaveFlashcardsToLibrary = async () => {
    if (!result) return;
    const llmCards = Array.isArray(result.flashcards) ? result.flashcards : [];
    const quizDerived = (Array.isArray(result.quiz) ? result.quiz : []).map((q) => {
      const correctLetter = String(q.correct_choice || "A").toUpperCase();
      return {
        front: q.question,
        back: q[`choice_${correctLetter.toLowerCase()}`] || "",
      };
    });
    const cards = llmCards.length > 0 ? llmCards : quizDerived;
    if (cards.length === 0) {
      toast.error("No flashcards to save.");
      return;
    }
    setSaving(true);
    try {
      await saveToLibrary({
        video: result.video || null,
        flashcards: cards,
      });
      toast.success(`Saved ${cards.length} flashcard${cards.length === 1 ? "" : "s"} to your library`);
      if (user?.id) loadLibrary(user.id);
    } catch (err) {
      console.error("Flashcards save failed:", err);
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRunLive = async () => {
    if (!result) return;
    // A live session plays the video + mid-video attention checks, so it needs
    // a real video. PDF-only generations have no video and can only be printed.
    if (!result.video?.videoId) {
      toast.error("A live session needs a video. A PDF-only generation can only be printed as a handout.");
      return;
    }
    setSaving(true);
    try {
      // Auto-save so the live session builder can seed from a real handout id.
      const saved = await saveToLibrary(result, resultTitle);
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
    if (!row?.payload?.video?.videoId) {
      toast.error("A live session needs a video. This PDF-only handout can only be printed.");
      return;
    }
    navigate(createPageUrl("LiveSessionBuilder") + `?fromHandout=${row.id}`);
  };

  // Save edits made in the review/edit modal. For a result-stage edit we just
  // fold the draft back into local state (it's saved to the library explicitly
  // via "Save to library"). For a library item we persist immediately.
  const handleSaveEdit = async (draft) => {
    if (!editTarget) return;
    if (editTarget.source === "result") {
      setResult(draft);
      setEditTarget(null);
      toast.success("Changes applied");
      return;
    }
    setEditSaving(true);
    try {
      await quest.entities.GeneratedHandout.update(editTarget.id, {
        title: draft?.video?.title || editTarget.title || "Untitled handout",
        payload: draft,
      });
      toast.success("Handout updated");
      if (user?.id) loadLibrary(user.id);
      setEditTarget(null);
    } catch (err) {
      console.error("Update handout failed:", err);
      toast.error(err?.message || "Could not save changes");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteFromLibrary = (rowId) => {
    setConfirmDialog({
      title: "Delete handout?",
      message: "This removes it from your library. This can't be undone.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await quest.entities.GeneratedHandout.delete(rowId);
          if (user?.id) loadLibrary(user.id);
        } catch (err) {
          toast.error("Could not delete.");
        }
      },
    });
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

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    setConfirmDialog({
      title: `Delete ${n} handout${n === 1 ? "" : "s"}?`,
      message: "This can't be undone.",
      confirmLabel: "Delete",
      onConfirm: runBulkDelete,
    });
  };

  const runBulkDelete = async () => {
    const n = selectedIds.size;
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
  // Choose chrome by account type. Students get the StudentSidebar; teachers
  // (and anyone else) keep TeacherLayout. The page body is identical — only
  // the wrapper changes.
  const pageBody = (
    <>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-[#2563EB]" />
            {isStudent ? "Create" : "Generate"}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isStudent
              ? "Turn any YouTube video or PDF into a personalized study session — quiz, case study, and more."
              : "Turn a YouTube video or a PDF into a print-ready quiz, case study, and live session in 90 seconds."}
          </p>
        </div>

        {isStudent && (
          <StudentUsageBanner
            used={studentUsed}
            limit={studentLimit}
            remaining={studentRemaining}
            onUpgrade={() => setShowUpgrade(true)}
          />
        )}

        {/* Mode toggle — pick the outcome up front. Students choose
            Flashcards vs Learning Session; teachers choose Live vs Handout.
            Only shown while building (input stage) so the result/preview
            views stay uncluttered. */}
        {stage === "input" && (
          <>
            <StepHeader
              n={1}
              label="Choose what to create"
              hint={isStudent ? "Turn a video into a flashcard deck." : "Run it live, or make a handout."}
            />
            {isStudent ? null : (
          <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm flex gap-1 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode("live");
                // Live sessions need a video — if a PDF source was selected,
                // fall back to YouTube (PDF is greyed out in live mode).
                if (tab === "pdf") setTab("youtube");
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
                  Print-ready PDF + editable Word.
                </div>
              </div>
            </button>
          </div>
        )}

            <StepHeader
              n={2}
              label="Pick your source"
              hint={isStudent ? "Turn a YouTube video into a session." : "Start from a YouTube video or a PDF."}
            />
            {/* Source picker — a clean segmented control. Students only have
                YouTube today, so the toggle is hidden for them. */}
            {!isStudent && (
              <div className="inline-flex bg-slate-100 rounded-xl p-1 mb-5 gap-1">
                {[
                  { id: "youtube", label: "YouTube", icon: Youtube },
                  { id: "pdf", label: "PDF", icon: FileText },
                ].map((t) => {
                  // The chosen output drives which sources are available: a live
                  // session needs a video, so the PDF source is greyed out
                  // whenever "Live session" is selected.
                  const disabled = t.id === "pdf" && mode === "live";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={disabled}
                      title={disabled ? "Switch to Handout to use a PDF — live sessions need a video." : undefined}
                      onClick={() => {
                        if (disabled) return;
                        setTab(t.id);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        disabled
                          ? "opacity-40 cursor-not-allowed text-slate-400"
                          : tab === t.id
                          ? "bg-white text-[#2563EB] shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <t.icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {stage === "input" && (
          <div className="space-y-5">
            {/* Student-only Learning Session controls — summary toggle,
                picks what to include BEFORE choosing a source. Hidden for
                students. */}
            {!isStudent && (
              <CustomizePanel
                options={options}
                onChange={setOptions}
                mode={mode}
              />
            )}

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
                      {searchResults.map((r) => {
                        const picked = extractVideoId(url) === r.videoId;
                        return (
                        <button
                          key={r.videoId}
                          type="button"
                          onClick={() => {
                            // Select the video (don't generate yet) so the
                            // teacher can name it before hitting Generate.
                            setUrl(`https://www.youtube.com/watch?v=${r.videoId}`);
                            setError("");
                          }}
                          className={`text-left group rounded-xl border hover:shadow-md transition overflow-hidden bg-white ${
                            picked ? "border-[#2563EB] ring-2 ring-[#2563EB]/30" : "border-slate-200 hover:border-[#2563EB]"
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
                            {picked && (
                              <span className="absolute top-2 left-2 bg-[#2563EB] text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Picked
                              </span>
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
                        );
                      })}
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

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={resultTitle}
                onChange={(e) => setResultTitle(e.target.value)}
                placeholder="Name this session"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <Button
              onClick={handleGenerate}
              disabled={
                !resultTitle.trim() ||
                (tab === "youtube" && !url.trim()) ||
                (tab === "pdf" && (!pdfMeta || extracting))
              }
              className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white h-12 gap-2 text-base font-semibold rounded-xl"
            >
              Generate <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {stage === "generating" && (
          <GenerationProgress
            title="Building your handout"
            started={!!result}
            estimateSeconds={
              45 +
              (options.includeInquiry ? 30 : 0) +
              (options.includeAttentionChecks ? 18 : 0) +
              (isStudent && includeSummary ? 10 : 0) +
              (isStudent && studentMode === "flashcards" ? 12 : 0)
            }
            steps={[
              { label: "Quiz + case study", done: !!result?.quiz?.length },
              ...(options.includeAttentionChecks
                ? [{
                    label: "Attention checks",
                    done:
                      Array.isArray(result?.attention_checks) &&
                      result.attention_checks.length > 0 &&
                      !enriching.attentionChecks,
                  }]
                : []),
              ...(options.includeInquiry
                ? [{
                    label: "Inquiry hook + Socratic prompt",
                    done: !!result?.inquiry_session?.hook_question && !enriching.inquiry,
                  }]
                : []),
            ]}
          />
        )}

        {stage === "result" && result && !isStudent && (
          <div className="space-y-5">
            {/* One scrollable row — compact so the actions don't wrap onto a
                second line; on a narrow screen they scroll horizontally. */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border border-slate-200 rounded-2xl p-2 flex items-center gap-2 shadow-sm overflow-x-auto">
              <Button
                size="sm"
                onClick={handleSaveToLibrary}
                disabled={saving}
                className="gap-1.5 h-9 px-3 shrink-0 bg-[#2563EB] hover:bg-[#1D4ED8]"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save to library
              </Button>
              {result.video?.videoId && (
                <Button size="sm" onClick={handleRunLive} disabled={saving} className="gap-1.5 h-9 px-3 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <PlayCircle className="w-4 h-4" /> Use in live session
                </Button>
              )}
              <Button size="sm" onClick={handleDownloadPDF} variant="outline" className="gap-1.5 h-9 px-3 shrink-0">
                <Download className="w-4 h-4" /> PDF
              </Button>
              <Button size="sm" onClick={handleDownloadWord} variant="outline" className="gap-1.5 h-9 px-3 shrink-0">
                <FileText className="w-4 h-4" /> Word
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  setEditTarget({
                    source: "result",
                    title: resultTitle || result?.video?.title,
                    payload: result,
                  })
                }
                variant="outline"
                className="gap-1.5 h-9 px-3 shrink-0"
              >
                <Pencil className="w-4 h-4" /> Edit
              </Button>
              <Button onClick={startOver} size="sm" variant="ghost" className="h-9 px-3 shrink-0 whitespace-nowrap ml-auto">
                Generate another
              </Button>
            </div>

            <ResultPreview result={result} enriching={enriching} title={resultTitle} />
          </div>
        )}

        {stage === "result" && result && isStudent && (
          <StudentFlashcardsView
            result={result}
            saving={saving}
            onSave={handleSaveFlashcardsToLibrary}
            onStartOver={startOver}
          />
        )}

        {/* Library section — always visible (when not actively generating) */}
        {stage !== "generating" && (
          <section id="library" className={`mt-12 scroll-mt-6 ${selectMode ? "pb-28" : ""}`}>
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
                        {Array.isArray(row.payload?.flashcards) && row.payload.flashcards.length > 0
                          ? `${row.payload.flashcards.length} flashcard${row.payload.flashcards.length === 1 ? "" : "s"}`
                          : `${(row.payload?.quiz?.length || 0)} questions${row.payload?.case_study?.scenario ? " · 1 case study" : ""}`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Saved {new Date(row.created_at).toLocaleDateString()}
                      </p>
                      {!selectMode && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {!isStudent && row.payload?.video?.videoId && (
                            <Button
                              size="sm"
                              onClick={() => handleRunLiveFromLibrary(row)}
                              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs"
                            >
                              <PlayCircle className="w-3.5 h-3.5" /> Run live
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditTarget({
                                source: "library",
                                id: row.id,
                                title: row.title,
                                payload: row.payload || {},
                              })
                            }
                            className="h-8 px-3 text-xs gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" /> Review
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFromLibrary(row.id)}
                            className="h-8 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md flex items-center justify-center ml-auto"
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
    </>
  );

  return (
    <>
      {isStudent ? (
        <div className="flex h-screen bg-gray-50">
          <StudentSidebar
            activeNav="generate"
            classes={[]}
            selectedClassId={null}
            onClassChange={() => {}}
            user={user}
          />
          <div className="flex-1 overflow-auto bg-white pt-14 md:pt-0 min-w-0" style={{ fontFamily: '"Inter", sans-serif' }}>
            {pageBody}
          </div>
        </div>
      ) : (
        <TeacherLayout activeNav="generate" user={user}>
          {pageBody}
        </TeacherLayout>
      )}

      {showUpgrade && (
        <UpgradeModal
          used={studentUsed}
          limit={studentLimit}
          onCancel={() => setShowUpgrade(false)}
          onUpgrade={handleUpgrade}
          upgrading={upgrading}
        />
      )}

      {editTarget && (
        <SessionContentReview
          title={editTarget.title || editTarget.payload?.video?.title}
          payload={editTarget.payload}
          saving={editSaving}
          saveLabel={editTarget.source === "library" ? "Save changes" : "Apply changes"}
          mathEditing
          onClose={() => setEditTarget(null)}
          onSave={handleSaveEdit}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          {...confirmDialog}
          onCancel={() => setConfirmDialog(null)}
          onDone={() => setConfirmDialog(null)}
        />
      )}
    </>
  );
}

// Banner shown above the Generate page for student accounts. Tracks
// lifetime free generations against the cap. Clicking Upgrade opens the
// modal which kicks off Stripe checkout for the $9/mo student plan.
/**
 * StepHeader — a small numbered section label used to give the Generate flow
 * a clear, scannable 1-2-3 structure (matches the uppercase tag-badge vocab
 * used in the student learn-session player and curriculum review).
 */
function StepHeader({ n, label, hint }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="w-7 h-7 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center shrink-0">
        {n}
      </span>
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wider text-slate-900">
          {label}
        </div>
        {hint && <div className="text-[11.5px] text-slate-500 leading-tight">{hint}</div>}
      </div>
    </div>
  );
}

function StudentUsageBanner({ used, limit, remaining, onUpgrade }) {
  const finite = Number.isFinite(limit);
  if (!finite) return null;
  const exhausted = remaining <= 0;
  return (
    <div
      className={`mb-5 rounded-2xl border p-4 flex items-center justify-between gap-4 ${
        exhausted
          ? "border-amber-300 bg-amber-50"
          : "border-blue-200 bg-blue-50"
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {exhausted
            ? "You've used your 5 free generations"
            : `${remaining} of ${limit} free generations left`}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">
          {exhausted
            ? "Upgrade to Student Pro for unlimited generations — $9/mo, cancel anytime."
            : `Used ${used}/${limit}. Upgrade for unlimited generations.`}
        </p>
      </div>
      <Button
        onClick={onUpgrade}
        className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
      >
        Upgrade — $9/mo
      </Button>
    </div>
  );
}

// Blocking modal — shown when a free-tier student tries to generate but
// has hit the cap, OR when they click Upgrade on the usage banner.
function UpgradeModal({ used, limit, onCancel, onUpgrade, upgrading }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Upgrade to Student Pro</h2>
        <p className="text-sm text-slate-600 mb-4">
          You've used {used}/{limit} free generations. Go unlimited — generate
          as many study sessions as you want.
        </p>

        <div className="border border-slate-200 rounded-xl p-4 mb-4 bg-slate-50">
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-3xl font-bold text-slate-900">$9</span>
            <span className="text-sm text-slate-500">/ month</span>
          </div>
          <ul className="text-sm text-slate-700 space-y-1.5">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              Unlimited learning sessions from YouTube + PDFs
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              AI-graded case studies + practice quizzes
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              Cancel anytime from the billing portal
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={upgrading} className="text-slate-600">
            Not now
          </Button>
          <Button
            onClick={onUpgrade}
            disabled={upgrading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {upgrading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting checkout…
              </>
            ) : (
              "Continue to checkout"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Student-side pre-generation controls (Learning Session mode only)
// =========================================================================

// Summary / attention-checks toggles + scheduled date + reviews toggle.
// Sits above the source picker on the Generate page when a student is
// in Learning Session mode.
function StudentSessionControls({
  includeSummary,
  setIncludeSummary,
  includeAttention,
  setIncludeAttention,
  scheduledFor,
  setScheduledFor,
  reviewsEnabled,
  setReviewsEnabled,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="text-sm font-semibold text-slate-900">Customize this session</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <ToggleRow
          on={includeSummary}
          onChange={setIncludeSummary}
          title="Pre-watch summary"
          desc="A 5-bullet preview of the key ideas before you watch."
        />
        <ToggleRow
          on={includeAttention}
          onChange={setIncludeAttention}
          title="Attention checks"
          desc="Pop-up MCQs mid-video. You can still skip them."
        />
      </div>
      <div className="border-t border-slate-100 pt-4 grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold tracking-wider uppercase text-slate-500 mb-1.5">
            Show on Learning Hub on
          </label>
          <input
            type="date"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
        <ToggleRow
          on={reviewsEnabled}
          onChange={setReviewsEnabled}
          title="Spaced-repetition reviews"
          desc="After you complete this, reviews appear at +1, 3, 7, 14, 30 days."
        />
      </div>
    </div>
  );
}

function ToggleRow({ on, onChange, title, desc }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`text-left p-3 rounded-xl border-2 transition-colors ${
        on
          ? "border-blue-500 bg-blue-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">{desc}</div>
        </div>
        <div
          className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
            on ? "bg-blue-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
              on ? "left-[18px]" : "left-0.5"
            }`}
          />
        </div>
      </div>
    </button>
  );
}

// =========================================================================
// Student-side post-generation views
// =========================================================================

// Flippable flashcard deck. Source of truth is result.flashcards
// (LLM-generated, variable count) when present; falls back to quiz-
// derived cards while the flashcards enrichment is still in flight.
// Click to flip; arrows to step through. Save button persists ONLY
// the flashcards (not the full bundle payload) so the library entry
// is a pure deck.
function StudentFlashcardsView({ result, saving, onSave, onStartOver }) {
  const cards = React.useMemo(() => {
    const llm = Array.isArray(result?.flashcards) ? result.flashcards : [];
    if (llm.length > 0) {
      return llm.map((c, i) => ({
        index: i,
        front: c.front,
        back: c.back,
        explanation: null,
      }));
    }
    const quiz = Array.isArray(result?.quiz) ? result.quiz : [];
    return quiz.map((q, i) => {
      const correctLetter = String(q.correct_choice || "A").toUpperCase();
      const correctText = q[`choice_${correctLetter.toLowerCase()}`] || "";
      return {
        index: i,
        front: q.question,
        back: correctText,
        explanation: q.explanation || null,
      };
    });
  }, [result]);

  const usingLlmCards = Array.isArray(result?.flashcards) && result.flashcards.length > 0;

  const [idx, setIdx] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);

  React.useEffect(() => {
    setFlipped(false);
  }, [idx]);

  if (cards.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <p className="text-slate-600">No flashcards available for this video yet.</p>
        <Button onClick={onStartOver} variant="outline" className="mt-4">
          Generate another
        </Button>
      </div>
    );
  }

  const card = cards[idx];
  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(cards.length - 1, i + 1));

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border border-slate-200 rounded-2xl p-3 flex flex-wrap gap-2 shadow-sm">
        <Button
          onClick={onSave}
          disabled={saving}
          className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8]"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save to library
        </Button>
        <Button onClick={onStartOver} variant="ghost" className="ml-auto">
          Generate another
        </Button>
      </div>

      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Card {idx + 1} of {cards.length}
        </div>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className={`w-full min-h-[280px] sm:min-h-[340px] rounded-3xl border-2 shadow-md p-8 sm:p-12 flex items-center justify-center text-center transition-colors ${
            flipped
              ? "border-emerald-300 bg-emerald-50"
              : "border-slate-200 bg-white hover:border-blue-300"
          }`}
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-3 ${flipped ? 'text-emerald-700' : 'text-slate-400'}">
              {flipped ? "Answer" : "Question"}
            </div>
            <p className={`text-xl sm:text-2xl font-semibold leading-snug ${flipped ? "text-emerald-900" : "text-slate-900"}`}>
              {flipped ? card.back : card.front}
            </p>
            {flipped && card.explanation && (
              <p className="text-sm text-slate-700 mt-4 leading-relaxed italic">
                {card.explanation}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-6">Click card to flip</p>
          </div>
        </button>

        <div className="flex items-center justify-center gap-3 mt-5">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={idx === 0}
            className="gap-1"
          >
            ← Previous
          </Button>
          <div className="flex items-center gap-1.5 px-2">
            {cards.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-blue-600" : i < idx ? "w-3 bg-blue-300" : "w-3 bg-slate-200"}`}
              />
            ))}
          </div>
          <Button
            variant="outline"
            onClick={goNext}
            disabled={idx === cards.length - 1}
            className="gap-1"
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}

// Read-only preview shown on the result/download screen. Each section is a
// collapsed accordion, in play order: inquiry → attention checks → quiz →
// case study.
function ResultPreview({ result, enriching = { inquiry: false, attentionChecks: false }, title = "" }) {
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
          {title || video?.title}
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
        <details className="p-6 border-b border-slate-100">
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
                {inquiry_session.hook_image_prompt ? "Image generating…" : "No hook image"}
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                {inquiry_session.hook_question}
              </h3>
              <p className="text-sm text-slate-600 italic leading-relaxed">
                Panda's opening:&nbsp;
                <span className="not-italic">{inquiry_session.tutor_first_message}</span>
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
              <li key={i} className="border border-slate-200 rounded-xl p-4 bg-amber-50/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-amber-700">
                    At {fmtTime(ac.timestamp)}
                  </span>
                  <span className="text-[11px] text-slate-500">Correct: {ac.correct_choice}</span>
                </div>
                <p className="font-medium text-slate-900 mb-2">{ac.question}</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {["a", "b", "c", "d"].map((l) => (
                    <li key={l} className="flex gap-2">
                      <span className="font-semibold w-5">{l.toUpperCase()}</span>
                      <span>{ac[`choice_${l}`]}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      )}

      {quiz?.length > 0 && (
        <details className="p-6 border-b border-slate-100">
          <summary className="cursor-pointer text-lg font-semibold text-slate-900">
            Quiz · {quiz.length} questions
          </summary>
          <ol className="space-y-4 mt-4">
            {quiz.map((q, i) => (
              <li key={i} className="border border-slate-200 rounded-xl p-4">
                <p className="font-medium text-slate-900 mb-3">
                  {i + 1}. {q.question}
                </p>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {["a", "b", "c", "d"].map((letter) => {
                    const isCorrect = revealed[i] && q.correct_choice === letter.toUpperCase();
                    return (
                      <li
                        key={letter}
                        className={`flex items-start gap-2 px-2 py-1 rounded ${
                          isCorrect ? "bg-emerald-50 text-emerald-900" : ""
                        }`}
                      >
                        <span className="font-semibold w-5 shrink-0">{letter.toUpperCase()}</span>
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
                  onClick={() => setRevealed((prev) => ({ ...prev, [i]: !prev[i] }))}
                  className="mt-3 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  {revealed[i] ? "Hide answer" : "Show answer"}
                </button>
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
          <p className="text-slate-700 leading-relaxed mt-3 mb-4">{case_study.scenario}</p>
          {case_study.discussion_questions?.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Discussion Questions</h4>
              <ol className="list-decimal space-y-4 text-slate-700 pl-5">
                {case_study.discussion_questions.map((q, i) => (
                  <li key={i}>
                    <span>{dqText(q)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </details>
      )}
    </div>
  );
}

// In-page confirm dialog used for library deletes (replaces window.confirm so
// the prompt lives inside the app, not the browser chrome).
function ConfirmDialog({ title, message, confirmLabel = "Confirm", onConfirm, onCancel, onDone }) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
      onDone?.();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {message && <p className="text-sm text-slate-600 mt-1">{message}</p>}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 border-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
