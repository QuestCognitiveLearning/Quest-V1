/**
 * TutorSignup — 4-step Studio onboarding wizard.
 *
 * Reuses the existing Supabase auth + DB trigger for account creation
 * (handle_new_auth_user from 0003 inserts the public.users row), then layers
 * three additional steps for tutor-specific setup: brand, first student +
 * class, and a quick walkthrough.
 *
 * Notes:
 *   - The signup trigger creates the users row asynchronously. We poll
 *     quest.auth.me() with a short backoff after signUp before any DB writes.
 *   - role/tier: existing `account_type='teacher'` semantics are reused —
 *     tutors ARE teachers internally. We tag `new_role='tutor'` so the UI can
 *     branch via getUserRole(). Tier stays 'free' until they pick a Studio
 *     plan from /Pricing.
 *   - The first class created here has curriculum_id=NULL (migration 0018
 *     already made the column nullable).
 */
import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/components/lib/supabase-client";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Upload,
  Image as ImageIcon,
  Check,
  Sparkles,
  Users,
  FileText,
  Calendar,
} from "lucide-react";

const ACCENT_PRESETS = [
  "#2563EB",
  "#7C3AED",
  "#EC4899",
  "#16A34A",
  "#F97316",
  "#0F172A",
];

const CALENDLY_URL =
  import.meta.env.VITE_STUDIO_ONBOARDING_URL ||
  "https://calendly.com/questlearning/studio-onboarding";

async function waitForUserRow(maxMs = 6000) {
  const start = Date.now();
  let delay = 250;
  while (Date.now() - start < maxMs) {
    try {
      const me = await quest.auth.me();
      if (me?.id) return me;
    } catch {
      // not provisioned yet
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 1000);
  }
  throw new Error("Account row was not provisioned in time. Refresh and try again.");
}

