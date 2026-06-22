import React from "react";

import Header from "@/components/landing/v3/Header";
import Hero from "@/components/landing/v3/Hero";
import ProblemStrip from "@/components/landing/v3/ProblemStrip";
import PlatformLoop from "@/components/landing/v3/PlatformLoop";
import TeacherFlow from "@/components/landing/v3/TeacherFlow";
import ForStudents from "@/components/landing/v3/ForStudents";
import RetentionLab from "@/components/landing/v3/RetentionLab";
import ClassroomLive from "@/components/landing/v3/ClassroomLive";
import Voices from "@/components/landing/v3/Voices";
import Pricing from "@/components/landing/v3/Pricing";
import Faq from "@/components/landing/v3/Faq";
import Compliance from "@/components/landing/v3/Compliance";
import CtaFinal from "@/components/landing/v3/CtaFinal";
import Footer from "@/components/landing/v3/Footer";
import StickyCta from "@/components/landing/v3/StickyCta";

export default function Landing() {
  return (
    <div className="lp-v3 min-h-screen">
      <Header />
      <main>
        <Hero />
        <ProblemStrip />
        <PlatformLoop />
        <TeacherFlow />
        <ForStudents />
        <RetentionLab />
        <ClassroomLive />
        <Voices />
        <Pricing />
        <Faq />
        <CtaFinal />
        <Compliance />
      </main>
      <Footer />
      <StickyCta />
    </div>
  );
}
