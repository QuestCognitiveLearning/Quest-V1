// Lifecycle drip orchestration. One source of truth for:
//   - which emails go out immediately vs. on a schedule
//   - which scheduled emails get cancelled by a behavior event
//   - the per-email cooldown rule (24h max, see spec)
//
// Event triggers (immediate or scheduled):
//   first_generation_complete       -> A1 immediate, A2 schedule +24h
//   generation_count = 2|3|4|5      -> B|C|D|E1 immediate; if 5, also
//                                       E2 +24h, E3 +72h, E4 +7d
//   trial_started                   -> T0 immediate; kill Phase 1; schedule
//                                       T1+24h, T4+5d, T5+10d, T6+13d, T7+14d
//   first_class_created             -> T2 immediate; cancel T1
//   first_student_quiz_submission   -> T3 immediate
//   subscription_created            -> kill all Phase 2/3, switch to phase_4
//   trial_expired (cron)            -> T7 (handled by time triggers)
//   post-trial nudges               -> P1 +3d, P2 +10d, P3 +21d, P4 +45d
//
// This file is imported by handleEventTrigger and processTimeTriggers.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { TEMPLATES, TemplateContext } from './emailTemplates.ts';
import { sendEmail } from './email.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const HOST = Deno.env.get('PUBLIC_APP_URL') || 'https://www.questlearning.co';

export const APP_URLS = {
  trial: () => `${HOST}/SignIn?mode=signup&source=leadmagnet&intent=trial`,
  pricing: () => `${HOST}/Pricing`,
  dashboard: () => `${HOST}/TeacherDashboard`,
  resume: () => `${HOST}/Pricing?intent=resume`,
};

export type Lead = {
  id: string;
  email: string;
  first_name: string | null;
  generations_used: number;
  generations_limit: number;
  trial_started_at: string | null;
  trial_expired_at: string | null;
  converted_to_paid: boolean;
  sequence_phase: string;
  first_class_at: string | null;
  first_student_quiz_at: string | null;
  unsubscribe_token: string | null;
  unsubscribed_at: string | null;
};

type Decision = {
  immediate?: string[];           // sequence_ids to send now
  schedule?: { id: string; at: Date }[];
  cancel?: string[];              // sequence_ids of pending emails to cancel
  patch?: Partial<Lead>;          // state changes to apply to the lead row
};

// Per-event decision table. Pure function — easy to test.
export function decide(event: string, lead: Lead, payload: Record<string, unknown> = {}): Decision {
  const now = Date.now();
  if (lead.unsubscribed_at) return {}; // honor unsub for all events

  switch (event) {
    case 'first_generation_complete': {
      return {
        immediate: ['A1'],
        schedule: [{ id: 'A2', at: new Date(now + 24 * HOUR) }],
        patch: { sequence_phase: 'phase_1' },
      };
    }
    case 'generation_count': {
      const n = Number(payload.count) || lead.generations_used;
      if (n === 2) return { immediate: ['B'], cancel: ['A2'] };
      if (n === 3) return { immediate: ['C'] };
      if (n === 4) return { immediate: ['D'] };
      if (n >= 5) {
        return {
          immediate: ['E1'],
          schedule: [
            { id: 'E2', at: new Date(now + 24 * HOUR) },
            { id: 'E3', at: new Date(now + 72 * HOUR) },
            { id: 'E4', at: new Date(now + 7 * DAY) },
          ],
        };
      }
      return {};
    }
    case 'trial_started': {
      return {
        immediate: ['T0'],
        cancel: ['A2', 'B', 'C', 'D', 'E1', 'E2', 'E3', 'E4'],
        schedule: [
          { id: 'T1', at: new Date(now + 24 * HOUR) },
          { id: 'T4', at: new Date(now + 5 * DAY) },
          { id: 'T5', at: new Date(now + 10 * DAY) },
          { id: 'T6', at: new Date(now + 13 * DAY) },
          { id: 'T7', at: new Date(now + 14 * DAY) },
        ],
        patch: {
          sequence_phase: 'phase_2',
          trial_started_at: new Date().toISOString(),
          trial_expired_at: new Date(now + 14 * DAY).toISOString(),
        },
      };
    }
    case 'first_class_created': {
      return {
        immediate: ['T2'],
        cancel: ['T1'],
        patch: { first_class_at: new Date().toISOString() },
      };
    }
    case 'first_student_quiz_submission': {
      return {
        immediate: ['T3'],
        patch: { first_student_quiz_at: new Date().toISOString() },
      };
    }
    case 'trial_expired': {
      // Sent by cron when T+14d fires and !paid.
      return {
        immediate: ['T7'],
        schedule: [
          { id: 'P1', at: new Date(now + 3 * DAY) },
          { id: 'P2', at: new Date(now + 10 * DAY) },
          { id: 'P3', at: new Date(now + 21 * DAY) },
          { id: 'P4', at: new Date(now + 45 * DAY) },
        ],
        patch: { sequence_phase: 'phase_3' },
      };
    }
    case 'subscription_created': {
      return {
        cancel: ['T1','T4','T5','T6','T7','P1','P2','P3','P4'],
        patch: { sequence_phase: 'phase_4', converted_to_paid: true },
      };
    }
    default:
      return {};
  }
}

