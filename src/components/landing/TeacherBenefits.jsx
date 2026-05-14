import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Eye, Calendar, TrendingUp } from "lucide-react";

export default function TeacherBenefits() {
  const features = [
  { icon: Sparkles, text: "AI-generated curriculum" },
  { icon: Eye, text: "Real-time student insights" },
  { icon: Calendar, text: "Automated review scheduling" },
  { icon: TrendingUp, text: "Track mastery over time" }];


  return (
    <section id="for-teachers" className="bg-[#EEF3FB] px-6 py-24">
      <div className="container mx-auto max-w-6xl">
        <motion.h2
          className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}>

          Powerful instruction, <span className="text-blue-600">fully visible.</span>
        </motion.h2>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <motion.div
            className="bg-[#F8FAFF] rounded-3xl p-8 shadow-md border border-blue-50"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}>

            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Class Analytics</h3>
              <span className="text-sm text-gray-500">Biology 101</span>
            </div>
            <div className="space-y-5">
              {[
              { name: 'Alex Chen', progress: 85, color: 'bg-green-500' },
              { name: 'Maria Rodriguez', progress: 92, color: 'bg-green-500' },
              { name: 'James Wilson', progress: 45, color: 'bg-red-500' },
              { name: 'Sarah Kim', progress: 78, color: 'bg-green-500' }].
              map((student, idx) =>
              <div key={idx}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700 font-medium text-sm">{student.name}</span>
                    <span className="text-sm font-semibold text-gray-900">{student.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                    className={`h-full ${student.color}`}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${student.progress}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: idx * 0.15 }} />

                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 gap-4"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}>

            {features.map((feature, idx) =>
            <div key={idx} className="bg-[#F8FAFF] rounded-2xl p-6 shadow-sm border border-blue-50 text-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-gray-900 font-semibold text-sm">{feature.text}</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>);

}