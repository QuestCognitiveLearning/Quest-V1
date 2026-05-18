/**
 * @file   invokeLLM/index.ts
 * @desc   Generic LLM endpoint — the most cost-sensitive surface in the
 *         system. Stacked defenses (top-to-bottom on every request):
 *
 *           1. CORS preflight scoped to allowlisted origins
 *           2. Per-IP rate limit  (100/min — burst protection)
 *           3. JWT authentication (Supabase Auth)
 *           4. Per-user RPM limit (30/min — sustained protection)
 *           5. Input validation   (50K char cap, JSON shape)
 *           6. Model whitelist    (block "upgrade attacks" — gpt-5, o1-pro, etc.)
 *           7. System override block (only admin can replace the system prompt)
 *           8. Tier gate          (free tier blocked from heavy ops)
 *           9. Per-user day cap   (200 calls/day — caps attacker JWT to ~$2/day)
 *          10. Global token cap   (10M tokens/day — circuit breaker ~$100/day)
 *          11. OpenAI call
 *          12. Audit log insert (post-success only)
 *
 *         Failures use generic messages; full detail logged with correlation
 *         IDs server-side (safeErrorResponse).
 *
 * @author Quest Learning core team
 */
import { handlePreflight, json, safeErrorResponse, corsHeadersFor } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { invokeLLMWithUsage } from '../_shared/llm.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';
import { guardLLMRequest, logLLMUsage, guardFailureResponse } from '../_shared/llmGuard.ts';

const MAX_PROMPT_CHARS = 200_000;

const DEFAULT_SYSTEM_PROMPT =
  'You generate content for an English-language education platform. All output (questions, answer choices, explanations, summaries, scenarios) MUST be written in clear, natural English. Translate any non-English source material rather than echoing it. Never output text in another language.';

// Models that count as "heavy" — curriculum generation, content creation.
// Anything not in this set is "light" — chat-tier interactions.
const HEAVY_MODELS = new Set(['gpt-5-mini']);

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const corsH = corsHeadersFor(req);

  // 1+2. IP burst protection (pre-auth — covers unauthenticated abuse)
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 100, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  // 3. Authenticate
  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401, req);

  // 4. Per-user RPM (in-memory, smooth burst)
  const userLimit = rateLimitByUser(user.id, { maxRequests: 30, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  try {
    // 5. Parse + validate input shape
    const args = await req.json();
    if (!args || typeof args !== 'object') {
      return json({ error: 'Body must be a JSON object' }, 400, req);
    }
    const prompt = typeof args.prompt === 'string' ? args.prompt : '';
    if (!prompt.trim()) return json({ error: 'prompt is required' }, 400, req);
    if (prompt.length > MAX_PROMPT_CHARS) {
      return json({ error: `prompt exceeds ${MAX_PROMPT_CHARS} characters` }, 400, req);
    }

    // Model is required and must come from the whitelist (enforced in guard).
    // Fall back to gpt-4.1-mini if caller omitted it (legacy clients).
    const model =
      typeof args.model === 'string' && args.model.length > 0 ? args.model : 'gpt-4.1-mini';

    // 6+7+8+9+10. The big guard. Bounces unauthorized models / tiers / quotas.
    const action = HEAVY_MODELS.has(model) ? 'heavy' : 'light';
    const guard = await guardLLMRequest({ user, model, action });
    if (!guard.ok) return guardFailureResponse(guard, corsH);

    // 7. System-prompt override: admins only. Everyone else gets the default.
    //    Prevents prompt-extraction attacks where a caller replaces our
    //    system prompt to leak internal instructions.
    const isAdmin = (user.role ?? '') === 'admin';
    const system =
      isAdmin && typeof args.system === 'string' && args.system.length > 0
        ? args.system
        : DEFAULT_SYSTEM_PROMPT;

    // 11. Upstream call (returns content + token usage)
    const { content, usage } = await invokeLLMWithUsage({
      prompt,
      response_json_schema: args.response_json_schema,
      system,
      model,
    });

    // 12. Audit-log AFTER success. Failed calls don't count toward the cap.
    await logLLMUsage({
      userId: user.id,
      model,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
    });

    return json(content, 200, req);
  } catch (err) {
    return safeErrorResponse(err, 'Failed to generate response. Please try again.', 500, req);
  }
});
