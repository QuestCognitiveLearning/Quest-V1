/**
 * PandaChatWidget — a floating "ask Quest Panda" chat that lives at the root of
 * a student session (learn / review / single / live / self). It stays mounted
 * across phase transitions, so one conversation continues from the video into
 * the quiz and case study.
 *
 * Anti-cheating: when the student is on a graded step (quiz / case study) the
 * current prompt — and, if available, the answer — is passed in so Panda knows
 * exactly what NOT to reveal. Panda explains concepts and nudges with guiding
 * questions but never hands over the answer.
 *
 * Mount ONCE at the top level of a session player, OUTSIDE the phase switch, so
 * it doesn't unmount/reset when the phase changes. Pass the live `phase` and
 * `currentPrompt` as props and they update in place.
 */
import React, { useState, useRef, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { invokeLLM } from "@/components/utils/openai";
import { LLM_MODELS } from "@/lib/llmModels";
import { supabase } from "@/components/lib/supabase-client";

// Render **bold** markers from Panda's replies as actual bold text.
function renderRich(text) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );
}

export default function PandaChatWidget({ topic, phase, currentPrompt }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: "user" | "panda", content }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggedIn, setLoggedIn] = useState(null); // null = still resolving
  const endRef = useRef(null);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => active && setLoggedIn(!!data?.user))
      .catch(() => active && setLoggedIn(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, open]);

  // Per-session message cap: 6 for signed-in students, 4 for anonymous (e.g.
  // a guest in a live session). Treated conservatively as 4 until auth resolves.
  const maxChats = loggedIn ? 6 : 4;
  const used = messages.filter((m) => m.role === "user").length;
  const remaining = Math.max(0, maxChats - used);
  const limitReached = remaining <= 0;

  const send = async () => {
    const text = input.trim();
    if (!text || busy || limitReached) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      // Keep the prompt bounded — last 10 turns is plenty of context.
      const history = next
        .slice(-10)
        .map((m) => `${m.role === "user" ? "Student" : "Panda"}: ${m.content}`)
        .join("\n");

      const guard = currentPrompt
        ? `RIGHT NOW the student is being asked to answer this themselves:\n"""\n${currentPrompt}\n"""\nDo NOT reveal the answer and do NOT say or hint which option is correct. Instead, explain the underlying concept(s) they need so they can work it out themselves — but never state the final answer.`
        : `Explain the idea directly and clearly, but never do their thinking for them on something they're being graded on.`;

      const prompt = `You are Quest Panda, a warm, encouraging study buddy embedded inside a learning session about "${topic || "this topic"}". The student can ask you anything while they work${phase ? ` (they are currently on the ${String(phase).replace(/_/g, " ")} step)` : ""}.

Your job: ANSWER their question directly and explain it clearly — give plain-language explanations, analogies, and definitions.

STYLE RULES:
- Do NOT ask the student questions back or quiz them, unless they explicitly ask you to test/quiz them. Just help.
- Be concise. If your reply runs longer than ~2 sentences, put the single most important takeaway in **bold** (wrap it in **double asterisks**) so it stands out.

ANTI-CHEATING RULE (critical): ${guard} If they ask outright for the answer to the graded question, kindly decline and explain the concept instead.

Conversation so far:
${history}

Panda:`;

      // Signed-in students use the authed LLM path; anonymous students (e.g.
      // live-session guests with no account) can't, so they go through the
      // public, rate-limited publicTryFunnel "panda" action.
      let content = "";
      if (loggedIn) {
        const reply = await invokeLLM({ model: LLM_MODELS.SOCRATIC_TUTOR, prompt });
        content = typeof reply === "string" ? reply : reply?.content || reply?.text || "";
      } else {
        const { data, error } = await supabase.functions.invoke("publicTryFunnel", {
          body: { action: "panda", prompt },
        });
        if (error) throw error;
        content = data?.text || "";
      }
      setMessages((m) => [
        ...m,
        {
          role: "panda",
          content:
            String(content).trim() ||
            "Let's think it through together — which part feels tricky?",
        },
      ]);
    } catch (err) {
      console.error("Panda chat failed:", err);
      setMessages((m) => [
        ...m,
        { role: "panda", content: "Sorry — I had trouble responding. Try again in a moment!" },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Quest Panda"
          className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center text-2xl hover:scale-105 transition-transform"
        >
          <span role="img" aria-hidden="true">🐼</span>
          <span className="absolute -top-[5px] -right-[5px] bg-indigo-600 text-white text-[11px] font-bold leading-none rounded-full px-1.5 py-0.5">
            Ask
          </span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-[60] w-[min(92vw,360px)] h-[min(70vh,520px)] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
            <div className="flex items-center gap-2">
              <span className="text-lg" role="img" aria-hidden="true">🐼</span>
              <span className="font-bold text-sm">Quest Panda</span>
              <span className="text-[10px] font-semibold bg-white/20 rounded-full px-2 py-0.5">
                {remaining} left
              </span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 text-sm px-4 py-6">
                <div className="text-3xl mb-2">🐼</div>
                Stuck on something? Ask me anything and I'll help you think it
                through — but I won't give away answers!
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  {m.role === "panda" ? renderRich(m.content) : m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-2xl rounded-bl-sm text-sm inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Panda is thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {limitReached ? (
            <div className="border-t border-slate-200 p-3 bg-white text-center text-xs text-slate-500">
              You&apos;ve used all your Panda questions for this session. Give it
              your best shot! 🐼
            </div>
          ) : (
            <div className="border-t border-slate-200 p-2.5 flex items-end gap-2 bg-white">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask Panda a question…"
                className="flex-1 resize-none max-h-24 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={send}
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="w-9 h-9 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-indigo-700"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
