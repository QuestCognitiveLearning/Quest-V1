// sendParentReport — finalize a parent report by emailing the PDF.
//
// Two-phase flow:
//   1. Frontend invokes generateParentReport, gets back { report_id, ... }.
//   2. Frontend renders the PDF (React-PDF is client-only), uploads it to the
//      private `parent-reports/{tutor_id}/{report_id}.pdf` bucket, then calls
//      this function with { report_id }.
//
// What this does:
//   - Authenticates the caller and confirms they own the report.
//   - Loads the parent_reports row + branding + class enrollment.
//   - Downloads the PDF from the private bucket (service-role read).
//   - Sends the email via Resend with a per-request "from" matching the
//      tutor's business + a base64 PDF attachment.
//   - Updates parent_reports.sent_to / sent_at / email_message_id /
//      pdf_url (stores the storage path, not a signed URL).

import { handlePreflight, json, safeErrorResponse } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { adminClient } from '../_shared/client.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const QUEST_DOMAIN = Deno.env.get('PARENT_REPORT_FROM_DOMAIN') || 'questlearning.co';
const DEFAULT_FROM = `Quest Learning <reports@${QUEST_DOMAIN}>`;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401, req);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 20, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  let body: { report_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req);
  }
  const reportId = body?.report_id;
  if (!reportId) return json({ error: 'report_id is required' }, 400, req);

  const db = adminClient();

  const { data: report, error: rErr } = await db
    .from('parent_reports')
    .select('*')
    .eq('id', reportId)
    .maybeSingle();
  if (rErr || !report) return json({ error: 'Report not found' }, 404, req);
  if (report.tutor_id !== user.id) return json({ error: 'Forbidden' }, 403, req);

  // Pull supporting context — branding (for "from" + intro), enrollment (for
  // recipient emails), student (for subject line).
  const [{ data: branding }, { data: enrollments }, { data: studentRow }] =
    await Promise.all([
      db.from('branding').select('*').eq('user_id', user.id).maybeSingle(),
      db.from('student_enrollments').select('*').eq('class_id', report.class_id).limit(5),
      db.from('users').select('id, full_name').eq('id', report.student_id).maybeSingle(),
    ]);

  const enrollment = (enrollments || []).find(
    (e: { student_id: string }) => e.student_id === report.student_id,
  ) || (enrollments || [])[0];
  if (!enrollment) return json({ error: 'No matching enrollment' }, 400, req);

  const parentEmails = [enrollment.parent_email, enrollment.parent_email_secondary]
    .filter(Boolean);
  if (parentEmails.length === 0) {
    return json({ error: 'No parent email on file' }, 400, req);
  }

  const studentName =
    enrollment.student_full_name || studentRow?.full_name || 'your student';
  const tutorName = branding?.tutor_name || user.full_name || 'your tutor';
  const businessName = branding?.business_name || 'Quest Learning';
  const replyTo = branding?.contact_email || user.email || undefined;

  // PDF download from private storage
  const storagePath = `${user.id}/${reportId}.pdf`;
  const { data: pdfFile, error: dlErr } = await db.storage
    .from('parent-reports')
    .download(storagePath);
  if (dlErr || !pdfFile) {
    return json(
      { error: 'PDF not uploaded yet — upload to parent-reports/' + storagePath + ' first' },
      400,
      req,
    );
  }
  const pdfBuf = new Uint8Array(await pdfFile.arrayBuffer());
  const pdfBase64 = toBase64(pdfBuf);

  // Build the email
  const intro =
    branding?.custom_report_intro ||
    `Here's a quick recap of ${studentName}'s session with me. The attached report has the full picture — topics covered, strengths, what to keep practicing, and three questions to spark a conversation at home.`;

  const topics = Array.isArray(report.topics_covered) ? report.topics_covered : [];
  const accuracyPct = report.accuracy_summary?.accuracyPct;

  const html = renderEmailHtml({
    studentName,
    tutorName,
    businessName,
    accentColor: branding?.accent_color || '#2563EB',
    logoUrl: branding?.logo_url || null,
    intro,
    topics,
    accuracyPct,
    personalNote: report.tutor_personal_note,
    contactEmail: branding?.contact_email,
    contactPhone: branding?.contact_phone,
    website: branding?.website,
  });

  const subject = `${studentName}'s session report from ${tutorName}`;
  const from = `${businessName} via Quest <reports@${QUEST_DOMAIN}>`;
  const filename = `${slug(studentName)}-progress-report.pdf`;

  // Send (or stub if RESEND_API_KEY isn't set in this env)
  let messageId: string | null = null;
  if (!RESEND_API_KEY) {
    console.log(
      `[email stub] from=${from} to=${parentEmails.join(',')} subject="${subject}" pdf=${pdfBuf.byteLength}B`,
    );
  } else {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: parentEmails,
        cc: user.email ? [user.email] : undefined,
        reply_to: replyTo,
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdfBase64,
            content_type: 'application/pdf',
          },
        ],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return safeErrorResponse(
        new Error(`Resend ${resp.status}: ${txt}`),
        'Email send failed.',
        502,
        req,
      );
    }
    const j = await resp.json().catch(() => ({}));
    messageId = (j as { id?: string }).id || null;
  }

  const sentAt = new Date().toISOString();
  await db
    .from('parent_reports')
    .update({
      pdf_url: storagePath,
      sent_to: parentEmails,
      sent_at: sentAt,
      email_message_id: messageId,
    })
    .eq('id', reportId);

  return json({
    ok: true,
    report_id: reportId,
    sent_to: parentEmails,
    sent_at: sentAt,
    email_message_id: messageId,
    stubbed: !RESEND_API_KEY || undefined,
  }, 200, req);
});