export default function TutorSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [brand, setBrand] = useState({
    logo_url: "",
    business_name: "",
    tutor_name: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    accent_color: "#2563EB",
  });

  // Step 3
  const [student, setStudent] = useState({
    student_full_name: "",
    student_email: "",
    parent_name: "",
    parent_email: "",
  });

  // Lazy state set after step 1
  const [me, setMe] = useState(null);

  const submitStep1 = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/LearningHub`,
        },
      });
      if (err) throw err;
      // Some Supabase configs require email confirmation before a session
      // exists. Without a session we can't update DB rows yet — stop here and
      // let the user confirm via email, then come back.
      if (!data.session) {
        toast.success(
          "Account created. Check your email to confirm, then sign in to finish setup.",
        );
        navigate("/SignIn");
        return;
      }
      const row = await waitForUserRow();
      // Tag the row as a tutor and prefill branding tutor_name with the name.
      await quest.entities.User.update(row.id, {
        new_role: "tutor",
        account_type: "teacher",
        full_name: fullName,
      });
      // Default branding row — survives even if they skip step 2.
      await supabase.from("branding").upsert(
        {
          user_id: row.id,
          tutor_name: fullName,
          business_name: `${fullName}'s Tutoring`,
          contact_email: email,
          accent_color: "#2563EB",
        },
        { onConflict: "user_id" },
      );
      setMe({ ...row, new_role: "tutor", full_name: fullName });
      setBrand((b) => ({
        ...b,
        tutor_name: fullName,
        business_name: `${fullName}'s Tutoring`,
        contact_email: email,
      }));
      setStep(2);
    } catch (ex) {
      setError(ex?.message || String(ex));
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2MB or smaller.");
      return;
    }
    if (!me?.auth_user_id) {
      toast.error("Refresh — sign-in lost.");
      return;
    }
    setUploading(true);
    try {
      const ext = (f.name.split(".").pop() || "png").toLowerCase();
      const path = `${me.auth_user_id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("branding-logos")
        .upload(path, f, { upsert: true, contentType: f.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage
        .from("branding-logos")
        .getPublicUrl(path);
      setBrand((b) => ({ ...b, logo_url: pub.publicUrl }));
      toast.success("Logo uploaded");
    } catch (ex) {
      toast.error(ex?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const submitStep2 = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.from("branding").upsert(
        {
          user_id: me.id,
          logo_url: brand.logo_url || null,
          business_name: brand.business_name || null,
          tutor_name: brand.tutor_name || null,
          contact_email: brand.contact_email || null,
          contact_phone: brand.contact_phone || null,
          website: brand.website || null,
          accent_color: brand.accent_color || "#2563EB",
        },
        { onConflict: "user_id" },
      );
      if (err) throw err;
      setStep(3);
    } catch (ex) {
      setError(ex?.message || String(ex));
    } finally {
      setBusy(false);
    }
  };

  const submitStep3 = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!student.student_full_name) {
        throw new Error("Student name is required.");
      }
      // Create a stub student user (account_type='student') so the
      // enrollment row references a real users.id. The student doesn't get
      // login credentials here — the tutor sees them in the dashboard.
      const studentRow = await quest.entities.User.create({
        full_name: student.student_full_name,
        email: student.student_email || `${Date.now()}@stub.questlearning.co`,
        account_type: "student",
        role: "user",
      });
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const klass = await quest.entities.Class.create({
        teacher_id: me.id,
        class_name: `${student.student_full_name}'s sessions`,
        curriculum_id: null,
        join_code: code,
      });
      await quest.entities.StudentEnrollment.create({
        student_id: studentRow.id,
        class_id: klass.id,
        student_full_name: student.student_full_name,
        student_email: student.student_email || null,
        parent_name: student.parent_name || null,
        parent_email: student.parent_email || null,
        parent_email_opted_in: !!student.parent_email,
      });
      setStep(4);
    } catch (ex) {
      setError(ex?.message || String(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-xl mx-auto">
        <Stepper step={step} />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mt-6">
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={submitStep1} className="space-y-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Create your tutor account
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Quest gives you branded packets, parent progress reports, and
                  a booking link in one tool.
                </p>
              </div>
              <Field
                label="Your full name"
                value={fullName}
                onChange={setFullName}
                required
                placeholder="Alex Rivera"
              />
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                required
                placeholder="alex@yourtutoring.com"
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                required
                placeholder="At least 6 characters"
                minLength={6}
              />
              <Button type="submit" disabled={busy} className="w-full h-11">
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating account…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
              <p className="text-xs text-center text-slate-500">
                Already have an account?{" "}
                <a href="/SignIn" className="text-slate-900 underline">
                  Sign in
                </a>
              </p>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Brand your account
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  This appears on every PDF and parent email you send.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Logo
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
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
                      variant="outline"
                      onClick={onPickFile}
                      disabled={uploading}
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
                      PNG, JPG, or SVG · max 2MB
                    </p>
                  </div>
                </div>
              </div>

              <Field
                label="Business name"
                value={brand.business_name}
                onChange={(v) => setBrand((b) => ({ ...b, business_name: v }))}
                placeholder="Rivera Tutoring"
              />
              <Field
                label="Tutor name"
                value={brand.tutor_name}
                onChange={(v) => setBrand((b) => ({ ...b, tutor_name: v }))}
              />
              <Field
                label="Contact email"
                type="email"
                value={brand.contact_email}
                onChange={(v) => setBrand((b) => ({ ...b, contact_email: v }))}
              />
              <Field
                label="Phone"
                value={brand.contact_phone}
                onChange={(v) => setBrand((b) => ({ ...b, contact_phone: v }))}
                placeholder="(555) 555-5555"
              />
              <Field
                label="Website"
                type="url"
                value={brand.website}
                onChange={(v) => setBrand((b) => ({ ...b, website: v }))}
                placeholder="https://yoursite.com"
              />

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Accent color
                </label>
                <div className="flex items-center gap-3">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setBrand((b) => ({ ...b, accent_color: c }))
                      }
                      className={`w-9 h-9 rounded-full border-2 transition-all ${
                        brand.accent_color === c
                          ? "border-slate-900 scale-110"
                          : "border-slate-200"
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(3)}
                  disabled={busy}
                >
                  Skip
                </Button>
                <Button type="button" onClick={submitStep2} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving…
                    </>
                  ) : (
                    "Save and continue"
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Add your first student
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  We'll create a session for them you can start right after
                  signup. Add more later.
                </p>
              </div>

              <Field
                label="Student name"
                value={student.student_full_name}
                onChange={(v) =>
                  setStudent((s) => ({ ...s, student_full_name: v }))
                }
                required
                placeholder="Jordan Smith"
              />
              <Field
                label="Student email (optional)"
                type="email"
                value={student.student_email}
                onChange={(v) =>
                  setStudent((s) => ({ ...s, student_email: v }))
                }
                placeholder="jordan@student.com"
              />
              <Field
                label="Parent name"
                value={student.parent_name}
                onChange={(v) =>
                  setStudent((s) => ({ ...s, parent_name: v }))
                }
                placeholder="Sam Smith"
              />
              <Field
                label="Parent email"
                type="email"
                value={student.parent_email}
                onChange={(v) =>
                  setStudent((s) => ({ ...s, parent_email: v }))
                }
                placeholder="sam@home.com"
              />
              <p className="text-xs text-slate-500">
                Parent reports go to this address after every session. You can
                turn this off later in the student's settings.
              </p>

              <div className="flex justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(4)}
                  disabled={busy}
                >
                  Skip for now
                </Button>
                <Button type="button" onClick={submitStep3} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving…
                    </>
                  ) : (
                    "Add student and continue"
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  You're set up
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Here's what Quest does for tutors. Open them from the sidebar
                  any time.
                </p>
              </div>

              <FeatureCard
                Icon={Sparkles}
                title="Generate session content in minutes"
                body="Drop a YouTube link or PDF. Get quizzes, case studies, and an attention-checked plan."
              />
              <FeatureCard
                Icon={FileText}
                title="Branded parent reports"
                body="Every session ends with a one-tap report sent from your business, not Quest."
              />
              <FeatureCard
                Icon={Calendar}
                title="Booking link (Studio)"
                body="Share a calendar link so parents book right into your schedule."
              />

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="button"
                  className="w-full h-11"
                  onClick={() => navigate("/LearningHub")}
                >
                  Take me to my dashboard
                </Button>
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-center text-slate-500 hover:text-slate-700 underline"
                >
                  Book my free 30-min onboarding call
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required, minLength }) {
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
        required={required}
        minLength={minLength}
      />
    </div>
  );
}

function Stepper({ step }) {
  const labels = ["Account", "Brand", "Student", "Done"];
  return (
    <div className="flex items-center justify-between">
      {labels.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
                done
                  ? "bg-slate-900 text-white border-slate-900"
                  : active
                  ? "bg-white text-slate-900 border-slate-900"
                  : "bg-white text-slate-400 border-slate-300"
              }`}
            >
              {done ? <Check className="w-4 h-4" /> : n}
            </div>
            <span
              className={`text-xs font-medium ${
                active ? "text-slate-900" : "text-slate-500"
              }`}
            >
              {label}
            </span>
            {n < labels.length && (
              <div
                className={`flex-1 h-px ${
                  done ? "bg-slate-900" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FeatureCard({ Icon, title, body }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-700" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{body}</p>
      </div>
    </div>
  );
}