// Cancel rule per spec rule #2: max 1 email per 24h per user. We enforce this
// inside sendIfNotRecent() rather than in decide() because schedule emails
// can be queued in advance and the rule applies at send time.
export async function sendIfNotRecent(
  admin: SupabaseClient,
  lead: Lead,
  sequenceId: string,
  ctx: Partial<TemplateContext>,
  triggerType: 'time' | 'event',
): Promise<{ ok: boolean; skipped?: string; resendId?: string }> {
  if (lead.unsubscribed_at) return { ok: false, skipped: 'unsubscribed' };

  // 24h cooldown
  const since = new Date(Date.now() - 24 * HOUR).toISOString();
  const { data: recent } = await admin
    .from('email_log')
    .select('id')
    .eq('lead_id', lead.id)
    .gte('sent_at', since)
    .not('sent_at', 'is', null)
    .limit(1);
  if (recent && recent.length > 0 && triggerType === 'time') {
    return { ok: false, skipped: 'cooldown' };
  }

  // Ensure unsubscribe token
  let token = lead.unsubscribe_token;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '');
    await admin.from('leads').update({ unsubscribe_token: token }).eq('id', lead.id);
    lead.unsubscribe_token = token;
  }
  const unsubscribeUrl = `${HOST}/unsubscribe?t=${token}`;

  const template = TEMPLATES[sequenceId];
  if (!template) return { ok: false, skipped: 'no_template' };

  const fullCtx: TemplateContext = {
    firstName: lead.first_name,
    remainingGens: Math.max(0, lead.generations_limit - lead.generations_used),
    generationsUsed: lead.generations_used,
    ctaUrl: APP_URLS.trial(),
    unsubscribeUrl,
    ...ctx,
  };

  const { subject, html } = template(fullCtx);

  try {
    const res = await sendEmail({
      to: lead.email,
      subject,
      html,
    });

    const sentAt = new Date().toISOString();
    await admin
      .from('email_log')
      .insert({
        lead_id: lead.id,
        email: lead.email,
        sequence_id: sequenceId,
        trigger_type: triggerType,
        scheduled_for: sentAt,
        sent_at: sentAt,
        resend_id: res.id || null,
      });
    await admin
      .from('leads')
      .update({ last_email_sent_at: sentAt })
      .eq('id', lead.id);

    return { ok: true, resendId: res.id };
  } catch (err) {
    console.error(`[sequence] send failed sequence=${sequenceId} lead=${lead.id}:`, err);
    return { ok: false, skipped: 'send_error' };
  }
}

export async function scheduleEmails(
  admin: SupabaseClient,
  lead: Lead,
  rows: { id: string; at: Date }[],
): Promise<void> {
  if (rows.length === 0) return;
  await admin.from('email_log').insert(
    rows.map((r) => ({
      lead_id: lead.id,
      email: lead.email,
      sequence_id: r.id,
      trigger_type: 'time',
      scheduled_for: r.at.toISOString(),
    })),
  );
}

export async function cancelScheduled(
  admin: SupabaseClient,
  lead: Lead,
  sequenceIds: string[],
  reason: string,
): Promise<void> {
  if (sequenceIds.length === 0) return;
  await admin
    .from('email_log')
    .update({ cancelled_at: new Date().toISOString(), cancelled_reason: reason })
    .eq('lead_id', lead.id)
    .in('sequence_id', sequenceIds)
    .is('sent_at', null)
    .is('cancelled_at', null);
}

export async function applyDecision(
  admin: SupabaseClient,
  lead: Lead,
  event: string,
  decision: Decision,
  payload: Record<string, unknown>,
): Promise<void> {
  if (decision.cancel?.length) {
    await cancelScheduled(admin, lead, decision.cancel, `superseded_by:${event}`);
  }
  if (decision.patch) {
    await admin.from('leads').update(decision.patch).eq('id', lead.id);
    Object.assign(lead, decision.patch);
  }
  for (const id of decision.immediate || []) {
    await sendIfNotRecent(admin, lead, id, payload as Partial<TemplateContext>, 'event');
  }
  if (decision.schedule?.length) {
    await scheduleEmails(admin, lead, decision.schedule);
  }
}
