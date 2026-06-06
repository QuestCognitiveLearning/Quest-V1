/**
 * Client-side soft quota for the public /try lead magnet. Server-side
 * enforcement lives in captureLead (counts leads.ip_hash). This is the gentle
 * UX layer that surfaces the counter and the upgrade modal before the
 * server-side gate trips.
 *
 * Stored in localStorage so a visitor who clears cookies still sees the
 * counter reset — that's intentional. The hard cap is server-side.
 */
const KEY = "quest_free_handout_quota_v1";
export const FREE_QUOTA = 5;

export function getQuotaUsed() {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementQuota() {
  if (typeof window === "undefined") return 0;
  const next = getQuotaUsed() + 1;
  try {
    window.localStorage.setItem(KEY, String(next));
  } catch {
    // localStorage quota exceeded — ignore; server will still gate.
  }
  return next;
}

export function getQuotaRemaining() {
  return Math.max(0, FREE_QUOTA - getQuotaUsed());
}

export function isQuotaExhausted() {
  return getQuotaRemaining() <= 0;
}

export function resetQuota() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
