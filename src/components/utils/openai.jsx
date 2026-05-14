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

// Accept EITHER a bare string OR an options object — callers do both.
export async function invokeLLM(arg) {
  const { quest } = await import("@/api/questClient");
  const opts = typeof arg === 'string' ? { prompt: arg } : (arg || {});
  return quest.integrations.Core.InvokeLLM({
    prompt: opts.prompt,
    response_json_schema: opts.response_json_schema,
    add_context_from_internet: opts.add_context_from_internet ?? false,
    model: opts.model,
  });
}

export async function generateImage({ prompt, quality }) {
  const { quest } = await import("@/api/questClient");
  return quest.integrations.Core.GenerateImage({ prompt, quality });
}
