/**
 * @file   ContactSalesModal.jsx
 * @desc   Reusable in-app contact form, opened from any "Contact Sales" /
 *         "Contact Us" CTA. Sends the message through the existing
 *         `contactForm` Supabase Edge Function (anon, IP rate-limited,
 *         honeypotted) so admin@questlearning.co receives it server-side —
 *         no mailto popup, no client email client involved.
 *
 *         Portals to document.body so the modal can't be trapped by an
 *         ancestor's stacking context.
 *
 * @author Quest Learning core team
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/components/lib/supabase-client.jsx";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} [props.topic]            - Free-form tag prepended to the
 *                                            outbound message (e.g. "Enterprise
 *                                            Plan Inquiry") so the admin inbox
 *                                            can sort by intent.
 * @param {string} [props.heading]          - Modal heading. Defaults to
 *                                            "Talk to our team".
 * @param {string} [props.subheading]       - Subtitle copy under the heading.
 * @param {{ name?: string, email?: string }} [props.defaults] - Prefill values
 *                                            for the form (e.g. signed-in user).
 */
export default function ContactSalesModal({
  open,
  onClose,
  topic,
  heading = "Talk to our team",
  subheading = "Tell us about your school or district — we'll reply within a day.",
  defaults,
}) {
  const [name, setName] = useState(defaults?.name || "");
  const [email, setEmail] = useState(defaults?.email || "");
  const [msg, setMsg] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState("idle"); // 'idle' | 'sending' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState("");

  // Reset form whenever the modal is reopened so a previous submission's state
  // doesn't carry over into a second visit.
  useEffect(() => {
    if (open) {
      setName(defaults?.name || "");
      setEmail(defaults?.email || "");
      setMsg("");
      setHoneypot("");
      setState("idle");
      setErrorMsg("");
    }
  }, [open, defaults?.name, defaults?.email]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && state !== "sending") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, state]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (state === "sending") return;

    // Light client-side validation (the server validates again).
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email so we can reply.");
      setState("error");
      return;
    }
    if (msg.trim().length < 4) {
      setErrorMsg("Tell us a line or two about what you're looking for.");
      setState("error");
      return;
    }

    setState("sending");
    setErrorMsg("");

    // Prepend the topic tag to the body so the inbox can be filtered. The
    // server-side function builds the email subject from name/email, so this
    // tag is the cleanest place to mark the intent for downstream routing.
    const messageBody = topic
      ? `[${topic}]\n\n${msg.trim()}`
      : msg.trim();

    try {
      const { data, error } = await supabase.functions.invoke("contactForm", {
        body: {
          name: name.trim(),
          email: email.trim(),
          message: messageBody,
          honeypot,
        },
      });
      if (error) throw new Error(error.message || "Failed to send");
      if (data && data.error) throw new Error(data.error);
      setState("sent");
    } catch (err) {
      console.error("[ContactSalesModal] send failed:", err);
      setErrorMsg(
        err?.message ||
          "We couldn't send your message right now. Please try again, or email admin@questlearning.co directly."
      );
      setState("error");
    }
  };

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onClick={state === "sending" ? undefined : onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 560,
          background:
            "linear-gradient(160deg, #2563EB 0%, #1D4ED8 60%, #1E1B4B 100%)",
          color: "#fff",
          borderRadius: 24,
          padding: "32px 32px 28px",
          boxShadow: "0 32px 80px -12px rgba(15,23,42,0.4)",
          fontFamily:
            "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* coral / blue radial accents, matching CtaFinal on the landing */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(500px 240px at 100% 100%, rgba(249,115,22,0.30), transparent 65%), radial-gradient(360px 200px at 0% 0%, rgba(255,255,255,0.10), transparent 70%)",
          }}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          disabled={state === "sending"}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            border: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: state === "sending" ? "not-allowed" : "pointer",
            opacity: state === "sending" ? 0.5 : 1,
            zIndex: 1,
          }}
        >
          <X size={18} strokeWidth={2.2} />
        </button>

        <div style={{ position: "relative" }}>
          <h2
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            {heading}
          </h2>
          <p
            style={{
              margin: "10px 0 22px",
              color: "rgba(255,255,255,0.78)",
              fontSize: 14.5,
              lineHeight: 1.5,
            }}
          >
            {subheading}
          </p>

          {state === "sent" ? (
            <div
              role="status"
              style={{
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 16,
                padding: 20,
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: "#16A34A",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Check size={20} strokeWidth={2.6} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
                  Message sent — thank you.
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.78)",
                    fontSize: 13.5,
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  We got your note and will reply to{" "}
                  <span style={{ color: "#F97316", fontWeight: 500 }}>
                    {email || "your email"}
                  </span>{" "}
                  within a day.
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={submit}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {/* Honeypot — invisible to real users, bots fill it. */}
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: -10000,
                  width: 1,
                  height: 1,
                  opacity: 0,
                }}
              />

              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={state === "sending"}
                style={inputStyle}
              />
              <input
                type="email"
                placeholder="your.work@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={state === "sending"}
                style={inputStyle}
              />
              <textarea
                placeholder={
                  topic
                    ? `Tell us about your school size, current curriculum, and what you're hoping to use Quest for…`
                    : `What can we help with?`
                }
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={4}
                disabled={state === "sending"}
                style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
              />

              {state === "error" && (
                <div
                  style={{
                    color: "#FCA5A5",
                    fontSize: 13,
                    background: "rgba(127,29,29,0.30)",
                    border: "1px solid rgba(185,28,28,0.40)",
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={state === "sending"}
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 6,
                  height: 48,
                  padding: "0 22px",
                  background: state === "sending" ? "#D97706" : "#F97316",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14.5,
                  border: 0,
                  borderRadius: 12,
                  cursor: state === "sending" ? "not-allowed" : "pointer",
                  boxShadow: "0 10px 22px -10px rgba(249,115,22,0.6)",
                  opacity: state === "sending" ? 0.85 : 1,
                  transition: "background 200ms ease",
                }}
              >
                {state === "sending" ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Sending…
                  </>
                ) : (
                  <>
                    Send Message
                    <ArrowRight size={14} strokeWidth={2.4} />
                  </>
                )}
              </button>

              <p
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 12,
                  marginTop: 8,
                }}
              >
                Or email us directly at{" "}
                <a
                  href="mailto:admin@questlearning.co"
                  style={{
                    color: "#F97316",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                  }}
                >
                  admin@questlearning.co
                </a>
                .
              </p>
            </form>
          )}
        </div>
      </div>

      {/* tiny keyframes for the spinner — kept inline so this component is
          drop-in regardless of which page mounts it. */}
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return createPortal(modal, document.body);
}

const inputStyle = {
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.20)",
  borderRadius: 12,
  padding: "12px 16px",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 200ms ease, background 200ms ease",
};
