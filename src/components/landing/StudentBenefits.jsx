import React from "react";
import { motion } from "framer-motion";
import { HelpCircle, Zap, Target, RefreshCw } from "lucide-react";

const learningSteps = [
  { icon: HelpCircle, title: "Inquiry-Based Entry", text: "Socratic hook questions prime your curiosity." },
  { icon: Zap, title: "Interactive Session", text: "Videos and readings with attention checks." },
  { icon: Target, title: "Personalized Quizzes", text: "Adaptive questions calibrated to your level." },
  { icon: Target, title: "Case Studies", text: "Real-world scenarios with free-response challenges." },
  { icon: RefreshCw, title: "Spaced Repetition", text: "Auto reviews at 1, 3, 7, 14, and 21 days." }
];

export default function StudentBenefits() {
  return (
    <section id="for-students" className="py-24 px-6 bg-white">
      <div className="container mx-auto max-w-6xl">
        <motion.h2
          className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          A <span className="text-blue-600">clear path</span>, every day.
        </motion.h2>

        <motion.p
          className="text-center text-gray-500 mb-16 text-lg"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Every topic follows the same science-backed flow:
        </motion.p>

        {/* Benefits cards + screenshots */}
        <div className="grid lg:grid-cols-2 gap-12">
          <motion.div
            className="space-y-6 flex flex-col justify-center"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {learningSteps.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-blue-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.text}</p>
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div
            className="overflow-hidden rounded-3xl shadow-xl border border-blue-100"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <img
              src="/student-quiz.png"
              alt="Quiz Interface"
              className="w-full h-auto block"
            />
            <img
              src="/student-progress.png"
              alt="Progress Dashboard"
              className="w-full h-auto block"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}