import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import KnowledgeMapVisualization from "./KnowledgeMapVisualization";

export default function NewHeroSection() {
  const navigate = useNavigate();
  const handleTryNow = () => {
    navigate(createPageUrl("SignIn"));
  };

  return (
    <section className="bg-gradient-to-br from-blue-100 via-blue-200 to-blue-300 pt-32 pb-20 px-6 relative overflow-hidden">
      {/* Classroom photo at 30% opacity over the blue gradient. */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: "url('/hero-classroom.jpg')",
          opacity: 0.3,
        }}
      />
      <div className="container mx-auto max-w-7xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}>

            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-xl">
              <motion.div
                className="inline-flex items-center gap-2 mb-8 bg-green-50 border border-green-200 rounded-full px-4 py-2 shadow-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}>

                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-700 text-sm font-semibold">Now launched · Try now</span>
              </motion.div>

              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Transform learning into{" "}
                <span className="text-blue-600">
                  mastery
                </span>
              </h1>

              <p className="text-gray-700 mb-10 text-xl leading-relaxed">Adaptive learning that combines inquiry-based teaching, spaced repetition, and real-time insights.</p>

              <div className="flex gap-4">
                <Button onClick={handleTryNow} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-6 text-base font-semibold rounded-xl shadow-lg shadow-blue-200">
                  Try Now
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Right: Visualization */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}>

            <KnowledgeMapVisualization />
          </motion.div>
        </div>
      </div>
    </section>);


}