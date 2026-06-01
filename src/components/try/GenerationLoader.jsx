/**
 * @file   GenerationLoader.jsx
 * @desc   Loading screen for the /Try funnel. Plays the Quest demo video in
 *         an iframe while the real generation request runs in the background.
 *         When generation finishes, we surface a "See your results" CTA but
 *         let the user keep watching if they want.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEMO_VIDEO_ID = 'vOacrBHo0dE'; // matches the landing-page hero modal

const STAGES = [
  'Pulling the transcript from YouTube…',
  'Analyzing key concepts…',
  'Drafting quiz questions…',
  'Generating a case study…',
  'Polishing the handout…',
];

export default function GenerationLoader({ status, onContinue, errorMessage }) {
  // status: 'running' | 'done' | 'error'
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
    }, 18_000); // ~90s total runway across all 5 stages
    return () => clearInterval(id);
  }, [status]);

  const src = `https://www.youtube.com/embed/${DEMO_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-md">
        {/* Demo video */}
        <div className="aspect-video bg-black">
          <iframe
            src={src}
            title="Quest Learning — demo"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>

        {/* Status strip */}
        <div className="p-6 border-t border-slate-100">
          {status === 'running' && (
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{STAGES[stageIdx]}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Meanwhile, here's a quick tour of Quest Learning — usually under two minutes.
                </p>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-medium text-slate-900">
                  Your handout is ready.
                </p>
              </div>
              <Button onClick={onContinue} className="gap-2">
                See your results <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div>
              <p className="text-sm font-medium text-red-700">
                {errorMessage || 'Something went wrong while generating your handout.'}
              </p>
              <Button variant="outline" onClick={onContinue} className="mt-3">
                Try a different video
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
