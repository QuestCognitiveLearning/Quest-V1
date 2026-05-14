import React from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

export default function SimpleComparison() {
  const comparisons = [
    { old: "Passive videos", new: "Inquiry-driven sessions" },
    { old: "Static pacing", new: "Adaptive pathways" },
    { old: "Manual review", new: "Automatic spaced repetition" },
    { old: "Limited insight", new: "Real-time analytics" }
  ];

  return (
    <section className="py-24 px-6 bg-white">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          className="bg-white rounded-3xl shadow-md p-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Traditional Learning</h3>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-blue-600">Quest Learning</h3>
            </div>
          </div>

          <div className="space-y-3">
            {comparisons.map((comparison, idx) => (
              <motion.div
                key={idx}
                className="grid md:grid-cols-2 gap-3"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
              >
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-gray-700 text-sm font-medium">{comparison.old}</p>
                </div>
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                  <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <p className="text-gray-900 text-sm font-medium">{comparison.new}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}