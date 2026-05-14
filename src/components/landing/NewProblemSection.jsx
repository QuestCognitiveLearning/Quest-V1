import React from 'react';
import { motion } from 'framer-motion';
import { Hourglass, Play, Calendar, EyeOff } from 'lucide-react';

export default function NewProblemSection() {
  const problems = [
  {
    icon: Hourglass,
    title: "Rapid Forgetting",
    text: "Students forget most new material within days."
  },
  {
    icon: Play,
    title: "Passive Learning",
    text: "Videos create familiarity, not understanding."
  },
  {
    icon: Calendar,
    title: "Unstructured Review",
    text: "Students don't know what to review or when."
  },
  {
    icon: EyeOff,
    title: "Limited Visibility",
    text: "Teachers don't see misconceptions until assessments."
  }];


  return (
    <section id="problem" className="bg-[#EEF3FB] py-24 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16">

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-16">
            The problem isn't effort.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
              It's forgetting.
            </span>
          </h2>

          {/* Forgetting Curve Diagram */}
          <motion.div
            className="max-w-3xl mx-auto mb-16"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}>

            <div
              className="relative bg-gradient-to-br from-red-50 via-orange-50 to-blue-50 rounded-3xl p-8 border-2 border-red-200 shadow-xl overflow-hidden">

              {/* Animated background pattern */}
              <motion.div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'radial-gradient(circle at 20px 20px, rgba(239, 68, 68, 0.4) 1px, transparent 0)',
                  backgroundSize: '40px 40px'
                }}
                animate={{
                  backgroundPosition: ['0px 0px', '40px 40px']
                }}
                transition={{
                  duration: 20,
                  ease: "linear",
                  repeat: Infinity
                }} />

              
              <svg viewBox="0 0 600 300" className="w-full h-auto relative z-10">
                {/* Glow effect behind curve */}
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#EF4444" />
                    <stop offset="50%" stopColor="#EF4444" />
                    <stop offset="100%" stopColor="#EF4444" />
                  </linearGradient>
                </defs>
                
                {/* Axes with animation */}
                <motion.line
                  x1="50" y1="250" x2="550" y2="250"
                  stroke="#6B7280"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  viewport={{ once: true }} />

                <motion.line
                  x1="50" y1="250" x2="50" y2="30"
                  stroke="#6B7280"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  transition={{ duration: 0.8, ease: "easeInOut", delay: 0.2 }}
                  viewport={{ once: true }} />

                
                {/* Labels */}
                <motion.text
                  x="300" y="285"
                  textAnchor="middle"
                  className="fill-gray-700 text-sm font-semibold"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  viewport={{ once: true }}>

                  Time
                </motion.text>
                <motion.text
                  x="20" y="150"
                  textAnchor="middle"
                  transform="rotate(-90 20 150)"
                  className="fill-gray-700 text-sm font-semibold"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                  viewport={{ once: true }}>

                  Retention
                </motion.text>
                
                {/* Shadow path for depth */}
                <motion.path
                  d="M 50 50 Q 150 50, 250 150 T 550 240"
                  stroke="#DC2626"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.3"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  transition={{ duration: 2.5, ease: "easeInOut", delay: 0.1 }}
                  viewport={{ once: true }} />

                
                {/* Main Forgetting Curve with gradient */}
                <motion.path
                  d="M 50 50 Q 150 50, 250 150 T 550 240"
                  stroke="url(#curveGradient)"
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                  filter="url(#glow)"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  transition={{ duration: 2.5, ease: "easeInOut" }}
                  viewport={{ once: true }} />

                
                {/* Animated Points on curve with pulse */}
                <motion.g>
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="8"
                    fill="#EF4444"
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: [0, 1.2, 1], opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.3, times: [0, 0.6, 1] }}
                    viewport={{ once: true }} />

                  <motion.circle
                    cx="50"
                    cy="50"
                    r="8"
                    fill="#EF4444"
                    opacity="0.5"
                    animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} />

                </motion.g>
                
                <motion.g>
                  <motion.circle
                    cx="250"
                    cy="150"
                    r="8"
                    fill="#F97316"
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: [0, 1.2, 1], opacity: 1 }}
                    transition={{ duration: 0.5, delay: 1.5, times: [0, 0.6, 1] }}
                    viewport={{ once: true }} />

                  <motion.circle
                    cx="250"
                    cy="150"
                    r="8"
                    fill="#F97316"
                    opacity="0.5"
                    animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1.7 }} />

                </motion.g>
                
                <motion.g>
                  <motion.circle
                    cx="550"
                    cy="240"
                    r="8"
                    fill="#DC2626"
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: [0, 1.2, 1], opacity: 1 }}
                    transition={{ duration: 0.5, delay: 2.5, times: [0, 0.6, 1] }}
                    viewport={{ once: true }} />

                  <motion.circle
                    cx="550"
                    cy="240"
                    r="8"
                    fill="#DC2626"
                    opacity="0.5"
                    animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 2.7 }} />

                </motion.g>
                
                {/* Annotations with background */}
                <motion.g
                  initial={{ opacity: 0, y: -10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  viewport={{ once: true }}>

                  <rect x="60" y="15" width="120" height="22" rx="11" fill="white" opacity="0.95" />
                  <text
                    x="120"
                    y="30"
                    textAnchor="middle"
                    className="fill-red-600 text-xs font-bold">

                    Watched the video
                  </text>
                </motion.g>
                
                <motion.g
                  initial={{ opacity: 0, y: -10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 1.5 }}
                  viewport={{ once: true }}>

                  <rect x="250" y="115" width="100" height="22" rx="11" fill="white" opacity="0.95" />
                  <text
                    x="300"
                    y="130"
                    textAnchor="middle"
                    className="fill-orange-600 text-xs font-bold">

                    Felt confident
                  </text>
                </motion.g>
                
                <motion.g
                  initial={{ opacity: 0, y: -10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 2.5 }}
                  viewport={{ once: true }}>

                  <rect x="460" y="255" width="110" height="22" rx="11" fill="white" opacity="0.95" />
                  <text
                    x="515"
                    y="270"
                    textAnchor="middle"
                    className="fill-red-700 text-xs font-bold">

                    Forgot most of it
                  </text>
                </motion.g>
              </svg>
            </div>
          </motion.div>
        </motion.div>

        {/* Problem Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map((problem, index) =>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true }}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-red-200 hover:-translate-y-1 transition-all duration-300">

              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                <problem.icon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{problem.title}</h3>
              <p className="text-gray-600 text-sm">{problem.text}</p>
            </motion.div>
          )}
        </div>
      </div>
    </section>);

}