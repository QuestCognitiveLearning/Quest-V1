// Email provider stub. Quest used Gmail OAuth via its connector — that flow
// is not available on Supabase. To actually send mail, set RESEND_API_KEY (or
// swap in another provider) and uncomment the real send path below.
// Until then, calls log to console and return success so downstream logic works.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM') || 'Quest Learning <noreply@questlearning.local>';

export async function sendEmail(
  { to, subject, html }: { to: string; subject: string; html: string },
): Promise<{ ok: true; stubbed?: boolean }> {
  if (!RESEND_API_KEY) {
    console.log(`[email stub] to=${to} subject="${subject}" (${html.length} chars)`);
    return { ok: true, stubbed: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
  return { ok: true };
}
