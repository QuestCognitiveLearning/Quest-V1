/**
 * @file   Results.jsx
 * @desc   Display the generated quiz + case study with download CTAs. The
 *         actual download triggers DownloadGate first; once a user has a
 *         valid trial/subscription, the CTAs call exportPdf / exportDoc.
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, RefreshCw, CheckCircle } from 'lucide-react';
import EmailGate from './EmailGate';
import DownloadGate from './DownloadGate';
import { exportDoc } from '@/lib/tryExporters';

export default function Results({ result, onStartOver }) {
  const { video, quiz, case_study } = result;
  const [emailGateOpen, setEmailGateOpen] = useState(false);
  const [trialGateOpen, setTrialGateOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState(null);
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [delivered, setDelivered] = useState(false);

  const handleDownload = (format) => {
    setPendingFormat(format);
    if (format === 'doc') {
      // Word path keeps the trial gate behavior the existing /Try flow uses.
      setTrialGateOpen(true);
    } else {
      // PDF path is the lead-gen email gate: collect address, send + download.
      setEmailGateOpen(true);
    }
  };

  const onTrialAuthorized = () => {
    if (pendingFormat === 'doc') exportDoc(result);
    setTrialGateOpen(false);
    setPendingFormat(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-indigo-600 font-semibold mb-1">
              Your free handout
            </p>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">{video?.title}</h2>
            {video?.channelTitle && (
              <p className="text-sm text-slate-500 mt-1">From {video.channelTitle} on YouTube</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onStartOver} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Try another video
          </Button>
        </div>

        {/* Case study */}
        {case_study?.scenario && (
          <section className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Case Study</h3>
            <p className="text-slate-700 leading-relaxed mb-4">{case_study.scenario}</p>
            {case_study.discussion_questions?.length > 0 && (
              <>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Discussion Questions</h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-700">
                  {case_study.discussion_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </>
            )}
          </section>
        )}

        {/* Quiz */}
        {quiz?.length > 0 && (
          <section className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Quiz · {quiz.length} questions
            </h3>
            <ol className="space-y-5">
              {quiz.map((q, i) => {
                const revealed = revealedAnswers[i];
                return (
                  <li key={i} className="border border-slate-200 rounded-xl p-4">
                    <p className="font-medium text-slate-900 mb-3">
                      {i + 1}. {q.question}
                    </p>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {['a', 'b', 'c', 'd'].map((letter) => {
                        const isCorrect = revealed && q.correct_choice === letter.toUpperCase();
                        return (
                          <li
                            key={letter}
                            className={`flex items-start gap-2 px-2 py-1 rounded ${isCorrect ? 'bg-emerald-50 text-emerald-900' : ''}`}
                          >
                            <span className="font-semibold w-5 shrink-0">{letter.toUpperCase()}.</span>
                            <span className="flex-1">{q[`choice_${letter}`]}</span>
                            {isCorrect && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                          </li>
                        );
                      })}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setRevealedAnswers((prev) => ({ ...prev, [i]: !prev[i] }))}
                      className="mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {revealed ? 'Hide answer' : 'Show answer'}
                    </button>
                    {revealed && q.explanation && (
                      <p className="mt-2 text-sm text-slate-600 italic">{q.explanation}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>

      {/* Download CTA strip */}
      <div className="mt-6 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900">Print-ready handout</h3>
          <p className="text-sm text-slate-600 mt-1">
            Branded PDF with the full quiz, case study, and answer key.
            <span className="text-indigo-700 font-medium"> Free &mdash; just tell us where to send it.</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleDownload('pdf')} className="gap-2">
            <Download className="w-4 h-4" /> Email me my PDF
          </Button>
          <Button onClick={() => handleDownload('doc')} variant="secondary" className="gap-2">
            <FileText className="w-4 h-4" /> Word (trial)
          </Button>
        </div>
      </div>

      <EmailGate
        open={emailGateOpen}
        onClose={() => { setEmailGateOpen(false); setPendingFormat(null); }}
        onAfterDownload={() => setDelivered(true)}
        result={result}
      />

      <DownloadGate
        open={trialGateOpen}
        onClose={() => { setTrialGateOpen(false); setPendingFormat(null); }}
        onAuthorized={onTrialAuthorized}
        format={pendingFormat}
      />

      {delivered && (
        <div className="mt-6 rounded-2xl border border-indigo-200 bg-white p-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900">
              Want to run this live with your students?
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Unlock leaderboards, AI tutoring, live response tracking, branded
              parent reports, and the full curriculum builder.
            </p>
          </div>
          <Button
            onClick={() => (window.location.href = '/SignIn?mode=signup&source=leadmagnet')}
          >
            Try it free to access other features
          </Button>
        </div>
      )}
    </div>
  );
}
