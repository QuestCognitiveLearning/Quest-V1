import React from "react";
import MinimalHeader from "@/components/landing/MinimalHeader";
import NewHeroSection from "@/components/landing/NewHeroSection";
import NewProblemSection from "@/components/landing/NewProblemSection";
import CoreIdeaSection from "@/components/landing/CoreIdeaSection";
import AnimatedStats from "@/components/landing/AnimatedStats";
import StudentBenefits from "@/components/landing/StudentBenefits";
import TeacherBenefits from "@/components/landing/TeacherBenefits";
import CurriculumCreationProcess from "@/components/landing/CurriculumCreationProcess";
import SimpleTestimonials from "@/components/landing/SimpleTestimonials";
import SimpleComparison from "@/components/landing/SimpleComparison";

import PricingSection from "@/components/landing/PricingSection";
import ContactSection from "@/components/landing/ContactSection";
import SimpleFAQ from "@/components/landing/SimpleFAQ";
import MinimalFooter from "@/components/landing/MinimalFooter";
import { Toaster } from "sonner";

export default function Landing() {
  const handleContactClick = () => {
    const contactSection = document.getElementById("contact");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      <MinimalHeader onContactClick={handleContactClick} />
      <NewHeroSection />
      <NewProblemSection />
      <CoreIdeaSection />
      <AnimatedStats />
      <StudentBenefits />
      <TeacherBenefits />
      <CurriculumCreationProcess />
      <SimpleTestimonials />
      {/* SimpleComparison removed */}
      <PricingSection />
      <div id="contact">
        <ContactSection />
      </div>
      <SimpleFAQ />
      <MinimalFooter onContactClick={handleContactClick} />
      <Toaster />
    </div>
  );
}