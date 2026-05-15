/**
 * @file   contactForm/index.ts
 * @desc   Public, unauthenticated contact form endpoint used by the landing
 *         page's "Bring Quest to your school" form.
 *
 *         Anonymous endpoint → tight per-IP rate limiting is the only thing
 *         standing between Resend's send quota and the open internet, so we
 *         keep the limits aggressive. A real user submits at most once per
 *         visit; bots loop forever.
 *
 *         Also validates input length & email shape, and rejects obvious spam
 *         heuristics (links in the message field, very short bodies).
 *
 * @author Quest Learning core team
 */

import { handlePreflight, json, safeErrorResponse } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import {
  clientIp,
  rateLimitByIp,
  tooManyRequestsResponse,
} from '../_shared/rateLimit.ts';

// Tunables
const MAX_NAME_LEN = 120;
const MAX_EMAIL_LEN = 200;
const MAX_MESSAGE_LEN = 4000;
const MIN_MESSAGE_LEN = 4;

// Where the form gets delivered. We send TO admin@questlearning.co (the inbox
// the landing page advertises as the contact address).
const CONTACT_TO = Deno.env.get('CONTACT_FORM_TO') || 'admin@questlearning.co';

// Cheap email-shape validation. We're not trying to RFC 5322 — we just want to
// reject obvious garbage (no @, no dot in domain). Resend will do the real
// validation on the recipient side.
function looksLikeEmail(s: string): boolean {
  if (typeof s !== 'string') return false;
  if (s.length < 5 || s.length > MAX_EMAIL_LEN) return false;
  const at = s.indexOf('@');
  const dot = s.lastIndexOf('.');
  return at > 0 && dot > at + 1 && dot < s.length - 1;
}

// Basic HTML-escape for embedding user-provided text into the HTML email body.
// We don't render this in a browser app — it goes to a mail client — but
// Resend stores the raw HTML, and mail clients DO render it. Better safe.
function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return ch;
    }
  });
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  // Aggressive IP rate limit since this endpoint is unauthenticated. Real users
  // submit at most once per page visit; anything higher is spam/abuse.
  //   * 3 / 5min — short-burst protection
  //   * 10 / 1hr — sustained-bot protection
  const ip = clientIp(req);
  const burst = rateLimitByIp(ip, { maxRequests: 3, windowMs: 5 * 60_000 });
  if (!burst.allowed) return tooManyRequestsResponse(burst);
  const sustained = rateLimitByIp(`${ip}:hour`, { maxRequests: 10, windowMs: 60 * 60_000 });
  if (!sustained.allowed) return tooManyRequestsResponse(sustained);

  let payload: { name?: string; email?: string; message?: string; honeypot?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req);
  }

  // Honeypot: a hidden form field bots tend to fill. Real users never see it.
  // If it has any value, silently "succeed" so the bot has nothing to learn.
  if (payload.honeypot && payload.honeypot.length > 0) {
    return json({ ok: true }, 200, req);
  }

  const name = (payload.name ?? '').toString().trim().slice(0, MAX_NAME_LEN);
  const email = (payload.email ?? '').toString().trim().slice(0, MAX_EMAIL_LEN);
  const message = (payload.message ?? '').toString().trim().slice(0, MAX_MESSAGE_LEN);

  if (!email || !looksLikeEmail(email)) {
    return json({ error: 'A valid email is required.' }, 400, req);
  }
  if (!message || message.length < MIN_MESSAGE_LEN) {
    return json({ error: 'Tell us a little about your school so we can reply.' }, 400, req);
  }

  // Very light spam heuristic: messages overwhelmingly composed of URLs are
  // almost always link spam. Reject if more than 3 URLs present.
  const urlCount = (message.match(/https?:\/\//gi) ?? []).length;
  if (urlCount > 3) {
    return json({ error: 'Message looks like spam. Please remove the URLs and try again.' }, 400, req);
  }

  // Compose the inbound notification email. The reply-to-style "Reply To" is
  // simulated by surfacing the user's email in both the subject and body, since
  // our sendEmail helper doesn't expose a reply_to field yet.
  const safeName = escapeHtml(name || '(no name)');
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

  const subject = `New contact: ${name || email} — Quest Learning`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; color: #0F172A;">
      <h2 style="color: #2563EB; margin: 0 0 16px;">New Quest Learning inquiry</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; width: 90px; color: #475569;">Name</td>
          <td style="padding: 8px 0;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #475569;">Email</td>
          <td style="padding: 8px 0;">
            <a href="mailto:${safeEmail}" style="color: #2563EB; text-decoration: none;">${safeEmail}</a>
          </td>
        </tr>
      </table>
      <div style="background: #F8FAFC; border-left: 3px solid #2563EB; padding: 16px 20px; border-radius: 8px;">
        <div style="font-size: 12px; font-weight: 600; color: #64748B; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 8px;">Message</div>
        <div style="font-size: 14px; line-height: 1.6; color: #0F172A;">${safeMessage}</div>
      </div>
      <p style="margin-top: 24px; font-size: 12px; color: #94A3B8;">
        Sent from the questlearning.co contact form.
        IP hint: ${escapeHtml(ip).slice(0, 64)}.
      </p>
    </div>
  `;

  try {
    await sendEmail({ to: CONTACT_TO, subject, html });
    return json({ ok: true, message: 'Thanks — we got it and will reply within a day.' }, 200, req);
  } catch (err) {
    return safeErrorResponse(err, "We couldn't send your message right now. Please try again in a minute.", 502, req);
  }
});
