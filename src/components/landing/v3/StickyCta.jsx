import React, { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

export default function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const h = window.innerHeight;
      const dh = document.documentElement.scrollHeight;
      setShow(y > h * 0.9 && y < dh - h * 1.6);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

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
          Bring Quest to your{" "}
          <em className="not-italic text-[#F97316] font-bold">school</em>
        </span>
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById("cta-final") || document.getElementById("contact");
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
              window.location.href = "mailto:admin@questlearning.co?subject=Bring%20Quest%20to%20Our%20School";
            }
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[13px] transition-colors"
        >
          Contact Us
          <ArrowRight size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
