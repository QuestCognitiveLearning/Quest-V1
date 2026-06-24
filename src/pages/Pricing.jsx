/**
 * @file   Pricing.jsx
 * @desc   3-tier pricing: Classroom / Studio / Enterprise. Founding-member
 *         pricing is the default ($29/$59) — standard prices are shown
 *         struck-through above so visitors see the discount. Monthly/Annual
 *         toggle. Existing teachers keep their grandfathered subscription.
 *
 *         CTAs:
 *           Classroom → Stripe Checkout (createCheckout)
 *           Studio    → Stripe Checkout for Studio prices
 *           Enterprise → in-app contact form modal
 */

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import ContactSalesModal from "@/components/shared/ContactSalesModal";

const C = {
  paper: "#EEF3FB",
  card: "#FFFFFF",
  ink: "#0F172A",
  ink3: "#475569",
  muted: "#64748B",
  line: "#E2E8F0",
  brand: "#2563EB",
  brandDeep: "#1D4ED8",
  brandSoft: "#DBEAFE",
};

const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

const STANDARD_PRICES = {
  classroom: { monthly: 49, annual: 399 },
  // Student standard = $9 * 12 = $108/yr; annual locks in $89.
  student:   { monthly: 9,  annual: 108 },
};

const FOUNDING_PRICES = {
  classroom: { monthly: 29, annual: 250 },
  student:   { monthly: 9,  annual: 89 },
};

