/**
 * @file   Try.jsx
 * @desc   Top-of-funnel landing page at `/Try`. Public — no auth required to
 *         generate a quiz/case-study preview from a YouTube video. The
 *         download (PDF/Word) is gated behind starting a 7-day free trial.
 *
 *         State machine:
 *           pick     → user picks a video (URL or YouTube search)
 *           loading  → demo video plays while generate request runs
 *           results  → preview rendered, download CTA gated
 *           error    → bounce back to pick with a message
 *
 *         The generated payload is cached in sessionStorage so that the
 *         round-trip through SignIn → Stripe Checkout returns the user to
 *         their existing results instead of forcing them to re-generate.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/components/lib/supabase-client';
import { ArrowRight, Sparkles, Youtube, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VideoPicker from '@/components/try/VideoPicker';
import GenerationLoader from '@/components/try/GenerationLoader';
import Results from '@/components/try/Results';
import Footer from '@/components/landing/v3/Footer';

const CACHE_KEY = 'quest_try_result_v1';

export default function Try() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stage, setStage] = useState('pick'); // pick | loading | results | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [genStatus, setGenStatus] = useState('running'); // running | done | error
  const inFlight = useRef(false);

  // Restore cached result if the user is returning from sign-up or Stripe.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.quiz?.length) {
          setResult(cached);
          setStage('results');
        }
      }
    } catch { /* ignore parse errors */ }
  }, []);

  // Surface a toast-y banner when the user comes back from Stripe success.
  const trialFlag = searchParams.get('trial');
  useEffect(() => {
    if (trialFlag === 'success') {
      // Clean the URL; the active subscription_status will refresh in AuthContext.
      const params = new URLSearchParams(searchParams);
      params.delete('trial');
      setSearchParams(params, { replace: true });
    }
  }, [trialFlag, searchParams, setSearchParams]);

  const startGeneration = async ({ videoId }) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStage('loading');
    setGenStatus('running');
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('publicTryFunnel', {
        body: { action: 'generate', videoId },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      if (!data?.quiz?.length) throw new Error('No quiz generated. Try a different video.');
      setResult(data);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
      setGenStatus('done');
    } catch (err) {
      const msg = err?.message || 'Generation failed. Try a different video.';
      setError(msg);
      setGenStatus('error');
    } finally {
      inFlight.current = false;
    }
  };

  const startOver = () => {
    sessionStorage.removeItem(CACHE_KEY);
    setResult(null);
    setError('');
    setStage('pick');
  };

  return (
    <div
      className="min-h-screen bg-[#EEF3FB]"
      style={{
        fontFamily:
          "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Header — mirrors the homepage chrome (logo + wordmark, paper bg). */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#EEF3FB]/90 border-b border-[#E2E8F0]">
        <div className="max-w-[1200px] mx-auto px-6 h-[68px] flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img
              src="/quest-logo-on-white.png"
              alt="Quest"
              className="w-8 h-8 rounded-lg object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="text-[#0F172A] font-bold text-[17px] tracking-tight">
              Quest Learning
            </span>
          </a>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-sm font-medium text-[#475569] hover:text-[#2563EB] hidden sm:inline"
            >
              Home
            </a>
            <a
              href="/Pricing"
              className="text-sm font-medium text-[#475569] hover:text-[#2563EB] hidden sm:inline"
            >
              Pricing
            </a>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/SignIn')}
              className="border-[#E2E8F0] text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB]"
            >
              Sign in
            </Button>
          </div>
        </div>
      </header>

      <main className="px-6 py-10 sm:py-16">
        {trialFlag === 'success' && (
          <div className="max-w-3xl mx-auto mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Your free trial is active — your download is ready below.
          </div>
        )}

        {stage === 'pick' && (
          <>
            <div className="text-center max-w-3xl mx-auto mb-10">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-100 rounded-full px-3 py-1 mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Free tool
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
                Turn any YouTube video into a quiz + case study
              </h1>
              <p className="mt-4 text-lg text-slate-600">
                Paste a link or search YouTube. We'll generate a 10-question
                multiple-choice quiz and a discussion case study — ready to
                print as PDF or Word.
              </p>
              <div className="mt-5 flex items-center justify-center gap-5 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Youtube className="w-4 h-4" /> Any YouTube video</span>
                <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> PDF + Word export</span>
                <span className="flex items-center gap-1.5"><ArrowRight className="w-4 h-4" /> No signup to preview</span>
              </div>
            </div>
            <VideoPicker onPicked={startGeneration} />
          </>
        )}

        {stage === 'loading' && (
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Generating your handout
              </h2>
              <p className="mt-2 text-slate-600">
                This usually takes about a minute. While you wait — here's how
                Quest Learning works.
              </p>
            </div>
            <GenerationLoader
              status={genStatus}
              errorMessage={error}
              onContinue={() => {
                if (genStatus === 'done') setStage('results');
                if (genStatus === 'error') startOver();
              }}
            />
          </div>
        )}

        {stage === 'results' && result && (
          <Results result={result} onStartOver={startOver} />
        )}
      </main>

      <Footer />
    </div>
  );
}
