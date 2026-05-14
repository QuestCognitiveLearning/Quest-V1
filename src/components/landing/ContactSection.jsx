import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Clock, MapPin } from "lucide-react";
import { quest } from "@/api/questClient";
import { toast } from "sonner";

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    school: "",
    message: ""
  });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSending(true);
    try {
      await quest.integrations.Core.SendEmail({
        to: "tnbioquest@gmail.com",
        subject: `Contact Us Inquiry from ${formData.name}`,
        body: `
Name: ${formData.name}
Email: ${formData.email}
School/Organization: ${formData.school || "Not provided"}

Message:
${formData.message}
        `
      });

      toast.success("Message sent! We'll get back to you soon.");
      setFormData({ name: "", email: "", school: "", message: "" });
    } catch (error) {
      toast.error("Failed to send message. Please try again.");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contact" className="bg-blue-50 px-6 py-24 border-t border-blue-50">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16">

          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Get in <span className="text-blue-600">Touch</span>
          </h2>
          <p className="text-xl text-gray-600">
            Have questions? Our team is here to help.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-[#F0F5FF] rounded-3xl p-8 lg:p-12 border border-blue-100">

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Name *
                </label>
                <Input
                  type="text"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-12" />

              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Email *
                </label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-12" />

              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                School/Organization
              </label>
              <Input
                type="text"
                placeholder="Your school or organization"
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                className="h-12" />

            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Message *
              </label>
              <Textarea
                placeholder="Tell us more about your inquiry..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="min-h-32" />

            </div>

            <Button
              type="submit"
              disabled={sending}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-lg rounded-xl">

              {sending ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </motion.div>
      </div>
    </section>);

}