// captureLead: public Edge Function called from the /Try (and /quiz-from-video)
// email gate. Writes a row to public.leads (service role bypasses RLS), sends
// the Day-0 email with the freshly generated PDF attached, and returns ok.
//
// The PDF is rendered client-side by the Phase 1 PDF engine and posted here as
// base64 — keeps Edge Function CPU low and lets us reuse the same templates.

import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { sendEmail } from '../_shared/email.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';
import { validate } from '../_shared/validator.ts';
import { fireEvent } from '../_shared/fireEvent.ts';

const HOST = Deno.env.get('PUBLIC_APP_URL') || 'https://www.questlearning.co';

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

function dayZeroHtml(p: {
  videoTitle: string;
  ctaUrl: string;
}): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A;">
    <h1 style="font-size: 22px; margin: 0 0 12px;">Your quiz is attached.</h1>
    <p style="font-size: 15px; line-height: 1.55; color: #475569;">
      Thanks for trying Quest. Your handout for
      <strong>${escape(p.videoTitle)}</strong> is attached as a print-ready PDF.
    </p>
    <h2 style="font-size: 16px; margin: 22px 0 6px;">3 ways to use it tomorrow</h2>
    <ol style="font-size: 14px; line-height: 1.55; color: #1A1A1A; padding-left: 18px;">
      <li>Print + hand out at the start of class as a warm-up.</li>
      <li>Project on the board, run it live as a class discussion.</li>
      <li>Drop it in as homework — answer key included on the last page.</li>
    </ol>
    <p style="font-size: 14px; line-height: 1.55; color: #475569;">
      Want this as a live game with leaderboards instead? You can set up a free
      classroom in under two minutes — no card required.
    </p>
    <p style="margin: 22px 0;">
      <a href="${p.ctaUrl}"
         style="display: inline-block; background: #2563EB; color: #FFFFFF;
                text-decoration: none; padding: 12px 18px; border-radius: 10px;
                font-weight: 700; font-size: 14px;">
        Try Quest free to unlock more features
      </a>
    </p>
    <p style="font-size: 14px; line-height: 1.55; color: #1A1A1A; margin-top: 28px;">
      <strong>Got feedback?</strong> Just hit reply &mdash; I read every email
      personally and use it to improve the tool.
    </p>
    <p style="font-size: 13px; color: #64748B; margin-top: 8px;">
      &mdash; Adam, Quest Learning
    </p>
    <p style="font-size: 12px; color: #94A3B8; margin-top: 28px;">
      You're receiving this because you generated a free handout at questlearning.co.
      Unsubscribe in one click any time.
    </p>
  </div>`;
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Rate limit by IP. This endpoint is public + accepts an email + ~1 MB PDF.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 20, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  let rawBody: Record<string, unknown>;
  try {
    rawBody = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Split: strict-validate the scalar fields, then accept quizPayload as raw
  // JSON since it's a flexible blob stored verbatim in jsonb.
  const { quizPayload, ...rest } = rawBody as Record<string, unknown>;
  const { ok, value, errors } = validate(rest, {
    email:      { type: 'email', required: true, maxLength: 254 },
    firstName:  { type: 'string', required: false, maxLength: 80 },
    videoUrl:   { type: 'string', required: false, maxLength: 500 },
    videoTitle: { type: 'string', required: false, maxLength: 300 },
    gradeLevel: { type: 'string', required: false, maxLength: 40 },
    subject:    { type: 'string', required: false, maxLength: 80 },
    pdfBase64:  { type: 'string', required: true, maxLength: 8_000_000 },
    filename:   { type: 'string', required: false, maxLength: 200 },
  });
  if (!ok) return json({ error: 'Invalid request', details: errors }, 400);

  const admin = adminClient();

  // Upsert by email so repeat visitors increment generations instead of
  // collecting a fresh row each time.
  const { data: existing } = await admin
    .from('leads')
    .select('id, generations_used, first_name')
    .eq('email', value.email)
    .maybeSingle();

  let leadId: string;
  let isFirstGeneration = false;
  let newGenerationCount = 1;

  if (existing) {
    leadId = existing.id;
    newGenerationCount = (existing.generations_used || 0) + 1;
    isFirstGeneration = (existing.generations_used || 0) === 0;
    await admin
      .from('leads')
      .update({
        generations_used: newGenerationCount,
        video_url: value.videoUrl || null,
        video_title: value.videoTitle || null,
        grade_level: value.gradeLevel || null,
        subject: value.subject || null,
        first_name: existing.first_name || value.firstName || null,
        generated_quiz_payload: quizPayload ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);
  } else {
    const { data: lead, error: insertErr } = await admin
      .from('leads')
      .insert({
        email: value.email,
        first_name: value.firstName || null,
        source: 'youtube_funnel',
        video_url: value.videoUrl || null,
        video_title: value.videoTitle || null,
        grade_level: value.gradeLevel || null,
        subject: value.subject || null,
        generated_quiz_payload: quizPayload ?? null,
        generations_used: 1,
        sequence_phase: 'phase_1',
        email_sequence_status: 'pending',
        user_agent: req.headers.get('user-agent')?.slice(0, 300) || null,
      })
      .select('id')
      .single();
    if (insertErr || !lead) {
      console.error('[captureLead] insert failed:', insertErr);
      return json({ error: 'Could not save lead' }, 500);
    }
    leadId = lead.id;
    isFirstGeneration = true;
  }

  // Still send the Day-0 email with the PDF attached, since A1 doesn't
  // include the attachment. A1 fires through the event-trigger pipeline as
  // a follow-up. This preserves the value-delivery moment.
  try {
    await sendEmail({
      to: value.email,
      subject: `Your quiz + 3 ways to use it tomorrow`,
      html: dayZeroHtml({
        videoTitle: value.videoTitle || 'your YouTube video',
        ctaUrl: `${HOST}/SignIn?mode=signup&source=leadmagnet&lead_id=${leadId}`,
      }),
      attachments: [
        {
          filename: value.filename || `Quest-Quiz-${new Date().toISOString().slice(0, 10)}.pdf`,
          content: value.pdfBase64,
          contentType: 'application/pdf',
        },
      ],
    });

    await admin
      .from('leads')
      .update({
        email_sequence_status: 'day_0_sent',
        last_email_sent_at: new Date().toISOString(),
      })
      .eq('id', leadId);
  } catch (err) {
    console.error('[captureLead] PDF email send failed:', err);
  }

  // Fire lifecycle event. Decides the rest of the sequence — A1 confirmation,
  // A2 24h check-in, B/C/D/E1 on repeat generation, E2/E3/E4 schedule, etc.
  if (isFirstGeneration) {
    await fireEvent(value.email, 'first_generation_complete', {
      firstName: value.firstName,
      videoTitle: value.videoTitle,
    });
  } else {
    await fireEvent(value.email, 'generation_count', {
      count: newGenerationCount,
      videoTitle: value.videoTitle,
    });
  }

  return json({ ok: true, leadId, generations_used: newGenerationCount });
});
