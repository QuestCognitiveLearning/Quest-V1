import React, { useState } from "react";
import { ShieldCheck, Lock, UserCheck, EyeOff } from "lucide-react";
import LegalModal, { LEGAL_DOCS } from "./LegalModals";

/**
 * Compliance band — a trust strip aimed at school and district admins
 * evaluating Quest. Placed just before the district CTA so it's seen while
 * "approaching the platform."
 *
 * IMPORTANT — these are honest compliance statements, NOT third-party
 * certification seals. FERPA has no certifying body, and COPPA "certified"
 * seals only come from FTC-approved Safe Harbor programs (kidSAFE, iKeepSafe,
 * PRIVO, …) we are not enrolled in. Each badge therefore says "Compliant"
 * (our own attested commitment) and links to the policy that backs it up,
 * rather than implying an external audit we don't hold.
 */
const BADGES = [
  {
    key: "ferpa",
    icon: ShieldCheck,
    label: "FERPA Compliant",
    sub: "Student education records protected",
  },
  {
    key: "coppa",
    icon: UserCheck,
    label: "COPPA Compliant",
    sub: "Safe for learners under 13",
  },
  {
    key: "security",
    icon: Lock,
    label: "Encrypted & Secure",
    sub: "SSL/TLS in transit, encrypted at rest",
  },
  {
    key: "privacy",
    icon: EyeOff,
    label: "Never Sold, No Ad Tracking",
    sub: "No third-party advertising trackers",
  },
];

export default function Compliance() {
  const [modal, setModal] = useState(null);

  return (
    <>
      <section
        id="compliance"
        className="bg-[#F8FAFC] border-y border-[#E2E8F0]"
        style={{ padding: "72px 0" }}
      >
        <div className="lp-v3-container">
          <div className="text-center mb-9 max-w-[44ch] mx-auto">
            <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase">
              Built for Student Privacy
            </span>
            <h2
              className="font-bold text-[#0F172A] mt-3 mb-3"
              style={{
                fontSize: "clamp(30px, 3.6vw, 44px)",
                lineHeight: "1.05",
                letterSpacing: "-0.025em",
              }}
            >
              Compliant by{" "}
              <em className="not-italic text-[#2563EB]">design.</em>
            </h2>
            <p className="text-[#64748B] text-base">
              Quest follows FERPA and COPPA for every account. We collect only
              what a lesson needs, never sell student data, and run no
              advertising trackers. Tap any badge to read the policy.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BADGES.map(({ key, icon: Icon, label, sub }) => (
              <button
                key={key}
                type="button"
                onClick={() => setModal(key)}
                className="group bg-white rounded-2xl border border-[#E2E8F0] p-6 text-left lp-v3-soft-shadow transition-all hover:border-[#2563EB] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
              >
                <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mb-4 group-hover:bg-[#2563EB] group-hover:text-white transition-colors">
                  <Icon size={24} strokeWidth={2} />
                </div>
                <div className="font-bold text-[#0F172A] text-[15.5px] tracking-tight">
                  {label}
                </div>
                <div className="text-[12.5px] text-[#64748B] mt-1 leading-snug">
                  {sub}
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-[12px] text-[#94A3B8] mt-7 max-w-[60ch] mx-auto">
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
