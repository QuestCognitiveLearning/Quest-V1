import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PricingInfo() {
  const navigate = useNavigate();

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
    }
  ];

  const handleGetStarted = (planName) => {
    if (planName === "Enterprise") {
      window.location.href = "mailto:sales@questlearning.co?subject=Enterprise Plan Inquiry";
    } else {
      // Redirect to signup/login
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Back Button */}
      <div className="container mx-auto max-w-7xl px-6 pt-8">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Landing"))}
          className="mb-4"
        >
          ← Back
        </Button>
      </div>

      {/* Header */}
      <section className="pt-12 pb-20 px-6">
        <div className="container mx-auto max-w-7xl text-center">
          <motion.h1
            className="text-5xl lg:text-6xl font-bold text-gray-900 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Choose Your <span className="text-blue-600">Learning Path</span>
          </motion.h1>
          <motion.p
            className="text-xl text-gray-600 mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Start with a free plan or unlock full potential with Premium
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
                  onClick={() => handleGetStarted(plan.name)}
                  className={`w-full h-14 text-lg rounded-xl ${
                    plan.popular
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : plan.name === "Enterprise"
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-gray-600 hover:bg-gray-700 text-white"
                  }`}
                >
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Info */}
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