/**
 * TutorBookings — list of bookings received via the public /Book/:slug page.
 * One row per booking; click → opens the corresponding class detail (which
 * hosts the TutorSessionPanel). "Edit availability" sends to BookingSettings
 * where the tutor sets weekly hours and blackout dates.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import TeacherLayout from "../components/teacher/TeacherLayout";
import {
  Loader2,
  Calendar,
  Mail,
  Phone,
  Settings as SettingsIcon,
  Search,
  Copy,
  Check,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";

const STATUSES = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

export default function TutorBookings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [branding, setBranding] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await quest.auth.me();
        if (cancelled) return;
        setUser(me);
        const [{ data: bRows }, { data: brand }] = await Promise.all([
          supabase
            .from("bookings")
            .select("*")
            .eq("tutor_id", me.id)
            .order("booked_for", { ascending: false })
            .limit(500),
          supabase
            .from("branding")
            .select("booking_slug, business_name, tutor_name")
            .eq("user_id", me.id)
            .maybeSingle(),
        ]);
        if (!cancelled) {
          setBookings(bRows || []);
          setBranding(brand || null);
        }
      } catch (err) {
        console.error("Bookings load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const link = branding?.booking_slug
    ? `${window.location.origin}/Book/${branding.booking_slug}`
    : null;

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

  const filtered = useMemo(() => {
    const now = Date.now();
    let base = bookings;
    if (tab === "upcoming") {
      base = bookings.filter(
        (b) =>
          b.status !== "cancelled" &&
          new Date(b.booked_for).getTime() >= now - 30 * 60 * 1000,
      );
    } else if (tab === "past") {
      base = bookings.filter(
        (b) =>
          b.status !== "cancelled" &&
          new Date(b.booked_for).getTime() < now - 30 * 60 * 1000,
      );
    } else if (tab === "cancelled") {
      base = bookings.filter((b) => b.status === "cancelled");
    }
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter((b) =>
      [b.student_first_name, b.student_last_name, b.parent_name, b.parent_email]
        .map((s) => (s || "").toLowerCase())
        .some((s) => s.includes(q)),
    );
  }, [bookings, tab, query]);

  const cancelBooking = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: "Tutor cancelled",
        })
        .eq("id", cancelTarget.id);
      if (error) throw error;
      setBookings((bs) =>
        bs.map((b) =>
          b.id === cancelTarget.id
            ? { ...b, status: "cancelled", cancelled_at: new Date().toISOString() }
            : b,
        ),
      );
      setCancelTarget(null);
      toast.success("Booking cancelled.");
    } catch (err) {
      toast.error(err?.message || "Could not cancel.");
    } finally {
      setCancelling(false);
    }
  };

  const counts = useMemo(() => {
    const now = Date.now();
    const upcoming = bookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        new Date(b.booked_for).getTime() >= now - 30 * 60 * 1000,
    ).length;
    const past = bookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        new Date(b.booked_for).getTime() < now - 30 * 60 * 1000,
    ).length;
    const cancelled = bookings.filter((b) => b.status === "cancelled").length;
    return { upcoming, past, cancelled };
  }, [bookings]);

  return (
    <TeacherLayout user={user} onSignOut={() => quest.auth.logout()} activeNav="booking">
      <div className="min-h-screen bg-slate-50" style={{ fontFamily: '"Inter", sans-serif' }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

        <div className="max-w-5xl mx-auto px-6 py-8">
          <header className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Studio</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-0.5">Bookings</h1>
              <p className="text-slate-500 text-sm mt-1">
                Every session a parent or student booked through your link.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl("BookingSettings"))}
              className="gap-2"
            >
              <SettingsIcon className="w-4 h-4" />
              Edit availability
            </Button>
          </header>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
            <p className="text-sm font-semibold text-slate-900 mb-2">Your link</p>
            {link ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                  {link}
                </code>
                <Button variant="outline" onClick={copyLink} className="gap-1.5">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-700 hover:text-blue-900 underline"
                >
                  Open
                </a>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                You haven't claimed a slug yet.{" "}
                <button
                  type="button"
                  className="text-blue-700 underline"
                  onClick={() => navigate(createPageUrl("BookingSettings"))}
                >
                  Set one up
                </button>
                .
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setTab(s.id)}
                    className={`text-sm px-3 py-2 -mb-px border-b-2 transition ${
                      tab === s.id
                        ? "border-blue-600 text-blue-700 font-semibold"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {s.label}
                    <span className="ml-1.5 text-xs text-slate-400">
                      {counts[s.id]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search student or parent name / email"
                className="border-none focus-visible:ring-0 px-0 h-8"
              />
              <span className="text-xs text-slate-400">{filtered.length} shown</span>
            </div>

            {loading ? (
              <div className="px-5 py-10 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Calendar className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm text-slate-500 mt-3">
                  {bookings.length === 0
                    ? "No bookings yet. Share your link to get parents booking sessions."
                    : tab === "upcoming"
                    ? "No upcoming bookings."
                    : tab === "past"
                    ? "No past bookings yet."
                    : "Nothing cancelled."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map((b) => (
                  <BookingRow
                    key={b.id}
                    b={b}
                    onOpen={() =>
                      b.class_id &&
                      navigate(`${createPageUrl("TeacherClassDetail")}?id=${b.class_id}`)
                    }
                    onCancel={() => setCancelTarget(b)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 bg-slate-900/40 flex items-center justify-center px-4"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Cancel booking?</h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              {cancelTarget.student_first_name} {cancelTarget.student_last_name || ""} on{" "}
              {new Date(cancelTarget.booked_for).toLocaleString()}.
              The parent ({cancelTarget.parent_email}) won't be notified automatically;
              reply to their confirmation email to let them know.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={cancelling}>
                Keep
              </Button>
              <Button variant="destructive" onClick={cancelBooking} disabled={cancelling}>
                {cancelling && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Cancel booking
              </Button>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}

function BookingRow({ b, onOpen, onCancel }) {
  const isUpcoming =
    b.status !== "cancelled" &&
    new Date(b.booked_for).getTime() >= Date.now() - 30 * 60 * 1000;
  const studentName = [b.student_first_name, b.student_last_name].filter(Boolean).join(" ") || "Student";
  return (
    <li className="px-5 py-4 hover:bg-slate-50 transition">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-slate-900">{studentName}</p>
            <span
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                b.status === "cancelled"
                  ? "bg-rose-100 text-rose-800"
                  : isUpcoming
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {b.status === "cancelled" ? "cancelled" : isUpcoming ? "upcoming" : "past"}
            </span>
          </div>
          <p className="text-sm text-slate-700 mt-0.5">
            {new Date(b.booked_for).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {b.duration_minutes || 60} min
          </p>
          <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500">
            <p>
              <span className="text-slate-400">Parent:</span> {b.parent_name || "—"}
            </p>
            <p className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              <a className="text-blue-700 hover:text-blue-900" href={`mailto:${b.parent_email}`}>
                {b.parent_email}
              </a>
            </p>
            {b.parent_phone && (
              <p className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {b.parent_phone}
              </p>
            )}
            {b.notes && <p className="sm:col-span-2 italic">"{b.notes}"</p>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {b.class_id && (
            <Button size="sm" variant="outline" onClick={onOpen} className="gap-1">
              Open session
              <ChevronRight className="w-3 h-3" />
            </Button>
          )}
          {b.status !== "cancelled" && isUpcoming && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-slate-400 hover:text-rose-600"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
