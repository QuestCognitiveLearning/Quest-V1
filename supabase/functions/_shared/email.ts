// Email provider via Resend. Set RESEND_API_KEY in the Edge Function env to
// send real mail; otherwise calls log to console and return success.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM') || 'Quest Learning <noreply@questlearning.co>';
const REPLY_TO = Deno.env.get('EMAIL_REPLY_TO');

// Human sign-off rotates between the two founders so platform email reads
// personal rather than automated. Random per send.
const SIGNERS = ['Adam', 'Samuel'];
export function signerName(): string {
  return SIGNERS[Math.floor(Math.random() * SIGNERS.length)];
}
// e.g. "Adam at Quest Learning" / "Samuel at Quest Learning"
export function signOff(): string {
  return `${signerName()} at Quest Learning`;
}
// Short re-engagement nudge appended to every platform email so each one
// prompts continued use of Quest.
export function keepUsingQuestHtml(
  url = 'https://www.questlearning.co',
): string {
  return `
<p style="font-size:13px;line-height:1.55;color:#475569;margin-top:18px;">
  Keep your momentum going &mdash;
  <a href="${url}" style="color:#2563EB;font-weight:600;">jump back into Quest</a>
  and keep learning today.
</p>`;
}

export type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

export async function sendEmail(
  {
    to,
    subject,
    html,
    cc,
    bcc,
    replyTo,
    attachments,
  }: {
    to: string | string[];
    subject: string;
    html: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    attachments?: EmailAttachment[];
  },
): Promise<{ ok: true; stubbed?: boolean; id?: string }> {
  if (!RESEND_API_KEY) {
    console.log(
      `[email stub] to=${Array.isArray(to) ? to.join(',') : to} subject="${subject}" (${html.length} chars, ${attachments?.length || 0} attachments)`,
    );
    return { ok: true, stubbed: true };
  }

  const body: Record<string, unknown> = {
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  };
  if (cc) body.cc = cc;
  if (bcc) body.bcc = bcc;
  if (replyTo || REPLY_TO) body.reply_to = replyTo || REPLY_TO;
  if (attachments && attachments.length > 0) {
    body.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      content_type: a.contentType,
    }));
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
  const json = await res.json().catch(() => ({}));
  return { ok: true, id: (json as { id?: string }).id };
}
