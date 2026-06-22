// Thin wrappers that delegate to quest.integrations.Core, which now proxies
// to our Supabase Edge Functions. No API keys live here.

// Recursively make every object schema strict (Quest's InvokeLLM expected this).
// Kept for backward compatibility; our Edge Function tolerates non-strict too.
function addAdditionalPropertiesToSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = { ...schema };
  if (out.type === 'object') {
    if (!('additionalProperties' in out)) out.additionalProperties = false;
    if (out.properties && !out.required) out.required = Object.keys(out.properties);
  }
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, addAdditionalPropertiesToSchema(v)]),
    );
  }
  if (out.items) out.items = addAdditionalPropertiesToSchema(out.items);
  return out;
}

// Retry transient failures with exponential backoff + jitter. invokeLLM /
// generateImage edge functions return 500/546 (worker killed) and 429 (rate
// limit) under bursty load — e.g. generating many subunits at once. These
// calls are side-effect-free, so retrying is safe and recovers most blips.
async function withRetry(fn, { retries = 3, baseMs = 1500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const wait = baseMs * Math.pow(2, attempt) + Math.floor(Math.random() * 600);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// Accept EITHER a bare string OR an options object — callers do both.
export async function invokeLLM(arg) {
  const { quest } = await import("@/api/questClient");
  const opts = typeof arg === 'string' ? { prompt: arg } : (arg || {});
  return withRetry(() =>
    quest.integrations.Core.InvokeLLM({
      prompt: opts.prompt,
      response_json_schema: opts.response_json_schema,
      add_context_from_internet: opts.add_context_from_internet ?? false,
      model: opts.model,
    })
  );
}

export async function generateImage({ prompt, quality }) {
  const { quest } = await import("@/api/questClient");
  return withRetry(() => quest.integrations.Core.GenerateImage({ prompt, quality }), {
    retries: 2,
  });
}
