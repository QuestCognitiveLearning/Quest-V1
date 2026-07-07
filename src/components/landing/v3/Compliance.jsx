import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ShieldCheck, Lock, UserCheck, EyeOff } from "lucide-react";
import LegalModal, { LEGAL_DOCS } from "./LegalModals";

/**
 * Compliance strip — a compact, visual trust band aimed at school and district
 * admins. Sits directly below the "Bring Quest to your school" contact section
 * and above the footer, sharing the contact section's #EEF3FB background so the
 * two read as one continuous block before the dark footer.
 *
 * IMPORTANT — these are honest compliance statements, NOT third-party
 * certification seals. FERPA has no certifying body, and COPPA "certified"
 * seals only come from FTC-approved Safe Harbor programs we are not enrolled
 * in. Each badge says "Compliant" (our own attested commitment) and links to
 * the policy that backs it up.
 */
// All badges share the Quest brand blue (matches the logo) so the compliance
// strip reads as one unified band rather than a rainbow of per-badge colors.
const BRAND_TINT = "#2563EB";

const BADGES = [
  {
    key: "ferpa",
    icon: ShieldCheck,
    label: "FERPA Compliant",
    sub: "Education records protected",
    tint: BRAND_TINT,
  },
  {
    key: "coppa",
    icon: UserCheck,
    label: "COPPA Compliant",
    sub: "Safe for learners under 13",
    tint: BRAND_TINT,
  },
  {
    key: "security",
    icon: Lock,
    label: "Encrypted & Secure",
    sub: "TLS in transit, encrypted at rest",
    tint: BRAND_TINT,
  },
  {
    key: "privacy",
    icon: EyeOff,
    label: "Never Sold, No Ad Tracking",
    sub: "Zero advertising trackers",
    tint: BRAND_TINT,
  },
];

export default function Compliance() {
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);

  const handleBadge = (key) => {
    if (key === "privacy") {
      navigate(createPageUrl("Privacy"));
      return;
    }
    setModal(key);
  };

  return (
    <>
      <section id="compliance" className="bg-[#EEF3FB]" style={{ padding: "8px 0 72px" }}>
        <div className="lp-v3-container">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase">
              <ShieldCheck size={15} strokeWidth={2.4} />
              Built for Student Privacy
            </span>
            <h2
              className="font-bold text-[#0F172A] mt-2.5"
              style={{ fontSize: "clamp(24px, 2.8vw, 32px)", letterSpacing: "-0.02em" }}
            >
              Compliant by <em className="not-italic text-[#2563EB]">design.</em>
            </h2>
            <p className="text-[#475569] text-[14.5px] mt-2 max-w-[52ch] mx-auto">
              Quest follows FERPA and COPPA for every account — we collect only
              what a lesson needs, never sell student data, and run no ad
              trackers. Tap any badge to read the policy.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {BADGES.map(({ key, icon: Icon, label, sub, tint }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleBadge(key)}
                className="group flex items-center gap-3.5 bg-white rounded-2xl border border-[#E2E8F0] pl-3.5 pr-5 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(15,23,42,0.4)] focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ "--tint": tint }}
              >
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                  style={{ background: `${tint}14`, color: tint }}
                >
                  <Icon size={22} strokeWidth={2.1} />
                </span>
                <span>
                  <span className="block font-bold text-[#0F172A] text-[14px] tracking-tight leading-tight">
                    {label}
                  </span>
                  <span className="block text-[12px] text-[#64748B] leading-snug mt-0.5">
                    {sub}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <p className="text-center text-[11.5px] text-[#475569] mt-7 max-w-[64ch] mx-auto">
            Quest Learning attests to these practices; FERPA and COPPA are U.S.
            laws, not certification programs. Questions from administrators?{" "}
            <a
              href="mailto:admin@questlearning.co"
              className="text-[#2563EB] underline underline-offset-2"
            >
              admin@questlearning.co
            </a>
          </p>
        </div>
      </section>

      {modal && (
        <LegalModal doc={LEGAL_DOCS[modal]} onClose={() => setModal(null)} />
      )}
    </>
  );
}
