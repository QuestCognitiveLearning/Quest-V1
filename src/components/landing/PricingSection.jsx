import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function PricingSection() {
  const plans = [
  {
    name: "Basic",
    price: "Free",
    description: "Perfect for trying out live sessions",
    features: [
    "Access to live learning sessions",
    "Basic progress tracking",
    "Community support"],

    cta: "Get Started Free",
    popular: false
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
    "Priority support"],

    cta: "Start Free Trial",
    popular: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large schools and districts",
    features: [
    "Everything in Premium",
    "Unlimited users",
    "Large Scale Integration",
    "Dedicated Server Space",
    "Advanced analytics & reporting",
    "SSO & security features",
    "Custom training & onboarding",
    "Priority 24/7 support"],

    cta: "Contact Sales",
    popular: false
  }];


  const handleGetStarted = (planName) => {
    if (planName === "Enterprise") {
      document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <section id="pricing" className="bg-white px-6 py-24">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}>

          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Choose Your <span className="text-blue-600">Learning Path</span>
          </h2>
          <p className="text-xl text-gray-600">
            Start with a free plan or unlock full potential with Premium
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, idx) =>
          <motion.div
            key={plan.name}
            className={`relative bg-white rounded-3xl p-8 transition-all duration-300 hover:-translate-y-1 ${
            plan.popular ?
            "border-2 border-blue-600 shadow-2xl shadow-blue-100" :
            "border border-gray-100 shadow-md hover:shadow-xl"}`
            }
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}>

              {plan.popular &&
            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
            }

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-5xl font-bold ${plan.popular ? "text-blue-600" : "text-gray-900"}`}>
                    {plan.price}
                  </span>
                  {plan.period &&
                <span className="text-gray-500 text-lg">{plan.period}</span>
                }
                </div>
                {plan.name === "Premium" &&
              <p className="text-sm text-gray-500 mt-2">30-day free trial</p>
              }
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) =>
              <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
              )}
              </ul>

              <Button
              onClick={() => handleGetStarted(plan.name)}
              className={`w-full h-14 text-lg rounded-xl ${
              plan.popular ?
              "bg-blue-600 hover:bg-blue-700 text-white" :
              plan.name === "Enterprise" ?
              "bg-purple-600 hover:bg-purple-700 text-white" :
              "bg-gray-600 hover:bg-gray-700 text-white"}`
              }>

                {plan.cta}
              </Button>
            </motion.div>
          )}
        </div>

        {/* Info */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}>

          <p className="text-gray-600">
            Premium includes a 30-day free trial
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Questions? <a href="mailto:support@questlearning.co" className="text-blue-600 hover:underline">Contact our team</a>
          </p>
        </motion.div>
      </div>
    </section>);

}