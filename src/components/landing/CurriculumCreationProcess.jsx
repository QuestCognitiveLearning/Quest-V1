import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, Wand2, Search, Upload, ChevronDown } from "lucide-react";

export default function CurriculumCreationProcess() {
  const [openStep, setOpenStep] = useState(null);

  // Step 2 has two images stacked vertically (units/subunits creation + content generation).
  // Every other step is a single image.
  const steps = [
    {
      icon: ClipboardList,
      title: "Step 1: Select your standards",
      images: ["/step1-select-standards.png"],
      bullets: [
        "Pick your state, subject, and grade level",
        "Pulls live standards from the Common Standards Project",
        "Browse and confirm what your students need to learn",
      ],
    },
    {
      icon: Wand2,
      title: "Step 2: Let the AI do its magic",
      images: ["/step2a-ai-units.png", "/step2b-generating-content.png"],
      bullets: [
        "AI translates raw standards into clean units and subunits",
        "Generates the full content stack per subunit — inquiry, video matches, quiz, and case study — in parallel",
        "Sit back while Quest builds your curriculum",
      ],
    },
    {
      icon: Search,
      title: "Step 3: Review and refine",
      images: ["/step3-review-content.png"],
      bullets: [
        "Inspect every generated quiz question, case study, and inquiry prompt",
        "Edit or regenerate anything that isn't quite right",
        "Filter by difficulty (Easy / Medium / Hard) for fast review",
      ],
    },
    {
      icon: Upload,
      title: "Step 4: Upload your videos",
      images: ["/step4-upload-videos.png"],
      bullets: [
        "Attach a YouTube video to each subunit",
        "Transcripts and attention checks generate automatically",
        "Mark complete and your curriculum is live for students",
      ],
    },
  ];

  return (
    <section className="py-24 px-6 bg-white">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-gray-600 text-lg mb-4">From state standards to a complete classroom in minutes</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">
            How teachers create curriculum with AI
          </h2>
        </motion.div>

        <div className="space-y-4">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              className="bg-white rounded-2xl shadow-md border border-blue-50 overflow-hidden hover:shadow-xl transition-shadow duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
            >
              <button
                onClick={() => setOpenStep(openStep === idx ? null : idx)}
                className="w-full flex items-center justify-between p-6 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center">
                    <step.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 text-left">{step.title}</h3>
                </div>
                <ChevronDown
                  className={`w-6 h-6 text-gray-400 transition-transform ${openStep === idx ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {openStep === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-gray-200"
                  >
                    <div className="p-6 flex flex-col lg:flex-row items-start gap-6">
                      <ul className="flex-1 space-y-3">
                        {step.bullets.map((bullet, bulletIdx) => (
                          <li key={bulletIdx} className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                            <span className="text-gray-700">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="w-full lg:w-96 flex-shrink-0 space-y-3">
                        {step.images.map((src, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={src}
                            alt={`${step.title} — image ${imgIdx + 1}`}
                            className="w-full rounded-xl shadow-md border border-gray-100"
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
