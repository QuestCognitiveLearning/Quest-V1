// handleEventTrigger — internal endpoint called by other Edge Functions
// (captureLead, stripeWebhook) and by the Quest app when behavior events fire.
// Resolves the lead row by email, runs the per-event decision, sends any
// immediate emails, schedules future ones, cancels invalidated ones.
//
// Auth: requires X-Quest-Internal-Token header matching QUEST_INTERNAL_TOKEN
// secret. This is NOT a public function — never expose it to the browser.

import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { decide, applyDecision, Lead } from '../_shared/sequence.ts';

const INTERNAL_TOKEN = Deno.env.get('QUEST_INTERNAL_TOKEN') || '';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Authorize using a shared secret instead of Supabase JWT so the cron job
  // + other Edge Functions can call this without minting a user token.
  const presented = req.headers.get('x-quest-internal-token');
  if (!INTERNAL_TOKEN || presented !== INTERNAL_TOKEN) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: { email?: string; event?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const event = body.event || '';
  const payload = body.payload || {};
  if (!email || !event) return json({ error: 'email and event required' }, 400);

  const admin = adminClient();

  // Upsert the lead. The captureLead function inserts the initial row; for
  // events that fire BEFORE captureLead (e.g., trial_started from a logged-in
  // teacher who never used /try), we create a minimal lead so the sequence
  // still tracks them.
  const { data: existing } = await admin
    .from('leads')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  let lead: Lead;
  if (existing) {
    lead = existing as Lead;
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from('leads')
      .insert({
        email,
        source: 'event_trigger',
        first_name: (payload.firstName as string) || null,
        sequence_phase: 'phase_1',
      })
      .select('*')
      .single();
    if (insertErr || !inserted) {
      console.error('[handleEventTrigger] could not create lead:', insertErr);
      return json({ error: 'Could not initialize lead' }, 500);
    }
    lead = inserted as Lead;
  }

  // Update generations_used if the event carries a count.
  if (event === 'generation_count' && typeof payload.count === 'number') {
    await admin
      .from('leads')
      .update({ generations_used: payload.count })
      .eq('id', lead.id);
    lead.generations_used = payload.count;
  }
  if (event === 'first_generation_complete' && lead.generations_used === 0) {
    await admin.from('leads').update({ generations_used: 1 }).eq('id', lead.id);
    lead.generations_used = 1;
  }

  const decision = decide(event, lead, payload);
  await applyDecision(admin, lead, event, decision, payload);

  return json({ ok: true, decision });
});
