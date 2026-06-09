import React from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function StickyCta() {
  const navigate = useNavigate();

  return (
    <div
      role="region"
      aria-label="Quick start"
      className="fixed bottom-6 right-6 z-40 lp-v3-sticky"
    >
      <div
        className="inline-flex items-center gap-3 bg-[#0F172A] text-white pl-5 pr-2 py-2 rounded-full shadow-2xl shadow-black/30"
      >
        <span className="text-[13.5px]">
          Free{" "}
          <em className="not-italic text-[#F97316] font-bold">Curriculum Tool</em>
        </span>
        <button
          type="button"
          onClick={() => navigate("/try")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[13px] transition-colors"
        >
          Try Now
          <ArrowRight size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
