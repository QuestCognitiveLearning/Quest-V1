// Helper for Edge Functions to fire a lifecycle event into handleEventTrigger.
// Same-region in-cluster invoke — uses the platform's SUPABASE_URL and the
// internal shared-secret header so the call is authenticated without a JWT.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const INTERNAL_TOKEN = Deno.env.get('QUEST_INTERNAL_TOKEN') || '';

export async function fireEvent(
  email: string,
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!SUPABASE_URL || !INTERNAL_TOKEN) {
    console.warn('[fireEvent] missing SUPABASE_URL or QUEST_INTERNAL_TOKEN; skipping');
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/handleEventTrigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Quest-Internal-Token': INTERNAL_TOKEN,
      },
      body: JSON.stringify({ email, event, payload }),
    });
    if (!res.ok) {
      console.warn(`[fireEvent] handleEventTrigger ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.warn('[fireEvent] failed:', err);
  }
}
