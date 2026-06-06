/**
 * @file   Pricing.jsx
 * @desc   Post-signup pricing page that teachers land on after creating their
 *         account. Re-uses the v3 landing's pricing card design so the visual
 *         is consistent across marketing + product. Actions differ from the
 *         landing — here the buttons do real work:
 *           - Premium      → kicks off Stripe Checkout (createCheckout)
 *           - Enterprise   → opens the in-app contact form modal (no mailto)
 *
 * @author Quest Learning core team
 */

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
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

export default function Pricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [priceIds, setPriceIds] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);

  // First-time teacher = signed in as teacher but no subscription_status yet.
  // We show different framing (welcome, no "back" button) for that case.
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
      console.log("User not authenticated");
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

  // ─── Plan actions ───────────────────────────────────────────────────────

  const startPremiumTrial = async () => {
    setLoading(true);
    try {
      if (!user) {
        sessionStorage.setItem("signupRole", "teacher");
        sessionStorage.setItem("nextUrl", window.location.href);
        window.location.href = "/SignIn?mode=signup&next=/Pricing";
        return;
      }
      if (user.account_type !== "teacher") {
        toast.error("Premium subscription is only available for teachers");
        setLoading(false);
        return;
      }
      if (window.self !== window.top) {
        toast.error("Please open the published app to complete checkout");
        setLoading(false);
        return;
      }
      if (user.subscription_status === "free" || !user.subscription_status) {
        if (!priceIds || !priceIds.premium_price_id) {
          toast.error("Stripe products not configured. Please refresh and try again.");
          setLoading(false);
          return;
        }
        const response = await quest.functions.invoke("createCheckout", {
          priceId: priceIds.premium_price_id,
          successUrl: `${window.location.origin}${createPageUrl("TeacherDashboard")}?checkout=success`,
          cancelUrl: window.location.href,
        });
        if (response.data.url) window.location.href = response.data.url;
      } else {
        toast.success("You're already subscribed to Premium!");
        navigate(createPageUrl("TeacherDashboard"));
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout. Please try again.");
      setLoading(false);
    }
  };

  const TIERS = [
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
      action: startPremiumTrial,
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
        "Unlimited users",
        "Custom curriculum integration",
        "Dedicated account manager",
        "Advanced analytics & reporting",
        "SSO & security features",
        "Custom training & onboarding",
        "Priority 24/7 support",
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
      {/* Back button — hidden during first-time teacher onboarding so the
          pricing step feels like part of signup, not an interruption. */}
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

      {/* Header */}
      <section
        style={{
          padding: `${isFirstTimeTeacher ? 72 : 48}px 24px 32px`,
        }}
      >
        <div
          className="text-center mx-auto"
          style={{ maxWidth: 720 }}
        >
          {isFirstTimeTeacher && (
            <motion.span
              className="inline-block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              style={{
                color: C.brand,
                fontWeight: 700,
                fontSize: 12.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              One Last Step
            </motion.span>
          )}
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
              marginTop: isFirstTimeTeacher ? 12 : 0,
              marginBottom: 12,
            }}
          >
            {isFirstTimeTeacher ? (
              <>
                Welcome — start your{" "}
                <em style={{ fontStyle: "normal", color: C.brand }}>
                  free trial.
                </em>
              </>
            ) : (
              <>
                Simple Pricing.{" "}
                <em style={{ fontStyle: "normal", color: C.brand }}>
                  Built for Teachers.
                </em>
              </>
            )}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ color: C.muted, fontSize: 17, lineHeight: 1.55 }}
          >
            {isFirstTimeTeacher
              ? "Try the full Premium platform free for 7 days. Cancel anytime."
              : "Students join free with a class code. Teachers get full access with Premium — start with a 7-day free trial."}
          </motion.p>
        </div>
      </section>

      {/* Pricing cards */}
      <section style={{ paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div
          className="mx-auto grid md:grid-cols-2"
          style={{
            maxWidth: 880,
            gap: 20,
            paddingTop: 12,
            alignItems: "stretch",
          }}
        >
          {TIERS.map((t, idx) => {
            const popular = t.popular;
            const isLoading = loading && popular;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
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
                  borderRadius: 28,
                  padding: 32,
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
                    paddingBottom: 16,
                    borderBottom: `1px solid ${C.line}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 56,
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
                  {popular && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 10,
                        background: "#DCFCE7",
                        color: "#15803D",
                        fontWeight: 700,
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        padding: "5px 10px",
                        borderRadius: 999,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: "#16A34A",
                        }}
                      />
                      Free for 7 days
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
                    gap: 12,
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
                        fontSize: 14,
                        color: "#1E293B",
                        lineHeight: 1.4,
                      }}
                    >
                      <Check
                        size={16}
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
                    height: 48,
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    border: 0,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    color: "#fff",
                    background: popular
                      ? C.brand
                      : t.id === "enterprise"
                      ? C.ink
                      : "#0F172A",
                    boxShadow: popular
                      ? "0 10px 22px -10px rgba(37,99,235,0.55)"
                      : "none",
                    transition: "background 200ms ease, transform 200ms ease",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: isLoading ? 0.85 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (isLoading) return;
                    e.currentTarget.style.background = popular
                      ? C.brandDeep
                      : "#1E293B";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = popular
                      ? C.brand
                      : t.id === "enterprise"
                      ? C.ink
                      : "#0F172A";
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Loading…
                    </>
                  ) : (
                    t.cta
                  )}
                </button>
                {popular && (
                  <p
                    style={{
                      textAlign: "center",
                      fontSize: 12.5,
                      color: C.muted,
                      marginTop: 4,
                      marginBottom: 0,
                    }}
                  >
                    No charge for 7 days. Cancel anytime before day 7.
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Footer note */}
        <motion.div
          className="text-center mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{ marginTop: 48, maxWidth: 720 }}
        >
          <p style={{ color: C.muted, fontSize: 14 }}>
            Premium includes a 7-day free trial. Cancel anytime before it ends.
          </p>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>
            Questions?{" "}
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              style={{
                color: C.brand,
                background: "none",
                border: 0,
                padding: 0,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                fontSize: "inherit",
                fontFamily: "inherit",
              }}
            >
              Contact our team
            </button>
          </p>
        </motion.div>
      </section>

      <ContactSalesModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        topic="Enterprise Plan Inquiry"
        heading="Talk to our sales team"
        subheading="Tell us about your school or district — we'll get back within a day."
        defaults={{
          name: user?.full_name || "",
          email: user?.email || "",
        }}
      />
    </div>
  );
}
