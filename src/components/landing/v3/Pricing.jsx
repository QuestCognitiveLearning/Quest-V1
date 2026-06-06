import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import ContactSalesModal from "@/components/shared/ContactSalesModal";

// Premium CTA goes to signup (`?mode=signup` opens the signup form directly
// on the SignIn page). Enterprise opens the in-app ContactSalesModal — same UX
// as the post-signup Pricing page — instead of a mailto popup.
const buildTiers = (navigate, openContact) => [
  {
    id: "premium",
    name: "Premium",
    desc: "Full access to transform your learning",
    price: "$39",
    per: "/ month",
    cta: "Start Free Trial",
    popular: true,
    features: [
      "7-day free trial",
      "Unlimited live sessions",
      "AI-generated curriculum",
      "Personalized learning paths",
      "Spaced repetition system",
      "Progress analytics & insights",
      "Inquiry-based learning modules",
      "Priority support",
    ],
    action: () => {
      // Remember that this user picked Premium so the post-signup pricing page
      // can preselect it. The current Pricing.jsx already reads `signupRole`.
      try { sessionStorage.setItem("signupRole", "teacher"); } catch {}
      try { sessionStorage.setItem("nextUrl", "/Pricing"); } catch {}
      navigate("/SignIn?mode=signup&next=/Pricing");
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    desc: "For large schools and districts",
    price: "Custom",
    per: "",
    cta: "Contact Sales",
    popular: false,
    features: [
      "Everything in Premium",
      "Large Scale Integration",
      "Dedicated Server Space",
      "Advanced Analytics & Reporting",
      "Security features",
      "Custom training & onboarding",
      "Priority 24/7 support",
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
          <span className="inline-block text-[#2563EB] font-semibold text-[12.5px] tracking-[0.16em] uppercase">
            Pricing
          </span>
          <h2
            className="font-bold text-[#0F172A] mt-3 mb-3"
            style={{
              fontSize: "clamp(32px, 4.2vw, 52px)",
              lineHeight: "1.05",
              letterSpacing: "-0.025em",
            }}
          >
            Simple Pricing. <em className="not-italic text-[#2563EB]">Built for Teachers.</em>
          </h2>
          <p className="text-[17px] text-[#64748B]">
            Students join free with a class code. Teachers get full access with Premium — start with a 7-day free trial.
          </p>
        </div>

        <div className="grid md:grid-cols-2 max-w-3xl mx-auto gap-4 lg:gap-5 items-stretch pt-3">
          {TIERS.map((t) => {
            const popular = t.popular;
            return (
              <div
                key={t.id}
                className={`relative flex flex-col gap-4 rounded-[28px] p-8 ${
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

                <div className="pb-4 border-b border-[#E2E8F0]">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`font-extrabold text-[56px] leading-none tracking-tight ${
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
                  {popular && (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-[#DCFCE7] text-[#15803D] font-bold text-[11px] tracking-[0.08em] uppercase px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                      Free for 7 days
                    </div>
                  )}
                </div>

                <ul className="flex flex-col gap-3 flex-1">
                  {t.features.map((f, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[18px_1fr] gap-2.5 items-start text-[14px] text-[#1E293B] leading-snug"
                    >
                      <Check
                        size={16}
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
                  className={`w-full h-12 rounded-xl font-semibold text-sm transition-colors ${
                    popular
                      ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white lp-v3-cta-shadow"
                      : "bg-[#0F172A] hover:bg-[#1E293B] text-white"
                  }`}
                >
                  {t.cta}
                </button>
                {popular && (
                  <p className="text-center text-[12.5px] text-[#64748B] mt-1">
                    No charge for 7 days. Cancel anytime before day 7.
                  </p>
                )}
              </div>
            );
          })}
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
