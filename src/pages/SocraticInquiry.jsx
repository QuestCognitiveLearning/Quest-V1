import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Loader2, ArrowRight, Sparkles, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MathRenderer from "@/components/utils/MathRenderer";
import { LLM_MODELS } from "@/lib/llmModels";

// Flow:
// Q1: Observation FR — student observes image, writes freely. Panda acknowledges.
// Q2: Analogy MC — everyday analogy for the topic (3 options)
// Q3: Bridge MC — connects analogy to real academic concept (3 options)
// Step 4: Summary statement — Panda summarizes analogy-to-bridge connection (no student input)
// Q4: Transfer FR — the actual hook_question from the inquiry session

export default function SocraticInquiry() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inquirySession, setInquirySession] = useState(null);
  const [subunit, setSubunit] = useState(null);
  const [user, setUser] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [waitingForTutor, setWaitingForTutor] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const messagesEndRef = useRef(null);

  // phase: "q1_fr" | "q2_mc" | "q3_mc" | "q4_fr" | "complete"
  const [phase, setPhase] = useState("q1_fr");

  const [frInput, setFrInput] = useState("");
  const [frSubmitting, setFrSubmitting] = useState(false);

  const [mcChoices, setMcChoices] = useState([]);
  const [mcSelected, setMcSelected] = useState(null);
  const [mcSubmitted, setMcSubmitted] = useState(false);
  const [mcCorrectIndex, setMcCorrectIndex] = useState(null);
  const [generatingChoices, setGeneratingChoices] = useState(false);

  const [currentMcQuestion, setCurrentMcQuestion] = useState("");

  // Store analogy + bridge answers to feed into summary
  const [analogyAnswer, setAnalogyAnswer] = useState("");
  const [bridgeAnswer, setBridgeAnswer] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const subunitId = urlParams.get("topic");
  const isLiveSession = urlParams.get("live") === "true";
  const sessionCode = urlParams.get("code");

  useEffect(() => { loadData(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversationHistory, phase]);

  const subunitName = subunit?.subunit_name || "this topic";

  const loadData = async () => {
    try {
      const currentUser = await quest.auth.me();
      setUser(currentUser);

      if (isLiveSession && sessionCode) {
        const liveSessions = await quest.entities.LiveSession.filter({ session_code: sessionCode });
        if (liveSessions.length > 0) {
          const liveSession = liveSessions[0];
          if (liveSession.inquiry_content) {
            setInquirySession({
              hook_image_url: liveSession.inquiry_content.hook_image_url,
              hook_question: liveSession.inquiry_content.hook_question,
            });
            setSubunit({ subunit_name: liveSession.subunit_name });
          }
        }
      } else if (subunitId) {
        const [subunitData, inquiryData] = await Promise.all([
          quest.entities.Subunit.filter({ id: subunitId }),
          quest.entities.InquirySession.filter({ subunit_id: subunitId })
        ]);
        if (subunitData.length > 0) setSubunit(subunitData[0]);
        if (inquiryData.length > 0) setInquirySession(inquiryData[0]);
      }
    } catch (err) {
      console.error("Failed to load inquiry data:", err);
    } finally {
      setLoading(false);
    }
  };

  const addMessage = (history, msg) => {
     const updated = [...history, msg];
     setConversationHistory(updated);
     return updated;
   };

   // Shuffle choices and update correct index
   const shuffleChoices = (choices, correctIndex) => {
     const withIndices = choices.map((choice, idx) => ({ choice, originalIdx: idx }));
     for (let i = withIndices.length - 1; i > 0; i--) {
       const j = Math.floor(Math.random() * (i + 1));
       [withIndices[i], withIndices[j]] = [withIndices[j], withIndices[i]];
     }
     const shuffled = withIndices.map(item => item.choice);
     const newCorrectIdx = withIndices.findIndex(item => item.originalIdx === correctIndex);
     return { shuffled, newCorrectIdx };
   };

  // Q1: student submits free-response observation. Panda acknowledges warmly.
  const handleQ1Submit = async () => {
    if (!frInput.trim()) return;
    setFrSubmitting(true);

    const observation = frInput.trim();
    const userHistory = addMessage([], { role: "user", content: observation });
    setFrInput("");
    setWaitingForTutor(true);

    try {
      const ack = await quest.integrations.Core.InvokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `You are Quest Panda, a warm Socratic tutor. Topic: "${subunitName}".
Student's observation of the image: "${observation}"

First decide whether they actually shared an observation. If their message is off-topic, gibberish, blank, or says they're unsure (e.g. "idk", "i don't know", "not sure", "?"), do NOT pretend they gave a real observation — in 1-2 sentences warmly acknowledge they're not sure yet, reassure them that's okay, and invite them to just guess or name anything they notice.
Otherwise, in 1–2 sentences warmly acknowledge what they noticed — pick up on a specific word they used (use **bold**).
Either way, do NOT ask a quiz question. Just respond supportively and say you'll explore this together.`
      });

      const withAck = addMessage(userHistory, { role: "assistant", content: ack });
      setQuestionCount(1);
      await generateAnalogyMc(withAck);
    } catch (err) {
      console.error(err);
      const withAck = addMessage(userHistory, { role: "assistant", content: `You noticed something real there. Let's explore **${subunitName}** together.` });
      await generateAnalogyMc(withAck);
    } finally {
      setWaitingForTutor(false);
      setFrSubmitting(false);
    }
  };

  // Q2: Analogy MC
  const generateAnalogyMc = async (history) => {
    setGeneratingChoices(true);
    setMcChoices([]);
    setMcSelected(null);
    setMcSubmitted(false);
    setMcCorrectIndex(null);

    try {
      const result = await quest.integrations.Core.InvokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `You are Quest Panda. Topic: "${subunitName}".

      Generate an everyday analogy scenario and ask a multiple choice question that tests the student's understanding of ONLY the analogy itself—not the academic concept yet. Limit it to 1-2 sentences.

      The question should test comprehension of what happens in the everyday scenario, with 3 randomized plausible options where only one correctly describes the analogy.

      Return JSON:
      {
      "question": "Everyday analogy comprehension question?",
      "choices": ["Correct understanding of analogy", "Misconception about analogy", "Different interpretation"],
      "correct_index": 0
      }`,
        response_json_schema: {
          type: "object",
          properties: {
            question: { type: "string" },
            choices: { type: "array", items: { type: "string" } },
            correct_index: { type: "number" }
          }
        }
      });

      const question = result.question || `What everyday experience relates to ${subunitName}?`;
       setCurrentMcQuestion(question);
       addMessage(history, { role: "assistant", content: `**Analogy:** ${question}` });
       const choices = (result.choices || []).slice(0, 3);
       const correctIdx = result.correct_index ?? 0;
       const { shuffled, newCorrectIdx } = shuffleChoices(choices, correctIdx);
       setMcChoices(shuffled);
       setMcCorrectIndex(newCorrectIdx);
       setPhase("q2_mc");
    } catch (err) {
      const fallbackQ = `Think of a time when something kept moving after you stopped pushing it. Why did that happen?`;
      setCurrentMcQuestion(fallbackQ);
      addMessage(history, { role: "assistant", content: `**Analogy:** ${fallbackQ}` });
      setMcChoices(["It already had motion built up", "Something invisible pushed it", "It was going downhill"]);
      setMcCorrectIndex(0);
      setPhase("q2_mc");
    } finally {
      setGeneratingChoices(false);
    }
  };

  // Q2 submitted — Panda responds, generates Q3 Bridge MC
  const handleQ2McSubmit = async () => {
    if (mcSelected === null) return;
    setMcSubmitted(true);

    const isCorrect = mcSelected === mcCorrectIndex;
    const choiceText = mcChoices[mcSelected];
    setAnalogyAnswer(choiceText);
    const withUser = addMessage(conversationHistory, { role: "user", content: choiceText });
    setWaitingForTutor(true);

    try {
      const response = await quest.integrations.Core.InvokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `You are Quest Panda. Topic: "${subunitName}".
Student answered the analogy question: "${currentMcQuestion}"
Their choice: "${choiceText}" | Correct: "${mcChoices[mcCorrectIndex]}" | Was correct: ${isCorrect}

In 1-2 sentences:
1. If correct, affirm briefly then push deeper. If incorrect, gently redirect without giving the answer away. Use **bold** on a key word from their choice.
2. Explicitly name the connection: explain HOW the everyday analogy maps onto the real concept of "${subunitName}" — what plays the role of what.
3. Ask a bridge question that uses this mapping to test whether they can now apply the concept in its academic form. Do NOT list answer choices — they will be shown separately.`
      });

      const withPanda = addMessage(withUser, { role: "assistant", content: response });
      setQuestionCount(2);
      await generateBridgeMc(withPanda, response);
    } catch (err) {
      console.error(err);
      const withPanda = addMessage(withUser, { role: "assistant", content: `Interesting! How does this connect to **${subunitName}** itself?` });
      await generateBridgeMc(withPanda, `How does this connect to ${subunitName}?`);
    } finally {
      setWaitingForTutor(false);
    }
  };

  // Q3: Bridge MC
  const generateBridgeMc = async (history, tutorQuestion) => {
    setGeneratingChoices(true);
    setMcChoices([]);
    setMcSelected(null);
    setMcSubmitted(false);
    setMcCorrectIndex(null);

    try {
      const result = await quest.integrations.Core.InvokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `You are Quest Panda. Topic: "${subunitName}".
Bridge question: "${tutorQuestion}"

Generate 3 randomized MC options that answer the bridge question using the real academic concept of "${subunitName}". The correct option must use accurate terminology and directly follow from the analogy-to-concept mapping. Misconceptions should reflect common student errors. Each option under 12 words.

Return JSON:
{
  "choices": ["correct academic concept", "misconception 1", "misconception 2"],
  "correct_index": 0
}`,
        response_json_schema: {
          type: "object",
          properties: {
            choices: { type: "array", items: { type: "string" } },
            correct_index: { type: "number" }
          }
        }
      });

      const choices = (result.choices || []).slice(0, 3);
       const correctIdx = result.correct_index ?? 0;
       const { shuffled, newCorrectIdx } = shuffleChoices(choices, correctIdx);
       setMcChoices(shuffled);
       setMcCorrectIndex(newCorrectIdx);
       setPhase("q3_mc");
    } catch (err) {
      setMcChoices([`The key principle of ${subunitName}`, "An unrelated force", "A coincidence"]);
      setMcCorrectIndex(0);
      setPhase("q3_mc");
    } finally {
      setGeneratingChoices(false);
    }
  };

  // Q3 submitted — Panda generates a summary statement, then injects hook question
  const handleQ3McSubmit = async () => {
    if (mcSelected === null) return;
    setMcSubmitted(true);

    const isCorrect = mcSelected === mcCorrectIndex;
    const choiceText = mcChoices[mcSelected];
    setBridgeAnswer(choiceText);
    const withUser = addMessage(conversationHistory, { role: "user", content: choiceText });
    setWaitingForTutor(true);

    try {
      const summary = await quest.integrations.Core.InvokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `You are Quest Panda. Topic: "${subunitName}".
The student just completed an analogy-to-bridge journey:
- Analogy answer: "${analogyAnswer}"
- Bridge answer: "${choiceText}" | Correct: "${mcChoices[mcCorrectIndex]}" | Was correct: ${isCorrect}

Write a 1-2 sentence summary statement (NOT a question) that:
1. Ties together the everyday analogy and the real academic concept of "${subunitName}" — make it click.
2. Uses **bold** on the key academic term.
3. Ends with a warm transition like "Now let's put your understanding to the test with one final question."`
      });

      const withSummary = addMessage(withUser, { role: "assistant", content: summary });
      setQuestionCount(3);
      await injectHookQuestion(withSummary);
    } catch (err) {
      console.error(err);
      const withSummary = addMessage(withUser, { role: "assistant", content: `Great work connecting the analogy to **${subunitName}**! Now let's put your understanding to the test with one final question.` });
      await injectHookQuestion(withSummary);
    } finally {
      setWaitingForTutor(false);
    }
  };

  // Inject the actual hook_question as the final FR prompt
  const injectHookQuestion = async (history) => {
    const hookQ = inquirySession?.hook_question;
    if (hookQ) {
      addMessage(history, { role: "assistant", content: `**Final question:** ${hookQ}` });
    }
    setQuestionCount(4);
    setPhase("q4_fr");
  };

  // Q4: answer the real hook question
  const handleQ4Submit = async () => {
    if (!frInput.trim()) return;
    setFrSubmitting(true);

    const withUser = addMessage(conversationHistory, { role: "user", content: frInput.trim() });
    const input = frInput.trim();
    setFrInput("");
    setWaitingForTutor(true);

    try {
      const response = await quest.integrations.Core.InvokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `You are Quest Panda. Topic: "${subunitName}".
The inquiry question was: "${inquirySession?.hook_question}"
Student's answer: "${input}"

This is the FINAL exchange. First judge whether the student genuinely engaged. If their answer is off-topic, evasive, gibberish, or says they're unsure (e.g. "idk", "i don't know", "not sure"), do NOT pretend they nailed it — in 2 sentences warmly acknowledge they're unsure and that it's okay, then hand them the one key insight to "${subunitName}" yourself in plain terms (use **bold** on the key idea).
If they did engage, in 2 sentences affirm their answer with **bold** on their key insight — be specific.
Either way, end exactly with: "Brilliant thinking! Now let's watch the video to see the full picture." and DO NOT ask another question.`
      });

      addMessage(withUser, { role: "assistant", content: response });
      setQuestionCount(5);
      setPhase("complete");
    } catch (err) {
      console.error(err);
      addMessage(withUser, { role: "assistant", content: "Brilliant thinking! Now let's watch the video to see the full picture." });
      setPhase("complete");
    } finally {
      setWaitingForTutor(false);
      setFrSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!isLiveSession && user && inquirySession && conversationHistory.length > 0 && inquirySession.id) {
      try {
        await quest.entities.InquiryResponse.create({
          student_id: user.id,
          subunit_id: subunitId,
          inquiry_session_id: inquirySession.id,
          initial_guess: conversationHistory.find(m => m.role === "user")?.content || "",
          conversation_history: conversationHistory
        });
      } catch (err) {
        console.error("Failed to save inquiry response:", err);
      }
    }

    if (isLiveSession && sessionCode) {
      window.location.href = createPageUrl("LiveSessionPlay") + `?code=${sessionCode}`;
    } else {
      navigate(createPageUrl("NewSession") + `?topic=${subunitId}&skipInquiry=true`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F5FF] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
            <span className="text-3xl">🐼</span>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          <p className="text-violet-700 font-medium">Loading your inquiry...</p>
        </div>
      </div>
    );
  }

  if (!inquirySession) {
    return (
      <div className="min-h-screen bg-[#F9F5FF] flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-md">
          <span className="text-5xl mb-4 block">🐼</span>
          <p className="text-gray-600 mb-6">Inquiry session not available</p>
          <button
            onClick={() => navigate(createPageUrl("LearningHub"))}
            className="bg-violet-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-violet-700 transition-colors"
          >
            Return to Learning Hub
          </button>
        </div>
      </div>
    );
  }

  const isMcPhase = phase === "q2_mc" || phase === "q3_mc";
  const isFrPhase = phase === "q1_fr" || phase === "q4_fr";

  const phaseLabels = {
    q1_fr: "Observation",
    q2_mc: "Analogy",
    q3_mc: "Bridge",
    q4_fr: "Transfer",
    complete: "Complete"
  };

  return (
    <div className="min-h-screen bg-[#F9F5FF] flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-violet-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center">
            <span className="text-xl">🐼</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Quest Panda</p>
            <p className="text-xs text-violet-500">{subunit?.subunit_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {["Observe", "Analogy", "Bridge", "Transfer"].map((label, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                questionCount > i ? "bg-violet-500" : questionCount === i ? "bg-violet-300 animate-pulse" : "bg-violet-100"
              }`} />
              <span className="text-[9px] text-gray-400 hidden md:block">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Split Screen */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* LEFT PANEL — Image */}
        <div className="md:w-3/5 bg-gradient-to-br from-violet-50 to-purple-100 flex flex-col items-center justify-center p-8 md:sticky md:top-[65px] md:h-[calc(100vh-65px)]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-4xl"
          >
            {inquirySession.hook_image_url ? (
              <img
                src={inquirySession.hook_image_url}
                alt="Inquiry illustration"
                className="w-full rounded-3xl shadow-2xl object-cover aspect-square"
              />
            ) : (
              <div className="w-full aspect-square rounded-3xl bg-gradient-to-br from-violet-200 to-purple-300 flex items-center justify-center shadow-2xl">
                <span className="text-9xl">🐼</span>
              </div>
            )}
            <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-violet-100">
              <p className="text-base text-gray-600 italic">🔍 Analyze this carefully — what do you notice?</p>
            </div>
          </motion.div>
        </div>

        {/* RIGHT PANEL — Chat + Input */}
        <div className="md:w-2/5 flex flex-col overflow-y-auto bg-white">
          <div className="flex-1 p-6 md:p-8 space-y-6 max-h-[calc(100vh-65px)] overflow-y-auto">

            {/* Conversation */}
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {conversationHistory.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      msg.role === "user" ? "bg-green-100 text-green-700" : "bg-violet-100"
                    }`}>
                      {msg.role === "user" ? "You" : "🐼"}
                    </div>
                    <div className={`max-w-[85%] px-5 py-3.5 rounded-2xl text-lg font-medium leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-green-50 text-gray-800 border border-green-200"
                        : "bg-violet-50 text-gray-800 border border-violet-200"
                    }`}>
                      {msg.content.split(/(\*\*.*?\*\*)/).map((part, i) =>
                        part.startsWith("**") && part.endsWith("**")
                          ? <strong key={i} className="text-violet-700">{part.slice(2, -2)}</strong>
                          : <MathRenderer key={i} text={part} />
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {(waitingForTutor || generatingChoices) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">🐼</div>
                  <div className="bg-violet-50 border border-violet-200 px-5 py-3.5 rounded-2xl flex items-center gap-2 shadow-sm">
                    <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                    <span className="text-base text-violet-600 font-medium">Quest Panda is thinking...</span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* FR Input */}
            {isFrPhase && !waitingForTutor && !frSubmitting && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-violet-500 uppercase tracking-wider bg-violet-50 px-2 py-1 rounded-full">
                    {phaseLabels[phase]}
                  </span>
                </div>
                <textarea
                  value={frInput}
                  onChange={e => setFrInput(e.target.value)}
                  placeholder={
                    phase === "q1_fr" ? "What do you notice? What do you think is happening here? (1–2 sentences)"
                    : "Your answer..."
                  }
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-violet-400 focus:outline-none text-base text-gray-800 resize-none shadow-sm"
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (phase === "q1_fr") handleQ1Submit();
                      else if (phase === "q4_fr") handleQ4Submit();
                    }
                  }}
                />
                <button
                  onClick={phase === "q1_fr" ? handleQ1Submit : handleQ4Submit}
                  disabled={!frInput.trim()}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-200 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-semibold transition-all duration-200 shadow-md flex items-center justify-center gap-2"
                >
                  {phase === "q4_fr" ? "Submit & Finish" : "Submit"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* MC Input */}
            {isMcPhase && mcChoices.length > 0 && !mcSubmitted && !waitingForTutor && !generatingChoices && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <span className="text-xs font-bold text-violet-500 uppercase tracking-wider bg-violet-50 px-2 py-1 rounded-full inline-block">
                  {phaseLabels[phase]}
                </span>
                {mcChoices.map((choice, idx) => (
                   <button
                     key={idx}
                     onClick={() => setMcSelected(idx)}
                     className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-lg font-medium transition-all duration-200 shadow-sm ${
                       mcSelected === idx
                         ? "border-violet-500 bg-violet-50 text-violet-800 shadow-md scale-[1.01]"
                         : "border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50"
                     }`}
                   >
                     <MathRenderer text={choice} />
                   </button>
                 ))}
                <button
                  onClick={() => {
                    if (phase === "q2_mc") handleQ2McSubmit();
                    else if (phase === "q3_mc") handleQ3McSubmit();
                  }}
                  disabled={mcSelected === null}
                  className="w-full mt-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-200 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-semibold transition-all duration-200 shadow-md flex items-center justify-center gap-2"
                >
                  Submit Answer <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* MC Feedback */}
            {isMcPhase && mcSubmitted && mcChoices.length > 0 && !waitingForTutor && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                {mcChoices.map((choice, idx) => (
                  <div key={idx} className={`w-full px-5 py-4 rounded-2xl border-2 text-lg font-medium flex items-center gap-3 ${
                    idx === mcCorrectIndex
                      ? "border-green-400 bg-green-50 text-green-800"
                      : idx === mcSelected
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-gray-100 bg-gray-50 text-gray-400"
                  }`}>
                    <MathRenderer text={choice} />
                    {idx === mcCorrectIndex && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                    {idx === mcSelected && idx !== mcCorrectIndex && <XCircle className="w-4 h-4 text-red-400 ml-auto" />}
                  </div>
                ))}
              </motion.div>
            )}

            {/* Complete */}
            {phase === "complete" && !waitingForTutor && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-violet-50 to-green-50 border-2 border-violet-200 rounded-3xl p-6 text-center shadow-lg"
              >
                <span className="text-4xl mb-3 block">🎉</span>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Amazing thinking!</h3>
                <p className="text-lg text-gray-600 mb-6">You've explored this topic through guided inquiry. Now let's watch the video!</p>
                <button
                  onClick={handleComplete}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-4 rounded-full font-bold text-base shadow-xl transition-all hover:scale-105 flex items-center gap-2 mx-auto"
                >
                  Continue to Video
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}