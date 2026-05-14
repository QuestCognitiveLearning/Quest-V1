// Document data extraction via OpenAI Vision (for images) or simple text fetch
// (for plain text URLs). For PDFs/complex docs you'd want a dedicated service
// like Documind, Reducto, or AWS Textract — left as TODO.
import { handlePreflight, json } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // File processing is compute-heavy. Tight per-user cap.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 10, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  const { file_url, json_schema } = await req.json();
  if (!file_url) return json({ error: 'file_url required' }, 400);

  // Pull the file as text. If it's not text-decodable, return an empty result.
  let content = '';
  try {
    const res = await fetch(file_url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    content = await res.text();
  } catch (err) {
    return json({
      status: 'failed',
      details: (err as Error).message,
      output: json_schema?.type === 'array' ? [] : {},
    });
  }

  try {
    const extracted = await invokeLLM({
      prompt: `Extract structured data from the following content. Return JSON matching the supplied schema.\n\nCONTENT:\n${content.slice(0, 12000)}`,
      response_json_schema: json_schema,
    });
    return json({ status: 'success', details: null, output: extracted });
  } catch (err) {
    return json({
      status: 'failed',
      details: (err as Error).message,
      output: json_schema?.type === 'array' ? [] : {},
    });
  }
});
