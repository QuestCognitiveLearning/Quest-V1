// confirmBooking — finalize a public booking by creating a class + enrollment
// and sending parent + tutor confirmation emails.
//
// Called by the public /Book/:slug page after the bookings row is inserted.
// This is unauthenticated (visitors don't have accounts), so the function
// only writes through the service-role client when it has matched the
// booking_id to its tutor — no general write surface is exposed.
//
// Steps:
//   1. Load the bookings row by id; bail if it's already linked to a class.
//   2. Load the tutor's branding (for "from" in the email) and basic profile.
//   3. Create/find a stub student users row (account_type='student') for the
//      named student. Match by email if provided, otherwise always create.
//   4. Create a classes row (curriculum_id NULL, scheduled_for = booked_for,
//      scheduled_duration_minutes = duration_minutes).
//   5. Create a student_enrollments row tying the student to the class and
//      capturing parent contact.
//   6. Update the booking with class_id.
//   7. Send TWO emails via Resend:
//       - Parent: branded "you're booked" + .ics attachment + booking summary
//       - Tutor: "new booking" with student + parent details

import { handlePreflight, json, safeErrorResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const BOOKING_FROM_DOMAIN =
  Deno.env.get('BOOKING_FROM_DOMAIN') || 'questlearning.co';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Stricter IP limit since this is unauthenticated.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 20, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  let body: { booking_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req);
  }
  const bookingId = body?.booking_id;
  if (!bookingId) return json({ error: 'booking_id is required' }, 400, req);

  const db = adminClient();

  // 1) Load booking
  const { data: booking, error: bErr } = await db
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (bErr || !booking) return json({ error: 'Booking not found' }, 404, req);
  if (booking.status === 'cancelled') {
    return json({ error: 'Booking cancelled' }, 410, req);
  }

  // Idempotency — if a class already exists for this booking, just return it.
  if (booking.class_id) {
    return json(
      { ok: true, class_id: booking.class_id, already_processed: true },
      200,
      req,
    );
  }

  // 2) Load tutor + branding
  const [{ data: tutor }, { data: branding }] = await Promise.all([
    db.from('users').select('id, email, full_name').eq('id', booking.tutor_id).maybeSingle(),
    db.from('branding').select('*').eq('user_id', booking.tutor_id).maybeSingle(),
  ]);
  if (!tutor) return json({ error: 'Tutor not found' }, 404, req);

  // 3) Stub student row. Match by parent_email so repeated bookings for the
  //    same family don't multiply stub accounts; otherwise create new.
  let studentId: string | null = null;
  if (booking.parent_email) {
    const { data: existingStudent } = await db
      .from('users')
      .select('id')
      .eq('email', `booking-${booking.parent_email}`)
      .maybeSingle();
    if (existingStudent) studentId = existingStudent.id;
  }
  if (!studentId) {
    const fullName = [booking.student_first_name, booking.student_last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Student';
    const stubEmail = booking.parent_email
      ? `booking-${booking.parent_email}`
      : `booking-${bookingId}@stub.questlearning.co`;
    const { data: newStudent, error: sErr } = await db
      .from('users')
      .insert({
        full_name: fullName,
        email: stubEmail,
        account_type: 'student',
        role: 'user',
      })
      .select('id')
      .single();
    if (sErr || !newStudent) {
      return safeErrorResponse(sErr, 'Could not create student row.', 500, req);
    }
    studentId = newStudent.id;
  }

  // 4) Class
  const joinCode = randomCode(6);
  const className =
    `${booking.student_first_name || 'Student'} · ${new Date(booking.booked_for).toLocaleDateString()}`;
  const { data: klass, error: cErr } = await db
    .from('classes')
    .insert({
      teacher_id: booking.tutor_id,
      class_name: className,
      curriculum_id: null,
      join_code: joinCode,
      scheduled_for: booking.booked_for,
      scheduled_duration_minutes: booking.duration_minutes || 60,
    })
    .select('id')
    .single();
  if (cErr || !klass) {
    return safeErrorResponse(cErr, 'Could not create class.', 500, req);
  }

  // 5) Enrollment
  const fullName = [booking.student_first_name, booking.student_last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Student';
  await db.from('student_enrollments').insert({
    student_id: studentId,
    class_id: klass.id,
    student_full_name: fullName,
    parent_name: booking.parent_name,
    parent_email: booking.parent_email,
    parent_email_opted_in: true,
  });

  // 6) Link booking
  await db
    .from('bookings')
    .update({ class_id: klass.id })
    .eq('id', bookingId);

  // 7) Emails. We send via direct Resend calls because the "from" needs to be
  // per-tutor (tutor's business name) and the existing sendEmail helper hard-
  // codes a single FROM.
  const businessName = branding?.business_name || 'Quest Learning';
  const tutorName = branding?.tutor_name || tutor.full_name || 'your tutor';
  const accentColor = branding?.accent_color || '#2563EB';
  const replyTo = branding?.contact_email || tutor.email || undefined;
  const startDate = new Date(booking.booked_for);
  const endDate = new Date(
    startDate.getTime() + (booking.duration_minutes || 60) * 60000,
  );

  // Render the human-readable date in the tutor's local time zone, not the
  // Edge Function's UTC default. Without this, a 1pm ET booking renders as
  // "6:00 PM" in the email body (UTC) and breaks the parent's expectation
  // of seeing the same hour they clicked on the booking page.
  const { data: availRow } = await db
    .from('tutor_availability')
    .select('time_zone')
    .eq('tutor_id', booking.tutor_id)
    .limit(1)
    .maybeSingle();
  const tutorTz = availRow?.time_zone || 'America/New_York';
  const dateLine = formatInTz(startDate, tutorTz);

  const icsBody = buildIcs({
    uid: `${bookingId}@questlearning.co`,
    summary: `Tutoring session with ${tutorName}`,
    start: startDate,
    end: endDate,
    organizerName: tutorName,
    organizerEmail: replyTo,
  });
  const icsBase64 = btoa(icsBody);

  if (RESEND_API_KEY) {
    const parentHtml = renderParentHtml({
      studentFirstName: booking.student_first_name || 'your student',
      tutorName,
      businessName,
      accentColor,
      logoUrl: branding?.logo_url || null,
      dateLine,
      durationMin: booking.duration_minutes || 60,
      notes: booking.notes,
      website: branding?.website || null,
      contactEmail: branding?.contact_email || null,
    });
    const tutorHtml = renderTutorHtml({
      studentFirstName: booking.student_first_name || '—',
      studentLastName: booking.student_last_name || '',
      parentName: booking.parent_name,
      parentEmail: booking.parent_email,
      parentPhone: booking.parent_phone,
      dateLine,
      durationMin: booking.duration_minutes || 60,
      notes: booking.notes,
    });
    const parentSubject = `You're booked with ${tutorName} — ${dateLine}`;
    const tutorSubject = `New booking: ${booking.student_first_name || 'student'} on ${dateLine}`;
    const fromBranded = `${businessName} via Quest <bookings@${BOOKING_FROM_DOMAIN}>`;

    // Parent
    await sendResend({
      from: fromBranded,
      to: [booking.parent_email],
      reply_to: replyTo,
      subject: parentSubject,
      html: parentHtml,
      attachments: [
        {
          filename: 'tutoring-session.ics',
          content: icsBase64,
          content_type: 'text/calendar',
        },
      ],
    });
    // Tutor
    if (tutor.email) {
      await sendResend({
        from: `Quest Learning <bookings@${BOOKING_FROM_DOMAIN}>`,
        to: [tutor.email],
        subject: tutorSubject,
        html: tutorHtml,
      });
    }
  } else {
    console.log(
      `[booking stub] parent=${booking.parent_email} tutor=${tutor.email} for ${dateLine}`,
    );
  }

  return json(
    {
      ok: true,
      class_id: klass.id,
      stubbed: !RESEND_API_KEY || undefined,
    },
    200,
    req,
  );
});

