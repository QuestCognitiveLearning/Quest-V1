/**
 * UpgradeModal — shown when a tier-gated action is attempted. Reusable for the
 * "you hit the Classroom 3-class cap" path and any future feature gate.
 */
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket } from "lucide-react";
import { tierLabel } from "@/lib/tier";

const STUDIO_FEATURES = [
  "Unlimited classes",
  "Branded PDFs and parent emails",
  "Automated weekly parent progress reports",
  "Multiple teacher seats",
  "Priority support",
];

const CLASSROOM_FEATURES = [
  "Up to 3 classes, unlimited students",
  "Unlimited AI generations",
  "Live sessions with leaderboards",
  "AI Panda Tutor for every student",
  "Priority support",
];

export default function UpgradeModal({
  open,
  onClose,
  recommendedTier = "studio",
  reason,
}) {
  const features =
    recommendedTier === "studio" ? STUDIO_FEATURES : CLASSROOM_FEATURES;
  const price = recommendedTier === "studio" ? "$59/mo" : "$29/mo";

  if (!open) return null;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-indigo-700" />
          </div>
          <DialogTitle className="text-center text-xl">
            Upgrade to {tierLabel(recommendedTier)}
          </DialogTitle>
          <DialogDescription className="text-center">
            {reason ||
              `You've reached your plan's limit. Upgrade to ${tierLabel(
                recommendedTier
              )} to keep going.`}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-slate-700 mt-4 mb-4">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          onClick={() => (window.location.href = "/Pricing")}
        >
          See {tierLabel(recommendedTier)} plans &mdash; from {price}
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="block mx-auto mt-3 text-xs text-slate-500 hover:text-slate-700"
        >
          Not now
        </button>
      </DialogContent>
    </Dialog>
  );
}
