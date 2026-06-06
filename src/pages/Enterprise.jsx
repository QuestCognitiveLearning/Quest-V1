/**
 * Enterprise.jsx — short "book a call" funnel for schools, districts, and
 * tutoring chains. Single CTA: the in-app contact form modal.
 */
import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import ContactSalesModal from "@/components/shared/ContactSalesModal";
import Footer from "@/components/landing/v3/Footer";

const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

const PERSONAS = [
  {
    head: "Schools",
    body:
      "Standardize lesson planning across departments. Centralized admin + per-teacher analytics.",
  },
  {
    head: "Districts",
    body:
      "Quest deployed across every school with custom branding, SSO, and district-wide reporting.",
  },
  {
    head: "Tutoring chains",
    body:
      "Multi-tutor seats, franchise-level branding, parent reports auto-sent on your domain.",
  },
  {
    head: "Test-prep companies",
    body:
      "Custom AI training on your proprietary content + question banks; white-label student experience.",
  },
];

const FEATURES = [
  "Everything in Studio",
  "Unlimited tutor + admin seats",
  "SSO (Google, Okta, ClassLink)",
  "Admin dashboard + audit log",
  "White-label deployment (your domain)",
  "Custom AI training on your proprietary content",
  "Dedicated account manager",
  "Custom contract + invoice terms",
];

export default function Enterprise() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div style={{ fontFamily: FONT, background: "#EEF3FB", color: "#0F172A", minHeight: "100vh" }}>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-[1200px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <a href="/" className="font-bold text-slate-900 text-lg tracking-tight">
            Quest Enterprise
          </a>
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm"
          >
            Book a call
          </button>
        </div>
      </header>

      <section className="max-w-[900px] mx-auto px-6 pt-20 pb-12 text-center">
        <h1
          className="font-extrabold text-[#0F172A]"
          style={{
            fontSize: "clamp(36px, 5vw, 60px)",
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            marginBottom: 16,
          }}
        >
          Quest for{" "}
          <em className="not-italic text-[#2563EB]">your whole organization.</em>
        </h1>
        <p className="text-[18px] text-[#475569] max-w-2xl mx-auto" style={{ lineHeight: 1.55 }}>
          Custom-quoted plans starting at $5,000/year. SSO, admin dashboards,
          white-label deployment, and dedicated support.
        </p>
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[15px] mt-7"
        >
          Book a 20-minute discovery call
          <ArrowRight size={16} />
        </button>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 py-10">
        <h2
          className="text-center font-bold text-[#0F172A]"
          style={{ fontSize: 30, marginBottom: 32, letterSpacing: "-0.02em" }}
        >
          Built for organizations that ship outcomes at scale.
        </h2>
        <div className="grid md:grid-cols-2 gap-5">
          {PERSONAS.map((p) => (
            <div
              key={p.head}
              className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm"
            >
              <h3 className="font-bold text-[#0F172A] text-[18px] mb-2">
                {p.head}
              </h3>
              <p className="text-[14px] text-[#475569] leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[900px] mx-auto px-6 py-12">
        <h2
          className="text-center font-bold text-[#0F172A]"
          style={{ fontSize: 30, marginBottom: 24, letterSpacing: "-0.02em" }}
        >
          Everything Studio has, plus:
        </h2>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
          <ul className="grid sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <li
                key={f}
                className="flex gap-2 text-[14px] text-[#1E293B]"
              >
                <Check
                  size={16}
                  strokeWidth={2.4}
                  className="text-[#2563EB] shrink-0 mt-0.5"
                />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* TODO: real customer logos */}
      <section className="max-w-[900px] mx-auto px-6 py-12 text-center">
        <p className="text-[12px] text-[#94A3B8] tracking-[0.1em] uppercase font-semibold mb-4">
          Trusted by
        </p>
        <p className="text-[13px] text-[#94A3B8] italic">
          Customer logos coming soon. Want to be one of them?
        </p>
      </section>

      <section className="text-center py-16 px-6">
        <h2
          className="font-bold text-[#0F172A] mb-3"
          style={{ fontSize: 36, letterSpacing: "-0.02em" }}
        >
          Let's talk.
        </h2>
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[15px]"
        >
          Book a 20-minute discovery call
          <ArrowRight size={16} />
        </button>
      </section>

      <ContactSalesModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        topic="Enterprise Plan Inquiry"
        heading="Talk to our enterprise team"
        subheading="Tell us about your organization and we'll respond within a business day."
      />

      <Footer />
    </div>
  );
}