async function sendResend(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  reply_to?: string;
  attachments?: { filename: string; content: string; content_type: string }[];
}): Promise<void> {
  if (!RESEND_API_KEY) return;
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    console.error(`Resend ${resp.status}:`, await resp.text());
  }
}

// Format a UTC instant in a specific IANA time zone for the email body.
// Example: formatInTz(new Date('2026-06-08T18:00:00Z'), 'America/New_York')
//   → "Mon, Jun 8, 2026 at 2:00 PM EDT"
function formatInTz(d: Date, timeZone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    const parts = fmt.formatToParts(d);
    const pick = (t: string) => parts.find((p) => p.type === t)?.value || '';
    const weekday = pick('weekday');
    const month = pick('month');
    const day = pick('day');
    const year = pick('year');
    const hour = pick('hour');
    const minute = pick('minute');
    const dayPeriod = pick('dayPeriod');
    const tzName = pick('timeZoneName');
    return `${weekday}, ${month} ${day}, ${year} at ${hour}:${minute} ${dayPeriod} ${tzName}`.trim();
  } catch {
    // Fall back to ISO if Intl rejects the time zone for any reason.
    return d.toISOString();
  }
}

function randomCode(n: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < n; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function icsDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}
function escIcs(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}
function buildIcs(args: {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  organizerName: string;
  organizerEmail?: string;
}): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quest Learning//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${args.uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(args.start)}`,
    `DTEND:${icsDate(args.end)}`,
    `SUMMARY:${escIcs(args.summary)}`,
    args.organizerEmail
      ? `ORGANIZER;CN=${escIcs(args.organizerName)}:mailto:${args.organizerEmail}`
      : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

