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
import { SessionContentReview } from "../components/teacher/SessionContentReview";
import {
  Sparkles,
  PlayCircle,
  FileText,
  MessageCircle,
  Eye,
  Loader2,
  ArrowLeft,
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

  // `draft` is the (possibly edited) payload handed back by the shared review
  // editor; fall back to builder state for anything it didn't carry.
  const handleCreate = async (draft) => {
    if (!canCreate()) {
      toast.error("Fill in the included phases before launching.");
      return;
    }
    setCreating(true);
    try {
      const code = mintCode();
      const videoId = extractYouTubeId(videoUrl);
      const q = draft?.quiz ?? questions;
      const cs = draft?.case_study ?? caseStudy;
      const checks = draft?.attention_checks ?? attentionChecks;
      const iq = draft?.inquiry_session ?? inquiry;
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
        questions: includes.quiz ? q : [],
        question_count: includes.quiz ? q.length : 0,
        case_study: includes.case_study ? cs : null,
        attention_checks: includes.video ? checks : [],
        inquiry_session: includes.inquiry ? iq : null,
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
        <SessionContentReview
          title={topic || "Live session"}
          subtitle="Review before launching"
          saveLabel="Create & launch lobby"
          saving={creating}
          mathEditing
          payload={{
            video: includes.video
              ? { videoId: extractYouTubeId(videoUrl), title: topic }
              : undefined,
            quiz: includes.quiz ? questions : [],
            case_study: includes.case_study ? caseStudy : null,
            inquiry_session: includes.inquiry ? inquiry : null,
            attention_checks: includes.video ? attentionChecks : [],
          }}
          onClose={() => setReviewOpen(false)}
          onSave={(draft) => handleCreate(draft)}
        />
      )}
    </TeacherLayout>
  );
}
