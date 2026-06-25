import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { label: "How It Works", id: "loop" },
  { label: "For Teachers", id: "teacher-flow" },
  { label: "For Students", id: "how" },
  { label: "The Science", id: "lab" },
  { label: "Pricing", id: "pricing" },
  { label: "FAQ", id: "faq" },
];

export default function Header() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md transition-colors ${
        scrolled
          ? "bg-[#EEF3FB]/90 border-b border-[#E2E8F0]"
          : "bg-[#EEF3FB]/70 border-b border-transparent"
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex items-center justify-between h-[68px]">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2.5"
          >
            <img
              src="/quest-logo-on-white.png"
              alt="Quest"
              className="w-8 h-8 rounded-lg object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="text-[#0F172A] font-bold text-[17px] tracking-tight">
              Quest Learning
            </span>
          </a>

          <nav
            className="hidden lg:flex items-center gap-1"
            aria-label="Primary"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={scrollTo(link.id)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-[#475569] hover:text-[#2563EB] hover:bg-[#DBEAFE] transition-colors capitalize"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/SignIn")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563EB] text-white font-semibold text-sm hover:bg-[#1D4ED8] transition-colors lp-v3-cta-shadow"
            >
              Log in
              <ArrowRight size={14} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
