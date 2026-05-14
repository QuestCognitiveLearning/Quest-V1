import React from "react";
import { motion } from "framer-motion";

export default function SimpleTestimonials() {
  const testimonials = [
  {
    initials: "FE",
    name: "Felo Joseph",
    role: "Student",
    quote: "Quest Learning has transformed how I study. The spaced repetition system actually works, and I retain information much longer.",
    bgColor: "bg-blue-600"
  },
  {
    initials: "DW",
    name: "Drumwright",
    role: "Teacher",
    quote: "As an educator, I love seeing my students' progress in real-time. The analytics help me identify knowledge gaps before they become bigger problems.",
    bgColor: "bg-blue-600"
  },
  {
    initials: "EV",
    name: "Evelina",
    role: "College Staff",
    quote: "The Socratic inquiry feature challenged me to think deeply about concepts. It's like having a tutor who actually cares about my learning journey.",
    bgColor: "bg-blue-600"
  }];


  return (
    <section className="py-12 px-6 bg-blue-50">
      <div className="mx-auto w-fit">
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) =>
          <motion.div
            key={idx}
            className="bg-[#F5F8FF] p-8 rounded-3xl border border-blue-100 relative hover:shadow-lg transition-all duration-300"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {testimonial.initials}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{testimonial.name}</p>
                  <p className="text-blue-500 text-xs">{testimonial.role}</p>
                </div>
              </div>
              <div className="border-t border-blue-100 pt-5">
                <div className="text-4xl text-blue-200 font-serif leading-none mb-3">"</div>
                <p className="text-gray-700 leading-relaxed">{testimonial.quote}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>);

}