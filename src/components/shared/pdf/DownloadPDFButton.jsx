import React, { useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadPDF } from "@/lib/pdf/generatePDF";
import { quest } from "@/api/questClient";

export default function DownloadPDFButton({
  type,
  contentId,
  label,
  branding: brandingProp,
  variant = "primary",
  size = "md",
  data,
  children,
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      let branding = brandingProp;
      if (branding === undefined) {
        try {
          const me = await quest.auth.me();
          if (me?.id) {
            const rows = await quest.entities.Branding?.filter?.(
              { user_id: me.id },
              "-updated_at",
              1
            );
            branding = (rows || [])[0] || undefined;
          }
        } catch {
          branding = undefined;
        }
      }
      await downloadPDF({ type, contentId, branding, data, label });
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error(err?.message || "Could not generate PDF");
    } finally {
      setLoading(false);
    }
  };

  const base =
    variant === "secondary"
      ? "border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
      : "bg-[#2563EB] text-white hover:bg-[#1D4ED8]";
  const sizing =
    size === "sm"
      ? "h-9 px-3 text-[13px]"
      : size === "lg"
      ? "h-12 px-5 text-[15px]"
      : "h-10 px-4 text-sm";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`${base} ${sizing} inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed`}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : variant === "secondary" ? (
        <FileText size={16} />
      ) : (
        <Download size={16} />
      )}
      <span>{children || (loading ? "Preparing PDF..." : "Download PDF")}</span>
    </button>
  );
}
