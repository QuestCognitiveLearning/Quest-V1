import React, { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadWord } from "@/lib/pdf/generateWord";
import { quest } from "@/api/questClient";

export default function DownloadWordButton({
  type,
  contentId,
  label,
  branding: brandingProp,
  size = "md",
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
      await downloadWord({ type, contentId, branding, label });
      toast.success("Word doc downloaded");
    } catch (err) {
      console.error("Word generation failed:", err);
      toast.error(err?.message || "Could not generate Word doc");
    } finally {
      setLoading(false);
    }
  };

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
      className={`${sizing} inline-flex items-center justify-center gap-2 rounded-lg font-semibold border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC] transition-colors disabled:opacity-70 disabled:cursor-not-allowed`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
      <span>{children || (loading ? "Preparing..." : "Download Word")}</span>
    </button>
  );
}
