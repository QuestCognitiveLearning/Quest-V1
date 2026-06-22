/**
 * Global in-app confirm dialog. Replaces the browser-native window.confirm()
 * (which renders in the tab chrome) with an on-page modal popup.
 *
 * Usage from anywhere:
 *   import { confirmDialog } from "@/lib/confirm";
 *   if (await confirmDialog({ message: "Delete this?", tone: "danger", confirmLabel: "Delete" })) { ... }
 *
 * Mount <ConfirmRoot /> once at the app root.
 */
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";

let showFn = null;

export function confirmDialog(opts = {}) {
  return new Promise((resolve) => {
    if (!showFn) {
      // Root not mounted yet — fall back to native so we never lose the gate.
      resolve(window.confirm(opts.message || "Are you sure?"));
      return;
    }
    showFn(opts, resolve);
  });
}

export function ConfirmRoot() {
  const [state, setState] = useState(null); // { opts, resolve }

  useEffect(() => {
    showFn = (opts, resolve) => setState({ opts, resolve });
    return () => {
      showFn = null;
    };
  }, []);

  const close = (val) => {
    setState((s) => {
      s?.resolve(val);
      return null;
    });
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (!state) return null;
  const { opts } = state;
  const danger = opts.tone === "danger";

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              danger ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
            }`}
          >
            {danger ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">
              {opts.title || (danger ? "Are you sure?" : "Please confirm")}
            </h2>
            {opts.message && <p className="text-sm text-slate-600 mt-1">{opts.message}</p>}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={() => close(false)} className="flex-1 border-2">
            {opts.cancelLabel || "Cancel"}
          </Button>
          <Button
            onClick={() => close(true)}
            className={`flex-1 text-white ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {opts.confirmLabel || "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
