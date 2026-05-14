/**
 * @file   llmGuard.ts
 * @desc   Defense layer for OpenAI key abuse. Every LLM-related edge function
 *         calls `guardLLMRequest()` BEFORE making the upstream OpenAI call and
 *         `logLLMUsage()` AFTER it succeeds. Four checks run in this order:
 *
 *           1. Model whitelist   — only models we route to in code
 *           2. Tier gate         — heavy actions require trial/premium/grace
 *           3. Per-user day cap  — DAILY_CALL_LIMIT_PER_USER calls per UTC day
 *           4. Global token cap  — DAILY_TOKEN_LIMIT_GLOBAL tokens total per day
 *
 *         Failures map to HTTP status:
 *           400 → bad model
 *           403 → tier not allowed
 *           429 → daily user quota exceeded
 *           503 → global circuit breaker tripped
 *
 *         Logging happens only on success — failed/aborted OpenAI calls don't
 *         count against the user's daily cap.
 *
 * @author Quest Learning core team
 */

import { adminClient } from './client.ts';

// ─── Configuration ───────────────────────────────────────────────────────────

// Models we actually route to in src/lib/llmModels.js + image generation.
// Anything else is rejected at the door.
const ALLOWED_MODELS = new Set([
  'gpt-5-mini',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-image-1',
]);

// Subscription states that get access to heavy (curriculum-gen, image-gen)
// LLM operations. Free-tier users are blocked; new users with NULL status
// must pick a plan first.
const ALLOWED_TIERS_FOR_HEAVY = new Set(['premium', 'trial', 'grace_period']);

// Per-user daily call cap. Heaviest legitimate teacher day is ~100 calls
// (building a 10-subunit unit). 200 gives 2x headroom; attacker is capped
// at ~$2/day per JWT.
const DAILY_CALL_LIMIT_PER_USER = 200;

// Global daily token ceiling. At current model pricing, 10M tokens ≈ $100.
// Trip this and every LLM endpoint returns 503 until UTC midnight.
const DAILY_TOKEN_LIMIT_GLOBAL = 10_000_000;

// ─── Types ───────────────────────────────────────────────────────────────────

type GuardAction = 'heavy' | 'light';

interface GuardInput {
  user: { id: string; subscription_status?: string | null; role?: string | null };
  model: string;
  action: GuardAction;
}

interface GuardOk { ok: true }
interface GuardFail {
  ok: false;
  status: 400 | 403 | 429 | 503;
  error: string;
  retryAfter?: number;
}
type GuardResult = GuardOk | GuardFail;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfUtcDayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function secondsUntilUtcMidnight(): number {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return Math.ceil((next.getTime() - Date.now()) / 1000);
}

// ─── Main guard ──────────────────────────────────────────────────────────────

/**
 * Run all pre-flight defenses. Returns ok=true if the request should proceed,
 * or ok=false + a status + error message ready to return to the client.
 */
export async function guardLLMRequest({ user, model, action }: GuardInput): Promise<GuardResult> {
  // 1. Whitelist model. Stops the upgrade attack (caller asks for gpt-5 etc.)
  if (!ALLOWED_MODELS.has(model)) {
    return { ok: false, status: 400, error: 'Invalid model' };
  }

  // 2. Tier check for heavy ops. Free users are blocked from curriculum/image
  //    generation; chat-tier (light) calls are open to all authenticated users.
  if (action === 'heavy' && !ALLOWED_TIERS_FOR_HEAVY.has(user.subscription_status ?? '')) {
    return { ok: false, status: 403, error: 'Upgrade required for this feature' };
  }

  const supabase = adminClient();
  const todayStart = startOfUtcDayIso();

  // 3. Per-user daily call count. Best-effort: if the audit log isn't
  //    queryable for any reason (table missing, RLS misconfig, network),
  //    we FAIL OPEN. The model whitelist + tier gate above + per-minute
  //    rate limit at the edge function level still cap damage. A daily
  //    quota is a redundant safety net, not the primary defense.
  try {
    const { count: userCount, error: countErr } = await supabase
      .from('llm_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart);

    if (countErr) {
      console.error('[llmGuard] per-user count failed (failing open):', countErr);
    } else if ((userCount ?? 0) >= DAILY_CALL_LIMIT_PER_USER) {
      return {
        ok: false,
        status: 429,
        error: 'Daily quota exceeded. Resets at midnight UTC.',
        retryAfter: secondsUntilUtcMidnight(),
      };
    }
  } catch (err) {
    console.error('[llmGuard] per-user count threw (failing open):', err);
  }

  // 4. Global circuit breaker. Sums total_tokens across the whole day.
  //
  // We sum in JS rather than using PostgREST's aggregate syntax
  // (`select('total_tokens.sum()')`) because Supabase has aggregate functions
  // disabled at the PostgREST layer (PGRST123). At our scale (≤ low-tens of
  // thousands of rows per day) loading the rows and reducing is trivial.
  //
  // If this query fails for any reason we fail OPEN — log the error but
  // allow the call through. The model whitelist + tier gate + per-minute
  // rate limit + per-user daily cap (above) are still in force; the global
  // token cap is a redundant safety net, not the primary defense.
  try {
    const { data: rows, error: sumErr } = await supabase
      .from('llm_audit_log')
      .select('total_tokens')
      .gte('created_at', todayStart);

    if (sumErr) {
      console.error('[llmGuard] global token query failed (failing open):', sumErr);
      return { ok: true };
    }

    const globalSum = (rows ?? []).reduce(
      (acc, row: { total_tokens?: number | null }) => acc + (row.total_tokens ?? 0),
      0,
    );

    if (globalSum >= DAILY_TOKEN_LIMIT_GLOBAL) {
      return {
        ok: false,
        status: 503,
        error: 'Service temporarily unavailable',
        retryAfter: secondsUntilUtcMidnight(),
      };
    }
  } catch (err) {
    console.error('[llmGuard] global token query threw (failing open):', err);
  }

  return { ok: true };
}

/**
 * Record a successful LLM call to the audit log. Fire-and-forget — logging
 * failures are swallowed so they can't break the response to the user.
 */
export async function logLLMUsage(params: {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  try {
    const supabase = adminClient();
    await supabase.from('llm_audit_log').insert({
      user_id: params.userId,
      model: params.model,
      input_tokens: params.inputTokens ?? 0,
      output_tokens: params.outputTokens ?? 0,
    });
  } catch (err) {
    console.error('[llmGuard] log insert failed:', err);
  }
}

/**
 * Helper to map a guard failure into a Response. Avoids each caller having
 * to remember to set Retry-After.
 */
export function guardFailureResponse(
  fail: GuardFail,
  corsHeaders: Record<string, string>,
): Response {
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };
  if (fail.retryAfter !== undefined) {
    headers['Retry-After'] = String(fail.retryAfter);
  }
  return new Response(JSON.stringify({ error: fail.error }), {
    status: fail.status,
    headers,
  });
}
