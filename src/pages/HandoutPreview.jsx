/**
 * HandoutPreview — standalone, read-only preview of a saved library item
 * (a `generated_handouts` row). Opened in a SEPARATE WINDOW from the Generate
 * tab's library ("Open" button) so previewing a session never covers the
 * generation workspace.
 *
 * It walks the exact same `SelfSessionPhases` player a student sees in a
 * regular learn session (summary → video + attention checks → quiz → case
 * study → done), so teachers preview content the way students experience it.
 * Nothing is persisted here — it's a preview.
 */
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/components/lib/supabase-client";
import { Loader2, XCircle, X, Eye } from "lucide-react";
import SelfSessionPhases from "../components/student/SelfSessionPhases";

export default function HandoutPreview() {
  const [params] = useSearchParams();
  const id = params.get("id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [row, setRow] = useState(null);

  useEffect(() => {
    if (!id) {
      setError("No session specified.");
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: qErr } = await supabase
          .from("generated_handouts")
          .select("id, title, source_type, payload, created_at")
          .eq("id", id)
          .single();
        if (qErr) throw qErr;
        setRow(data);
      } catch (err) {
        console.error("Failed to load handout:", err);
        setError(err?.message || "Could not load this session.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !row) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-md">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Can't open this session
          </h2>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => window.close()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-4 py-2 text-sm font-semibold"
          >
            Close window
          </button>
        </div>
      </div>
    );
  }

  const payload = row?.payload || {};
  const counts = [];
  if (Array.isArray(payload.quiz) && payload.quiz.length)
    counts.push(`${payload.quiz.length} questions`);
  if (Array.isArray(payload.attention_checks) && payload.attention_checks.length)
    counts.push(`${payload.attention_checks.length} attention checks`);
  if (payload.case_study?.scenario) counts.push("1 case study");

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 50%, #FAF5FF 100%)",
        fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
            <Eye className="w-3.5 h-3.5" /> Preview
          </div>
          <button
            onClick={() => window.close()}
            className="bg-white border border-slate-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm inline-flex items-center gap-1.5 hover:bg-slate-50"
          >
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>

        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
            {row?.title || "Saved session"}
          </h1>
          {counts.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">{counts.join(" · ")}</p>
          )}
        </div>

        <SelfSessionPhases payload={payload} onComplete={() => {}} />
      </div>
    </div>
  );
}
