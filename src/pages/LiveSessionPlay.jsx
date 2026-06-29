/**
 * LiveSessionPlay — the student's view of a live session. The per-student
 * experience runs through the SHARED SessionFlow engine, so it has the exact
 * same design, steps, and flow as a curriculum learn session (inquiry → video
 * + attention checks → quiz → case study → results). The multiplayer layer is
 * preserved on top: every correct quiz answer (+100) / attention check (+50)
 * bumps live_session_participants.total_points, every answer is recorded to
 * live_session_responses for the host's analytics, the student's phase is
 * mirrored to current_phase, and the session ends on the class leaderboard.
 *
 * Joins via /Join (Edge Function joinLiveSession) which stashes join context in
 * sessionStorage. A cold visit bounces back to /Join with the code pre-filled.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shuffleQuestionList } from "@/lib/shuffleChoices";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trophy, CheckCircle, Sparkles, Send, XCircle } from "lucide-react";
import SessionFlow from "@/components/session/SessionFlow";
import { toCaseStudy } from "@/lib/sessionContent";

const LETTERS = ["A", "B", "C", "D"];

// SessionFlow step → live phase label mirrored to participant.current_phase.
const STEP_TO_PHASE = { inquiry: "inquiry", video: "video", quiz: "quiz", article: "case_study", results: "completed" };

function readJoinContext(code) {
  try {
    const raw = sessionStorage.getItem("quest_anon_join");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (code && parsed?.code !== code) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractVideoId(url) {
  const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/, /^([a-zA-Z0-9_-]{11})$/];
  for (const p of patterns) { const m = (url || "").match(p); if (m) return m[1]; }
  return null;
}

// Normalize a live question (choice_1..4 OR choice_a..d, correct_choice number OR letter)
// into SessionFlow's { question, options[], correctIndex, explanation } shape.
function toFlowQuestion(q, i) {
  const options = [q.choice_1, q.choice_2, q.choice_3, q.choice_4]
    .map((c, idx) => c ?? [q.choice_a, q.choice_b, q.choice_c, q.choice_d][idx])
    .filter((v) => v != null);
  const correctNum = typeof q.correct_choice === "number"
    ? q.correct_choice
    : LETTERS.indexOf(String(q.correct_choice || "A").toUpperCase()) + 1;
  return {
    id: q.id || `lq${i}`,
    question: q.question_text || q.question || "",
    options,
    correctIndex: Math.max(0, correctNum - 1),
    explanation: q.explanation || "",
  };
}

export default function LiveSessionPlay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = (searchParams.get("code") || "").toUpperCase();

  const [joinCtx, setJoinCtx] = useState(null);
  const [rawSession, setSession] = useState(null);
  // Shuffle each question's / attention-check's choices once per load so the
  // correct answer isn't always the same letter (correct_choice remapped in lockstep).
  const session = useMemo(() => {
    if (!rawSession) return rawSession;
    return {
      ...rawSession,
      questions: shuffleQuestionList(rawSession.questions),
      attention_checks: shuffleQuestionList(rawSession.attention_checks),
    };
  }, [rawSession]);
  const [participant, setParticipant] = useState(null);
  const participantRef = useRef(null);
  useEffect(() => { participantRef.current = participant; }, [participant]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // ---- Join context bootstrap ------------------------------------------
  useEffect(() => {
    if (!code) { navigate("/Join"); return; }
    const ctx = readJoinContext(code);
    if (!ctx) { navigate(`/Join?code=${code}`); return; }
    setJoinCtx(ctx);
  }, [code, navigate]);

  // ---- Load session + participant --------------------------------------
  const loadSession = useCallback(async () => {
    try {
      const { data, error: qErr } = await supabase
        .from("live_sessions").select("*")
        .or(`session_code.eq.${code},join_code.eq.${code}`).limit(1);
      if (qErr) throw qErr;
      if (!data || data.length === 0) { setError("Session not found."); return; }
      setSession(data[0]);
    } catch (err) {
      console.error("loadSession failed:", err);
      setError("Could not load the session.");
    }
  }, [code]);

  const loadParticipant = useCallback(async () => {
    if (!joinCtx?.participantId) return;
    try {
      const { data } = await supabase.from("live_session_participants").select("*").eq("id", joinCtx.participantId).maybeSingle();
      if (data) setParticipant(data);
    } catch (err) { console.warn("loadParticipant failed:", err); }
  }, [joinCtx?.participantId]);

  const loadLeaderboard = useCallback(async () => {
    if (!session?.id) return;
    try {
      const { data } = await supabase
        .from("live_session_participants")
        .select("id, display_name, total_points, is_anonymous")
        .eq("live_session_id", session.id)
        .order("total_points", { ascending: false }).limit(20);
      setLeaderboard(data || []);
    } catch (err) { console.warn("loadLeaderboard failed:", err); }
  }, [session?.id]);

  useEffect(() => {
    if (!joinCtx) return;
    (async () => { await loadSession(); await loadParticipant(); setLoading(false); })();
  }, [joinCtx, loadSession, loadParticipant]);

  // Poll session row (teacher End Session) + leaderboard.
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => { loadSession(); loadLeaderboard(); }, 4000);
    return () => clearInterval(t);
  }, [session, loadSession, loadLeaderboard]);

  // ---- Multiplayer scoring (preserved contract) ------------------------
  const bumpScore = async (delta) => {
    const p = participantRef.current;
    if (!p || delta <= 0) return;
    const newTotal = (p.total_points || 0) + delta;
    try {
      await supabase.from("live_session_participants").update({ total_points: newTotal }).eq("id", p.id);
      setParticipant({ ...p, total_points: newTotal });
    } catch (err) { console.warn("bumpScore failed:", err); }
  };

  const recordResponse = async (row) => {
    if (!session) return;
    try {
      await supabase.from("live_session_responses").insert({
        live_session_id: session.id,
        student_id: participantRef.current?.student_id || null,
        ...row,
        submitted_at: new Date().toISOString(),
      });
    } catch (err) { console.warn("recordResponse failed:", err); }
  };

  const persistProgress = async (ph) => {
    const p = participantRef.current;
    if (!p || !ph) return;
    try {
      await supabase.from("live_session_participants").update({ current_phase: ph }).eq("id", p.id);
    } catch (err) { console.warn("persistProgress failed:", err); }
  };

  // ---- Build SessionFlow content from the session row ------------------
  const liveVideoId = useMemo(() => extractVideoId(session?.video_url), [session?.video_url]);
  const content = useMemo(() => {
    if (!session) return null;
    const questions = Array.isArray(session.questions) ? session.questions.map(toFlowQuestion) : [];
    const attentionChecks = Array.isArray(session.attention_checks)
      ? session.attention_checks.map((c) => ({ ...c, correct_choice: String(c.correct_choice || "A").toUpperCase() }))
      : [];
    const inq = session.inquiry_session;
    const inquiry = inq?.hook_question ? { hook_question: inq.hook_question, hook_image_url: inq.hook_image_url } : null;
    return {
      topic: session.session_name || session.subunit_name || session.title || "Live Session",
      unitName: "",
      badgeLabel: "Live",
      videoId: liveVideoId,
      videoDurationSeconds: session.video_duration,
      attentionChecks,
      questions,
      caseStudy: toCaseStudy(session.case_study),
      inquiry,
    };
  }, [session, liveVideoId]);

  const events = {
    onQuizAnswer: async ({ selectedIndex, isCorrect, index }) => {
      await recordResponse({ question_index: index, question_type: "mcq", response: LETTERS[selectedIndex], is_correct: isCorrect, points_earned: isCorrect ? 100 : 0, max_points: 100 });
      if (isCorrect) await bumpScore(100);
    },
    onAttentionCheck: async ({ selectedChoice, isCorrect, index }) => {
      await recordResponse({ question_index: index, question_type: "attention_check", response: selectedChoice, is_correct: isCorrect, points_earned: isCorrect ? 50 : 0, max_points: 50 });
      if (isCorrect) await bumpScore(50);
    },
  };

  // ---- Render -----------------------------------------------------------
  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        {error ? (
          <div className="text-center">
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">{error}</p>
            <Button onClick={() => navigate("/Join")} variant="outline" className="mt-4">Back to join</Button>
          </div>
        ) : (
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        )}
      </div>
    );
  }

  // Teacher ended the session, or the student finished → class leaderboard.
  if (session.status === "completed" || session.status === "ended" || showLeaderboard) {
    return (
      <LeaderboardWrapper code={code} joinCtx={joinCtx} participant={participant}>
        <LeaderboardView participants={leaderboard} you={participant} ended={session.status === "completed" || session.status === "ended"} />
      </LeaderboardWrapper>
    );
  }

  const hasContent = content && (content.inquiry || content.videoId || content.questions.length > 0 || content.caseStudy);
  if (!hasContent) {
    return (
      <LeaderboardWrapper code={code} joinCtx={joinCtx} participant={participant}>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Nothing to do yet</h2>
          <p className="text-slate-500">Your teacher hasn't added any content to this session.</p>
        </div>
      </LeaderboardWrapper>
    );
  }

  return (
    <SessionFlow
      content={content}
      inquiryMode="inline"
      inquiryLlmCall={liveInquiryLlmCall}
      events={events}
      onCaseStudySave={() => {}}
      onPhaseChange={(step) => persistProgress(STEP_TO_PHASE[step] || step)}
      onFinish={() => setShowLeaderboard(true)}
      onExit={() => navigate("/Join")}
      allowRetry={false}
    />
  );
}

// Anonymous-safe LLM transport for the inline inquiry chat (live participants
// may not be authenticated, so route through the public edge function).
async function liveInquiryLlmCall({ prompt, schema }) {
  const { data, error } = await supabase.functions.invoke("publicTryFunnel", { body: { action: "socratic", prompt, schema } });
  if (error) throw error;
  return data?.result;
}

// ============================ Leaderboard chrome ==========================
function LeaderboardWrapper({ code, joinCtx, participant, children }) {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8" style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 50%, #FAF5FF 100%)", fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
            {joinCtx?.displayName || "Anonymous"} · <span className="text-emerald-700 font-bold">{participant?.total_points || 0} pts</span>
          </div>
          <div className="bg-slate-900 text-white rounded-full px-4 py-1.5 text-xs font-bold tracking-[0.2em] font-mono uppercase">{code}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

// =============================== Inquiry ==================================
// Structured 4-step Socratic flow (Q1 observation FR → Q2 analogy MC → Q3 bridge
// MC → Q4 transfer FR), each round-tripping through the public liveSessionSocratic
// Edge Function (anonymous-safe — required for live participants).
function InquiryView({ inquiry, topic, onContinue }) {
  const messagesEndRef = useRef(null);
  const codeFromUrl = (() => {
    try { return (new URLSearchParams(window.location.search).get("code") || "").toUpperCase(); } catch { return ""; }
  })();
  const subunitName = topic || "this topic";

  const [step, setStep] = useState("q1_fr");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "What do you observe in this image? Share what you notice — anything counts." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mc, setMc] = useState(null);
  const [picked, setPicked] = useState(null);
  const [picking, setPicking] = useState(false);
  const [analogyAnswer, setAnalogyAnswer] = useState("");

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, sending, mc, step]);

  const callSocratic = async (payload) => {
    const { data, error } = await supabase.functions.invoke("liveSessionSocratic", { body: { code: codeFromUrl, subunitName, ...payload } });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Tutor unavailable");
    return data;
  };
  const addAssistant = (content) => setMessages((prev) => [...prev, { role: "assistant", content }]);
  const addStudent = (content) => setMessages((prev) => [...prev, { role: "user", content }]);

  const submitObservation = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput(""); addStudent(text); setSending(true);
    try {
      const r = await callSocratic({ step: "q1_ack", observation: text });
      addAssistant(r.reply);
      setStep("q2_mc");
      const q2 = await callSocratic({ step: "q2_mc_generate" });
      setMc(q2); addAssistant(q2.question);
    } catch (err) {
      console.warn("Q1 failed:", err);
      addAssistant("Hmm, I couldn't think of a good follow-up. Try again?");
    } finally { setSending(false); }
  };

  const pickQ2 = async (idx) => {
    if (picking || picked !== null) return;
    setPicked(idx); setPicking(true); setAnalogyAnswer(mc.choices[idx]); addStudent(`I picked: ${mc.choices[idx]}`);
    try {
      const wasCorrect = idx === mc.correct_index;
      const r = await callSocratic({ step: "q2_ack", currentMcQuestion: mc.question, choiceText: mc.choices[idx], correctChoice: mc.choices[mc.correct_index], wasCorrect });
      addAssistant(r.reply);
      setStep("q3_mc"); setMc(null); setPicked(null);
      const q3 = await callSocratic({ step: "q3_mc_generate", bridgeQuestion: r.bridgeQuestion });
      setMc(q3); addAssistant(r.bridgeQuestion);
    } catch (err) {
      console.warn("Q2 failed:", err); addAssistant("Hmm, I lost track. Pick again?"); setPicked(null);
    } finally { setPicking(false); }
  };

  const pickQ3 = async (idx) => {
    if (picking || picked !== null) return;
    setPicked(idx); setPicking(true); addStudent(`I picked: ${mc.choices[idx]}`);
    try {
      const wasCorrect = idx === mc.correct_index;
      const r = await callSocratic({ step: "q3_summary", analogyAnswer, choiceText: mc.choices[idx], correctChoice: mc.choices[mc.correct_index], wasCorrect });
      addAssistant(r.reply);
      setStep("q4_fr"); setMc(null); setPicked(null);
      addAssistant(inquiry?.hook_question || "What's one new connection you're noticing about this topic?");
    } catch (err) {
      console.warn("Q3 failed:", err); addAssistant("Hmm, I lost track. Try again?"); setPicked(null);
    } finally { setPicking(false); }
  };

  const submitFinal = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput(""); addStudent(text); setSending(true);
    try {
      const r = await callSocratic({ step: "q4_ack", inquiryHookQuestion: inquiry?.hook_question || "", studentAnswer: text });
      addAssistant(r.reply); setStep("complete");
    } catch (err) {
      console.warn("Q4 failed:", err); addAssistant("Great thinking! Let's keep going."); setStep("complete");
    } finally { setSending(false); }
  };

  const onKeyDown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (step === "q1_fr") submitObservation(); else if (step === "q4_fr") submitFinal();
  };

  const showInput = step === "q1_fr" || step === "q4_fr";
  const showMc = (step === "q2_mc" || step === "q3_mc") && mc && picked === null;
  const showContinue = step === "complete";

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md mx-4">
      <div className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3">
        <Sparkles className="w-3 h-3" /> Think first with Panda
      </div>
      {inquiry?.hook_image_url && <img src={inquiry.hook_image_url} alt="" className="w-full rounded-xl border border-slate-200 mb-4" />}
      <div className="border border-slate-200 rounded-2xl bg-slate-50 p-3 max-h-[400px] overflow-y-auto mb-3 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-indigo-600 text-white rounded-br-md" : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"}`}>
              {m.role === "assistant" && <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-600 mb-0.5">🐼 Panda</div>}
              <div className="whitespace-pre-wrap">
                {String(m.content).split(/(\*\*.*?\*\*)/).map((part, idx) =>
                  part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={idx}>{part.slice(2, -2)}</strong> : <React.Fragment key={idx}>{part}</React.Fragment>
                )}
              </div>
            </div>
          </div>
        ))}
        {(sending || picking) && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3.5 py-2 text-sm text-slate-500 inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Panda is thinking…
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {showMc && (
        <div className="space-y-2 mb-3">
          {mc.choices.map((choice, idx) => (
            <button key={idx} onClick={() => (step === "q2_mc" ? pickQ2(idx) : pickQ3(idx))} disabled={picking}
              className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors disabled:opacity-50 flex items-center gap-3">
              <span className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 font-bold flex items-center justify-center flex-shrink-0">{["A", "B", "C", "D"][idx]}</span>
              <span className="text-sm text-slate-900">{choice}</span>
            </button>
          ))}
        </div>
      )}
      {showInput && (
        <div className="flex items-end gap-2 mb-3">
          <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} disabled={sending}
            placeholder={step === "q1_fr" ? "Type what you observe — even a guess is good." : "Share your final thinking on the question."} className="resize-none flex-1" />
          <Button onClick={step === "q1_fr" ? submitObservation : submitFinal} disabled={!input.trim() || sending} className="bg-indigo-600 hover:bg-indigo-700 text-white h-[58px] px-4">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
      {showContinue && (
        <Button onClick={onContinue} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white">Continue</Button>
      )}
    </div>
  );
}

// ============================== Leaderboard ===============================
function LeaderboardView({ participants, you, ended }) {
  const myRank = participants.findIndex((p) => p.id === you?.id);
  const handleFinish = () => {
    try { sessionStorage.removeItem("quest_anon_join"); } catch { /* ignore */ }
    window.location.href = "/Join";
  };
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
      <div className="text-center mb-5">
        <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-2" />
        <h2 className="text-2xl font-bold text-slate-900">{ended ? "Session ended" : "Session complete"}</h2>
        {myRank >= 0 && (
          <p className="text-sm text-slate-500 mt-1">
            You finished <span className="font-bold text-slate-900">#{myRank + 1}</span> with <span className="font-bold text-slate-900">{you?.total_points || 0} points</span>
          </p>
        )}
      </div>
      <ol className="space-y-2 mb-5">
        {participants.slice(0, 10).map((p, i) => {
          const isMe = p.id === you?.id;
          return (
            <li key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${isMe ? "border-indigo-300 bg-indigo-50" : i === 0 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
              <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-slate-200 text-slate-700"}`}>{i + 1}</span>
              <span className="flex-1 font-semibold text-slate-900">
                {p.display_name || "Anonymous"}
                {isMe && <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-indigo-700">you</span>}
              </span>
              <span className="text-lg font-extrabold text-slate-900">{p.total_points || 0}</span>
            </li>
          );
        })}
      </ol>
      <Button onClick={handleFinish} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold">
        <CheckCircle className="w-5 h-5 mr-2" /> Finish &amp; exit
      </Button>
    </div>
  );
}
