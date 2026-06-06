// 8 Week-1 priority email templates for the lifecycle drip.
// Each function returns { subject, html }. Shared brand styling lives in
// `wrap()` so future template additions stay consistent.

export type TemplateContext = {
  firstName?: string | null;
  remainingGens?: number;
  generationsUsed?: number;
  ctaUrl: string;
  unsubscribeUrl: string;
  trialEndsAt?: string;
  classCount?: number;
  quizCount?: number;
  caseStudyCount?: number;
  studentCount?: number;
  gradingCount?: number;
  videoTitle?: string;
};

export type Template = (ctx: TemplateContext) => { subject: string; html: string };

const escape = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );

const greet = (firstName?: string | null): string =>
  firstName && firstName.trim() ? `Hi ${escape(firstName.trim())},` : 'Hey,';

const cta = (label: string, url: string): string => `
<p style="margin:24px 0;">
  <a href="${url}"
     style="display:inline-block;background:#2563EB;color:#FFFFFF;
            text-decoration:none;padding:12px 20px;border-radius:10px;
            font-weight:700;font-size:14px;">${escape(label)}</a>
</p>`;

const sig = `
<p style="font-size:14px;line-height:1.55;color:#1A1A1A;margin-top:28px;">
  <strong>Got feedback?</strong> Just hit reply &mdash; I read every email
  personally and use it to shape what I build next.
</p>
<p style="font-size:13px;color:#475569;margin-top:6px;">&mdash; Adam, Quest Learning</p>`;

const wrap = (innerHtml: string, unsubscribeUrl: string): string => `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;
            max-width:560px;margin:0 auto;color:#1A1A1A;line-height:1.55;">
  ${innerHtml}
  ${sig}
  <p style="font-size:12px;color:#94A3B8;margin-top:28px;border-top:1px solid #E2E8F0;padding-top:14px;">
    You're receiving this because you generated a free handout at questlearning.co.
    <a href="${unsubscribeUrl}" style="color:#94A3B8;">Unsubscribe in one click.</a>
  </p>
</div>`;

