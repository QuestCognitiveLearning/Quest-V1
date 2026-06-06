import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import ContactSalesModal from "@/components/shared/ContactSalesModal";

// Homepage pricing section. Mirrors /Pricing's 3-tier model (Classroom /
// Studio / Enterprise) so visitors see the new subscription options without
// clicking through. Founding-member pricing surfaced with strike-through
// standard rates.
const buildTiers = (navigate, openContact) => [
  {
    id: "classroom",
    name: "Classroom",
    desc: "For individual teachers ready to ditch lesson-plan Sundays.",
    price: "$29",
    standardPrice: "$49",
    per: "/ month",
    cta: "Start 7-day free trial",
    popular: false,
    features: [
      "Unlimited classes and students",
      "Unlimited AI quiz + case study generation",
      "Live classroom sessions with leaderboards",
      "AI Panda Tutor for every student",
      "Print-ready PDF + Word handouts",
      "Priority email support",
    ],
    action: () => {
      try { sessionStorage.setItem("signupRole", "teacher"); } catch {}
      try { sessionStorage.setItem("nextUrl", "/Pricing"); } catch {}
      navigate("/SignIn?mode=signup&next=/Pricing&intent=classroom");
    },
  },
  {
    id: "studio",
    name: "Studio",
    desc: "For tutors and tutoring businesses with paying parents.",
    price: "$59",
    standardPrice: "$99",
    per: "/ month",
    cta: "Start 14-day free trial",
    popular: true,
    features: [
      "Everything in Classroom",
      "Unlimited classes and students",
      "Your logo + brand colors on every PDF",
      "Automated branded parent progress reports",
      "Multi-tutor seats ($29/mo each)",
      "30-min onboarding call with the founder",
    ],
    action: () => {
      try { sessionStorage.setItem("signupRole", "teacher"); } catch {}
      try { sessionStorage.setItem("nextUrl", "/Pricing"); } catch {}
      navigate("/SignIn?mode=signup&next=/Pricing&intent=studio");
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    desc: "For schools, districts, and tutoring chains.",
    price: "Custom",
    standardPrice: null,
    per: "",
    cta: "Contact Sales",
    popular: false,
    features: [
      "Everything in Studio",
      "Unlimited tutor + admin seats",
      "SSO (Google, Okta, ClassLink)",
      "Admin dashboard + audit log",
      "White-label deployment",
      "Dedicated account manager",
    ],
    action: () => openContact(),
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [contactOpen, setContactOpen] = useState(false);
  const TIERS = buildTiers(navigate, () => setContactOpen(true));
  return (
    <section id="pricing" className="bg-[#EEF3FB]" style={{ padding: "72px 0" }}>
      <div className="lp-v3-container">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#DCFCE7] text-[#15803D] px-3 py-1 text-[11px] font-bold tracking-[0.08em] uppercase mb-3">
            <Sparkles size={12} /> Founding member pricing
          </span>
          <h2
            className="font-bold text-[#0F172A] mt-3 mb-3"
            style={{
              fontSize: "clamp(32px, 4.2vw, 52px)",
              lineHeight: "1.05",
              letterSpacing: "-0.025em",
            }}
          >
            Simple Pricing. <em className="not-italic text-[#2563EB]">Built for the way you teach.</em>
          </h2>
          <p className="text-[17px] text-[#64748B]">
            Students join free with a class code. Founding members lock in
            this price for life — standard pricing kicks in once we hit 100
            paid accounts.
          </p>
        </div>

        <div className="grid md:grid-cols-3 max-w-5xl mx-auto gap-4 lg:gap-5 items-stretch pt-3">
          {TIERS.map((t) => {
            const popular = t.popular;
            return (
              <div
                key={t.id}
                className={`relative flex flex-col gap-4 rounded-[24px] p-7 ${
                  popular
                    ? "border-2 border-[#2563EB] lp-v3-deep-shadow -translate-y-2"
                    : "border border-[#E2E8F0] bg-white lp-v3-soft-shadow"
                }`}
                style={{
                  background: popular
                    ? "linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)"
                    : undefined,
                }}
              >
                {popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#2563EB] text-white text-[11px] font-bold tracking-[0.12em] uppercase px-3.5 py-1.5 rounded-full">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="font-bold text-[22px] tracking-tight text-[#0F172A]">
                    {t.name}
                  </div>
                  <div className="text-[13.5px] text-[#64748B] mt-1">
                    {t.desc}
                  </div>
                </div>

                <div className="pb-3 border-b border-[#E2E8F0]">
                  {t.standardPrice && (
                    <div className="text-[#64748B] text-[13px] line-through mb-1">
                      {t.standardPrice}{t.per}
                    </div>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`font-extrabold text-[48px] leading-none tracking-tight ${
                        popular ? "text-[#2563EB]" : "text-[#0F172A]"
                      }`}
                    >
                      {t.price}
                    </span>
                    {t.per && (
                      <span className="text-[#64748B] font-semibold text-sm">
                        {t.per}
                      </span>
                    )}
                  </div>
                  {t.standardPrice && (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-[#DCFCE7] text-[#15803D] font-bold text-[11px] tracking-[0.06em] uppercase px-2.5 py-1 rounded-full">
                      Founding member
                    </div>
                  )}
                </div>

                <ul className="flex flex-col gap-2.5 flex-1">
                  {t.features.map((f, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[18px_1fr] gap-2.5 items-start text-[13.5px] text-[#1E293B] leading-snug"
                    >
                      <Check
                        size={15}
                        strokeWidth={2.4}
                        className="text-[#2563EB] mt-1"
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={t.action}
                  className={`w-full h-11 rounded-xl font-semibold text-sm transition-colors ${
                    popular
                      ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white lp-v3-cta-shadow"
                      : "bg-[#0F172A] hover:bg-[#1E293B] text-white"
                  }`}
                >
                  {t.cta}
                </button>
                {t.id !== "enterprise" && (
                  <p className="text-center text-[12px] text-[#64748B]">
                    No charge during trial. Cancel anytime.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <a
            href="/Pricing"
            className="inline-flex items-center gap-1.5 text-[#2563EB] font-semibold text-[14px] hover:text-[#1D4ED8]"
          >
            See full plan comparison &rarr;
          </a>
        </div>
      </div>

      <ContactSalesModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        topic="Enterprise Plan Inquiry"
        heading="Talk to our sales team"
        subheading="Tell us about your school or district — we'll get back within a day."
      />
    </section>
  );
}
