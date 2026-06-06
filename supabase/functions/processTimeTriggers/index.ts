// processTimeTriggers — fires every hour via pg_cron. Scans email_log for
// rows where scheduled_for <= now() AND sent_at IS NULL AND cancelled_at IS
// NULL. For each, loads the lead, applies last-mile gates (still in the right
// phase, still not unsubscribed, still hasn't done the action that would
// cancel this email), then sends. Marks row as sent.
//
// Two extra responsibilities:
//   1. Detect trial_expired: leads where trial_started_at != NULL AND
//      trial_expired_at <= now() AND converted_to_paid = false AND
//      sequence_phase = 'phase_2'. Fires the trial_expired event which
//      schedules T7 + post-trial P-series.
//   2. Last-mile gating: e.g. T5 should not send if converted_to_paid=true.
//
// Auth: requires X-Quest-Internal-Token (same as handleEventTrigger).

import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { sendIfNotRecent, decide, applyDecision, Lead } from '../_shared/sequence.ts';

const INTERNAL_TOKEN = Deno.env.get('QUEST_INTERNAL_TOKEN') || '';

// Sequence IDs that require last-mile gating before sending.
const GATES: Record<string, (lead: Lead) => string | null> = {
  // Trial-sequence emails should not fire after the user has converted to
  // paid (W0 already welcomed them) or before they've reached the relevant
  // behavior milestone.
  T1: (l) => (l.first_class_at ? 'first_class_already' : (l.converted_to_paid ? 'converted' : null)),
  T4: (l) => (l.converted_to_paid ? 'converted' : null),
  T5: (l) => (l.converted_to_paid ? 'converted' : null),
  T6: (l) => (l.converted_to_paid ? 'converted' : null),
  T7: (l) => (l.converted_to_paid ? 'converted' : null),
  P1: (l) => (l.converted_to_paid ? 'converted' : null),
  P2: (l) => (l.converted_to_paid ? 'converted' : null),
  P3: (l) => (l.converted_to_paid ? 'converted' : null),
  P4: (l) => (l.converted_to_paid ? 'converted' : null),
  A2: (l) => (l.generations_used >= 2 ? 'gen2_already' : null),
  E2: (l) => (l.trial_started_at ? 'trial_started' : null),
  E3: (l) => (l.trial_started_at ? 'trial_started' : null),
  E4: (l) => (l.trial_started_at ? 'trial_started' : null),
  // Paid-sequence emails should not fire if the user cancelled before the
  // checkpoint arrived.
  W1: (l) => (!l.converted_to_paid ? 'not_paid' : null),
  W2: (l) => (!l.converted_to_paid ? 'not_paid' : null),
  W3: (l) => (!l.converted_to_paid ? 'not_paid' : null),
};

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const presented = req.headers.get('x-quest-internal-token');
  if (!INTERNAL_TOKEN || presented !== INTERNAL_TOKEN) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const admin = adminClient();
  const summary = { trial_expired_fired: 0, sent: 0, gated: 0, errors: 0 };

  // 1. Detect newly-expired trials and fire trial_expired event.
  const { data: expired } = await admin
    .from('leads')
    .select('*')
    .lte('trial_expired_at', new Date().toISOString())
    .eq('converted_to_paid', false)
    .eq('sequence_phase', 'phase_2')
    .is('unsubscribed_at', null);

  for (const lead of (expired || []) as Lead[]) {
    try {
      const decision = decide('trial_expired', lead);
      await applyDecision(admin, lead, 'trial_expired', decision, {});
      summary.trial_expired_fired++;
    } catch (err) {
      console.error('[processTimeTriggers] trial_expired failed:', err);
      summary.errors++;
    }
  }

  // 2. Send any scheduled emails whose time has come.
  const { data: due } = await admin
    .from('email_log')
    .select('id, lead_id, sequence_id, scheduled_for')
    .lte('scheduled_for', new Date().toISOString())
    .is('sent_at', null)
    .is('cancelled_at', null)
    .order('scheduled_for', { ascending: true })
    .limit(200);

  for (const row of due || []) {
    const { data: lead } = await admin
      .from('leads')
      .select('*')
      .eq('id', row.lead_id)
      .single();
    if (!lead) {
      await admin
        .from('email_log')
        .update({ cancelled_at: new Date().toISOString(), cancelled_reason: 'lead_missing' })
        .eq('id', row.id);
      continue;
    }

    const gate = GATES[row.sequence_id]?.(lead as Lead);
    if (gate) {
      await admin
        .from('email_log')
        .update({ cancelled_at: new Date().toISOString(), cancelled_reason: `gate:${gate}` })
        .eq('id', row.id);
      summary.gated++;
      continue;
    }

    const result = await sendIfNotRecent(admin, lead as Lead, row.sequence_id, {}, 'time');
    if (result.ok) {
      // sendIfNotRecent inserts a fresh email_log row for the actual send.
      // Clear the scheduled row so it isn't re-picked.
      await admin
        .from('email_log')
        .update({ sent_at: new Date().toISOString(), cancelled_reason: 'sent_via_scheduler' })
        .eq('id', row.id);
      summary.sent++;
    } else if (result.skipped === 'cooldown') {
      // Cooldown — reschedule for +24h instead of cancelling.
      await admin
        .from('email_log')
        .update({ scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
        .eq('id', row.id);
    } else {
      await admin
        .from('email_log')
        .update({ cancelled_at: new Date().toISOString(), cancelled_reason: result.skipped || 'unknown' })
        .eq('id', row.id);
      summary.gated++;
    }
  }

  return json({ ok: true, summary });
});