// A1 — PDF Delivery (immediate after gen #1).
// Note: the original Day-0 mail in captureLead/index.ts attaches the PDF
// directly; A1 here is the follow-up version used by event triggers. If you
// also want A1 to attach a PDF, render PDF base64 client-side and pass it as
// the attachment when calling sendSequenceEmail.
export const A1: Template = (ctx) => ({
  subject: 'Your quiz is ready (plus 4 more on the house)',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Your quiz is ready</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Here's your AI-generated quiz packet${ctx.videoTitle ? ` for <strong>${escape(ctx.videoTitle)}</strong>` : ''}.
      PDF attached, with the Word doc downloadable from your account.</p>
    <h2 style="font-size:16px;margin:22px 0 6px;">Three ways teachers use this</h2>
    <ol style="padding-left:18px;">
      <li>Print and hand out as a worksheet (5 min)</li>
      <li>Project on your screen for whole-class review (no prep)</li>
      <li>Assign it to your students online &mdash; auto-graded, full
          analytics, students take it on phones or laptops</li>
    </ol>
    <p>Option 3 needs a free Quest account. When you sign up, this quiz and
       any others you generate will be saved to your account &mdash; ready
       to assign to a class.</p>
    ${cta('Save my quizzes + start free trial', ctx.ctaUrl)}
    <p style="font-size:13px;color:#475569;">You have ${ctx.remainingGens ?? 4}
       free PDF generations left at <a href="https://www.questlearning.co/try">questlearning.co/try</a>
       &mdash; use them whenever.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// B — After Generation #2
export const B: Template = (ctx) => ({
  subject: 'The part most teachers miss about Quest',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">The part most teachers miss about Quest</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Glad you came back. Most teachers use Quest just for printable PDFs &mdash;
       but the real time-saver is letting students take the same quizzes online:</p>
    <ul style="padding-left:18px;">
      <li><strong>Auto-grading</strong> &mdash; no more marking 30 papers</li>
      <li><strong>Per-student analytics</strong> &mdash; see exactly which questions
          tripped them up, which kids need help</li>
      <li><strong>Topic mastery tracking</strong> &mdash; Quest builds a knowledge
          map of what each student actually knows</li>
    </ul>
    <p>Same quizzes you're already generating. Just digital, with the grading
       done for you.</p>
    <p>14-day free trial. No card. Your generated quizzes save to your account.</p>
    ${cta('Start trial', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// C — After Generation #3
export const C: Template = (ctx) => ({
  subject: "You've saved about 3 hours so far",
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">You've saved about 3 hours so far</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Quick math &mdash; 3 quiz packets in your account.</p>
    <p>Each one would've taken about an hour to build from scratch
       (write questions, find answers, format, build case study, write rubric).
       You just got 3 hours back.</p>
    <p><strong>What if you didn't have to do it ever again?</strong></p>
    <p>14-day trial &mdash; unlimited PDF generations plus everything else Quest
       does for your class.</p>
    ${cta('Start trial — no card', ctx.ctaUrl)}
    <p style="font-size:13px;color:#475569;">${ctx.remainingGens ?? 2} free PDFs left.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// E1 — Wall Hit (immediate after gen #5)
export const E1: Template = (ctx) => ({
  subject: 'That was your 5th — want unlimited?',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">That was your 5th &mdash; want unlimited?</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>5 quiz packets in your account. You clearly got value from this.</p>
    <p><strong>Here's what's on the other side of the trial wall:</strong></p>
    <ul style="padding-left:18px;line-height:1.7;">
      <li>Unlimited quiz, case study, attention check, and inquiry session generation</li>
      <li>Real classrooms with unlimited students each</li>
      <li>Students take quizzes online &mdash; auto-graded, with per-student analytics</li>
      <li>AI Panda Tutor working 1-on-1 with every student</li>
      <li>Standards alignment (NGSS, Common Core, AP, state)</li>
      <li>Auto-curriculum from any state standard</li>
    </ul>
    <p>All 5 quizzes you've already generated transfer to your account
       automatically. Nothing lost.</p>
    <p><strong>14 days. No card. Cancel any time.</strong> Most teachers know within
       3 days whether Quest is for them.</p>
    ${cta('Start your free trial', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// E4 — Wall + 7d, final close (permission-based exit)
export const E4: Template = (ctx) => ({
  subject: 'Last note from me',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Last note from me</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>You tried Quest, got 5 free quizzes, didn't continue. That's totally
       fine &mdash; I'm not going to keep pestering you.</p>
    <p><strong>Two things before I go quiet:</strong></p>
    <ol style="padding-left:18px;">
      <li>The trial is still there if you change your mind:
        <a href="${ctx.ctaUrl}">questlearning.co/Pricing</a>
        (your 5 quizzes will still be waiting).</li>
      <li>You'll get one short note per quarter about big Quest updates &mdash;
        major features, new integrations. If you don't even want that,
        <a href="${ctx.unsubscribeUrl}">unsubscribe with one click</a>.</li>
    </ol>
    <p>Thanks for trying it out.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// T0 — Trial Welcome (immediate after trial_started)
export const T0: Template = (ctx) => ({
  subject: "Your trial is live — here's your 15-minute setup",
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Welcome to your 14-day trial</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Your trial is active. Two things to know:</p>
    <p><strong>Your generated quizzes are already in your account.</strong>
       Anything you made through the public tool has been imported. They're
       ready to assign.</p>
    <h2 style="font-size:16px;margin:22px 0 6px;">Fastest path to value (3 steps, ~15 min)</h2>
    <ol style="padding-left:18px;">
      <li>Open your dashboard</li>
      <li>Create your first class and grab the join code</li>
      <li>Assign one of your imported quizzes &mdash; students take it online,
          Quest grades it</li>
    </ol>
    ${cta('Open my dashboard', ctx.ctaUrl)}
    <p>Stuck? Reply to this email &mdash; I personally help every trialer set up
       in the first 24 hours.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// T7 — Trial Expired, No Convert
export const T7: Template = (ctx) => ({
  subject: 'Your trial just wrapped',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Your trial just wrapped</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Your 14-day trial ended a few hours ago. Your account is paused but
       everything's preserved &mdash; classes, students, generated content,
       the whole setup. <strong>Nothing is deleted.</strong></p>
    <p>If you decide later, you can pick up exactly where you left off:</p>
    ${cta('Resume my account', ctx.ctaUrl)}
    <p>If something didn't click during the trial, I'd love to know what.
       Hit reply.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// P1 — Day +3 after trial end (honest-question feedback ask)
export const P1: Template = (ctx) => ({
  subject: 'Honest question',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Honest question</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Real founder asking real question &mdash; why didn't Quest stick during
       your trial?</p>
    <p><strong>Most common reasons teachers tell me:</strong></p>
    <ol style="padding-left:18px;line-height:1.8;">
      <li>Too busy to set it up properly during trial weeks</li>
      <li>Wanted features that aren't built yet</li>
      <li>Wasn't sure if students would actually use it</li>
      <li>Price wasn't right</li>
      <li>Just forgot</li>
    </ol>
    <p>Hit reply with a number, or write what's actually going on. It takes
       you 30 seconds and directly affects what I build next.</p>
    <p style="font-size:13px;color:#475569;">PS &mdash; if it was reason #1,
       just ask and I'll restart your trial. No catch.</p>`,
    ctx.unsubscribeUrl,
  ),
});

export const TEMPLATES: Record<string, Template> = {
  A1, B, C, E1, E4, T0, T7, P1,
};
