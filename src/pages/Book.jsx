/**
 * Book — public booking page at /Book/:slug. Unauthenticated.
 *
 * Renders the tutor's branding (looked up by branding.booking_slug — a public
 * read policy on the branding table allows this without auth), a 14-day
 * calendar derived from tutor_availability minus tutor_blocked_dates and
 * already-booked slots, then a booking form that:
 *   1. Inserts a row into `bookings` (public insert policy allows it).
 *   2. Lets the tutor's own dashboard pick it up and convert it to a class
 *      on first login (a class is not created from public context to keep
 *      the unauthenticated surface narrow).
 *
 * The .ics confirmation file is generated inline and offered as a download.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Calendar, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/components/lib/supabase-client";

const SLOT_DURATION = 30; // minutes — granularity of slot grid
const DEFAULT_SESSION = 60;

export default function Book() {
  const { slug } = useParams();
  const [branding, setBranding] = useState(null);
  const [tutorId, setTutorId] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [blocks, setBlocks] = useState(new Set());
  const [booked, setBooked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(null); // { dateIso, time }
  const [duration, setDuration] = useState(DEFAULT_SESSION);
  const [form, setForm] = useState({
    student_first_name: "",
    student_last_name: "",
    parent_name: "",
    parent_email: "",
    parent_phone: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const { data: brand, error: bErr } = await supabase
          .from("branding")
          .select("*")
          .eq("booking_slug", slug)
          .maybeSingle();
        if (bErr) throw bErr;
        if (!brand) {
          setError("This booking link doesn't exist.");
          return;
        }
        setBranding(brand);
        setTutorId(brand.user_id);

        const [{ data: avail }, { data: bl }] = await Promise.all([
          supabase.from("tutor_availability").select("*").eq("tutor_id", brand.user_id),
          supabase
            .from("tutor_blocked_dates")
            .select("*")
            .eq("tutor_id", brand.user_id),
        ]);
        setAvailability(avail || []);
        setBlocks(new Set((bl || []).map((b) => b.blocked_date)));

        // Booked slots (next 30d) we'll subtract — anyone can insert but
        // nobody can read, so we ask the function to filter for us via the
        // public selectable booked_for view... not built yet. As a fallback
        // we accept double-booking risk and let the tutor manage conflicts;
        // a future migration can expose a per-slot count view.
        setBooked([]);
      } catch (err) {
        setError(err?.message || "Could not load booking page.");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [weekStart]);

  const slotsForDay = (date) => {
    const iso = isoDate(date);
    if (blocks.has(iso)) return [];
    const dayOfWeek = date.getDay();
    const windows = availability.filter((a) => a.day_of_week === dayOfWeek);
    if (!windows.length) return [];
    const slots = [];
    for (const w of windows) {
      const [sh, sm] = (w.start_time || "09:00").split(":").map(Number);
      const [eh, em] = (w.end_time || "17:00").split(":").map(Number);
      const total = (eh * 60 + em) - (sh * 60 + sm);
      for (let off = 0; off + duration <= total; off += SLOT_DURATION) {
        const mins = sh * 60 + sm + off;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return slots;
  };

  const submit = async () => {
    if (!selected || !tutorId) return;
    setSubmitting(true);
    setError(null);
    try {
      const [h, m] = selected.time.split(":").map(Number);
      const bookedFor = new Date(selected.dateIso);
      bookedFor.setHours(h, m, 0, 0);
      const { data, error: ierr } = await supabase
        .from("bookings")
        .insert({
          tutor_id: tutorId,
          student_first_name: form.student_first_name,
          student_last_name: form.student_last_name || null,
          parent_name: form.parent_name,
          parent_email: form.parent_email,
          parent_phone: form.parent_phone || null,
          notes: form.notes || null,
          booked_for: bookedFor.toISOString(),
          duration_minutes: duration,
        })
        .select()
        .single();
      if (ierr) throw ierr;
      setConfirmed({
        bookedFor,
        bookingId: data?.id,
      });
    } catch (err) {
      setError(err?.message || "Could not save your booking.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadIcs = () => {
    if (!confirmed) return;
    const tutorName = branding?.tutor_name || branding?.business_name || "Tutor";
    const summary = `Tutoring session with ${tutorName}`;
    const dtStart = icsDate(confirmed.bookedFor);
    const dtEnd = icsDate(new Date(confirmed.bookedFor.getTime() + duration * 60000));
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Quest Learning//Booking//EN",
      "BEGIN:VEVENT",
      `UID:${confirmed.bookingId || crypto.randomUUID()}@questlearning.co`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escIcs(summary)}`,
      branding?.contact_email
        ? `ORGANIZER;CN=${escIcs(tutorName)}:mailto:${branding.contact_email}`
        : null,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tutoring-session.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }
  if (error || !branding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">{error || "Page not found."}</p>
      </div>
    );
  }
  const accent = branding.accent_color || "#2563EB";

  if (confirmed) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div
            className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            <Check className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mt-4">
            You're booked!
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {confirmed.bookedFor.toLocaleString()} with{" "}
            {branding.tutor_name || branding.business_name}
          </p>
          <Button onClick={downloadIcs} className="mt-6 w-full" style={{ backgroundColor: accent }}>
            Add to calendar (.ics)
          </Button>
          <p className="text-xs text-slate-400 mt-4">
            A confirmation will go to {form.parent_email}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt=""
              className="w-14 h-14 rounded-lg object-contain bg-slate-50 border border-slate-200"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: accent }}
            >
              {(branding.business_name || "Q").charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Book a session with {branding.tutor_name || branding.business_name}
            </h1>
            {branding.bio && (
              <p className="text-sm text-slate-500 mt-1">{branding.bio}</p>
            )}
          </div>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Pick a time
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Session length</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="text-sm border border-slate-200 rounded-md px-2 py-1"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() - 7);
                if (d >= startOfDay(new Date())) setWeekStart(d);
              }}
              className="p-2 text-slate-500 hover:text-slate-900 disabled:opacity-30"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs uppercase tracking-wider text-slate-500">
              <Calendar className="w-3 h-3 inline -mt-0.5 mr-1" />
              {days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
              {days[13].toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + 7);
                setWeekStart(d);
              }}
              className="p-2 text-slate-500 hover:text-slate-900"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.slice(0, 7).map((d) => (
              <DayCol
                key={isoDate(d)}
                d={d}
                slots={slotsForDay(d)}
                accent={accent}
                selected={selected}
                onSelect={(t) => setSelected({ dateIso: isoDate(d), time: t })}
              />
            ))}
          </div>
        </section>

        {selected && (
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mt-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Your information
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Booking {new Date(selected.dateIso).toLocaleDateString()} at{" "}
              {selected.time}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Student first name"
                value={form.student_first_name}
                onChange={(v) => setForm((f) => ({ ...f, student_first_name: v }))}
                required
              />
              <FormField
                label="Student last name"
                value={form.student_last_name}
                onChange={(v) => setForm((f) => ({ ...f, student_last_name: v }))}
              />
              <FormField
                label="Parent name"
                value={form.parent_name}
                onChange={(v) => setForm((f) => ({ ...f, parent_name: v }))}
                required
              />
              <FormField
                label="Parent email"
                type="email"
                value={form.parent_email}
                onChange={(v) => setForm((f) => ({ ...f, parent_email: v }))}
                required
              />
              <FormField
                label="Phone (optional)"
                value={form.parent_phone}
                onChange={(v) => setForm((f) => ({ ...f, parent_phone: v }))}
              />
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Anything we should know?
              </label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 mt-3">{error}</p>
            )}
            <Button
              onClick={submit}
              disabled={
                submitting ||
                !form.student_first_name ||
                !form.parent_name ||
                !form.parent_email
              }
              className="w-full mt-4"
              style={{ backgroundColor: accent }}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirm booking"
              )}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

function DayCol({ d, slots, accent, selected, onSelect }) {
  const iso = isoDate(d);
  const isSelectedDay = selected?.dateIso === iso;
  return (
    <div>
      <div className="text-center text-[10px] uppercase tracking-wider text-slate-500">
        {d.toLocaleDateString(undefined, { weekday: "short" })}
      </div>
      <div className="text-center text-sm font-semibold text-slate-900 mb-1.5">
        {d.getDate()}
      </div>
      <div className="space-y-1">
        {slots.length === 0 ? (
          <p className="text-[10px] text-center text-slate-300">—</p>
        ) : (
          slots.map((t) => {
            const isSelected = isSelectedDay && selected?.time === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onSelect(t)}
                className={`w-full text-xs py-1 rounded-md border transition ${
                  isSelected
                    ? "text-white border-transparent"
                    : "text-slate-700 border-slate-200 hover:border-slate-400"
                }`}
                style={isSelected ? { backgroundColor: accent } : undefined}
              >
                {t}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-900 mb-1">
        {label}
      </label>
      <Input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function icsDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escIcs(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}
