/**
 * @file   llm.ts
 * @desc   Thin wrapper over OpenAI Chat Completions. Returns both the parsed
 *         content AND the token usage so callers can log against quotas.
 *
 *         There are two entry points:
 *           - invokeLLM()         — legacy, returns just content (kept for
 *                                   internal helpers that don't need usage)
 *           - invokeLLMWithUsage() — preferred, returns { content, usage }
 *
 * @author Quest Learning core team
 */
// deno-lint-ignore-file no-explicit-any

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const DEFAULT_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';

interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface InvokeResult {
  content: any;          // string or parsed JSON if schema was passed
  usage: UsageInfo;      // OpenAI token counts
  model: string;         // actual model used (after defaulting)
}

interface InvokeArgs {
  prompt: string;
  response_json_schema?: any;
  system?: string;
  model?: string;
}

/**
 * Preferred form. Returns content + token usage so the caller can log to the
 * audit table and enforce per-user / global token caps.
 */
export async function invokeLLMWithUsage(args: InvokeArgs): Promise<InvokeResult> {
  const model = args.model || DEFAULT_MODEL;

  const body: Record<string, unknown> = {
    model,
    messages: [
      ...(args.system ? [{ role: 'system', content: args.system }] : []),
      { role: 'user', content: args.prompt },
    ],
  };

  if (args.response_json_schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema: args.response_json_schema,
        strict: false,
      },
    };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }

  const data = await res.json();
  const rawContent: string = data.choices?.[0]?.message?.content ?? '';

  // Try to parse as JSON when caller specified a schema. Fall back to raw.
  let content: any = rawContent;
  if (args.response_json_schema) {
    try { content = JSON.parse(rawContent); } catch { /* fall back to string */ }
  }

  const usage: UsageInfo = {
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0,
  };

  return { content, usage, model };
}

/**
 * Legacy entry point. Returns only the content — usage info is dropped.
 * Use invokeLLMWithUsage() in any edge function that needs to enforce or
 * log quotas (i.e., all of them now).
 */
export async function invokeLLM(args: InvokeArgs): Promise<any> {
  const { content } = await invokeLLMWithUsage(args);
  return content;
}
