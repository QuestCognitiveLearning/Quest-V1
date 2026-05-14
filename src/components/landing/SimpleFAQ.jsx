import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export default function SimpleFAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
  {
    question: "When does Quest launch?",
    answer: "Quest Learning is launched now!"
  },
  {
    question: "What subjects are supported?",
    answer: "All subjects! Our AI-powered curriculum generation works across STEM, humanities, languages, and more at any education level."
  },
  {
    question: "Is this for K-12 or higher education?",
    answer: "Both! Quest Learning supports elementary through graduate-level education, adapting content difficulty to your needs."
  },
  {
    question: "Can teachers use their own content?",
    answer: "Yes! Teachers can use AI-generated content, upload their own materials, or combine both for maximum flexibility."
  },
  {
    question: "How is student data protected?",
    answer: "We use state-of-the-art database technology with industry-leading security practices including encryption, access controls, and regular security audits. Student data is never sold or shared with third parties."
  }];


  return (
    <section id="faq" className="bg-white px-6 py-24">
      <div className="container mx-auto max-w-3xl">
        <motion.h2
          className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}>

          Frequently Asked Questions
        </motion.h2>

        <div className="space-y-4">
          {faqs.map((faq, idx) =>
          <motion.div
            key={idx}
            className="bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden hover:shadow-md transition-shadow duration-300"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.05 }}>

              <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between p-6 hover:bg-blue-50/40 transition-colors text-left">

                <h3 className="text-base font-semibold text-gray-900 pr-4">{faq.question}</h3>
                <ChevronDown
                className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${openIndex === idx ? 'rotate-180' : ''}`} />

              </button>

              <AnimatePresence>
                {openIndex === idx &&
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="border-t border-gray-200">

                    <div className="p-6">
                      <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  </motion.div>
              }
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </section>);

}