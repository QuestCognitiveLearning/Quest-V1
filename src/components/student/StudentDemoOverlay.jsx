import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StudentDemoOverlay({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-gray-900/85 flex items-center justify-center p-2">
      <div className="relative w-full max-w-7xl flex flex-col items-center gap-3">
        {/* Header */}
        <div className="flex items-center justify-between w-full px-2">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">Interactive Demo</span>
          </div>
          <Button
            onClick={onClose}
            className="bg-white/20 hover:bg-white/30 text-white border-0 rounded-full px-5 py-2 text-sm font-medium backdrop-blur-sm"
          >
            <X className="w-4 h-4 mr-1" />
            Skip Demo
          </Button>
        </div>

        {/* iframe */}
        <div className="w-full rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black" style={{ height: "82vh" }}>
          <iframe
            src="https://queststudentlearning.navattic.com/pyr0bys?g=cmmxpwbsq000c04l709y51k51&s=0"
            className="w-full h-full"
            frameBorder="0"
            allow="fullscreen"
            title="Student Walkthrough Demo"
          />
        </div>

        <p className="text-white/60 text-sm">You can close this walkthrough at any time.</p>
      </div>
    </div>
  );
}