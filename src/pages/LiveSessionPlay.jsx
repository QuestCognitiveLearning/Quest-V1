/**
 * LiveSessionPlay — the student's view of a live session. Students self-pace
 * through whichever phases the teacher included (inquiry, video w/ attention
 * checks, quiz, case study). Every correct quiz answer + attention check
 * adds points to live_session_participants.total_points, which the host
 * polls to drive the leaderboard.
 *
 * Joins via /Join (Edge Function joinLiveSession) which stashes join context
 * in sessionStorage. If a visitor hits this URL cold, we bounce them back
 * to /Join with the code pre-filled.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shuffleQuestionList } from "@/lib/shuffleChoices";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Trophy,
  CheckCircle,
  Sparkles,
  MessageCircle,
  PlayCircle,
  XCircle,
  Send,
} from "lucide-react";

const LETTERS = ["A", "B", "C", "D"];

const PHASE_LABELS = {
  inquiry: "Inquiry",
  video: "Video",
  quiz: "Quiz",
  case_study: "Case Study",
  completed: "Results",
};

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

// Phases the session includes, in fixed display order. We only run the ones
// that have meaningful content. `lobby` is implicit (the join page handles
// it). `completed` is the terminal state.
function getOrderedPhases(session) {
  const out = [];
  if (session?.inquiry_session?.hook_question) out.push("inquiry");
  if (session?.video_url) out.push("video");
  if (Array.isArray(session?.questions) && session.questions.length > 0) out.push("quiz");
  if (session?.case_study?.scenario) out.push("case_study");
  return out;
}

export default function LiveSessionPlay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = (searchParams.get("code") || "").toUpperCase();

  const [joinCtx, setJoinCtx] = useState(null);
  const [rawSession, setSession] = useState(null);
  // Shuffle each question's / attention-check's answer choices once per load so
  // the correct answer isn't always the same letter. The shuffle is seeded by
  // question content (stable across re-renders), and `correct_choice` is remapped
  // in lockstep — so every downstream reader (render AND scoring) stays correct
  // while reading the same `session.questions` / `session.attention_checks`.
  const session = useMemo(() => {
    if (!rawSession) return rawSession;
    return {
      ...rawSession,
      questions: shuffleQuestionList(rawSession.questions),
      attention_checks: shuffleQuestionList(rawSession.attention_checks),
    };
  }, [rawSession]);
  const [participant, setParticipant] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Phase advance — student-controlled.
  const [phaseIdx, setPhaseIdx] = useState(0); // index into getOrderedPhases(session)
  const phases = session ? getOrderedPhases(session) : [];
  const phase = phases[phaseIdx] || (phases.length > 0 ? "completed" : "empty");

  // Quiz state (per question)
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // { correct, points }
  const [submittedQ, setSubmittedQ] = useState({}); // { [questionIndex]: true }

  // Per-student tallies — drive the personal results breakdown shown at the
  // end (mirrors the learn-session results screen) before the leaderboard.
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [checkCorrect, setCheckCorrect] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Video state
  const [ytPlayer, setYtPlayer] = useState(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [actualDuration, setActualDuration] = useState(null);
  const [activeCheck, setActiveCheck] = useState(null);
  const [checkSelected, setCheckSelected] = useState(null);
  const [checkFeedback, setCheckFeedback] = useState(null);
  const [checkIdx, setCheckIdx] = useState(0);
  const [checksDone, setChecksDone] = useState([]);
  const [videoEnded, setVideoEnded] = useState(false);
  const lastTimeRef = useRef(0);

  // ---- Join context bootstrap ------------------------------------------
  useEffect(() => {
    if (!code) {
      navigate("/Join");
      return;
    }
    const ctx = readJoinContext(code);
    if (!ctx) {
      navigate(`/Join?code=${code}`);
      return;
    }
    setJoinCtx(ctx);
  }, [code, navigate]);

  // ---- Load session + participant --------------------------------------
  const loadSession = useCallback(async () => {
    try {
      const { data, error: qErr } = await supabase
        .from("live_sessions")
        .select("*")
        .or(`session_code.eq.${code},join_code.eq.${code}`)
        .limit(1);
      if (qErr) throw qErr;
      if (!data || data.length === 0) {
        setError("Session not found.");
        return;
      }
      setSession(data[0]);
    } catch (err) {
      console.error("loadSession failed:", err);
      setError("Could not load the session.");
    }
  }, [code]);

  const loadParticipant = useCallback(async () => {
    if (!joinCtx?.participantId) return;
    try {
      const { data } = await supabase
        .from("live_session_participants")
        .select("*")
        .eq("id", joinCtx.participantId)
        .maybeSingle();
      if (data) setParticipant(data);
    } catch (err) {
      console.warn("loadParticipant failed:", err);
    }
  }, [joinCtx?.participantId]);

  const loadLeaderboard = useCallback(async () => {
    if (!session?.id) return;
    try {
      const { data } = await supabase
        .from("live_session_participants")
        .select("id, display_name, total_points, is_anonymous")
        .eq("live_session_id", session.id)
        .order("total_points", { ascending: false })
        .limit(20);
      setLeaderboard(data || []);
    } catch (err) {
      console.warn("loadLeaderboard failed:", err);
    }
  }, [session?.id]);

  useEffect(() => {
    if (!joinCtx) return;
    (async () => {
      await loadSession();
      await loadParticipant();
      setLoading(false);
    })();
  }, [joinCtx, loadSession, loadParticipant]);

  // Poll session row (for teacher-side End Session) and leaderboard.
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      loadSession();
      loadLeaderboard();
    }, 4000);
    return () => clearInterval(t);
  }, [session, loadSession, loadLeaderboard]);

  // ---- YouTube player setup --------------------------------------------
  const videoId = (() => {
    const url = session?.video_url || "";
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  })();

  useEffect(() => {
    if (phase !== "video" || !videoId || ytPlayer) return;
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    const init = () => {
      const el = document.getElementById("ls-yt-player");
      if (!el) return setTimeout(init, 150);
      if (!window.YT || !window.YT.Player) return setTimeout(init, 200);
      try {
        const p = new window.YT.Player("ls-yt-player", {
          height: "100%",
          width: "100%",
          videoId,
          playerVars: { controls: 1, modestbranding: 1, rel: 0, autoplay: 1, enablejsapi: 1 },
          events: {
            onReady: (e) => {
              setYtPlayer(e.target);
              const d = e.target.getDuration();
              if (d) setActualDuration(Math.floor(d));
            },
            onStateChange: (e) => {
              if (e.data === 0) setVideoEnded(true);
            },
          },
        });
      } catch (err) {
        console.error("YT init failed:", err);
      }
    };
    setTimeout(init, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, videoId]);

  // Track video progress + trigger attention checks
  useEffect(() => {
    if (phase !== "video" || !ytPlayer) return;
    const checks = session?.attention_checks || [];
    const id = setInterval(() => {
      if (!ytPlayer.getCurrentTime || !ytPlayer.getPlayerState) return;
      const state = ytPlayer.getPlayerState();
      const t = ytPlayer.getCurrentTime();

      if (activeCheck) {
        if (state === 1) ytPlayer.pauseVideo();
        return;
      }

      // Prevent seeking forward past checks
      if (t > lastTimeRef.current + 2) {
        ytPlayer.seekTo(lastTimeRef.current, true);
        return;
      }
      if (state === 1) {
        setVideoProgress(Math.floor(t));
        lastTimeRef.current = t;

        const next = checks[checkIdx];
        if (next && Math.abs(t - next.timestamp) <= 1 && !checksDone.includes(checkIdx)) {
          ytPlayer.pauseVideo();
          setActiveCheck(next);
          setCheckSelected(null);
          setCheckFeedback(null);
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase, ytPlayer, activeCheck, checkIdx, checksDone, session?.attention_checks]);

  // ---- Scoring helpers --------------------------------------------------
  const bumpScore = async (delta) => {
    if (!participant || delta <= 0) return;
    const newTotal = (participant.total_points || 0) + delta;
    try {
      await supabase
        .from("live_session_participants")
        .update({ total_points: newTotal })
        .eq("id", participant.id);
      setParticipant({ ...participant, total_points: newTotal });
    } catch (err) {
      console.warn("bumpScore failed:", err);
    }
  };

  const recordResponse = async (row) => {
    try {
      await supabase.from("live_session_responses").insert({
        live_session_id: session.id,
        student_id: participant?.student_id || null,
        ...row,
        submitted_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("recordResponse failed:", err);
    }
  };

  // Push the student's current phase to live_session_participants so the
  // host can see where each student is. We don't write current_question —
  // that column doesn't exist on the table, and the host now drives
  // question-level progress from live_session_responses instead.
  const persistProgress = useCallback(
    async ({ phase: ph }) => {
      if (!participant) return;
      try {
        await supabase
          .from("live_session_participants")
          .update({ current_phase: ph })
          .eq("id", participant.id);
      } catch (err) {
        console.warn("persistProgress failed:", err);
      }
    },
    [participant]
  );

  // Mirror local phase/question state to the row. Runs whenever the student
  // advances — the polling host picks it up within ~3s.
  useEffect(() => {
    if (!participant || !session) return;
    if (phases.length === 0) return;
    const ph = phaseIdx >= phases.length ? "completed" : phases[phaseIdx];
    persistProgress({ phase: ph });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant?.id, phaseIdx]);

  // ---- Phase advancement ------------------------------------------------
  const goNextPhase = () => {
    const nextIdx = phaseIdx + 1;
    setPhaseIdx(nextIdx);
    setQIdx(0);
    setSelected(null);
    setFeedback(null);
  };

  // Quiz answer
  const submitQuiz = async (choiceIndex) => {
    if (submittedQ[qIdx]) return;
    setSelected(choiceIndex);
    const q = session.questions[qIdx];
    // correct_choice can be 1-4 or letter. Normalize.
    const correctNum = typeof q.correct_choice === "number"
      ? q.correct_choice
      : (LETTERS.indexOf(String(q.correct_choice || "A").toUpperCase()) + 1);
    const isCorrect = choiceIndex + 1 === correctNum;
    const points = isCorrect ? 100 : 0;
    setFeedback({ correct: isCorrect, points });
    setSubmittedQ((prev) => ({ ...prev, [qIdx]: true }));
    if (isCorrect) setQuizCorrect((n) => n + 1);

    await recordResponse({
      question_index: qIdx,
      question_type: "mcq",
      response: LETTERS[choiceIndex],
      is_correct: isCorrect,
      points_earned: points,
      max_points: 100,
    });
    if (isCorrect) await bumpScore(points);
  };

  const nextQuestion = () => {
    if (qIdx + 1 < session.questions.length) {
      setQIdx(qIdx + 1);
      setSelected(null);
      setFeedback(null);
    } else {
      goNextPhase();
    }
  };

  // Attention check answer
  const submitCheck = async () => {
    if (!activeCheck || !checkSelected) return;
    const correctLetter = String(activeCheck.correct_choice || "A").toUpperCase();
    const isCorrect = checkSelected === correctLetter;
    const points = isCorrect ? 50 : 0;
    setCheckFeedback({ correct: isCorrect, points });
    if (isCorrect) setCheckCorrect((n) => n + 1);
    await recordResponse({
      question_index: checkIdx,
      question_type: "attention_check",
      response: checkSelected,
      is_correct: isCorrect,
      points_earned: points,
      max_points: 50,
    });
    if (isCorrect) await bumpScore(points);

    setTimeout(() => {
      setChecksDone((prev) => [...prev, checkIdx]);
      setActiveCheck(null);
      setCheckSelected(null);
      setCheckFeedback(null);
      setCheckIdx(checkIdx + 1);
      if (ytPlayer) ytPlayer.playVideo();
    }, 1500);
  };

  const videoCanProceed = () => {
    const total = session?.attention_checks?.length || 0;
    const dur = actualDuration || session?.video_duration || 0;
    const watchedEnough = videoEnded || (dur > 0 && videoProgress >= dur - 3);
    return watchedEnough && checksDone.length === total;
  };

  // ---- Render -----------------------------------------------------------
  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        {error ? (
          <div className="text-center">
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">{error}</p>
            <Button onClick={() => navigate("/Join")} variant="outline" className="mt-4">
              Back to join
            </Button>
          </div>
        ) : (
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        )}
      </div>
    );
  }

  if (session.status === "completed" || session.status === "ended") {
    return (
      <Wrapper code={code} joinCtx={joinCtx} participant={participant}>
        <LeaderboardView participants={leaderboard} you={participant} ended />
      </Wrapper>
    );
  }

  if (phases.length === 0) {
    return (
      <Wrapper code={code} joinCtx={joinCtx} participant={participant}>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Nothing to do yet</h2>
          <p className="text-slate-500">Your teacher hasn't added any content to this session.</p>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper code={code} joinCtx={joinCtx} participant={participant} progress={{ phaseIdx, total: phases.length, label: PHASE_LABELS[phase] || "" }}>
        {phase === "inquiry" && (
          <InquiryView
            inquiry={session.inquiry_session}
            topic={session.subunit_name || session.session_name}
            onContinue={goNextPhase}
          />
        )}
        {phase === "video" && (
          <VideoView
            videoId={videoId}
            activeCheck={activeCheck}
            checkSelected={checkSelected}
            checkFeedback={checkFeedback}
            setCheckSelected={setCheckSelected}
            submitCheck={submitCheck}
            progress={videoProgress}
            duration={actualDuration || session.video_duration || 0}
            checksDone={checksDone.length}
            totalChecks={session.attention_checks?.length || 0}
            canProceed={videoCanProceed()}
            onContinue={goNextPhase}
          />
        )}
        {phase === "quiz" && session.questions?.[qIdx] && (
          <QuizView
            q={session.questions[qIdx]}
            index={qIdx}
            total={session.questions.length}
            selected={selected}
            submitted={!!submittedQ[qIdx]}
            feedback={feedback}
            onSelect={submitQuiz}
            onNext={nextQuestion}
          />
        )}
        {phase === "case_study" && (
          <CaseStudyView cs={session.case_study} onDone={goNextPhase} />
        )}
        {phase === "completed" && (
          showLeaderboard ? (
            <LeaderboardView participants={leaderboard} you={participant} />
          ) : (
            <ResultsView
              quizCorrect={quizCorrect}
              quizTotal={session.questions?.length || 0}
              checkCorrect={checkCorrect}
              checkTotal={session.attention_checks?.length || 0}
              points={participant?.total_points || 0}
              onSeeLeaderboard={() => setShowLeaderboard(true)}
            />
          )
        )}
    </Wrapper>
  );
}

// ============================== Wrapper ===================================
function Wrapper({ code, joinCtx, participant, progress, children }) {
  return (
    <div
      className="min-h-screen px-4 py-6 sm:px-6 sm:py-8"
      style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 50%, #FAF5FF 100%)",
        fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
            {joinCtx?.displayName || "Anonymous"} ·{" "}
            <span className="text-emerald-700 font-bold">
              {participant?.total_points || 0} pts
            </span>
          </div>
          <div className="bg-slate-900 text-white rounded-full px-4 py-1.5 text-xs font-bold tracking-[0.2em] font-mono uppercase">
            {code}
          </div>
        </div>

        {progress && (
          <div className="mb-4">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              <span>
                {progress.label ? `${progress.label} · ` : ""}Step {Math.min(progress.phaseIdx + 1, progress.total)} of {progress.total}
              </span>
              <span>{Math.round((Math.min(progress.phaseIdx + 1, progress.total) / progress.total) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#3B82F6] transition-all"
                style={{ width: `${(Math.min(progress.phaseIdx + 1, progress.total) / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

// =============================== Views ====================================
// Inquiry phase 1 — structured 4-step Socratic flow (Q1 observation FR →
// Q2 analogy MC → Q3 bridge MC → Q4 transfer FR). Each step round-trips
// through the public liveSessionSocratic Edge Function which holds the
// canonical prompts server-side.
function InquiryView({ inquiry, topic, onContinue }) {
  const messagesEndRef = useRef(null);
  const codeFromUrl = (() => {
    try {
      return (new URLSearchParams(window.location.search).get('code') || '').toUpperCase();
    } catch {
      return '';
    }
  })();
  const subunitName = topic || "this topic";

  // Phases: q1_fr → q2_mc → q3_mc → q4_fr → complete
  const [step, setStep] = useState("q1_fr");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "What do you observe in this image? Share what you notice — anything counts." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // MC state shared across Q2 & Q3
  const [mc, setMc] = useState(null); // { question, choices, correct_index }
  const [picked, setPicked] = useState(null);
  const [picking, setPicking] = useState(false);

  // Memo of student's analogy answer for the Q3 summary step
  const [analogyAnswer, setAnalogyAnswer] = useState("");
  const [bridgeQuestion, setBridgeQuestion] = useState("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending, mc, step]);

  // Single helper for all Edge Function calls.
  const callSocratic = async (payload) => {
    const { data, error } = await supabase.functions.invoke("liveSessionSocratic", {
      body: { code: codeFromUrl, subunitName, ...payload },
    });
    if (error || data?.error) {
      throw new Error(data?.error || error?.message || "Tutor unavailable");
    }
    return data;
  };

  const addAssistant = (content) =>
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  const addStudent = (content) =>
    setMessages((prev) => [...prev, { role: "user", content }]);

  // ---- Q1: observation FR ------------------------------------------------
  const submitObservation = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    addStudent(text);
    setSending(true);
    try {
      const r = await callSocratic({ step: "q1_ack", observation: text });
      addAssistant(r.reply);
      // Move straight into Q2 — generate analogy MC.
      setStep("q2_mc");
      const q2 = await callSocratic({ step: "q2_mc_generate" });
      setMc(q2);
      addAssistant(q2.question);
    } catch (err) {
      console.warn("Q1 failed:", err);
      addAssistant("Hmm, I couldn't think of a good follow-up. Try again?");
    } finally {
      setSending(false);
    }
  };

  // ---- Q2: analogy MC pick -----------------------------------------------
  const pickQ2 = async (idx) => {
    if (picking || picked !== null) return;
    setPicked(idx);
    setPicking(true);
    setAnalogyAnswer(mc.choices[idx]);
    addStudent(`I picked: ${mc.choices[idx]}`);
    try {
      const wasCorrect = idx === mc.correct_index;
      const r = await callSocratic({
        step: "q2_ack",
        currentMcQuestion: mc.question,
        choiceText: mc.choices[idx],
        correctChoice: mc.choices[mc.correct_index],
        wasCorrect,
      });
      addAssistant(r.reply);
      setBridgeQuestion(r.bridgeQuestion);
      // Move to Q3 — generate bridge MC.
      setStep("q3_mc");
      setMc(null);
      setPicked(null);
      const q3 = await callSocratic({
        step: "q3_mc_generate",
        bridgeQuestion: r.bridgeQuestion,
      });
      setMc(q3);
      addAssistant(r.bridgeQuestion);
    } catch (err) {
      console.warn("Q2 failed:", err);
      addAssistant("Hmm, I lost track. Pick again?");
      setPicked(null);
    } finally {
      setPicking(false);
    }
  };

  // ---- Q3: bridge MC pick → summary --------------------------------------
  const pickQ3 = async (idx) => {
    if (picking || picked !== null) return;
    setPicked(idx);
    setPicking(true);
    addStudent(`I picked: ${mc.choices[idx]}`);
    try {
      const wasCorrect = idx === mc.correct_index;
      const r = await callSocratic({
        step: "q3_summary",
        analogyAnswer,
        choiceText: mc.choices[idx],
        correctChoice: mc.choices[mc.correct_index],
        wasCorrect,
      });
      addAssistant(r.reply);
      // Q4 — show the inquiry hook question and wait for a FR.
      setStep("q4_fr");
      setMc(null);
      setPicked(null);
      const hookQ =
        inquiry?.hook_question ||
        "What's one new connection you're noticing about this topic?";
      addAssistant(hookQ);
    } catch (err) {
      console.warn("Q3 failed:", err);
      addAssistant("Hmm, I lost track. Try again?");
      setPicked(null);
    } finally {
      setPicking(false);
    }
  };

  // ---- Q4: final transfer FR ---------------------------------------------
  const submitFinal = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    addStudent(text);
    setSending(true);
    try {
      const r = await callSocratic({
        step: "q4_ack",
        inquiryHookQuestion: inquiry?.hook_question || "",
        studentAnswer: text,
      });
      addAssistant(r.reply);
      setStep("complete");
    } catch (err) {
      console.warn("Q4 failed:", err);
      addAssistant("Great thinking! Let's keep going.");
      setStep("complete");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (step === "q1_fr") submitObservation();
    else if (step === "q4_fr") submitFinal();
  };

  const showInput = step === "q1_fr" || step === "q4_fr";
  const showMc = (step === "q2_mc" || step === "q3_mc") && mc && picked === null;
  const showContinue = step === "complete";

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
      <div className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3">
        <Sparkles className="w-3 h-3" /> Think first with Panda
      </div>
      {inquiry?.hook_image_url && (
        <img
          src={inquiry.hook_image_url}
          alt=""
          className="w-full rounded-xl border border-slate-200 mb-4"
        />
      )}

      <div className="border border-slate-200 rounded-2xl bg-slate-50 p-3 max-h-[400px] overflow-y-auto mb-3 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-md"
                  : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"
              }`}
            >
              {m.role === "assistant" && (
                <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-600 mb-0.5">
                  🐼 Panda
                </div>
              )}
              <div className="whitespace-pre-wrap">
                {String(m.content).split(/(\*\*.*?\*\*)/).map((part, idx) =>
                  part.startsWith("**") && part.endsWith("**") && part.length > 4
                    ? <strong key={idx}>{part.slice(2, -2)}</strong>
                    : <React.Fragment key={idx}>{part}</React.Fragment>
                )}
              </div>
            </div>
          </div>
        ))}
        {(sending || picking) && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3.5 py-2 text-sm text-slate-500 inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Panda is thinking…
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {showMc && (
        <div className="space-y-2 mb-3">
          {mc.choices.map((choice, idx) => (
            <button
              key={idx}
              onClick={() => (step === "q2_mc" ? pickQ2(idx) : pickQ3(idx))}
              disabled={picking}
              className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors disabled:opacity-50 flex items-center gap-3"
            >
              <span className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 font-bold flex items-center justify-center flex-shrink-0">
                {["A", "B", "C", "D"][idx]}
              </span>
              <span className="text-sm text-slate-900">{choice}</span>
            </button>
          ))}
        </div>
      )}

      {showInput && (
        <div className="flex items-end gap-2 mb-3">
          <Textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
            placeholder={step === "q1_fr"
              ? "Type what you observe — even a guess is good."
              : "Share your final thinking on the question."}
            className="resize-none flex-1"
          />
          <Button
            onClick={step === "q1_fr" ? submitObservation : submitFinal}
            disabled={!input.trim() || sending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-[58px] px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {showContinue && (
        <Button
          onClick={onContinue}
          className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Continue
        </Button>
      )}
    </div>
  );
}

function VideoView({
  videoId, activeCheck, checkSelected, checkFeedback, setCheckSelected, submitCheck,
  progress, duration, checksDone, totalChecks, canProceed, onContinue,
}) {
  if (!videoId) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center">
        <p className="text-slate-500">Video unavailable.</p>
        <Button onClick={onContinue} className="mt-3" variant="outline">
          Skip
        </Button>
      </div>
    );
  }
  const pct = duration > 0 ? Math.min(100, Math.floor((progress / duration) * 100)) : 0;
  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-md overflow-hidden">
      <div className="aspect-video bg-black">
        <div id="ls-yt-player" className="w-full h-full" />
      </div>
      <div className="p-5">
        {activeCheck && (
          <div className="mb-4 border-2 border-indigo-300 bg-indigo-50 rounded-2xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-2">
              Attention check
            </div>
            <p className="font-semibold text-slate-900 mb-3">{activeCheck.question}</p>
            <div className="space-y-2">
              {["a", "b", "c", "d"].map((k) => {
                const letter = k.toUpperCase();
                const text = activeCheck[`choice_${k}`];
                if (!text) return null;
                const isSel = checkSelected === letter;
                const showResult = !!checkFeedback;
                const isCorrect = letter === String(activeCheck.correct_choice || "A").toUpperCase();
                let cls = "border-slate-200 bg-white";
                if (showResult && isCorrect) cls = "border-emerald-500 bg-emerald-50";
                else if (showResult && isSel && !isCorrect) cls = "border-red-400 bg-red-50";
                else if (isSel) cls = "border-indigo-500 bg-indigo-50";
                return (
                  <button
                    key={k}
                    disabled={showResult}
                    onClick={() => setCheckSelected(letter)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left ${cls}`}
                  >
                    <span className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-xs font-bold">
                      {letter}
                    </span>
                    <span className="flex-1 text-slate-900 text-sm">{text}</span>
                    {showResult && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
            {!checkFeedback && (
              <Button onClick={submitCheck} disabled={!checkSelected} className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white">
                Submit
              </Button>
            )}
            {checkFeedback && (
              <p className={`text-sm font-semibold mt-3 ${checkFeedback.correct ? "text-emerald-700" : "text-amber-700"}`}>
                {checkFeedback.correct ? `+${checkFeedback.points} points` : "Not quite. Keep watching."}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Watch progress: {pct}%</span>
          <span>Checks: {checksDone}/{totalChecks}</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>

        <Button
          onClick={onContinue}
          disabled={!canProceed}
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          {canProceed ? "Continue" : "Finish the video first"}
        </Button>
      </div>
    </div>
  );
}

function QuizView({ q, index, total, selected, submitted, feedback, onSelect, onNext }) {
  const choices = [q.choice_1, q.choice_2, q.choice_3, q.choice_4]
    .map((c, i) => c ?? [q.choice_a, q.choice_b, q.choice_c, q.choice_d][i])
    .filter(Boolean);
  const questionText = q.question_text || q.question;
  const correctNum = typeof q.correct_choice === "number"
    ? q.correct_choice
    : (LETTERS.indexOf(String(q.correct_choice || "A").toUpperCase()) + 1);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
        Question {index + 1} of {total}
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-5">{questionText}</h2>

      <div className="space-y-2.5">
        {choices.map((c, i) => {
          const isSel = selected === i;
          const isCorrect = i + 1 === correctNum;
          let cls = "border-slate-200 bg-white hover:border-indigo-300 cursor-pointer";
          if (submitted) {
            if (isCorrect) cls = "border-emerald-500 bg-emerald-50";
            else if (isSel) cls = "border-red-400 bg-red-50";
            else cls = "border-slate-200 bg-slate-50 opacity-70";
          } else if (isSel) {
            cls = "border-indigo-500 bg-indigo-50";
          }
          return (
            <button
              key={i}
              disabled={submitted}
              onClick={() => onSelect(i)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-colors ${cls}`}
            >
              <span className={`w-9 h-9 rounded-md flex items-center justify-center font-bold ${
                submitted && isCorrect ? "bg-emerald-600 text-white" :
                isSel ? "bg-indigo-600 text-white" :
                "bg-slate-100 text-slate-700"
              }`}>
                {LETTERS[i]}
              </span>
              <span className="flex-1 text-slate-900">{c}</span>
              {submitted && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600" />}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className={`mt-5 rounded-xl p-4 ${
          feedback.correct ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
        }`}>
          <p className={`font-bold ${feedback.correct ? "text-emerald-800" : "text-amber-800"}`}>
            {feedback.correct ? `+${feedback.points} points` : "Not quite — no points this time"}
          </p>
          {q.explanation && (
            <p className="text-sm text-slate-700 mt-1">{q.explanation}</p>
          )}
        </div>
      )}

      {submitted && (
        <Button onClick={onNext} className="w-full mt-4 h-11 bg-indigo-600 hover:bg-indigo-700 text-white">
          {index + 1 < total ? "Next question" : "Finish quiz"}
        </Button>
      )}
    </div>
  );
}

function CaseStudyView({ cs, onDone }) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
      <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3">
        <MessageCircle className="w-3 h-3" /> Case study
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-3">Read the scenario</h2>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <p className="text-slate-800 leading-relaxed whitespace-pre-line">{cs.scenario}</p>
      </div>
      {Array.isArray(cs.discussion_questions) && cs.discussion_questions.length > 0 && (
        <div className="mb-4">
          <h3 className="font-bold text-slate-900 mb-2">Discuss with your group</h3>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-800">
            {cs.discussion_questions.map((q, i) => (<li key={i}>{q}</li>))}
          </ol>
        </div>
      )}
      <Button onClick={onDone} className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white">
        I'm done
      </Button>
    </div>
  );
}

// Personal results breakdown — mirrors the learn-session results screen so a
// live session ends with the same per-student feedback. Shown before the
// class leaderboard (live sessions stay multiplayer).
function ResultsView({ quizCorrect, quizTotal, checkCorrect, checkTotal, points, onSeeLeaderboard }) {
  const totalGraded = quizTotal + checkTotal;
  const totalCorrect = quizCorrect + checkCorrect;
  const pct = totalGraded > 0 ? Math.round((totalCorrect / totalGraded) * 100) : 0;
  const mcPct = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
  const acPct = checkTotal > 0 ? Math.round((checkCorrect / checkTotal) * 100) : 0;
  const strong = pct >= 70;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-md">
      <div className="flex items-center gap-3 mb-6">
        {strong ? (
          <CheckCircle className="w-6 h-6 text-[#3B82F6]" />
        ) : (
          <Sparkles className="w-6 h-6 text-amber-500" />
        )}
        <h2 className="text-xl font-semibold text-[#1A1A1A]">
          {strong ? "Nice work!" : "Session complete"}
        </h2>
      </div>

      <div className="text-center mb-8">
        <p className="text-6xl font-bold text-[#1A1A1A] mb-2">{pct}%</p>
        <p className="text-sm text-[#1A1A1A]/70" style={{ fontWeight: 450 }}>
          {strong
            ? "Strong understanding across this session."
            : "Good effort — review the topic and try again to lock it in."}
        </p>
        <div className="mt-4 h-2 bg-[#C4B5FD]/20 rounded-full overflow-hidden max-w-md mx-auto">
          <div
            className={`h-full rounded-full ${strong ? "bg-[#3B82F6]" : "bg-amber-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-gray-50 rounded-[20px] p-6 mb-6 space-y-4">
        <h3 className="font-semibold text-[#1A1A1A] mb-4">Score Breakdown</h3>

        {quizTotal > 0 && (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[#1A1A1A]">Multiple Choice</p>
              <p className="text-sm text-[#1A1A1A]/60">{quizCorrect} of {quizTotal} correct</p>
            </div>
            <p className={`text-2xl font-bold ${mcPct >= 70 ? "text-[#3B82F6]" : "text-orange-500"}`}>
              {mcPct}%
            </p>
          </div>
        )}

        {checkTotal > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <div>
              <p className="font-medium text-[#1A1A1A]">Attention Checks</p>
              <p className="text-sm text-[#1A1A1A]/60">{checkCorrect} of {checkTotal} correct</p>
            </div>
            <p className={`text-2xl font-bold ${acPct >= 70 ? "text-[#3B82F6]" : "text-orange-500"}`}>
              {acPct}%
            </p>
          </div>
        )}

        <div className="border-t-2 border-[#1A1A1A]/20 pt-4 mt-4 flex items-center justify-between">
          <p className="font-semibold text-[#1A1A1A]">Points Earned</p>
          <p className="text-3xl font-bold text-emerald-600">{points}</p>
        </div>
      </div>

      <Button
        onClick={onSeeLeaderboard}
        className="w-full h-12 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white text-base font-semibold rounded-full"
      >
        <Trophy className="w-5 h-5 mr-2" />
        See class leaderboard
      </Button>
    </div>
  );
}

function LeaderboardView({ participants, you, ended }) {
  const myRank = participants.findIndex((p) => p.id === you?.id);
  const handleFinish = () => {
    try {
      sessionStorage.removeItem("quest_anon_join");
    } catch { /* ignore */ }
    // Send students back to the join page so the device is ready for the
    // next session / next student.
    window.location.href = "/Join";
  };
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
      <div className="text-center mb-5">
        <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-2" />
        <h2 className="text-2xl font-bold text-slate-900">
          {ended ? "Session ended" : "Session complete"}
        </h2>
        {myRank >= 0 && (
          <p className="text-sm text-slate-500 mt-1">
            You finished <span className="font-bold text-slate-900">#{myRank + 1}</span> with{" "}
            <span className="font-bold text-slate-900">{you?.total_points || 0} points</span>
          </p>
        )}
      </div>
      <ol className="space-y-2 mb-5">
        {participants.slice(0, 10).map((p, i) => {
          const isMe = p.id === you?.id;
          return (
            <li
              key={p.id}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                isMe ? "border-indigo-300 bg-indigo-50" :
                i === 0 ? "border-amber-300 bg-amber-50" :
                "border-slate-200 bg-white"
              }`}
            >
              <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${
                i === 0 ? "bg-amber-500 text-white" :
                i === 1 ? "bg-slate-400 text-white" :
                i === 2 ? "bg-amber-700 text-white" :
                "bg-slate-200 text-slate-700"
              }`}>
                {i + 1}
              </span>
              <span className="flex-1 font-semibold text-slate-900">
                {p.display_name || "Anonymous"}
                {isMe && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-indigo-700">
                    you
                  </span>
                )}
              </span>
              <span className="text-lg font-extrabold text-slate-900">{p.total_points || 0}</span>
            </li>
          );
        })}
      </ol>

      <Button
        onClick={handleFinish}
        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold"
      >
        <CheckCircle className="w-5 h-5 mr-2" />
        Finish &amp; exit
      </Button>
    </div>
  );
}
