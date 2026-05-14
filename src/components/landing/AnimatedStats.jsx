import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";

function AnimatedNumber({ target, suffix = "" }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    let start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

export default function AnimatedStats() {
  return (
    <section className="bg-[#EEF3FB] px-6 py-24">
      <div className="container mx-auto max-w-7xl">
        <motion.h2
          className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}>

          Quest Benefits
        </motion.h2>
        <div className="grid lg:grid-cols-[1fr,1fr] gap-8 items-center">
          {/* Left: Stat Cards */}
          <div className="flex flex-col md:flex-row gap-6">
            <motion.div
              className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-3xl p-12 w-full md:w-64 lg:w-64 h-80 flex flex-col justify-center items-center shadow-2xl shadow-blue-200"
              initial={{ opacity: 0, x: -30, scale: 0.95 }}
              whileInView={{ opacity: 1, x: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}>

              <div className="text-sm font-semibold text-blue-100 tracking-wide uppercase mb-6">Learning Impact</div>
              <div className="text-center flex-1 flex flex-col justify-center">
                <div className="text-7xl font-bold text-white mb-3">
                  <AnimatedNumber target={2} suffix="x" />
                </div>
                <div className="text-blue-100 font-medium text-lg">long-term retention</div>
              </div>
            </motion.div>

            <motion.div
              className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-3xl p-12 w-full md:w-64 lg:w-64 h-80 flex flex-col justify-center items-center shadow-2xl shadow-blue-200"
              initial={{ opacity: 0, x: -30, scale: 0.95 }}
              whileInView={{ opacity: 1, x: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}>

              <div className="text-sm font-semibold text-blue-100 tracking-wide uppercase mb-6">Engagement</div>
              <div className="text-center flex-1 flex flex-col justify-center">
                <div className="text-7xl font-bold text-white mb-3 leading-none -translate-y-3 translate-x-1">
                  <span>+<AnimatedNumber target={50} suffix="%" /></span>
                </div>
                <div className="text-blue-100 font-medium text-lg">student engagement</div>
              </div>
            </motion.div>

            <motion.div
              className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-3xl p-12 w-full md:w-64 lg:w-64 h-80 flex flex-col justify-center items-center shadow-2xl shadow-blue-200"
              initial={{ opacity: 0, x: -30, scale: 0.95 }}
              whileInView={{ opacity: 1, x: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}>

              <div className="text-sm font-semibold text-blue-100 tracking-wide uppercase mb-6">Teacher Time</div>
              <div className="text-center flex-1 flex flex-col justify-center">
                <div className="text-7xl font-bold text-white mb-3">
                  <AnimatedNumber target={15} suffix="+" />
                </div>
                <div className="text-blue-100 font-medium text-lg">hours saved per week</div>
              </div>
            </motion.div>
          </div>

          {/* Right: Citations */}
          <motion.div
            className="lg:pl-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}>

            <div className="space-y-2 text-sm text-gray-500 border-t border-gray-200 pt-6">
              <p>Dunlosky, J., et al. (2013). Improving students' learning with effective learning techniques. Psychological Science in the Public Interest.</p>
              <p>Freeman, S., et al. (2014). Active learning increases student performance in science, engineering, and mathematics. PNAS.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>);

}