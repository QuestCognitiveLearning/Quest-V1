/**
 * EmailGate — primary gate for the /Try lead magnet funnel. Collects an email,
 * generates the PDF client-side using the Phase 1 engine, POSTs it to the
 * captureLead Edge Function (which saves the lead + emails the PDF), and then
 * triggers an immediate local download so the user does not have to wait for
 * the email to arrive.
 *
 * The pre-existing DownloadGate (Stripe trial path) is still available as a
 * secondary upsell on the post-download success state.
 */
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, CheckCircle2, Lock } from "lucide-react";
import { supabase } from "@/components/lib/supabase-client";
import { generateTryPDF, blobToBase64, buildFileName } from "@/lib/pdf/generatePDF";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function downloadBlobLocally(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EmailGate({ open, onClose, result, onAfterDownload }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [touched, setTouched] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const valid = EMAIL_RE.test(email.trim());

  const submit = async (e) => {
    e?.preventDefault?.();
    setTouched(true);
    if (!valid || working) return;
    setError("");
    setWorking(true);
    try {
      const blob = await generateTryPDF(result);
      const base64 = await blobToBase64(blob);
      const filename = buildFileName("subunit", result?.video?.title);

      const { error: fnErr } = await supabase.functions.invoke("captureLead", {
        body: {
          email: email.trim().toLowerCase(),
          firstName: firstName.trim() || null,
          videoUrl: result?.video?.url || null,
          videoTitle: result?.video?.title || null,
          pdfBase64: base64,
          filename,
          // Full payload — the captureLead function stores it on the lead row
          // so when this visitor signs up later, importLeadContent (fired by
          // stripeWebhook on trial start) can recreate the quiz + case study
          // inside their new account.
          quizPayload: {
            video: result?.video || null,
            quiz: result?.quiz || [],
            case_study: result?.case_study || null,
          },
        },
      });
      if (fnErr) {
        console.warn("captureLead failed but continuing with local download:", fnErr);
      }
      downloadBlobLocally(blob, filename);
      setDone(true);
      onAfterDownload?.();
    } catch (err) {
      console.error("EmailGate submit failed:", err);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const close = () => {
    if (working) return;
    setEmail("");
    setTouched(false);
    setDone(false);
    setError("");
    onClose?.();
  };

  if (!open) return null;

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
            {done ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            ) : (
              <Lock className="w-5 h-5 text-indigo-700" />
            )}
          </div>
          <DialogTitle className="text-center text-xl">
            {done ? "Your PDF is on its way." : "Your quiz is ready."}
          </DialogTitle>
          <DialogDescription className="text-center">
            {done
              ? "We started the download and emailed you a copy. Check your inbox in a minute."
              : "Where should we send your print-ready handout?"}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 mt-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
              We sent <span className="font-semibold">{email}</span> a copy with
              your PDF attached. The download has also started in this browser.
            </div>
            <Button onClick={close} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 mt-2">
            <label className="block">
              <span className="sr-only">First name (optional)</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name (optional)"
                className="w-full h-11 px-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
              />
            </label>
            <label className="block">
              <span className="sr-only">Email address</span>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="you@school.edu"
                  className="w-full h-11 pl-9 pr-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                  required
                />
              </div>
              {touched && !valid && email.length > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Please enter a valid email address.
                </p>
              )}
            </label>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={!valid || working}
              className="w-full"
            >
              {working ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Preparing your PDF...
                </>
              ) : (
                "Email me my PDF"
              )}
            </Button>

            <p className="text-[12px] text-slate-500 text-center leading-snug">
              No spam. Unsubscribe in one click. We&apos;ll send you a few
              teaching tips over the next two weeks &mdash; opt out anytime.
            </p>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-[12px] text-slate-500 text-center">
                Want this as a live interactive quiz instead?{" "}
                <a
                  href="/SignIn?mode=signup&source=leadmagnet"
                  className="text-indigo-700 font-semibold underline"
                >
                  Try it free to access other features
                </a>
              </p>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
