/**
 * LiveSessionBuilder — teacher creates a new live session and CHOOSES which
 * phases to include. Each phase is optional. The teacher can seed from a
 * saved /Generate handout, then toggle parts on/off and tweak content.
 *
 * On Create:
 *   - inserts a live_sessions row with session_code / join_code, the included
 *     content (jsonb columns), status='waiting', current_phase='lobby'
 *   - navigates to /LiveSessionHost?sessionId=...
 *
 * Optional URL param `?fromHandout=<id>` pre-fills the builder from a saved
 * GeneratedHandout payload — used by the Generate page's "Use in live session"
 * action so teachers don't re-enter content.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { quest } from "@/api/questClient";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TeacherLayout from "../components/teacher/TeacherLayout";
import {
  Sparkles,
  PlayCircle,
  FileText,
  MessageCircle,
  Eye,
  Loader2,
  ArrowLeft,
  Rocket,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "sonner";

const PHASES = [
  {
    key: "inquiry",
    label: "Inquiry hook",
    desc: "Curiosity question + image to prime thinking before the lesson.",
    Icon: Sparkles,
  },
  {
    key: "video",
    label: "Video",
    desc: "YouTube video with optional attention checks that pause playback.",
    Icon: PlayCircle,
  },
  {
    key: "quiz",
    label: "Quiz",
    desc: "Multiple-choice questions. Each correct answer = points on the leaderboard.",
    Icon: FileText,
  },
  {
    key: "case_study",
    label: "Case study",
    desc: "A scenario with discussion prompts. Read-and-discuss, no auto-grading.",
    Icon: MessageCircle,
  },
];

function mintCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function LiveSessionBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromHandoutId = searchParams.get("fromHandout");

  const [teacher, setTeacher] = useState(null);
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Builder state
  const [sessionName, setSessionName] = useState("");
  const [topic, setTopic] = useState("");
  const [includes, setIncludes] = useState({
    inquiry: false,
    video: false,
    quiz: true,
    case_study: false,
  });
  const [selectedHandoutId, setSelectedHandoutId] = useState("");

  // Content (per phase)
  const [inquiry, setInquiry] = useState({
    hook_question: "",
    hook_image_url: "",
    tutor_first_message: "",
    socratic_system_prompt: "",
  });
  const [videoUrl, setVideoUrl] = useState("");
  const [videoDuration, setVideoDuration] = useState(0);
  const [attentionChecks, setAttentionChecks] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [caseStudy, setCaseStudy] = useState({
    scenario: "",
    discussion_questions: [],
  });

  useEffect(() => {
    (async () => {
      try {
        const me = await quest.auth.me();
        setTeacher(me);
        const rows = await quest.entities.GeneratedHandout
          ?.filter?.({ teacher_id: me.id }, "-created_at", 50)
          .catch(() => []);
        setLibrary(rows || []);

        if (fromHandoutId) {
          const match = (rows || []).find((r) => r.id === fromHandoutId);
          if (match) {
            applyHandout(match);
          }
        }
      } catch (err) {
        console.error("Builder load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromHandoutId]);

  const applyHandout = (row) => {
    const p = row?.payload || {};
    setSelectedHandoutId(row.id);
    if (!sessionName) setSessionName(row.title || p?.video?.title || "");
    if (!topic) setTopic(p?.video?.title || row.title || "");

    if (p.inquiry_session?.hook_question) {
      setInquiry({
        hook_question: p.inquiry_session.hook_question || "",
        hook_image_url: p.inquiry_session.hook_image_url || "",
        tutor_first_message: p.inquiry_session.tutor_first_message || "",
        socratic_system_prompt: p.inquiry_session.socratic_system_prompt || "",
      });
    }
    if (p.video?.videoId) {
      setVideoUrl(`https://www.youtube.com/watch?v=${p.video.videoId}`);
      setVideoDuration(p.video?.duration || 0);
    } else if (p.video?.url) {
      setVideoUrl(p.video.url);
      setVideoDuration(p.video?.duration || 0);
    }
    if (Array.isArray(p.attention_checks)) setAttentionChecks(p.attention_checks);
    if (Array.isArray(p.quiz)) setQuestions(p.quiz);
    if (p.case_study?.scenario) setCaseStudy(p.case_study);

    setIncludes({
      inquiry: !!p.inquiry_session?.hook_question,
      video: !!(p.video?.videoId || p.video?.url),
      quiz: Array.isArray(p.quiz) && p.quiz.length > 0,
      case_study: !!p.case_study?.scenario,
    });
  };

  const toggleIncluded = (key) => {
    setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const canCreate = () => {
    if (!sessionName.trim()) return false;
    const anyPhase = Object.values(includes).some(Boolean);
    if (!anyPhase) return false;
    if (includes.video && !extractYouTubeId(videoUrl)) return false;
    if (includes.quiz && questions.length === 0) return false;
    if (includes.inquiry && !inquiry.hook_question.trim()) return false;
    if (includes.case_study && !caseStudy.scenario.trim()) return false;
    return true;
  };

  const handleCreate = async () => {
    if (!canCreate()) {
      toast.error("Fill in the included phases before launching.");
      return;
    }
    setCreating(true);
    try {
      const code = mintCode();
      const videoId = extractYouTubeId(videoUrl);
      const payload = {
        teacher_id: teacher.id,
        class_id: null,
        title: sessionName,
        session_name: sessionName,
        subunit_name: topic || sessionName,
        session_code: code,
        join_code: code,
        status: "waiting",
        current_phase: "lobby",
        // current_question lives on live_session_participants (per-student
        // progress), not on live_sessions itself — PostgREST rejects it here.
        questions: includes.quiz ? questions : [],
        question_count: includes.quiz ? questions.length : 0,
        case_study: includes.case_study ? caseStudy : null,
        attention_checks: includes.video ? attentionChecks : [],
        inquiry_session: includes.inquiry ? inquiry : null,
        video_url: includes.video && videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
        video_duration: includes.video ? Number(videoDuration) || 0 : 0,
        created_by_id: teacher.id,
        created_by: teacher.email,
      };
      const session = await quest.entities.LiveSession.create(payload);
      toast.success(`Live session ready — code ${code}`);
      navigate(createPageUrl("LiveSessionHost") + `?sessionId=${session.id}`);
    } catch (err) {
      console.error("Create live session failed:", err);
      toast.error("Could not create the live session.");
    } finally {
      setCreating(false);
    }
  };

  const handleSignOut = () => quest.auth.logout();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <TeacherLayout activeNav="generate" user={teacher} onSignOut={handleSignOut}>
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => navigate(createPageUrl("Generate"))}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Generate
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Build a live session</h1>
          <p className="text-slate-500 mt-1">
            Pick which parts to include. Students join with a code — every correct answer earns points on the leaderboard.
          </p>
        </div>

        <Card className="mb-5 border border-slate-200">
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Session name
              </label>
              <Input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g. Friday warm-up — Newton's laws"
                className="text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Topic
              </label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Newton's first law of motion"
                className="text-base"
              />
            </div>

            {library.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Start from a saved handout (optional)
                </label>
                <select
                  value={selectedHandoutId}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) {
                      setSelectedHandoutId("");
                      return;
                    }
                    const row = library.find((r) => r.id === id);
                    if (row) applyHandout(row);
                  }}
                  className="w-full border-2 border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Start from scratch —</option>
                  {library.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.title || "Untitled handout"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        <h2 className="text-lg font-bold text-slate-900 mb-2">What's in this session?</h2>
        <p className="text-sm text-slate-500 mb-4">
          Toggle the parts you want. Students will see them in this order: inquiry → video → quiz → case study.
        </p>

        <div className="space-y-4 mb-6">
          {PHASES.map((phase) => {
            const on = includes[phase.key];
            return (
              <Card
                key={phase.key}
                className={`border-2 transition-colors ${
                  on ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200"
                }`}
              >
                <CardContent className="p-5">
                  <button
                    type="button"
                    onClick={() => toggleIncluded(phase.key)}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    {on ? (
                      <CheckCircle2 className="w-6 h-6 text-indigo-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-300 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <phase.Icon className="w-4 h-4 text-slate-600" />
                        <span className="font-bold text-slate-900">{phase.label}</span>
                        {on && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            Included
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{phase.desc}</p>
                    </div>
                  </button>

                  {on && phase.key === "inquiry" && (
                    <div className="mt-4 pl-9 space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Hook question
                        </label>
                        <Input
                          value={inquiry.hook_question}
                          onChange={(e) => setInquiry({ ...inquiry, hook_question: e.target.value })}
                          placeholder="A curiosity question students can guess at"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Hook image URL (optional)
                        </label>
                        <Input
                          value={inquiry.hook_image_url}
                          onChange={(e) => setInquiry({ ...inquiry, hook_image_url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Tutor's first message (optional)
                        </label>
                        <Textarea
                          rows={2}
                          value={inquiry.tutor_first_message}
                          onChange={(e) => setInquiry({ ...inquiry, tutor_first_message: e.target.value })}
                          placeholder="Welcome! Let's think about this together..."
                        />
                      </div>
                    </div>
                  )}

                  {on && phase.key === "video" && (
                    <div className="mt-4 pl-9 space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          YouTube video URL
                        </label>
                        <Input
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                        {videoUrl && !extractYouTubeId(videoUrl) && (
                          <p className="text-xs text-red-600 mt-1">That doesn't look like a valid YouTube link.</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Video duration (seconds, optional)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={videoDuration}
                          onChange={(e) => setVideoDuration(e.target.value)}
                          placeholder="e.g. 360"
                        />
                      </div>
                      <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {attentionChecks.length} attention check{attentionChecks.length === 1 ? "" : "s"} carried over from the handout. Generate more in /Generate to add them.
                      </p>
                    </div>
                  )}

                  {on && phase.key === "quiz" && (
                    <div className="mt-4 pl-9">
                      <p className="text-sm text-slate-600">
                        <strong>{questions.length}</strong> multiple-choice question
                        {questions.length === 1 ? "" : "s"} ready.
                        {questions.length === 0 && (
                          <span className="text-amber-700">
                            {" "}
                            Seed from a saved handout above, or open /Generate to make a quiz.
                          </span>
                        )}
                      </p>
                      {questions.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer">Preview questions</summary>
                          <ol className="mt-2 list-decimal list-inside space-y-1 text-sm text-slate-700">
                            {questions.slice(0, 10).map((q, i) => (
                              <li key={i} className="truncate">{q.question}</li>
                            ))}
                            {questions.length > 10 && (
                              <li className="text-slate-400">… and {questions.length - 10} more</li>
                            )}
                          </ol>
                        </details>
                      )}
                    </div>
                  )}

                  {on && phase.key === "case_study" && (
                    <div className="mt-4 pl-9 space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Scenario
                        </label>
                        <Textarea
                          rows={4}
                          value={caseStudy.scenario}
                          onChange={(e) => setCaseStudy({ ...caseStudy, scenario: e.target.value })}
                          placeholder="A realistic scenario students reason through..."
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Discussion prompts (one per line, optional)
                        </label>
                        <Textarea
                          rows={3}
                          value={(caseStudy.discussion_questions || []).join("\n")}
                          onChange={(e) =>
                            setCaseStudy({
                              ...caseStudy,
                              discussion_questions: e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder={"What might explain X?\nWhat would happen if Y?"}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="sticky bottom-4">
          <Card className="border-2 border-emerald-300 shadow-lg">
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm text-slate-500">
                  {Object.values(includes).filter(Boolean).length} phase
                  {Object.values(includes).filter(Boolean).length === 1 ? "" : "s"} included
                </p>
                <p className="font-bold text-slate-900">{sessionName || "Untitled live session"}</p>
              </div>
              <Button
                onClick={() => {
                  if (!canCreate()) {
                    toast.error("Fill in the included phases before launching.");
                    return;
                  }
                  setReviewOpen(true);
                }}
                disabled={creating || !canCreate()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-6 gap-2"
              >
                <Eye className="w-5 h-5" />
                Review &amp; launch
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {reviewOpen && (
        <ReviewOverlay
          sessionName={sessionName}
          topic={topic}
          includes={includes}
          inquiry={inquiry}
          videoUrl={videoUrl}
          videoId={extractYouTubeId(videoUrl)}
          attentionChecks={attentionChecks}
          questions={questions}
          caseStudy={caseStudy}
          creating={creating}
          onClose={() => setReviewOpen(false)}
          onLaunch={handleCreate}
        />
      )}
    </TeacherLayout>
  );
}

// Curriculum-style "review of created items" — a final read-through of exactly
// what students will get, in the order they'll see it, before the session goes
// live. Mirrors the curriculum content-review layout.
function ReviewOverlay({
  sessionName, topic, includes, inquiry, videoUrl, videoId, attentionChecks,
  questions, caseStudy, creating, onClose, onLaunch,
}) {
  const items = [];
  if (includes.inquiry) items.push("inquiry");
  if (includes.video) items.push("video");
  if (includes.quiz) items.push("quiz");
  if (includes.case_study) items.push("case_study");

  const SectionCard = ({ icon: Icon, color, label, step, children }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Step {step}
          </div>
          <div className="font-bold text-slate-900 leading-tight">{label}</div>
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="bg-slate-50 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 my-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-200 rounded-t-3xl px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Review your live session</h2>
            <p className="text-xs text-slate-500">
              {sessionName || "Untitled"} · {items.length} step{items.length === 1 ? "" : "s"} · what students will see, in order
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 text-sm font-semibold">
            Edit
          </button>
        </div>

        <div className="p-6 space-y-4">
          {items.length === 0 && (
            <p className="text-center text-slate-500 py-8">No phases included yet.</p>
          )}

          {includes.inquiry && (
            <SectionCard icon={Sparkles} color="bg-indigo-100 text-indigo-600" label="Inquiry hook" step={items.indexOf("inquiry") + 1}>
              {inquiry.hook_image_url && (
                <img src={inquiry.hook_image_url} alt="" className="w-full rounded-xl border border-slate-200 mb-3" />
              )}
              <p className="text-slate-800 font-medium">{inquiry.hook_question || "—"}</p>
            </SectionCard>
          )}

          {includes.video && (
            <SectionCard icon={PlayCircle} color="bg-blue-100 text-blue-600" label="Video" step={items.indexOf("video") + 1}>
              {videoId && (
                <div className="aspect-video rounded-xl overflow-hidden border border-slate-200 mb-3 bg-black">
                  <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <p className="text-sm text-slate-600 inline-flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                {attentionChecks.length} attention check{attentionChecks.length === 1 ? "" : "s"} during playback
              </p>
            </SectionCard>
          )}

          {includes.quiz && (
            <SectionCard icon={FileText} color="bg-violet-100 text-violet-600" label={`Quiz · ${questions.length} question${questions.length === 1 ? "" : "s"}`} step={items.indexOf("quiz") + 1}>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700">
                {questions.slice(0, 10).map((q, i) => (
                  <li key={i}>{q.question || q.question_text}</li>
                ))}
                {questions.length > 10 && (
                  <li className="list-none text-slate-400">… and {questions.length - 10} more</li>
                )}
              </ol>
            </SectionCard>
          )}

          {includes.case_study && (
            <SectionCard icon={MessageCircle} color="bg-amber-100 text-amber-700" label="Case study" step={items.indexOf("case_study") + 1}>
              <p className="text-sm text-slate-800 whitespace-pre-line mb-3">{caseStudy.scenario}</p>
              {Array.isArray(caseStudy.discussion_questions) && caseStudy.discussion_questions.length > 0 && (
                <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
                  {caseStudy.discussion_questions.map((q, i) => (<li key={i}>{q}</li>))}
                </ol>
              )}
            </SectionCard>
          )}
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 rounded-b-3xl px-6 py-4 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={onClose} disabled={creating} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Keep editing
          </Button>
          <Button onClick={onLaunch} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-6 gap-2">
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
            Create &amp; launch lobby
          </Button>
        </div>
      </div>
    </div>
  );
}
