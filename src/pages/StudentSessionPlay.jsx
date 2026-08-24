/**
 * StudentSessionPlay — player for a student's self-generated learning session.
 * Mirrors AssignedSessionPlay: renders through the SHARED SessionFlow engine
 * so a self-made session has the exact same design/steps/flow as a
 * teacher-assigned one. The only differences are the data source (the
 * student's own generated_handouts row, saved from /Generate) and that there
 * is no completion/spaced-repetition persistence — it's a self-study run.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, ArrowLeft } from "lucide-react";
import SessionFlow from "@/components/session/SessionFlow";
import { bundlePayloadToContent } from "@/lib/sessionContent";

export default function StudentSessionPlay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handoutId = searchParams.get("handout_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [handout, setHandout] = useState(null);

  useEffect(() => {
    if (!handoutId) {
      setError("No session specified.");
      setLoading(false);
      return;
    }
    loadHandout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoutId]);

  const loadHandout = async () => {
    setLoading(true);
    setError("");
    try {
      // RLS on generated_handouts restricts reads to the owner, so a student
      // can only ever open their own sessions here.
      await quest.auth.me();
      const { data: row, error: hErr } = await supabase
        .from("generated_handouts")
        .select("id, title, source_type, source_url, payload")
        .eq("id", handoutId)
        .single();
      if (hErr) throw hErr;
      setHandout(row);
    } catch (err) {
      console.error("Failed to load session:", err);
      setError(err?.message || "Could not load this session.");
    } finally {
      setLoading(false);
    }
  };

  const content = useMemo(
    () =>
      bundlePayloadToContent(handout?.payload, {
        badgeLabel: "My Session",
        sourceUrl: handout?.source_url,
        title: handout?.title,
      }),
    [handout]
  );

  const backToGenerate = () => navigate(createPageUrl("Generate"));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !handout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-md">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Can't open this session</h2>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <Button onClick={backToGenerate} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Create
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SessionFlow
      content={content}
      inquiryMode="inline"
      onFinish={backToGenerate}
      onExit={backToGenerate}
    />
  );
}
