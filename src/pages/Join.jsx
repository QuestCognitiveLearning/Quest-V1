/**
 * Join — public landing at /Join. Students enter a 6-char session code + a
 * display name and jump straight into the live session. No account required.
 * When the visitor IS signed in, we skip the name field and use their real
 * full_name.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles } from "lucide-react";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";

export default function Join() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCode = (searchParams.get("code") || "").toUpperCase();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    quest.auth
      .me()
      .then((u) => {
        setUser(u);
        if (u?.full_name) setName(u.full_name);
      })
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    if (cleanCode.length < 4) return setError("Enter the session code your teacher shared.");
    if (!cleanName) return setError("Enter a display name so your teacher can see you.");

    setWorking(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "joinLiveSession",
        { body: { code: cleanCode, displayName: cleanName } }
      );
      if (fnErr || data?.error) {
        throw new Error(data?.error || fnErr?.message || "Could not join.");
      }
      // Stash join details so LiveSessionPlay can re-hydrate them
      // on the next page (no auth needed for anonymous joiners).
      sessionStorage.setItem(
        "quest_anon_join",
        JSON.stringify({
          code: cleanCode,
          displayName: cleanName,
          participantId: data.participantId,
          sessionId: data.sessionId,
          anonymous: !user,
        })
      );
      navigate(`/LiveSessionPlay?code=${cleanCode}`);
    } catch (err) {
      setError(err?.message || "Could not join. Check the code and try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        background:
          "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #EEF2FF 100%)",
        fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <img
            src="/quest-logo-on-white.png"
            alt="Quest Learning"
            width="64"
            height="64"
            className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow-sm"
          />
          <h1 className="text-2xl font-bold text-[#1E40AF]">Join the live session</h1>
          <p className="text-sm text-slate-500 mt-1">
            No account needed. Your teacher shared a 6-character code.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase text-slate-500 mb-1.5">
              Session code
            </label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. EH8Y54"
              maxLength={8}
              className="text-center text-2xl tracking-[0.3em] font-bold font-mono h-14"
              autoFocus={!initialCode}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase text-slate-500 mb-1.5">
              Display name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              maxLength={50}
              autoFocus={!!initialCode && !user}
            />
            {user && (
              <p className="text-[11px] text-slate-500 mt-1">
                Using your account name. Edit if you'd like a different display name.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={working}
            className="w-full h-12 bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2 text-base"
          >
            {working ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Joining...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" /> Join session
              </>
            )}
          </Button>

          <p className="text-[11px] text-slate-400 text-center pt-2">
            By joining you agree to share your display name with the teacher of
            the class running this session.
          </p>
        </form>
      </div>
    </div>
  );
}
