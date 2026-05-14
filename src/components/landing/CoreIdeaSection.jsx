import React from "react";
import { motion } from "framer-motion";
import { Clock, FileEdit, Workflow } from "lucide-react";

export default function CoreIdeaSection() {
  const pillars = [
    {
      icon: Clock,
      title: "Hours, not weeks",
      description: "Skip the manual lesson planning. Quest generates videos, quizzes, and review sessions for every standard you teach.",
    },
    {
      icon: FileEdit,
      title: "Editable, not boilerplate",
      description: "Every AI-generated lesson is yours to refine. Tweak questions, swap videos, adjust pacing — keep your voice in every class.",
    },
    {
      icon: Workflow,
      title: "Class management on autopilot",
      description: "Assignments, reviews, attention checks, and progress tracking run themselves so you can focus on the students who need you.",
    },
  ];

  return (
    <section id="core-idea" className="py-24 px-6 bg-white">
      <div className="container mx-auto max-w-6xl">
        <motion.h2
          className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Built for the time teachers <span className="text-blue-600">don't have.</span>
        </motion.h2>
        <motion.p
          className="text-center text-gray-600 text-lg max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Curriculum planning, grading, and progress tracking eat the hours that should go to teaching. Quest takes those off your plate.
        </motion.p>

        <div className="grid md:grid-cols-3 gap-6">
          {pillars.map((pillar, idx) => (
            <motion.div
              key={idx}
              className="bg-white rounded-3xl p-8 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-blue-50"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
            >
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <pillar.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{pillar.title}</h3>
              <p className="text-gray-600 leading-relaxed">{pillar.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
