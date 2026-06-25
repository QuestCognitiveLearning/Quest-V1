import React, { useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadPDF } from "@/lib/pdf/generatePDF";

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
      await downloadPDF({ type, contentId, branding: brandingProp, data, label });
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF generation failed:", err);
      const msg =
        err?.message ||
        err?.error?.message ||
        (typeof err === "string" ? err : "") ||
        "Could not generate PDF. Please try again.";
      toast.error(msg);
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
