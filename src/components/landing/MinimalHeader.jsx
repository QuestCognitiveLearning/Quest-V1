import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { quest } from "@/api/questClient";

export default function MinimalHeader({ onContactClick }) {
  const navigate = useNavigate();

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSignIn = () => {
    navigate(createPageUrl('SignIn'));
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-gray-100 shadow-md">
      <div className="container mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Header sits on a white background — use the blue-square mark
              variant so the logo is visible. The transparent
              `/quest-logo-on-blue.png` is reserved for the dark-blue sidebars. */}
          <img
            src="/quest-logo-on-white.png"
            alt="Quest Learning"
            width="36"
            height="36"
            className="h-9 w-9 rounded-xl shadow-sm"
          />
          <span className="text-lg font-bold text-gray-900 tracking-tight">Quest Learning</span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { label: 'How It Works', id: 'core-idea' },
            { label: 'For Students', id: 'for-students' },
            { label: 'For Teachers', id: 'for-teachers' },
            { label: 'Pricing', id: 'pricing' },
            { label: 'FAQ', id: 'faq' },
            { label: 'Contact', id: 'contact', onClick: onContactClick },
          ].map(({ label, id, onClick }) => (
            <button
              key={id}
              onClick={onClick || (() => scrollToSection(id))}
              className="px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-150 font-medium"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button onClick={handleSignIn} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 shadow-md shadow-blue-100 text-sm font-semibold">
            Sign In / Sign Up
          </Button>
        </div>
      </div>
    </header>
  );
}