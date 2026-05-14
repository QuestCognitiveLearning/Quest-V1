import React, { useState, useEffect, useRef } from "react";
import { quest } from "@/api/questClient";
import { Sparkles, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { invokeLLM } from "@/components/utils/openai";
import { LLM_MODELS } from "@/lib/llmModels";
import { motion, AnimatePresence } from "framer-motion";
import MathRenderer from "@/components/utils/MathRenderer";
import StudentMathInput from "@/components/shared/StudentMathInput";

// Progressive Hybrid Inquiry:
// Q1 — open FR observation (low-stakes, activates prior knowledge)
// Q2–Q3 — diagnostic MC (3 options, Socratic response to choice)
// Q4 — adaptive: MC if struggling (<1 correct), FR if on track
// Q5 — synthesis FR (prediction/connection)

export default function SocraticTutor({ inquirySession, studentGuess, subunit, unitName, onComplete, user }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [questionCount, setQuestionCount] = useState(0);
  const messagesEndRef = useRef(null);

  // phase: "q1_fr" | "q2_mc" | "q3_mc" | "q4_mc" | "q4_fr" | "q5_fr" | "complete"
  const [phase, setPhase] = useState("q1_fr");

  // FR state
  const [frInput, setFrInput] = useState("");
  const [frSubmitting, setFrSubmitting] = useState(false);

  // MC state
  const [mcChoices, setMcChoices] = useState([]);
  const [mcSelected, setMcSelected] = useState(null);
  const [mcSubmitted, setMcSubmitted] = useState(false);
  const [mcCorrect, setMcCorrect] = useState(null);
  const [generatingChoices, setGeneratingChoices] = useState(false);

  const [correctCount, setCorrectCount] = useState(0);

  const subunitName = subunit?.subunit_name || "this topic";

  useEffect(() => {
    initializeTutor();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  const initializeTutor = async () => {
    setLoading(true);
    try {
      // Tutor opens with first message responding to student's initial guess
      const firstMessage = await invokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `You are Quest Panda. Respond in 1-2 sentences max.
      Acknowledge "${studentGuess}" warmly, bold one word, then ask one short question (under 10 words).`
      });

      const initialMessages = [{ role: "assistant", content: firstMessage }];
      setMessages(initialMessages);
      setConversationHistory(initialMessages);
      setPhase("q1_fr");
    } catch (err) {
      console.error("Failed to initialize tutor:", err);
      const fallback = [{ role: "assistant", content: `Interesting observation! What else do you notice?` }];
      setMessages(fallback);
      setConversationHistory(fallback);
      setPhase("q1_fr");
    } finally {
      setLoading(false);
    }
  };

  const generateMcChoices = async (tutorQuestion, history, nextPhase) => {
    setGeneratingChoices(true);
    setMcChoices([]);
    setMcSelected(null);
    setMcSubmitted(false);
    setMcCorrect(null);
    try {
      const result = await quest.integrations.Core.InvokeLLM({
        model: LLM_MODELS.MC_CHOICE_GENERATOR,
        prompt: `3 MC answers (under 10 words each). Best, partial misconception, off-track.
      Question: "${tutorQuestion}"
      {"choices": ["A", "B", "C"], "correct_index": 0}`,
        response_json_schema: {
          type: "object",
          properties: {
            choices: { type: "array", items: { type: "string" } },
            correct_index: { type: "number" }
          }
        }
      });
      setMcChoices((result.choices || []).slice(0, 3));
      setMcCorrect(result.correct_index ?? 0);
      setPhase(nextPhase);
    } catch (err) {
      setMcChoices(["Energy is transferred between systems", "A chemical reaction occurs", "Movement creates the effect"]);
      setMcCorrect(0);
      setPhase(nextPhase);
    } finally {
      setGeneratingChoices(false);
    }
  };

  const addToMessages = (history, newMsg) => {
    const updated = [...history, newMsg];
    setMessages(updated);
    setConversationHistory(updated);
    return updated;
  };

  // Q1 free response submit
  const handleQ1Submit = async () => {
    if (!frInput.trim()) return;
    setFrSubmitting(true);

    const userMsg = { role: "user", content: frInput.trim() };
    const newHistory = addToMessages(conversationHistory, userMsg);
    setFrInput("");

    try {
      const response = await invokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `React warmly to "${frInput.trim()}" in 1-2 sentences. Bold one word. Ask one diagnostic question (under 10 words).`
      });

      const updated = addToMessages(newHistory, { role: "assistant", content: response });
      setQuestionCount(1);
      await generateMcChoices(response, updated, "q2_mc");
    } catch (err) {
      console.error(err);
      const updated = addToMessages(newHistory, { role: "assistant", content: "Great observation! What do you think causes this to happen?" });
      await generateMcChoices("What do you think causes this to happen?", updated, "q2_mc");
    } finally {
      setFrSubmitting(false);
    }
  };

  // Q2 / Q3 MC submit
  const handleMcSubmit = async (currentPhase) => {
    if (mcSelected === null) return;
    setMcSubmitted(true);

    const isCorrect = mcSelected === mcCorrect;
    if (isCorrect) setCorrectCount(prev => prev + 1);

    const choiceText = mcChoices[mcSelected];
    const newHistory = addToMessages(conversationHistory, { role: "user", content: choiceText });

    try {
      const isQ2 = currentPhase === "q2_mc";
      const response = await invokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `1-2 sentences. ${isCorrect ? "Affirm choice, bold one word." : "Ask why they chose that. Hint: " + mcChoices[mcCorrect]}. ${isQ2 ? "One follow-up (under 10 words)." : "Bridge to prediction."}`
      });

      const updated = addToMessages(newHistory, { role: "assistant", content: response });
      setQuestionCount(prev => prev + 1);

      if (isQ2) {
        await generateMcChoices(response, updated, "q3_mc");
      } else {
        // Q3 done — determine Q4 format
        const totalCorrect = correctCount + (isCorrect ? 1 : 0);
        if (totalCorrect < 1) {
          // Struggling: MC with scaffolding
          await generateMcChoices(response, updated, "q4_mc");
        } else {
          // On track: free response
          setPhase("q4_fr");
        }
      }
    } catch (err) {
      console.error(err);
      setPhase(currentPhase === "q2_mc" ? "q3_mc" : "q4_fr");
    }
  };

  // Q4 MC (struggling students)
  const handleQ4McSubmit = async () => {
    if (mcSelected === null) return;
    setMcSubmitted(true);

    const choiceText = mcChoices[mcSelected];
    const newHistory = addToMessages(conversationHistory, { role: "user", content: choiceText });

    try {
      const response = await invokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `Connect to concept in 1-2 sentences. Bold one word. Ask "What would happen if...?" (under 10 words).`
      });

      addToMessages(newHistory, { role: "assistant", content: response });
      setQuestionCount(prev => prev + 1);
      setPhase("q5_fr");
    } catch (err) {
      console.error(err);
      addToMessages(newHistory, { role: "assistant", content: "Great! What would happen if this changed?" });
      setPhase("q5_fr");
    }
  };

  // Q4 FR (on-track students)
  const handleQ4FrSubmit = async () => {
    if (!frInput.trim()) return;
    setFrSubmitting(true);

    const newHistory = addToMessages(conversationHistory, { role: "user", content: frInput.trim() });
    setFrInput("");

    try {
      const response = await invokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `Acknowledge "${frInput.trim()}" warmly in 1-2 sentences. Bold one word. Ask "What would happen if...?" (under 10 words).`
      });

      addToMessages(newHistory, { role: "assistant", content: response });
      setQuestionCount(prev => prev + 1);
      setPhase("q5_fr");
    } catch (err) {
      console.error(err);
      addToMessages(newHistory, { role: "assistant", content: "Excellent! What would happen if this changed?" });
      setPhase("q5_fr");
    } finally {
      setFrSubmitting(false);
    }
  };

  // Q5 synthesis FR
  const handleQ5Submit = async () => {
    if (!frInput.trim()) return;
    setFrSubmitting(true);

    const newHistory = addToMessages(conversationHistory, { role: "user", content: frInput.trim() });
    setFrInput("");

    try {
      const response = await invokeLLM({
        model: LLM_MODELS.SOCRATIC_TUTOR,
        prompt: `Final message. Praise "${frInput.trim()}" in 1-2 sentences, bold one insight. End with: "Brilliant! Now let's watch the video."`
      });

      addToMessages(newHistory, { role: "assistant", content: response });
      setQuestionCount(5);
      setPhase("complete");
    } catch (err) {
      console.error(err);
      addToMessages(newHistory, { role: "assistant", content: "Brilliant! Now let's watch the video." });
      setPhase("complete");
    } finally {
      setFrSubmitting(false);
    }
  };

  const isMcPhase = phase === "q2_mc" || phase === "q3_mc" || phase === "q4_mc";
  const isFrPhase = phase === "q1_fr" || phase === "q4_fr" || phase === "q5_fr";

  const frPlaceholder = phase === "q1_fr"
    ? "What do you notice? What do you think is happening here? (1–2 sentences)"
    : phase === "q4_fr"
    ? "Share your thoughts..."
    : "Based on what we've discussed, what would happen if...?";

  return (
    <div className="w-full flex flex-col md:flex-row min-h-[600px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-violet-100">

      {/* LEFT — Image at intrinsic 1024x1024 */}
      <div className="shrink-0 overflow-auto bg-black flex items-start justify-start" style={{width: 1024}}>
        {inquirySession.hook_image_url ? (
          <img
            src={inquirySession.hook_image_url}
            alt="Inquiry"
            width={1024}
            height={1024}
            className="block"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-200 to-purple-300 flex items-center justify-center" style={{width:1024,height:1024}}>
            <span className="text-8xl">🐼</span>
          </div>
        )}
      </div>

      {/* RIGHT — Chat + Input */}
      <div className="md:w-3/5 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-violet-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-lg">🐼</div>
            <span className="font-bold text-gray-800">Quest Panda</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${questionCount >= i ? "bg-violet-500" : "bg-violet-200"}`} />
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[400px]">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  message.role === "user" ? "bg-green-100 text-green-700" : "bg-violet-100"
                }`}>
                  {message.role === "user" ? "You" : "🐼"}
                </div>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-lg leading-relaxed font-medium ${
                   message.role === "user"
                     ? "bg-green-50 text-gray-800 border border-green-200"
                     : "bg-violet-50 text-gray-800 border border-violet-200"
                 }`}>
                  {message.content.split(/(\*\*.*?\*\*)/).map((part, i) =>
                     part.startsWith("**") && part.endsWith("**")
                       ? <strong key={i} className="text-violet-700">{part.slice(2, -2)}</strong>
                       : <MathRenderer key={i} text={part} />
                   )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {(loading || generatingChoices || frSubmitting) && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center">🐼</div>
              <div className="bg-violet-50 border border-violet-200 px-4 py-3 rounded-2xl flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                <span className="text-sm text-violet-600">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-5 border-t border-violet-100 bg-gray-50/50 space-y-2.5">

          {/* FR Input */}
          {isFrPhase && !loading && !frSubmitting && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              {phase === "q1_fr" && (
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Your observation (no wrong answers!)</p>
              )}
              {phase === "q5_fr" && (
                <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider">🧠 Synthesis — make a prediction</p>
              )}
              <StudentMathInput
                value={frInput}
                onChange={e => setFrInput(e.target.value)}
                placeholder={frPlaceholder}
                multiline={true}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 focus:outline-none text-base text-gray-800 resize-none shadow-sm"
              />
              <button
                onClick={
                  phase === "q1_fr" ? handleQ1Submit :
                  phase === "q4_fr" ? handleQ4FrSubmit :
                  handleQ5Submit
                }
                disabled={!frInput.trim()}
                className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-200 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow"
              >
                {phase === "q5_fr" ? "Submit & Finish" : "Submit"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* MC Choices */}
          {isMcPhase && mcChoices.length > 0 && !mcSubmitted && !generatingChoices && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Choose your answer:</p>
              {mcChoices.map((choice, idx) => (
                 <button
                   key={idx}
                   onClick={() => setMcSelected(idx)}
                   className={`w-full text-left px-4 py-3 rounded-xl border-2 text-base font-medium transition-all duration-200 ${
                     mcSelected === idx
                       ? "border-violet-500 bg-violet-50 text-violet-800 scale-[1.01] shadow-sm"
                       : "border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50"
                   }`}
                 >
                   <span className="inline-block w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-xs font-bold mr-2.5 text-center leading-5">
                     {["A","B","C"][idx]}
                   </span>
                   <MathRenderer text={choice} />
                 </button>
               ))}
              <button
                onClick={() => {
                  if (phase === "q2_mc") handleMcSubmit("q2_mc");
                  else if (phase === "q3_mc") handleMcSubmit("q3_mc");
                  else handleQ4McSubmit();
                }}
                disabled={mcSelected === null}
                className="w-full mt-1 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-200 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow"
              >
                Submit Answer <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* MC Feedback */}
          {isMcPhase && mcSubmitted && mcChoices.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              {mcChoices.map((choice, idx) => (
                <div key={idx} className={`w-full px-4 py-3 rounded-xl border-2 text-base font-medium flex items-center gap-2.5 ${
                  idx === mcCorrect
                    ? "border-green-400 bg-green-50 text-green-800"
                    : idx === mcSelected
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-gray-100 bg-gray-50 text-gray-400"
                }`}>
                  <span className={`inline-block w-5 h-5 rounded-full text-xs font-bold text-center leading-5 ${
                    idx === mcCorrect ? "bg-green-200 text-green-700" : idx === mcSelected ? "bg-red-200 text-red-600" : "bg-gray-200 text-gray-400"
                  }`}>{["A","B","C"][idx]}</span>
                  <MathRenderer text={choice} />
                  {idx === mcCorrect && <CheckCircle className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />}
                  {idx === mcSelected && idx !== mcCorrect && <XCircle className="w-4 h-4 text-red-400 ml-auto flex-shrink-0" />}
                </div>
              ))}
            </motion.div>
          )}

          {/* Complete */}
          {phase === "complete" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-2">
              <p className="text-base text-gray-700 mb-3 font-medium">🎉 Great discussion! Ready to watch the video?</p>
              <button
                onClick={() => onComplete(conversationHistory)}
                className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg transition-all hover:scale-105 flex items-center gap-2 mx-auto"
              >
                Continue to Video <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}