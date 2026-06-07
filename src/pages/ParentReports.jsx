/**
 * ParentReports — Studio tier archive of generated parent reports.
 * Lists rows from `parent_reports` owned by the current tutor, with delivery
 * status (sent_at, email_message_id) and a PDF preview pane.
 *
 * The PDF blob is private: we fetch a short-lived signed URL on demand.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, FileText, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/components/lib/supabase-client";
import { quest } from "@/api/questClient";
import { isFeatureEnabled } from "@/lib/tier";
import UpgradeModal from "@/components/shared/UpgradeModal";

export default function ParentReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [rows, setRows] = useState([]);
  const [studentNames, setStudentNames] = useState({});
  const [activeRow, setActiveRow] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await quest.auth.me();
        setUser(me);
        if (!isFeatureEnabled(me, "parentReportsEnabled")) {
          setShowUpgrade(true);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("parent_reports")
          .select("*")
          .eq("tutor_id", me.id)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        setRows(data || []);
        const ids = [...new Set((data || []).map((r) => r.student_id))];
        if (ids.length) {
          const names = await Promise.all(
            ids.map((id) =>
              quest.entities.User.get(id)
                .then((u) => [id, u?.full_name || "Student"])
                .catch(() => [id, "Student"]),
            ),
          );
          setStudentNames(Object.fromEntries(names));
        }
      } catch (err) {
        console.error("Could not load parent reports:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openPreview = async (row) => {
    setActiveRow(row);
    setPdfUrl(null);
    if (!row.pdf_url) return;
    setPreviewBusy(true);
    try {
      const { data, error } = await supabase.storage
        .from("parent-reports")
        .createSignedUrl(row.pdf_url, 600); // 10 min
      if (error) throw error;
      setPdfUrl(data?.signedUrl || null);
    } catch (err) {
      console.error("Signed URL failed:", err);
    } finally {
      setPreviewBusy(false);
    }
  };

  const closePreview = () => {
    setActiveRow(null);
    setPdfUrl(null);
  };

  const resend = async (row) => {
    try {
      const { error } = await supabase.functions.invoke("sendParentReport", {
        body: { report_id: row.id },
      });
      if (error) throw error;
      const { data } = await supabase
        .from("parent_reports")
        .select("*")
        .eq("id", row.id)
        .maybeSingle();
      setRows((r) => r.map((x) => (x.id === row.id ? data || x : x)));
    } catch (err) {
      alert(err?.message || "Could not resend.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (showUpgrade) {
    return (
      <UpgradeModal
        open
        onClose={() => navigate("/Pricing")}
        recommendedTier="studio"
        reason="Parent reports are a Studio feature. Upgrade to send a branded recap after every session."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6">
      <div className="max-w-5xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-3xl font-bold text-slate-900">Parent reports</h1>
        <p className="text-slate-600 mt-1">
          Every report you've sent. Open one to preview the PDF or resend it.
        </p>

        <div className="bg-white rounded-2xl border border-slate-200 mt-6 shadow-sm overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-8 h-8 mx-auto text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">
                No reports yet. End a session with a student who has a parent email
                on file and the first one will land here.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th>Student</Th>
                  <Th>Trigger</Th>
                  <Th>Sent to</Th>
                  <Th>Sent at</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-b-0">
                    <Td>
                      <button
                        type="button"
                        onClick={() => openPreview(r)}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {studentNames[r.student_id] || "Student"}
                      </button>
                    </Td>
                    <Td>
                      <span className="text-xs uppercase tracking-wider text-slate-500">
                        {r.trigger_type || "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-700">
                        {Array.isArray(r.sent_to) && r.sent_to.length
                          ? r.sent_to.join(", ")
                          : "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-slate-500">
                        {r.sent_at
                          ? new Date(r.sent_at).toLocaleString()
                          : "queued"}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPreview(r)}
                        >
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resend(r)}
                        >
                          Resend
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {activeRow && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 bg-slate-900/40 flex items-center justify-center px-4"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {studentNames[activeRow.student_id] || "Student"}
                </p>
                <p className="text-xs text-slate-500">
                  {activeRow.sent_at
                    ? `Sent ${new Date(activeRow.sent_at).toLocaleString()}`
                    : "Not yet sent"}
                </p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {previewBusy ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                </div>
              ) : pdfUrl ? (
                <iframe
                  title="Parent report preview"
                  src={pdfUrl}
                  className="w-full h-[70vh]"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-500 px-6 text-center">
                  PDF not available for preview. It may not have been uploaded yet.
                </div>
              )}
            </div>
            <div className="flex items-center justify-end border-t border-slate-200 px-5 py-3 gap-2">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in new tab
                </a>
              )}
              <Button variant="outline" onClick={() => resend(activeRow)}>
                Resend email
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="text-left text-xs uppercase tracking-wider text-slate-500 font-medium px-5 py-2.5">
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td className="px-5 py-3 align-middle">{children}</td>;
}
