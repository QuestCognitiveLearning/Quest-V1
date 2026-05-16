import React, { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

// `s=0` is the canonical first step (Navattic indexes from 0). `__t=<now>`
// per mount busts any Navattic-side cached visitor progress so each fresh
// signup sees the demo from the very beginning.
const NAVATTIC_BASE =
  "https://quest-learning.navattic.com/8xw086y?g=cmmxnnojh001404jmgicv6m6l&s=0";

export default function DemoOverlay({ onClose }) {
  const src = useMemo(() => `${NAVATTIC_BASE}&__t=${Date.now()}`, []);
  return (
    <div className="fixed inset-0 z-50 bg-gray-900/80 flex items-center justify-center p-2">
      <div className="relative w-full max-w-7xl flex flex-col items-center gap-3">
        {/* Label */}
        <div className="flex items-center gap-3">
          <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
            Interactive Demo
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20 hover:text-white gap-1.5"
          >
            <X className="w-4 h-4" />
            Skip Demo
          </Button>
        </div>

        {/* iframe container */}
        <div className="w-full rounded-2xl border-4 border-blue-500 shadow-2xl overflow-hidden bg-white"
          style={{ height: "82vh" }}>
          <iframe
            src={src}
            title="Quest Learning Demo"
            className="w-full h-full"
            allow="fullscreen"
          />
        </div>

        <p className="text-gray-300 text-sm">
          This is a guided walkthrough of the platform. You can exit at any time.
        </p>
      </div>
    </div>
  );
}