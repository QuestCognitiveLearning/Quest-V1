import React, { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { supabase } from "@/components/lib/supabase-client.jsx";

/**
 * Final contact-us section. Sends the form straight to admin@questlearning.co
 * via the `contactForm` Supabase Edge Function (anon, IP rate-limited).
 *
 * UX:
 *   - Idle    → show form
 *   - Sending → spinner, button disabled
 *   - Sent    → success state (no form reload, no mailto popup)
 *   - Error   → inline error, form stays editable, button re-enables
 *
 * Fallback:
 *   If the function call fails entirely (network down, function 5xx), we fall
 *   back to the mailto: link below — the user always has a way to reach us.
 */
export default function CtaFinal() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [honeypot, setHoneypot] = useState(""); // bot trap, never shown
  const [state, setState] = useState("idle"); // 'idle' | 'sending' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (state === "sending") return;

    // Minimal client-side validation; the server validates again.
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email so we can reply.");
      setState("error");
      return;
    }
    if (msg.trim().length < 4) {
      setErrorMsg("Tell us a line or two about what you're hoping to use Quest for.");
      setState("error");
      return;
    }

    setState("sending");
    setErrorMsg("");

    try {
      const { data, error } = await supabase.functions.invoke("contactForm", {
        body: {
          name: name.trim(),
          email: email.trim(),
          message: msg.trim(),
          honeypot,
        },
      });
      if (error) throw new Error(error.message || "Failed to send");
      if (data && data.error) throw new Error(data.error);
      setState("sent");
    } catch (err) {
      // Surface a friendly message; details land in console.
      console.error("[contactForm] send failed:", err);
      setErrorMsg(
        err?.message ||
          "We couldn't send your message right now. Please try again, or email admin@questlearning.co directly."
      );
      setState("error");
    }
  };

  return (
    <section id="cta-final" className="bg-[#EEF3FB]" style={{ padding: "72px 0 24px" }}>
      <div className="lp-v3-container">
        <div
          className="rounded-[28px] p-10 lg:p-14 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(160deg, #2563EB 0%, #1D4ED8 60%, #1E1B4B 100%)",
            // Keep the card visually tall even in the compact success state so
            // there's always a generous block of dark blue between the inner
            // success card and the page footer below.
            minHeight: "520px",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(700px 320px at 100% 100%, rgba(249,115,22,0.28), transparent 65%), radial-gradient(500px 280px at 0% 0%, rgba(255,255,255,0.12), transparent 70%)",
            }}
          />
          <div className="relative">
            <h2
              className="font-extrabold text-white max-w-[24ch]"
              style={{
                fontSize: "clamp(32px, 4.2vw, 52px)",
                lineHeight: "1.05",
                letterSpacing: "-0.025em",
              }}
            >
              Bring Quest to <em className="not-italic text-[#F97316]">your school.</em>
            </h2>
            <p className="text-white/80 text-base mt-4 mb-7 max-w-[50ch]">
              Tell us about your school — we'll get back within a day.
            </p>

            {state === "sent" ? (
              <div
                role="status"
                className="max-w-[600px] bg-white/10 border border-white/20 rounded-2xl p-6 flex items-start gap-4"
              >
                <div className="w-9 h-9 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
                  <Check size={20} strokeWidth={2.6} className="text-white" />
                </div>
                <div>
                  <div className="font-bold text-white text-lg">
                    Message sent — thank you.
                  </div>
                  <div className="text-white/80 text-sm mt-1.5 leading-relaxed">
                    We got your note and will reply to{" "}
                    <span className="text-[#F97316] font-medium">
                      {email || "your email"}
                    </span>{" "}
                    within a day.
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3 max-w-[600px]">
                {/* Honeypot — visually hidden, real users never fill it. */}
                <input
                  type="text"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  style={{
                    position: "absolute",
                    left: "-10000px",
                    width: "1px",
                    height: "1px",
                    opacity: 0,
                  }}
                  aria-hidden="true"
                />

                <div className="grid sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={state === "sending"}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white text-[14px] outline-none placeholder:text-white/50 focus:border-[#F97316] focus:bg-white/[0.14] transition-colors disabled:opacity-60"
                  />
                  <input
                    type="email"
                    placeholder="your.work@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={state === "sending"}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white text-[14px] outline-none placeholder:text-white/50 focus:border-[#F97316] focus:bg-white/[0.14] transition-colors disabled:opacity-60"
                  />
                </div>
                <textarea
                  placeholder="A line or two about your role and what you're hoping to use Quest for…"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  rows={3}
                  disabled={state === "sending"}
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white text-[14px] outline-none placeholder:text-white/50 focus:border-[#F97316] focus:bg-white/[0.14] transition-colors resize-y disabled:opacity-60"
                />

                {state === "error" && (
                  <div className="text-[#FCA5A5] text-sm bg-[#7F1D1D]/30 border border-[#B91C1C]/40 rounded-lg px-4 py-2.5">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="inline-flex items-center gap-2 self-start h-12 px-6 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-[14.5px] transition-colors mt-1 shadow-[0_8px_20px_-10px_rgba(249,115,22,0.6)] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {state === "sending" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send Message
                      <ArrowRight size={14} strokeWidth={2.2} />
                    </>
                  )}
                </button>
                <p className="text-white/60 text-[12.5px] mt-1.5">
                  Or email us directly at{" "}
                  <a
                    href="mailto:admin@questlearning.co"
                    className="text-[#F97316] underline underline-offset-2"
                  >
                    admin@questlearning.co
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
