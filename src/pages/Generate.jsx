/**
 * Generate — top-level teacher dashboard surface for content generation.
 * Tabs: YouTube, PDF. Same AI pipeline. Result page lets the teacher save
 * the output to a class/subunit, download as PDF/Word, or start a live
 * session pre-populated with the new quiz.
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import CustomizePanel, { DEFAULT_OPTIONS } from "@/components/try/CustomizePanel";
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
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("youtube"); // youtube | pdf
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

  // Save-to-subunit modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [curricula, setCurricula] = useState([]);
  const [classes, setClasses] = useState([]);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);
  const [savePicker, setSavePicker] = useState({
    classId: "",
    unitId: "",
    subunitId: "",
    newSubunitName: "",
    mode: "existing", // existing | new
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await quest.auth.me();
        setUser(me);
        const [cur, cls] = await Promise.all([
          quest.entities.Curriculum.filter({ teacher_id: me.id }),
          quest.entities.Class.filter({ teacher_id: me.id }),
        ]);
        setCurricula(cur || []);
        setClasses(cls || []);
      } catch (err) {
        console.error("Failed to load teacher context:", err);
      }
    })();
  }, []);

  // Load units when a class is picked
  useEffect(() => {
    if (!savePicker.classId) {
      setUnits([]);
      setSubunits([]);
      return;
    }
    const cls = classes.find((c) => c.id === savePicker.classId);
    if (!cls) return;
    quest.entities.Unit.filter({ curriculum_id: cls.curriculum_id })
      .then((u) => setUnits(u || []))
      .catch(() => setUnits([]));
  }, [savePicker.classId, classes]);

  useEffect(() => {
    if (!savePicker.unitId) {
      setSubunits([]);
      return;
    }
    quest.entities.Subunit.filter({ unit_id: savePicker.unitId })
      .then((s) => setSubunits(s || []))
      .catch(() => setSubunits([]));
  }, [savePicker.unitId]);

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

  // ---- Save flow ---------------------------------------------------------
  const persistGeneratedQuiz = async (targetSubunitId) => {
    if (!result || !targetSubunitId) return null;

    const me = user || (await quest.auth.me());
    const quiz = await quest.entities.Quiz.create({
      subunit_id: targetSubunitId,
      quiz_type: "new_topic",
      created_by_id: me.id,
      created_by: me.email,
    });

    const LETTER_TO_NUM = { A: 1, B: 2, C: 3, D: 4 };
    for (let i = 0; i < result.quiz.length; i++) {
      const q = result.quiz[i];
      await quest.entities.Question.create({
        quiz_id: quiz.id,
        question_text: q.question,
        choice_1: q.choice_a,
        choice_2: q.choice_b,
        choice_3: q.choice_c,
        choice_4: q.choice_d,
        correct_choice:
          LETTER_TO_NUM[String(q.correct_choice || "").toUpperCase()] || 1,
        question_order: i,
        difficulty: options.difficulty || "medium",
        created_by_id: me.id,
        created_by: me.email,
      });
    }

    if (result.case_study?.scenario) {
      const cs = result.case_study;
      const prompts = cs.discussion_questions || [];
      await quest.entities.CaseStudy.create({
        subunit_id: targetSubunitId,
        scenario: cs.scenario,
        question_a: prompts[0] || null,
        question_b: prompts[1] || null,
        question_c: prompts[2] || null,
        question_d: prompts[3] || null,
        created_by_id: me.id,
        created_by: me.email,
      });
    }

    return quiz.id;
  };

  const handleSave = async () => {
    if (!savePicker.classId) {
      toast.error("Pick a class first.");
      return;
    }
    if (savePicker.mode === "existing" && !savePicker.subunitId) {
      toast.error("Pick a subunit.");
      return;
    }
    if (savePicker.mode === "new" && !savePicker.newSubunitName.trim()) {
      toast.error("Give your new subunit a name.");
      return;
    }

    setSaving(true);
    try {
      const cls = classes.find((c) => c.id === savePicker.classId);
      let targetSubunitId = savePicker.subunitId;

      if (savePicker.mode === "new") {
        let unitId = savePicker.unitId;
        if (!unitId) {
          // Auto-create a unit if the user picked none.
          const me = user || (await quest.auth.me());
          const newUnit = await quest.entities.Unit.create({
            curriculum_id: cls.curriculum_id,
            unit_name: "Generated content",
            unit_order: (units?.length || 0) + 1,
            created_by_id: me.id,
            created_by: me.email,
          });
          unitId = newUnit.id;
        }
        const me2 = user || (await quest.auth.me());
        const newSubunit = await quest.entities.Subunit.create({
          unit_id: unitId,
          subunit_name: savePicker.newSubunitName.trim(),
          subunit_order: (subunits?.length || 0) + 1,
          created_by_id: me2.id,
          created_by: me2.email,
        });
        targetSubunitId = newSubunit.id;
      }

      const quizId = await persistGeneratedQuiz(targetSubunitId);
      toast.success("Saved to your library");
      setSaveModalOpen(false);
      return { quizId, subunitId: targetSubunitId, classId: savePicker.classId };
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err?.message || "Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndOpen = async () => {
    const saved = await handleSave();
    if (saved?.subunitId) {
      navigate(
        createPageUrl("ManageCurriculum") +
          `?curriculum_id=${
            classes.find((c) => c.id === saved.classId)?.curriculum_id || ""
          }`
      );
    }
  };

  const handleRunLive = async () => {
    if (!savePicker.classId) {
      setSaveModalOpen(true);
      toast.info("Pick a class to save the quiz first; live session opens after.");
      return;
    }
    const saved = await handleSave();
    if (saved?.classId) {
      navigate(
        createPageUrl("CreateLiveSession") +
          `?class_id=${saved.classId}&quiz_id=${saved.quizId}`
      );
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

            <CustomizePanel options={options} onChange={setOptions} />

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
          <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm text-center">
            <Loader2 className="w-10 h-10 text-[#2563EB] mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-bold text-slate-900">
              Generating your handout
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Watching the source… extracting key concepts… writing questions…
              designing case study… (~60 seconds)
            </p>
          </div>
        )}

        {stage === "result" && result && (
          <div className="space-y-5">
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border border-slate-200 rounded-2xl p-3 flex flex-wrap gap-2 shadow-sm">
              <Button onClick={() => setSaveModalOpen(true)} className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8]">
                <Save className="w-4 h-4" /> Save to class
              </Button>
              <Button onClick={handleSaveAndOpen} variant="outline" className="gap-2">
                <Library className="w-4 h-4" /> Save &amp; open in curriculum
              </Button>
              <Button onClick={handleRunLive} variant="outline" className="gap-2">
                <PlayCircle className="w-4 h-4" /> Run as live session
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

            <ResultPreview result={result} />
          </div>
        )}
      </div>

      {/* Save modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Save to your library</h3>

            <label className="block text-xs font-semibold tracking-wider uppercase text-slate-500 mb-1.5">
              Class
            </label>
            <Select
              value={savePicker.classId}
              onValueChange={(v) =>
                setSavePicker((p) => ({
                  ...p,
                  classId: v,
                  unitId: "",
                  subunitId: "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.class_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {savePicker.classId && (
              <>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setSavePicker((p) => ({ ...p, mode: "existing" }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold ${
                      savePicker.mode === "existing"
                        ? "bg-[#2563EB] text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Existing subunit
                  </button>
                  <button
                    onClick={() => setSavePicker((p) => ({ ...p, mode: "new" }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold ${
                      savePicker.mode === "new"
                        ? "bg-[#2563EB] text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    New subunit
                  </button>
                </div>

                <label className="block text-xs font-semibold tracking-wider uppercase text-slate-500 mt-3 mb-1.5">
                  Unit
                </label>
                <Select
                  value={savePicker.unitId}
                  onValueChange={(v) =>
                    setSavePicker((p) => ({ ...p, unitId: v, subunitId: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a unit (optional for new)" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.unit_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {savePicker.mode === "existing" ? (
                  <>
                    <label className="block text-xs font-semibold tracking-wider uppercase text-slate-500 mt-3 mb-1.5">
                      Subunit
                    </label>
                    <Select
                      value={savePicker.subunitId}
                      onValueChange={(v) =>
                        setSavePicker((p) => ({ ...p, subunitId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a subunit" />
                      </SelectTrigger>
                      <SelectContent>
                        {subunits.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.subunit_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-semibold tracking-wider uppercase text-slate-500 mt-3 mb-1.5">
                      New subunit name
                    </label>
                    <Input
                      value={savePicker.newSubunitName}
                      onChange={(e) =>
                        setSavePicker((p) => ({
                          ...p,
                          newSubunitName: e.target.value,
                        }))
                      }
                      placeholder="e.g. Photosynthesis basics"
                    />
                  </>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setSaveModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#2563EB] hover:bg-[#1D4ED8]">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}

function ResultPreview({ result }) {
  const { video, quiz, case_study } = result;
  const [revealed, setRevealed] = useState({});
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
