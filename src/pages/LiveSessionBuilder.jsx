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
 * The builder is always opened from the Generate page via `?fromHandout=<id>`,
 * which seeds the phase content from that saved GeneratedHandout payload. The
 * teacher just names the session and picks which phases to include.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { quest } from "@/api/questClient";
import { createPageUrl, extractYouTubeId } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  X,
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

// Whether a chosen phase actually has content to show students. Used only to
// surface a readiness hint / count chip — content itself is edited on the
// /Generate handout side, not here, so the builder stays a pure picker.
function phaseReadiness(key, ctx) {
  switch (key) {
    case "inquiry": {
      const ready = !!ctx.inquiry?.hook_question?.trim();
      return {
        ready,
        summary: "Hook ready",
        hint: "This handout doesn't include an inquiry hook.",
      };
    }
    case "video": {
      const ready = !!ctx.videoId;
      const n = ctx.attentionChecks?.length || 0;
      return {
        ready,
        summary: n > 0 ? `Video · ${n} check${n === 1 ? "" : "s"}` : "Video ready",
        hint: "This handout doesn't include a video.",
      };
    }
    case "quiz": {
      const n = ctx.questions?.length || 0;
      return {
        ready: n > 0,
        summary: `${n} question${n === 1 ? "" : "s"}`,
        hint: "This handout doesn't include a quiz.",
      };
    }
    case "case_study": {
      const ready = !!ctx.caseStudy?.scenario?.trim();
      return {
        ready,
        summary: "Case study ready",
        hint: "This handout doesn't include a case study.",
      };
    }
    default:
      return { ready: false, summary: "", hint: "" };
  }
}

export default function LiveSessionBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromHandoutId = searchParams.get("fromHandout");

  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Builder state
  const [topic, setTopic] = useState("");
  const [includes, setIncludes] = useState({
    inquiry: false,
    video: false,
    quiz: true,
    case_study: false,
  });

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

        if (fromHandoutId) {
          const rows = await quest.entities.GeneratedHandout
            ?.filter?.({ teacher_id: me.id }, "-created_at", 50)
            .catch(() => []);
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
    // A live session plays the video + attention checks, so a video is required.
    // PDF-only handouts (no video) can't seed a live session.
    if (!p.video?.videoId && !p.video?.url) {
      toast.error("This handout has no video, so it can't become a live session. Live sessions need a video.");
      return;
    }

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
    if (!topic.trim()) return false;
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
        title: topic,
        session_name: topic,
        subunit_name: topic,
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
          <CardContent className="p-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Title
              </label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Newton's first law of motion"
                className="text-base"
              />
            </div>
          </CardContent>
        </Card>

        <h2 className="text-lg font-bold text-slate-900 mb-2">What's in this session?</h2>
        <p className="text-sm text-slate-500 mb-4">
          Pick the parts to include. Students will see them in this order: inquiry → video → quiz → case study. You'll review exactly what they see in the next step.
        </p>

        <div className="space-y-3 mb-6">
          {PHASES.map((phase) => {
            const on = includes[phase.key];
            const readiness = phaseReadiness(phase.key, {
              inquiry,
              videoUrl,
              videoId: extractYouTubeId(videoUrl),
              attentionChecks,
              questions,
              caseStudy,
            });
            return (
              <Card
                key={phase.key}
                className={`border-2 transition-colors ${
                  on ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200"
                }`}
              >
                <CardContent className="p-4">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <phase.Icon className="w-4 h-4 text-slate-600" />
                        <span className="font-bold text-slate-900">{phase.label}</span>
                        {on && readiness.ready && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            {readiness.summary}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{phase.desc}</p>
                      {on && !readiness.ready && (
                        <p className="text-xs text-amber-700 mt-1.5 font-medium">
                          {readiness.hint}
                        </p>
                      )}
                    </div>
                  </button>
                </CardContent>
              </Card>
            );
          })}
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
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 gap-2"
        >
          <Eye className="w-5 h-5" />
          Review &amp; launch
        </Button>
      </div>

      {reviewOpen && (
        <ReviewOverlay
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
  topic, includes, inquiry, videoUrl, videoId, attentionChecks,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
        <div
          className="sticky top-0 z-10 text-white p-6"
          style={{ background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Review your live session</h2>
              <p className="text-blue-100 text-sm mt-0.5">
                {topic || "Untitled"} · {items.length} step{items.length === 1 ? "" : "s"} · what students will see, in order
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
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

          {/* Actions scroll with the content (matches the curriculum review),
              so there's no stationary bar fighting the page as you scroll. */}
          <div className="flex gap-4 pt-2">
            <Button variant="outline" onClick={onClose} disabled={creating} className="flex-1 border-2 gap-2">
              <ArrowLeft className="w-4 h-4" /> Keep editing
            </Button>
            <Button onClick={onLaunch} disabled={creating} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-base font-semibold gap-2">
              {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
              Create &amp; launch lobby
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
