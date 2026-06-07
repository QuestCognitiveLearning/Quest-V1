/**
 * BookingSettings — Studio tier booking-link configuration. The tutor sets a
 * URL slug (lives on branding.booking_slug), weekly availability windows
 * (tutor_availability), and one-off blackout dates (tutor_blocked_dates).
 *
 * The actual public booking page is /Book/:slug.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/components/lib/supabase-client";
import { quest } from "@/api/questClient";
import { isFeatureEnabled } from "@/lib/tier";
import UpgradeModal from "@/components/shared/UpgradeModal";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BookingSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [slug, setSlug] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);
  const [slots, setSlots] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [copied, setCopied] = useState(false);

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
        const [{ data: b }, { data: avail }, { data: bl }] = await Promise.all([
          supabase
            .from("branding")
            .select("booking_slug")
            .eq("user_id", me.id)
            .maybeSingle(),
          supabase
            .from("tutor_availability")
            .select("*")
            .eq("tutor_id", me.id)
            .order("day_of_week"),
          supabase
            .from("tutor_blocked_dates")
            .select("*")
            .eq("tutor_id", me.id)
            .order("blocked_date"),
        ]);
        setSlug(b?.booking_slug || "");
        setSlots(avail || []);
        setBlocks(bl || []);
      } catch (err) {
        console.error("BookingSettings load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSaveSlug = async () => {
    if (!user) return;
    setSavingSlug(true);
    try {
      const cleaned = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      const { error } = await supabase
        .from("branding")
        .upsert(
          { user_id: user.id, booking_slug: cleaned || null },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      setSlug(cleaned);
      toast.success("Slug saved.");
    } catch (err) {
      toast.error(err?.message || "Could not save slug. It may be taken.");
    } finally {
      setSavingSlug(false);
    }
  };

  const onAddSlot = async (day) => {
    try {
      const { data, error } = await supabase
        .from("tutor_availability")
        .insert({
          tutor_id: user.id,
          day_of_week: day,
          start_time: "09:00:00",
          end_time: "17:00:00",
        })
        .select()
        .single();
      if (error) throw error;
      setSlots((s) => [...s, data].sort((a, b) => a.day_of_week - b.day_of_week));
    } catch (err) {
      toast.error(err?.message || "Could not add slot.");
    }
  };

  const onUpdateSlot = async (id, patch) => {
    try {
      const { error } = await supabase
        .from("tutor_availability")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      setSlots((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    } catch (err) {
      toast.error(err?.message || "Update failed.");
    }
  };

  const onDeleteSlot = async (id) => {
    try {
      await supabase.from("tutor_availability").delete().eq("id", id);
      setSlots((s) => s.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err?.message || "Delete failed.");
    }
  };

  const onAddBlock = async (date) => {
    try {
      const { data, error } = await supabase
        .from("tutor_blocked_dates")
        .insert({ tutor_id: user.id, blocked_date: date })
        .select()
        .single();
      if (error) throw error;
      setBlocks((b) => [...b, data]);
    } catch (err) {
      toast.error(err?.message || "Could not block date.");
    }
  };

  const onRemoveBlock = async (id) => {
    try {
      await supabase.from("tutor_blocked_dates").delete().eq("id", id);
      setBlocks((b) => b.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err?.message || "Delete failed.");
    }
  };

  const link = slug ? `${window.location.origin}/Book/${slug}` : null;

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy.");
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
        reason="The booking link is a Studio feature."
      />
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

        <h1 className="text-3xl font-bold text-slate-900">Booking link</h1>
        <p className="text-slate-600 mt-1">
          Share a link parents can book on. New bookings automatically create a
          session in Classes.
        </p>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-6 shadow-sm space-y-3">
          <label className="block text-sm font-semibold text-slate-900">
            Your link
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">
              {window.location.origin}/Book/
            </span>
            <Input
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())
              }
              placeholder="your-name"
              className="flex-1"
            />
            <Button onClick={onSaveSlug} disabled={savingSlug}>
              {savingSlug ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          {link && (
            <div className="flex items-center gap-2 pt-2">
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-700 hover:text-blue-900 underline truncate"
              >
                {link}
              </a>
              <button
                onClick={copyLink}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Copy link"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Weekly availability
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Hours parents can book within. Add multiple windows for a single
            day if you have a break.
          </p>
          <div className="space-y-3">
            {DAYS.map((label, day) => {
              const daySlots = slots.filter((s) => s.day_of_week === day);
              return (
                <div key={day} className="border-b border-slate-100 last:border-b-0 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900 w-12">
                      {label}
                    </span>
                    <button
                      onClick={() => onAddSlot(day)}
                      className="text-xs text-blue-700 hover:text-blue-900"
                    >
                      Add window
                    </button>
                  </div>
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-slate-400 mt-1">Unavailable</p>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {daySlots.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={s.start_time?.slice(0, 5) || "09:00"}
                            onChange={(e) =>
                              onUpdateSlot(s.id, { start_time: e.target.value })
                            }
                            className="w-32"
                          />
                          <span className="text-slate-400 text-sm">to</span>
                          <Input
                            type="time"
                            value={s.end_time?.slice(0, 5) || "17:00"}
                            onChange={(e) =>
                              onUpdateSlot(s.id, { end_time: e.target.value })
                            }
                            className="w-32"
                          />
                          <button
                            onClick={() => onDeleteSlot(s.id)}
                            className="text-slate-400 hover:text-red-600"
                            aria-label="Delete window"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Blocked dates
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            One-off days you're not available (vacation, holidays).
          </p>
          <BlockedAdder onAdd={onAddBlock} />
          <ul className="mt-3 space-y-2">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between text-sm border border-slate-200 rounded-md px-3 py-2"
              >
                <span>{b.blocked_date}</span>
                <button
                  onClick={() => onRemoveBlock(b.id)}
                  className="text-slate-400 hover:text-red-600"
                  aria-label="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
            {blocks.length === 0 && (
              <li className="text-xs text-slate-400">No dates blocked.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function BlockedAdder({ onAdd }) {
  const [d, setD] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={d}
        onChange={(e) => setD(e.target.value)}
        className="w-44"
      />
      <Button
        type="button"
        variant="outline"
        disabled={!d}
        onClick={() => {
          onAdd(d);
          setD("");
        }}
      >
        Block this date
      </Button>
    </div>
  );
}