export default function Pricing() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState("monthly"); // monthly | annual
  const [loading, setLoading] = useState({ tier: null });
  const [user, setUser] = useState(null);
  const [priceIds, setPriceIds] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);

  const isFirstTimeTeacher =
    !!user && user.account_type === "teacher" && !user.subscription_status;

  useEffect(() => {
    checkUserAuth();
    loadPriceIds();
  }, []);

  const checkUserAuth = async () => {
    try {
      const userData = await quest.auth.me();
      setUser(userData);
    } catch {
      // public visitor
    }
  };

  const loadPriceIds = async () => {
    try {
      const response = await quest.functions.invoke("getStripePrices");
      setPriceIds(response.data);
    } catch (err) {
      console.error("Failed to load price IDs:", err);
      toast.error("Failed to load pricing information");
    }
  };

  const checkout = async (tier) => {
    if (!user) {
      const signupRole = tier === "student" ? "student" : "teacher";
      sessionStorage.setItem("signupRole", signupRole);
      sessionStorage.setItem("nextUrl", window.location.href);
      window.location.href = `/SignIn?mode=signup&next=/Pricing&intent=${tier}`;
      return;
    }
    if (window.self !== window.top) {
      toast.error("Please open the published app to complete checkout");
      return;
    }

    let priceId;
    if (tier === "student") {
      priceId =
        billing === "annual"
          ? priceIds?.tiers?.student?.annual
          : priceIds?.tiers?.student?.monthly;
    } else {
      priceId =
        billing === "annual"
          ? priceIds?.tiers?.classroom?.annual
          : priceIds?.tiers?.classroom?.monthly || priceIds?.premium_price_id;
    }

    if (!priceId) {
      toast.error("Stripe products not configured. Please refresh.");
      return;
    }
    setLoading({ tier });
    try {
      // Student checkout returns to Generate so the upgrade-modal CTA
      // path lands the user back where they were. Teacher checkout
      // returns to the dashboard as before.
      const successPath =
        tier === "student"
          ? `${createPageUrl("Generate")}?checkout=success`
          : `${createPageUrl("TeacherDashboard")}?checkout=success`;
      const response = await quest.functions.invoke("createCheckout", {
        priceId,
        successUrl: `${window.location.origin}${successPath}`,
        cancelUrl: window.location.href,
      });
      if (response.data?.url) window.location.href = response.data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error("Failed to start checkout. Please try again.");
      setLoading({ tier: null });
    }
  };

  const TIERS = [
    {
      id: "classroom",
      name: "Classroom",
      desc: "For teachers ready to ditch lesson-plan Sundays.",
      price:
        billing === "annual"
          ? `$${FOUNDING_PRICES.classroom.annual}`
          : `$${FOUNDING_PRICES.classroom.monthly}`,
      per: billing === "annual" ? "/ year" : "/ month",
      standardPrice:
        billing === "annual"
          ? `$${STANDARD_PRICES.classroom.annual}`
          : `$${STANDARD_PRICES.classroom.monthly}`,
      cta: "Start 7-day free trial",
      popular: false,
      features: [
        "Unlimited classes and students",
        "Unlimited AI quiz + case study generation",
        "Live classroom sessions with leaderboards",
        "AI Panda Tutor for every student",
        "Print-ready PDF + Word handouts",
        "Standards alignment for K-12 + College",
        "Priority email support",
      ],
      action: () => checkout("classroom"),
    },
    {
      id: "student",
      name: "Student",
      desc: "For students who want to study smarter on their own.",
      price:
        billing === "annual"
          ? `$${FOUNDING_PRICES.student.annual}`
          : `$${FOUNDING_PRICES.student.monthly}`,
      per: billing === "annual" ? "/ year" : "/ month",
      standardPrice:
        billing === "annual"
          ? `$${STANDARD_PRICES.student.annual}`
          : null,
      cta:
        billing === "annual"
          ? `Upgrade — $${FOUNDING_PRICES.student.annual}/yr`
          : `Upgrade — $${FOUNDING_PRICES.student.monthly}/mo`,
      popular: true,
      features: [
        "Unlimited AI-generated learning sessions",
        "Flashcards from any YouTube video or PDF",
        "AI-graded case studies + quizzes",
        "Save sessions to your library, replay anytime",
        "Cancel anytime from the billing portal",
      ],
      action: () => checkout("student"),
    },
    {
      id: "enterprise",
      name: "Enterprise",
      desc: "For schools and districts.",
      price: "Custom",
      per: "",
      standardPrice: null,
      cta: "Book a call",
      popular: false,
      features: [
        "Everything in Classroom",
        "Unlimited teacher + admin seats",
        "SSO (Google, Okta, ClassLink)",
        "Admin dashboard + audit log",
        "Custom AI training on your content",
        "Dedicated account manager",
      ],
      action: () => setContactOpen(true),
    },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background: C.paper,
        fontFamily: FONT,
        color: C.ink,
      }}
    >
      {!isFirstTimeTeacher && (
        <div className="max-w-[1200px] mx-auto px-6 pt-8">
          <button
            type="button"
            onClick={() => navigate(createPageUrl("Landing"))}
            className="inline-flex items-center gap-1.5 text-sm font-semibold"
            style={{
              color: C.ink3,
              background: "transparent",
              border: 0,
              cursor: "pointer",
              padding: "8px 4px",
            }}
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
            Back
          </button>
        </div>
      )}

      <section
        style={{
          padding: `${isFirstTimeTeacher ? 72 : 40}px 24px 24px`,
        }}
      >
        <div className="text-center mx-auto" style={{ maxWidth: 760 }}>
          <div
            className="inline-flex items-center gap-2 rounded-full mb-4"
            style={{
              background: "#DCFCE7",
              color: "#15803D",
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <Sparkles size={14} /> Founding member pricing
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              fontWeight: 800,
              color: C.ink,
              fontSize: "clamp(32px, 4.2vw, 52px)",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              marginBottom: 12,
            }}
          >
            Simple pricing.{" "}
            <em style={{ fontStyle: "normal", color: C.brand }}>
              Built for the way you teach.
            </em>
          </motion.h1>
          <p
            style={{
              color: C.muted,
              fontSize: 17,
              lineHeight: 1.55,
              marginBottom: 20,
            }}
          >
            Founding members lock in this price for life. Standard pricing
            kicks in once we hit 100 paid accounts.
          </p>

          {/* Billing toggle */}
          <div
            style={{
              display: "inline-flex",
              padding: 4,
              borderRadius: 999,
              background: C.brandSoft,
              border: `1px solid ${C.line}`,
            }}
          >
            {["monthly", "annual"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setBilling(mode)}
                style={{
                  border: 0,
                  background: billing === mode ? C.brand : "transparent",
                  color: billing === mode ? "#fff" : C.ink3,
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "8px 18px",
                  borderRadius: 999,
                  cursor: "pointer",
                  transition: "background 150ms",
                }}
              >
                {mode === "monthly" ? "Monthly" : "Annual"}
                {mode === "annual" && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      color: billing === "annual" ? "#fff" : "#15803D",
                      background:
                        billing === "annual"
                          ? "rgba(255,255,255,0.18)"
                          : "#DCFCE7",
                      borderRadius: 999,
                      padding: "2px 6px",
                    }}
                  >
                    save 28%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div
          className="mx-auto grid md:grid-cols-3"
          style={{
            maxWidth: 1100,
            gap: 20,
            paddingTop: 12,
            alignItems: "stretch",
          }}
        >
          {TIERS.map((t, idx) => {
            const popular = t.popular;
            const isLoading = loading.tier === t.id;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.08 }}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  background: popular
                    ? "linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)"
                    : C.card,
                  border: popular
                    ? `2px solid ${C.brand}`
                    : `1px solid ${C.line}`,
                  borderRadius: 24,
                  padding: 28,
                  boxShadow: popular
                    ? "0 24px 60px -24px rgba(37,99,235,0.22), 0 4px 12px rgba(15,23,42,0.06)"
                    : "0 8px 24px rgba(15, 23, 42, 0.06)",
                  transform: popular ? "translateY(-8px)" : undefined,
                }}
              >
                {popular && (
                  <div
                    style={{
                      position: "absolute",
                      top: -14,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: C.brand,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      padding: "6px 14px",
                      borderRadius: 999,
                    }}
                  >
                    Most Popular
                  </div>
                )}

                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 22,
                      letterSpacing: "-0.02em",
                      color: C.ink,
                    }}
                  >
                    {t.name}
                  </div>
                  <div style={{ color: C.muted, fontSize: 13.5, marginTop: 4 }}>
                    {t.desc}
                  </div>
                </div>

                <div
                  style={{
                    paddingBottom: 12,
                    borderBottom: `1px solid ${C.line}`,
                  }}
                >
                  {t.standardPrice && (
                    <div
                      style={{
                        color: C.muted,
                        fontSize: 13,
                        textDecoration: "line-through",
                        marginBottom: 2,
                      }}
                    >
                      {t.standardPrice}
                      {t.per}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 48,
                        lineHeight: 1,
                        letterSpacing: "-0.025em",
                        color: popular ? C.brand : C.ink,
                      }}
                    >
                      {t.price}
                    </span>
                    {t.per && (
                      <span
                        style={{
                          color: C.muted,
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {t.per}
                      </span>
                    )}
                  </div>
                  {t.standardPrice && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 8,
                        background: "#DCFCE7",
                        color: "#15803D",
                        fontWeight: 700,
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "4px 9px",
                        borderRadius: 999,
                      }}
                    >
                      Founding member
                    </div>
                  )}
                </div>

                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    flex: 1,
                  }}
                >
                  {t.features.map((f, i) => (
                    <li
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "18px 1fr",
                        gap: 10,
                        alignItems: "start",
                        fontSize: 13.5,
                        color: "#1E293B",
                        lineHeight: 1.4,
                      }}
                    >
                      <Check
                        size={15}
                        strokeWidth={2.4}
                        style={{ color: C.brand, marginTop: 2 }}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={t.action}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    height: 46,
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    border: 0,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    color: "#fff",
                    background:
                      t.id === "enterprise"
                        ? C.ink
                        : popular
                        ? C.brand
                        : "#0F172A",
                    boxShadow: popular
                      ? "0 10px 22px -10px rgba(37,99,235,0.55)"
                      : "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: isLoading ? 0.85 : 1,
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    t.cta
                  )}
                </button>
                {t.id !== "enterprise" && (
                  <p
                    style={{
                      textAlign: "center",
                      fontSize: 12,
                      color: C.muted,
                      marginTop: -2,
                      marginBottom: 0,
                    }}
                  >
                    No charge during trial. Cancel anytime.
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* FAQ */}
        <div
          className="mx-auto"
          style={{ maxWidth: 760, marginTop: 64, marginBottom: 24 }}
        >
          <h2
            style={{
              fontWeight: 800,
              fontSize: 28,
              color: C.ink,
              marginBottom: 18,
              textAlign: "center",
            }}
          >
            Frequently asked
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            <FaqRow
              q="What does 'founding member' mean?"
              a="The first 100 paid accounts lock in $29/mo Classroom for the life of their subscription, even after standard pricing ($49) goes into effect."
            />
            <FaqRow
              q="Is there a free trial?"
              a="Yes — 7 days for Classroom. No card required during the trial. Cancel anytime."
            />
            <FaqRow
              q="What's the difference between Classroom and Enterprise?"
              a="Classroom is built for individual teachers. Enterprise is for schools and districts who need SSO, admin dashboards, and bulk seats."
            />
            <FaqRow
              q="Can I upgrade or downgrade later?"
              a="Yes. Use the billing portal from your dashboard to change plans at any time. Annual plans pro-rate."
            />
            <FaqRow
              q="What about students? Do they pay?"
              a="Students always join a teacher's class for free with a class code. The Student plan ($9/mo) is optional — it unlocks unlimited self-serve AI generations for students who want to create their own study sessions from any YouTube video or PDF. Free students get 5 lifetime generations."
            />
          </div>
        </div>
      </section>

      <ContactSalesModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        topic="Enterprise Plan Inquiry"
        heading="Talk to our team"
        subheading="Tell us about your school or tutoring business — we'll get back within a day."
        defaults={{
          name: user?.full_name || "",
          email: user?.email || "",
        }}
      />
    </div>
  );
}

function FaqRow({ q, a }) {
  return (
    <details
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 15,
          color: "#0F172A",
          listStyle: "none",
        }}
      >
        {q}
      </summary>
      <p
        style={{
          marginTop: 8,
          color: "#475569",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {a}
      </p>
    </details>
  );
}
