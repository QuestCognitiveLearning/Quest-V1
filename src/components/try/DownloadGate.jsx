/**
 * @file   DownloadGate.jsx
 * @desc   Paywall modal shown when an anonymous visitor clicks "Download".
 *         States:
 *           1. Not signed in           → sign-up CTA (returns to /Try)
 *           2. Signed in, no subscription → start free trial (Stripe checkout)
 *           3. Signed in + active sub  → auto-authorize and close
 *
 *         Generated content is already in localStorage (key set by Try.jsx)
 *         so the round-trip through SignIn / Stripe Checkout restores the
 *         user's results when they land back on /Try.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { quest } from '@/api/questClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';

export default function DownloadGate({ open, onClose, onAuthorized, format }) {
  const { isAuthenticated, user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const hasActiveSub =
    !!user && user.subscription_status && user.subscription_status !== 'free';

  // Auto-authorize when modal opens for a user with an active trial/sub.
  useEffect(() => {
    if (open && isAuthenticated && hasActiveSub) {
      onAuthorized?.();
    }
  }, [open, isAuthenticated, hasActiveSub, onAuthorized]);

  const goSignUp = () => {
    const next = encodeURIComponent(location.pathname + location.search);
    navigate(`/SignIn?next=${next}&intent=trial`);
  };

  const startTrial = async () => {
    setError('');
    setWorking(true);
    try {
      // Fetch the configured Stripe price (same flow as /Pricing).
      const { data: pricesResp } = await quest.functions.invoke('getStripePrices', {});
      const priceId = pricesResp?.premium_price_id;
      if (!priceId) throw new Error('Stripe pricing is not configured. Please try again later.');

      const { data: checkout } = await quest.functions.invoke('createCheckout', {
        priceId,
        successUrl: `${window.location.origin}/try?trial=success`,
        cancelUrl: window.location.href,
      });
      if (checkout?.url) {
        window.location.href = checkout.url;
        return;
      }
      throw new Error('Could not start checkout.');
    } catch (err) {
      setError(err?.message || 'Could not start your free trial. Please try again.');
      setWorking(false);
    }
  };

  if (!open) return null;

  // If we're still loading auth, render nothing yet (avoids flash).
  if (isLoadingAuth) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center gap-2 py-6 text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking your account…
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Active sub: just a tiny success state while the parent finishes the download.
  if (isAuthenticated && hasActiveSub) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center gap-2 py-6 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" /> Starting your {format?.toUpperCase()} download…
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
            <Lock className="w-5 h-5 text-indigo-700" />
          </div>
          <DialogTitle className="text-center text-xl">
            Start your free 7-day trial
          </DialogTitle>
          <DialogDescription className="text-center">
            Download your {format === 'pdf' ? 'PDF' : 'Word'} handout — plus get full access to
            curriculum tools, live sessions, and AI tutoring while you're trialing.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-slate-700 mt-4 mb-4">
          <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> Unlimited PDF + Word downloads</li>
          <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> Build curriculum from any YouTube video</li>
          <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> Cancel anytime within 7 days — no charge</li>
        </ul>

        {error && (
          <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>
        )}

        {isAuthenticated ? (
          <Button onClick={startTrial} disabled={working} className="w-full">
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start free trial'}
          </Button>
        ) : (
          <Button onClick={goSignUp} className="w-full">
            Sign up to start your free trial
          </Button>
        )}

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
