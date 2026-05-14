import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { toast } from "sonner";

export default function Pricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [priceIds, setPriceIds] = useState(null);

  // First-time teacher = signed in as teacher but no subscription_status yet.
  // We show different framing (welcome, no "back" button) for that case.
  const isFirstTimeTeacher = !!user && user.account_type === "teacher" && !user.subscription_status;

  useEffect(() => {
    checkUserAuth();
    loadPriceIds();
  }, []);

  const checkUserAuth = async () => {
    try {
      const userData = await quest.auth.me();
      setUser(userData);
    } catch (err) {
      console.log("User not authenticated");
    }
  };

  const loadPriceIds = async () => {
    try {
      const response = await quest.functions.invoke('getStripePrices');
      console.log('Stripe prices response:', response.data);
      setPriceIds(response.data);
    } catch (err) {
      console.error("Failed to load price IDs:", err);
      toast.error("Failed to load pricing information");
    }
  };

  const plans = [
    {
      name: "Basic",
      price: "Free",
      description: "Perfect for trying out live sessions",
      features: [
        "Access to live learning sessions",
        "Basic progress tracking",
        "Community support"
      ],
      cta: "Get Started Free",
      popular: false,
      action: async () => {
        setLoading(true);
        try {
          if (!user) {
            window.location.href = '/login?next=' + encodeURIComponent(window.location.href);
            return;
          }

          if (user.account_type !== 'teacher') {
            toast.error("Subscription is only available for teachers");
            setLoading(false);
            return;
          }

          // Set user to basic tier
          await quest.auth.updateMe({ 
            subscription_status: 'free',
            subscription_tier: 'free'
          });

          toast.success("Basic plan activated!");
          navigate(createPageUrl("TeacherDashboard"));
        } catch (error) {
          console.error("Error:", error);
          toast.error("Failed to activate plan. Please try again.");
          setLoading(false);
        }
      }
    },
    {
      name: "Premium",
      price: "$30",
      period: "/month",
      description: "Full access to transform your learning",
      features: [
        "30-day free trial",
        "Unlimited live sessions",
        "AI-generated curriculum",
        "Personalized learning paths",
        "Spaced repetition system",
        "Progress analytics & insights",
        "Inquiry-based learning modules",
        "Priority support"
      ],
      cta: "Start Free Trial",
      popular: true,
      action: async () => {
        setLoading(true);
        try {
          // If not authenticated, redirect to teacher signup
          if (!user) {
            sessionStorage.setItem('signupRole', 'teacher');
            sessionStorage.setItem('nextUrl', window.location.href);
            window.location.href = '/login?next=' + encodeURIComponent(window.location.href);
            return;
          }

          if (user.account_type !== 'teacher') {
            toast.error("Premium subscription is only available for teachers");
            setLoading(false);
            return;
          }

          // Check if running in iframe (preview mode)
          if (window.self !== window.top) {
            toast.error("Please open the published app to complete checkout");
            setLoading(false);
            return;
          }

          // For new users, check if they already have a subscription
          if (user.subscription_status === 'free' || !user.subscription_status) {
            // New user - start the free trial flow
            if (!priceIds || !priceIds.premium_price_id) {
              console.error("Price IDs not loaded:", priceIds);
              toast.error("Stripe products not configured. Please refresh and try again.");
              setLoading(false);
              return;
            }

            const response = await quest.functions.invoke('createCheckout', {
              priceId: priceIds.premium_price_id,
              successUrl: `${window.location.origin}${createPageUrl('TeacherDashboard')}?checkout=success`,
              cancelUrl: window.location.href,
            });

            if (response.data.url) {
              window.location.href = response.data.url;
            }
          } else {
            // Existing subscriber or already on trial
            toast.success("You're already subscribed to Premium!");
            navigate(createPageUrl("TeacherDashboard"));
          }
        } catch (error) {
          console.error("Checkout error:", error);
          toast.error("Failed to start checkout. Please try again.");
          setLoading(false);
        }
      }
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For large schools and districts",
      features: [
        "Everything in Premium",
        "Unlimited users",
        "Custom curriculum integration",
        "Dedicated account manager",
        "Advanced analytics & reporting",
        "SSO & security features",
        "Custom training & onboarding",
        "Priority 24/7 support"
      ],
      cta: "Contact Sales",
      popular: false,
      action: () => {
        window.location.href = "mailto:sales@questlearning.co?subject=Enterprise Plan Inquiry";
      }
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Back button — hidden for first-time teachers so the pricing step
          feels like part of onboarding, not an interruption. */}
      {!isFirstTimeTeacher && (
        <div className="container mx-auto max-w-7xl px-6 pt-8">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Landing"))}
            className="mb-4"
          >
            ← Back
          </Button>
        </div>
      )}

      {/* Header */}
      <section className={`${isFirstTimeTeacher ? "pt-20" : "pt-12"} pb-20 px-6`}>
        <div className="container mx-auto max-w-7xl text-center">
          {isFirstTimeTeacher && (
            <motion.p
              className="text-sm font-semibold text-blue-600 mb-3 uppercase tracking-wider"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              One last step
            </motion.p>
          )}
          <motion.h1
            className="text-5xl lg:text-6xl font-bold text-gray-900 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {isFirstTimeTeacher ? (
              <>Welcome! Pick your <span className="text-blue-600">starting plan</span></>
            ) : (
              <>Choose Your <span className="text-blue-600">Learning Path</span></>
            )}
          </motion.h1>
          <motion.p
            className="text-xl text-gray-600 mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {isFirstTimeTeacher
              ? "Start free, or unlock the full platform with Premium. You can change anytime."
              : "Start with a free plan or unlock full potential with Premium"}
          </motion.p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-3 gap-8">
            {plans.map((plan, idx) => (
              <motion.div
                key={plan.name}
                className={`relative bg-white rounded-3xl p-8 ${
                  plan.popular
                    ? "border-4 border-blue-600 shadow-2xl"
                    : "border-2 border-gray-200 shadow-md"
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-5xl font-bold ${plan.popular ? "text-blue-600" : "text-gray-900"}`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-gray-500 text-lg">{plan.period}</span>
                    )}
                    </div>
                    {plan.name === "Premium" && (
                    <p className="text-sm text-gray-500 mt-2">30-day free trial</p>
                    )}
                    </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={plan.action}
                  className={`w-full h-14 text-lg rounded-xl ${
                    plan.popular
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : plan.name === "Enterprise"
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-gray-600 hover:bg-gray-700 text-white"
                  }`}
                  disabled={loading && plan.popular}
                >
                  {loading && plan.popular ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    plan.cta
                  )}
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Money-back guarantee */}
          <motion.div
            className="text-center mt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <p className="text-gray-600">
              Premium includes a 30-day free trial
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Questions? <a href="mailto:support@questlearning.co" className="text-blue-600 hover:underline">Contact our team</a>
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}