function safe(s: unknown): string {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

function renderParentHtml(args: {
  studentFirstName: string;
  tutorName: string;
  businessName: string;
  accentColor: string;
  logoUrl: string | null;
  dateLine: string;
  durationMin: number;
  notes?: string | null;
  website?: string | null;
  contactEmail?: string | null;
}): string {
  const logoHtml = args.logoUrl
    ? `<img src="${safe(args.logoUrl)}" alt="${safe(args.businessName)}" width="48" height="48" style="border-radius:8px;display:block" />`
    : '';
  const footerBits = [args.contactEmail, args.website].filter(Boolean).map(safe);
  const notesHtml = args.notes
    ? `<p style="margin:14px 0 0;color:#475569;font-size:13px">Notes: ${safe(args.notes)}</p>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
  <tr><td style="padding:24px 28px;border-bottom:1px solid #e2e8f0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle">${logoHtml}</td>
      <td style="vertical-align:middle;padding-left:${args.logoUrl ? '12px' : '0'}">
        <div style="font-weight:700;font-size:16px;color:#0f172a">${safe(args.businessName)}</div>
        <div style="font-size:12px;color:#64748b">Booking confirmation</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 28px">
    <h1 style="margin:0 0 10px;font-size:20px;color:#0f172a">You're booked!</h1>
    <p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.6">
      ${safe(args.studentFirstName)}'s session with ${safe(args.tutorName)} is confirmed for
      <strong>${safe(args.dateLine)}</strong> (${safe(args.durationMin.toString())} min).
    </p>
    <p style="margin:0 0 10px;color:#334155;font-size:14px;line-height:1.6">
      The session is attached as a calendar invite so you can pop it onto your calendar.
    </p>
    ${notesHtml}
    <p style="margin:18px 0 0;color:#475569;font-size:13px">Reply to this email if you need to reschedule.</p>
  </td></tr>
  <tr><td style="padding:18px 28px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">
    <div style="margin-bottom:4px">${safe(args.tutorName)} · ${safe(args.businessName)}</div>
    ${footerBits.length ? `<div>${footerBits.join(' · ')}</div>` : ''}
    <div style="margin-top:10px;font-size:11px;color:#94a3b8">Sent by Quest Learning on behalf of your tutor.</div>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

function renderTutorHtml(args: {
  studentFirstName: string;
  studentLastName: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string | null;
  dateLine: string;
  durationMin: number;
  notes?: string | null;
}): string {
  const notesHtml = args.notes
    ? `<p style="margin:8px 0 0;color:#334155;font-size:14px"><strong>Notes:</strong> ${safe(args.notes)}</p>`
    : '';
  const phoneRow = args.parentPhone
    ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Phone</td><td style="padding:6px 0;color:#0f172a;font-size:13px">${safe(args.parentPhone)}</td></tr>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
  <tr><td style="padding:24px 28px">
    <h1 style="margin:0 0 4px;font-size:20px;color:#0f172a">New booking</h1>
    <p style="margin:0 0 18px;color:#475569;font-size:14px">
      ${safe(args.studentFirstName)} ${safe(args.studentLastName)} · ${safe(args.dateLine)} · ${safe(args.durationMin.toString())} min
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Parent</td><td style="padding:6px 0;color:#0f172a;font-size:13px">${safe(args.parentName)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Email</td><td style="padding:6px 0;color:#0f172a;font-size:13px">${safe(args.parentEmail)}</td></tr>
      ${phoneRow}
    </table>
    ${notesHtml}
    <p style="margin:18px 0 0;color:#475569;font-size:13px">A new session was created in your Classes view — you can prep it from there.</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}
