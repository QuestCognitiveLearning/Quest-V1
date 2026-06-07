/**
 * BrandingSettings — Studio-tier branding controls. Tutors upload a logo,
 * set business + tutor name, contact info, and an accent color. The values
 * are read by the Phase 1 PDF engine (DownloadPDFButton auto-fetches the
 * row) and by the parent report email template.
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Image as ImageIcon, ChevronLeft } from "lucide-react";
import { isFeatureEnabled } from "@/lib/tier";
import UpgradeModal from "@/components/shared/UpgradeModal";

const ACCENT_PRESETS = [
  "#2563EB",
  "#7C3AED",
  "#EC4899",
  "#16A34A",
  "#F97316",
  "#0F172A",
];

export default function BrandingSettings() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [user, setUser] = useState(null);
  const [branding, setBranding] = useState({
    logo_url: "",
    business_name: "",
    tutor_name: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    accent_color: "#2563EB",
    bio: "",
    custom_report_intro: "",
    booking_slug: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await quest.auth.me();
        setUser(me);
        if (!isFeatureEnabled(me, "brandingEnabled")) {
          setShowUpgrade(true);
          setLoading(false);
          return;
        }
        const rows = await quest.entities.Branding?.filter?.(
          { user_id: me.id },
          "-updated_at",
          1
        );
        const row = (rows || [])[0];
        if (row) setBranding((b) => ({ ...b, ...row }));
      } catch (err) {
        console.error("Could not load branding:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2MB or smaller.");
      return;
    }
    if (!user?.auth_user_id) {
      toast.error("Sign in required.");
      return;
    }
    setUploading(true);
    try {
      const ext = (f.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.auth_user_id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("branding-logos")
        .upload(path, f, { upsert: true, contentType: f.type });
      if (upErr) throw upErr;
      const { data: publicData } = supabase.storage
        .from("branding-logos")
        .getPublicUrl(path);
      setBranding((b) => ({ ...b, logo_url: publicData.publicUrl }));
      toast.success("Logo uploaded");
    } catch (err) {
      console.error("Logo upload failed:", err);
      toast.error(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // user_id is the primary key on branding; upsert handles both insert and
      // update without an existence pre-check.
      const { error: upErr } = await supabase
        .from("branding")
        .upsert(
          {
            user_id: user.id,
            logo_url: branding.logo_url || null,
            business_name: branding.business_name || null,
            tutor_name: branding.tutor_name || null,
            contact_email: branding.contact_email || null,
            contact_phone: branding.contact_phone || null,
            website: branding.website || null,
            accent_color: branding.accent_color || "#2563EB",
            bio: branding.bio || null,
            custom_report_intro: branding.custom_report_intro || null,
            booking_slug: branding.booking_slug?.trim().toLowerCase() || null,
          },
          { onConflict: "user_id" }
        );
      if (upErr) throw upErr;
      toast.success("Branding saved");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6">
      <div className="max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-3xl font-bold text-slate-900">Branding</h1>
        <p className="text-slate-600 mt-1">
          Your logo and business info will appear on every PDF you download and
          on parent progress reports.
        </p>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-6 space-y-6 shadow-sm">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Logo
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                {branding.logo_url ? (
                  <img
                    src={branding.logo_url}
                    alt="logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={onFileChange}
                />
                <Button
                  type="button"
                  onClick={onPickFile}
                  disabled={uploading}
                  variant="outline"
                  className="gap-2"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload logo
                </Button>
                <p className="text-xs text-slate-500 mt-1.5">
                  PNG, JPG, or SVG · max 2MB · square aspect ratio
                </p>
              </div>
            </div>
          </div>

          <Field
            label="Business name"
            value={branding.business_name}
            onChange={(v) => setBranding((b) => ({ ...b, business_name: v }))}
            placeholder="Quest Tutoring"
          />
          <Field
            label="Tutor name"
            value={branding.tutor_name}
            onChange={(v) => setBranding((b) => ({ ...b, tutor_name: v }))}
            placeholder="Jane Doe"
          />
          <Field
            label="Contact email"
            type="email"
            value={branding.contact_email}
            onChange={(v) => setBranding((b) => ({ ...b, contact_email: v }))}
            placeholder="jane@questtutoring.com"
          />
          <Field
            label="Phone"
            value={branding.contact_phone}
            onChange={(v) => setBranding((b) => ({ ...b, contact_phone: v }))}
            placeholder="(555) 555-5555"
          />
          <Field
            label="Website"
            type="url"
            value={branding.website}
            onChange={(v) => setBranding((b) => ({ ...b, website: v }))}
            placeholder="https://yourwebsite.com"
          />

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Short bio
            </label>
            <textarea
              value={branding.bio || ""}
              onChange={(e) =>
                setBranding((b) => ({ ...b, bio: e.target.value }))
              }
              placeholder="Two or three sentences parents will see on your booking page."
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Parent report intro
            </label>
            <textarea
              value={branding.custom_report_intro || ""}
              onChange={(e) =>
                setBranding((b) => ({ ...b, custom_report_intro: e.target.value }))
              }
              placeholder="Replaces the default opening paragraph in every parent report email. Optional."
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Booking link slug
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">questlearning.co/Book/</span>
              <Input
                type="text"
                value={branding.booking_slug || ""}
                onChange={(e) =>
                  setBranding((b) => ({
                    ...b,
                    booking_slug: e.target.value
                      .replace(/[^a-z0-9-]/gi, "")
                      .toLowerCase(),
                  }))
                }
                placeholder="your-name"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Lowercase letters, numbers, and dashes. Must be unique.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Accent color
            </label>
            <div className="flex items-center gap-3">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBranding((b) => ({ ...b, accent_color: c }))}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${
                    branding.accent_color === c
                      ? "border-slate-900 scale-110"
                      : "border-slate-200"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <Input
                type="text"
                value={branding.accent_color || ""}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, accent_color: e.target.value }))
                }
                placeholder="#2563EB"
                className="w-32 ml-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => {
          setShowUpgrade(false);
          navigate("/Pricing");
        }}
        recommendedTier="studio"
        reason="Branding is a Studio feature. Upgrade to unlock logo, business name, and brand color on every PDF and parent email."
      />
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-900 mb-1.5">
        {label}
      </label>
      <Input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