function renderEmailHtml(args: {
  studentName: string;
  tutorName: string;
  businessName: string;
  accentColor: string;
  logoUrl: string | null;
  intro: string;
  topics: string[];
  accuracyPct?: number | null;
  personalNote?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
}): string {
  const {
    studentName, tutorName, businessName, accentColor, logoUrl,
    intro, topics, accuracyPct, personalNote,
    contactEmail, contactPhone, website,
  } = args;
  const safe = (s: string) =>
    String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const topicsHtml = topics.length
    ? `<ul style="padding-left:18px;margin:8px 0 18px;color:#334155;font-size:14px;line-height:1.6">${topics
        .map((t) => `<li>${safe(t)}</li>`)
        .join('')}</ul>`
    : '';
  const accuracyHtml =
    typeof accuracyPct === 'number'
      ? `<p style="margin:0 0 12px;color:#334155;font-size:14px"><strong>Accuracy this session:</strong> ${accuracyPct}%</p>`
      : '';
  const noteHtml = personalNote
    ? `<div style="border-left:3px solid ${safe(accentColor)};padding:8px 14px;margin:16px 0;background:#f8fafc;color:#1e293b;font-size:14px;line-height:1.6">${safe(personalNote)}</div>`
    : '';
  const logoHtml = logoUrl
    ? `<img src="${safe(logoUrl)}" alt="${safe(businessName)}" width="48" height="48" style="border-radius:8px;display:block" />`
    : '';
  const footerBits = [contactEmail, contactPhone, website].filter(Boolean).map((s) => safe(String(s)));
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc">
    <tr><td align="center" style="padding:32px 12px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e2e8f0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:middle">${logoHtml}</td>
            <td style="vertical-align:middle;padding-left:${logoUrl ? '12px' : '0'}">
              <div style="font-weight:700;font-size:16px;color:#0f172a">${safe(businessName)}</div>
              <div style="font-size:12px;color:#64748b">Progress report</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px 28px">
          <h1 style="margin:0 0 6px;font-size:20px;color:#0f172a">${safe(studentName)}'s session report</h1>
          <p style="margin:0 0 14px;color:#475569;font-size:14px">From ${safe(tutorName)}</p>
          <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6">${safe(intro)}</p>
          ${accuracyHtml}
          ${topics.length ? `<p style="margin:14px 0 4px;font-weight:600;color:#0f172a;font-size:14px">What we covered</p>${topicsHtml}` : ''}
          ${noteHtml}
          <p style="margin:18px 0 0;color:#475569;font-size:13px">The full PDF is attached.</p>
        </td></tr>
        <tr><td style="padding:18px 28px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">
          <div style="margin-bottom:4px">${safe(tutorName)} · ${safe(businessName)}</div>
          ${footerBits.length ? `<div>${footerBits.join(' · ')}</div>` : ''}
          <div style="margin-top:10px;font-size:11px;color:#94a3b8">Reports are generated by Quest Learning on behalf of your tutor.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function slug(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'student';
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}
