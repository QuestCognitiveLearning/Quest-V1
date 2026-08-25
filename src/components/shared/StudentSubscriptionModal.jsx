import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle, RefreshCw, ExternalLink, X, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { quest } from "@/api/questClient";
import { getUserTier, getLimits, studentGenerationsRemaining } from "@/lib/tier";

/**
 * StudentSubscriptionModal — the student "Settings" surface for their plan.
 * Opens from the sidebar. On mount it re-syncs the subscription with Stripe
 * (server writes the fresh tier onto the user row, so the status shown here
 * is always what's actually stored on the student's account), then shows:
 *   - Free tier: generations used vs the 5-generation cap + Upgrade button.
 *   - Student Pro / Classroom: unlimited badge + Manage subscription (Stripe
 *     billing portal) for card changes / cancellation.
 * A manual "Refresh status" button re-runs the same sync on demand.
 *
 * `onUserRefresh(freshUser)` propagates the updated user to the parent page
 * so tier-gated UI (like the free-generations banner) updates immediately.
 */
export default function StudentSubscriptionModal({ user, onClose, onUserRefresh }) {
  const [me, setMe] = useState(user);
  const [syncing, setSyncing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const tier = getUserTier(me);
  const paid = tier !== "free";
  const limits = getLimits(me);
  const used = me?.student_generations_used ?? 0;
  const limit = limits.studentGenerationsTotal ?? 0;
  const remaining = studentGenerationsRemaining(me);
  const status = me?.subscription_status;

  const refreshStatus = async ({ silent = false } = {}) => {
    setSyncing(true);
    try {
      console.log("[StripeDebug] sync start — current user:", {
        email: user?.email,
        tier: user?.tier,
        subscription_status: user?.subscription_status,
        subscription_tier: user?.subscription_tier,
        student_generations_used: user?.student_generations_used,
      });
      const syncResp = await quest.functions.invoke("syncStripeSubscription", {});
      console.log("[StripeDebug] syncStripeSubscription response:", JSON.stringify(syncResp?.data ?? syncResp, null, 2));
      const fresh = await quest.auth.me();
      console.log("[StripeDebug] refetched user after sync:", {
        email: fresh?.email,
        tier: fresh?.tier,
        subscription_status: fresh?.subscription_status,
        subscription_tier: fresh?.subscription_tier,
        effectiveTier: getUserTier(fresh),
      });
      setMe(fresh);
      onUserRefresh?.(fresh);
      if (!silent) {
        const freshTier = getUserTier(fresh);
        toast.success(
          freshTier === "free"
            ? "Status refreshed — no active subscription found."
            : "Status refreshed — your plan is active."
        );
      }
    } catch (err) {
      console.error("[StripeDebug] sync FAILED:", err?.message || err, err?.context || "");
      if (!silent) toast.error("Couldn't refresh subscription status.");
    } finally {
      setSyncing(false);
    }
  };

  // Sync once when the modal opens so the student always sees the truth
  // from Stripe, not a possibly-stale cached tier.
  useEffect(() => {
    refreshStatus({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpgrade = async () => {
    if (upgrading) return;
    setUpgrading(true);
    try {
      const pricesResp = await quest.functions.invoke("getStripePrices", {});
      const priceId =
        pricesResp?.data?.tiers?.student?.monthly ||
        pricesResp?.tiers?.student?.monthly;
      if (!priceId) {
        toast.error("Student plan isn't configured yet — try again shortly.");
        return;
      }
      const back = `${window.location.origin}${window.location.pathname}`;
      const resp = await quest.functions.invoke("createCheckout", {
        priceId,
        successUrl: `${back}?checkout=success`,
        cancelUrl: `${back}?checkout=canceled`,
      });
      const url = resp?.data?.url || resp?.url;
      if (!url) throw new Error("Checkout could not be started.");
      window.location.href = url;
    } catch (err) {
      console.error("Upgrade failed:", err);
      toast.error(err?.message || "Couldn't start checkout.");
    } finally {
      setUpgrading(false);
    }
  };

  const handleManage = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const resp = await quest.functions.invoke("stripePortal", {
        returnPath: window.location.pathname,
      });
      const url = resp?.data?.url || resp?.url;
      if (!url) throw new Error("Could not open the billing portal.");
      window.location.href = url;
    } catch (err) {
      console.error("Billing portal failed:", err);
      toast.error(err?.message || "Couldn't open the billing portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  const statusBadge = paid
    ? status === "trial"
      ? { label: "Trial", cls: "bg-blue-100 text-blue-700" }
      : status === "grace_period"
        ? { label: "Ends soon", cls: "bg-amber-100 text-amber-700" }
        : { label: "Active", cls: "bg-emerald-100 text-emerald-700" }
    : { label: "Free plan", cls: "bg-slate-100 text-slate-600" };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full text-slate-900"
        style={{ fontFamily: '"Inter", sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center ${paid ? "bg-blue-600" : "bg-slate-100"}`}>
              {paid ? <Crown className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-slate-500" />}
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">
                {paid ? (tier === "classroom" ? "Classroom" : "Student Pro") : "Your plan"}
              </h2>
              <span className={`inline-block mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                {syncing ? "Checking…" : statusBadge.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {paid ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle className="w-4 h-4" />
              Unlimited learning sessions
            </div>
            <p className="text-xs text-emerald-700 mt-1">
              Generate as many study sessions and flashcard decks as you want — no caps.
            </p>
            {status === "grace_period" && me?.grace_period_end_date && (
              <p className="text-xs text-amber-700 mt-2">
                Your subscription is set to end on{" "}
                {new Date(me.grace_period_end_date).toLocaleDateString()}.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
            <div className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>Free generations</span>
              <span className={remaining <= 0 ? "text-amber-600" : "text-slate-700"}>
                {Math.min(used, limit)}/{limit} used
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${remaining <= 0 ? "bg-amber-500" : "bg-blue-600"}`}
                style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Upgrade to Student Pro for unlimited generations — $9/mo, cancel anytime.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {paid ? (
            <Button
              onClick={handleManage}
              disabled={portalLoading}
              variant="outline"
              className="w-full justify-center"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Manage subscription
            </Button>
          ) : (
            <Button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white"
            >
              {upgrading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Upgrade — $9/mo
            </Button>
          )}
          <Button
            onClick={() => refreshStatus()}
            disabled={syncing}
            variant="ghost"
            className="w-full justify-center text-slate-600"
          >
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh status
          </Button>
        </div>
      </div>
    </div>
  );
}
