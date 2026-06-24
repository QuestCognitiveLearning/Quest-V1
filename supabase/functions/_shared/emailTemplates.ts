// 8 Week-1 priority email templates for the lifecycle drip.
// Each function returns { subject, html }. Shared brand styling lives in
// `wrap()` so future template additions stay consistent.

import { signOff, keepUsingQuestHtml } from './email.ts';

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

// Built per-email so the founder sign-off alternates (Adam / Samuel).
const sig = (): string => `
<p style="font-size:14px;line-height:1.55;color:#1A1A1A;margin-top:28px;">
  <strong>Got feedback?</strong> Just hit reply &mdash; I read every email
  personally and use it to shape what I build next.
</p>
<p style="font-size:13px;color:#475569;margin-top:6px;">&mdash; ${signOff()}</p>`;

const wrap = (innerHtml: string, unsubscribeUrl: string): string => `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;
            max-width:560px;margin:0 auto;color:#1A1A1A;line-height:1.55;">
  ${innerHtml}
  ${keepUsingQuestHtml()}
  ${sig()}
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
  subject: 'Your quiz is ready (plus 4 more free)',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Your quiz is ready</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Your quiz packet${ctx.videoTitle ? ` for <strong>${escape(ctx.videoTitle)}</strong>` : ''}
       is attached as a PDF (Word version is in your account).</p>
    <p>Print it, project it, or assign it online &mdash; Quest auto-grades and
       shows you each student's results. Assigning online needs a free account.</p>
    ${cta('Save my quizzes + start free trial', ctx.ctaUrl)}
    <p style="font-size:13px;color:#475569;">${ctx.remainingGens ?? 4} free
       generations left at <a href="https://www.questlearning.co/try">questlearning.co/try</a>.</p>`,
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
    <p>Most teachers stop at the printable PDF. The real time-saver is assigning
       the same quiz online: Quest auto-grades it, shows you which questions
       tripped each student up, and builds a knowledge map of what they know.</p>
    <p>Same quizzes you're already making &mdash; just graded for you.
       14-day trial, no card.</p>
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
    <p>3 quiz packets in your account &mdash; roughly 3 hours you didn't spend
       building them from scratch.</p>
    <p>Want unlimited generations plus online auto-graded quizzes for your class?
       14-day trial, no card.</p>
    ${cta('Start trial — no card', ctx.ctaUrl)}
    <p style="font-size:13px;color:#475569;">${ctx.remainingGens ?? 2} free generations left.</p>`,
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
    <p>5 quiz packets in. Here's what the trial unlocks:</p>
    <ul style="padding-left:18px;line-height:1.7;">
      <li>Unlimited quizzes, case studies, attention checks &amp; inquiry sessions</li>
      <li>Online quizzes &mdash; auto-graded, with per-student analytics</li>
      <li>An AI Panda Tutor for every enrolled student</li>
      <li>Curriculum builder aligned to NGSS, Common Core, AP &amp; state standards</li>
    </ul>
    <p>Your 5 quizzes carry over automatically. 14 days, no card, cancel anytime.</p>
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
    <p>You got your 5 free quizzes and didn't continue &mdash; totally fine, no
       more nudging.</p>
    <p>The <a href="${ctx.ctaUrl}">trial</a> is there if you change your mind
       (your quizzes are still saved). Otherwise I'll send one short update per
       quarter &mdash; <a href="${ctx.unsubscribeUrl}">unsubscribe anytime</a>.</p>
    <p>Thanks for trying it.</p>`,
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
    <p>Your trial's active and the quizzes you already generated are imported and
       ready to assign.</p>
    <p><strong>Fastest path (~15 min):</strong> open your dashboard → create a
       class and grab the join code → assign a quiz. Students take it online and
       Quest grades it.</p>
    ${cta('Open my dashboard', ctx.ctaUrl)}`,
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
    <p>Your trial ended. Your account's paused but nothing's deleted &mdash;
       classes, students, and content are all preserved.</p>
    <p>Pick up where you left off whenever you're ready:</p>
    ${cta('Resume my account', ctx.ctaUrl)}`,
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
    <p>Why didn't Quest stick? Usually it's one of: too busy to set up, missing
       a feature, unsure students would use it, price, or just forgot.</p>
    <p>Reply with which one (or what's really going on) &mdash; it directly
       shapes what I build next.</p>
    <p style="font-size:13px;color:#475569;">PS &mdash; if it was "too busy,"
       just ask and I'll restart your trial.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- A2 — 24h check-in (no gen #2) --------------------
export const A2: Template = (ctx) => ({
  subject: 'Did that quiz work for your class?',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Did that quiz work?</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Quick check &mdash; did the quiz I sent yesterday work for you?
       Anything weird, confusing, or missing?</p>
    <p>If yes, you've got 4 more free generations whenever you need them:</p>
    ${cta('Generate another quiz', ctx.ctaUrl.replace('/SignIn?mode=signup&source=leadmagnet&intent=trial', '/try'))}
    <p>If not, hit reply and tell me what went wrong. Takes you 30 seconds
       and directly shapes what I fix next.</p>
    <p style="font-size:13px;color:#475569;">PS &mdash; when you're ready for
       students to take quizzes online instead of on paper (auto-graded, no
       marking), that's what the trial unlocks.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- D — after gen #4 --------------------
export const D: Template = (ctx) => ({
  subject: 'Heads up — one free PDF left',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">One free PDF left</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>You're on generation #4 &mdash; one left (free generations are lifetime,
       not monthly, so no rush).</p>
    <p>Or start a trial for unlimited generations + online auto-graded quizzes.
       No card, and your quizzes carry over.</p>
    ${cta('Start trial', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- E2 — wall + 24h --------------------
export const E2: Template = (ctx) => ({
  subject: 'Still need that 6th quiz?',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Still need that 6th quiz?</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>If you're hesitating, two quick facts:</p>
    <ol style="padding-left:18px;line-height:1.7;">
      <li>The trial is genuinely free. No card. I'm not collecting anything at
        signup beyond what you already gave me.</li>
      <li>Your 5 generated quizzes carry over to your account automatically.</li>
    </ol>
    ${cta('Start trial', ctx.ctaUrl)}
    <p>If now's not the right time, ignore this. The free 5 stay yours forever.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- E3 — wall + 72h (social proof) --------------------
export const E3: Template = (ctx) => ({
  subject: 'How teachers run Quest with their whole class',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Quick story</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Teachers running Quest tell me the same thing &mdash; they used to spend
       12+ hours every Sunday writing quizzes, case studies, and discussion
       prompts. Now it takes about 90 minutes, and their students take the
       quizzes online instead of on paper, so they stopped grading.</p>
    <p>The trial gives you exactly that setup.</p>
    ${cta('Start trial', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- T1 — Day 1 activation (no class yet) --------------------
export const T1: Template = (ctx) => ({
  subject: "Don't make me do this for you (I will)",
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Need a hand getting set up?</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>You haven't opened your starter class yet. Want me to do it? Reply with
       your class name and subject, and I'll set it up, link your imported
       quizzes, and send back a join code.</p>
    ${cta('Or DIY — open my dashboard', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- T2 — first class created --------------------
export const T2: Template = (ctx) => ({
  subject: 'Class is live — now get one student in',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Class is live</h1>
    <p>${greet(ctx.firstName)}</p>
    <p><strong>Next step: get one student to join</strong> &mdash; even your own
       kid or a TA. The moment you watch Quest grade their quiz, it clicks. The
       join code's in your class settings.</p>
    <p>Once a student's enrolled, it just works: every student automatically gets
       the AI Panda Tutor (a Socratic tutor that guides with questions, not
       answers) and a knowledge map that fills in as they go &mdash; nothing to
       switch on.</p>
    ${cta('Open my class', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- T3 — first student quiz submission --------------------
export const T3: Template = (ctx) => ({
  subject: 'Your first student just finished a Quest quiz',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">A student just finished a quiz</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>A student in your class just finished their first quiz. Two things to look
       at in your dashboard: their <strong>per-student analytics</strong> (which
       questions they missed) and their <strong>knowledge map</strong> (mastered
       vs. needs review).</p>
    ${cta('Open dashboard', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- T4 — Day 5 (Panda Tutor push) --------------------
export const T4: Template = (ctx) => ({
  subject: '9 days left — have your students meet Panda',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Don't sleep on the Panda Tutor</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>A third of your trial's gone. The feature teachers try too late: the
       <strong>AI Panda Tutor.</strong></p>
    <p>Every enrolled student already has it &mdash; a Socratic tutor that guides
       them with questions instead of answers. It's what sets Quest apart from
       the AI quiz tools: they generate content, Quest teaches.</p>
    <p>Have a student log in and start a session to see it.</p>
    ${cta('Open my dashboard', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- T5 — Day 10 mid-trial conversion --------------------
export const T5: Template = (ctx) => ({
  subject: 'Your trial ends in 3 days',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Your trial ends in 3 days</h1>
    <p>${greet(ctx.firstName)}</p>
    <p><strong>Snapshot of your trial so far:</strong></p>
    <ul style="padding-left:18px;line-height:1.7;">
      <li>Classes created: ${ctx.classCount ?? '—'}</li>
      <li>Quizzes generated: ${ctx.quizCount ?? '—'}</li>
      <li>Case studies generated: ${ctx.caseStudyCount ?? '—'}</li>
      <li>Students enrolled: ${ctx.studentCount ?? '—'}</li>
      <li>Quizzes auto-graded by Quest: ${ctx.gradingCount ?? '—'}</li>
    </ul>
    <p>If Quest has earned a place in your week, upgrade before
       ${ctx.trialEndsAt ? escape(ctx.trialEndsAt) : 'your trial ends'} so
       nothing pauses:</p>
    <p><strong>Classroom &mdash; $29/month</strong> (founding member, locked
       in for life)<br />
       Or <strong>$250/year</strong> (save $98)</p>
    <p>Both include everything you've been using during the trial.</p>
    ${cta('Upgrade now', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- T6 — Day 13 (24h before) --------------------
export const T6: Template = (ctx) => ({
  subject: "Tomorrow's the day",
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Trial ends tomorrow</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Your trial ends tomorrow${ctx.trialEndsAt ? ` at ${escape(ctx.trialEndsAt)}` : ''}.</p>
    <p>Upgrade today and your classes, students, and content stay live at the
       locked-in $29/mo founding rate. Skip it and your account just pauses
       (everything's preserved &mdash; resume anytime).</p>
    ${cta('Upgrade — $29/mo', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- P2 — Day +10 post-trial (social proof) --------------------
export const P2: Template = (ctx) => ({
  subject: 'Teachers who saved 12 hours/week with Quest',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">12 hours a week, back</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Quick story &mdash; teachers running Quest at scale tell me the same
       thing: before, 12 hours of Sunday prep. After, 90 minutes &mdash;
       with auto-grading handling what used to take every weeknight.</p>
    <p>The setup they use is exactly what was waiting in your account during
       the trial.</p>
    ${cta('Restart my trial', ctx.ctaUrl)}
    <p>Or hit reply and I'll walk you through how it works in 15 minutes.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- P3 — Day +21 discount --------------------
export const P3: Template = (ctx) => ({
  subject: '50% off for teachers who tried Quest',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">50% off your first 3 months</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Special offer for teachers who tried Quest but didn't continue:</p>
    <p><strong>First 3 months at 50% off &mdash; $14.50/month instead of
       $29.</strong></p>
    <p>Locked-in founding member pricing ($29/mo) kicks in after.</p>
    ${cta('Claim 50% off', `${ctx.ctaUrl}&promo=COMEBACK50`)}
    <p style="font-size:13px;color:#475569;">Expires in 7 days.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- P4 — Day +45 final close --------------------
export const P4: Template = (ctx) => ({
  subject: 'Last note — staying in touch is optional',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Last note</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Sivers rule &mdash; I'd rather be honest than annoying.</p>
    <p>Moving you to the quarterly list (4 emails per year, only big stuff).
       If you'd rather hear nothing from Quest at all,
       <a href="${ctx.unsubscribeUrl}">unsubscribe with one click</a>.</p>
    <p>If you ever decide to give Quest another try, the door is open and your
       account is still there.</p>
    ${cta('Resume my account', ctx.ctaUrl)}
    <p>Thanks for giving it a real shot.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- Phase 4 (paid) --------------------
// W0 — paid welcome (immediate on subscription_created)
export const W0: Template = (ctx) => ({
  subject: "Welcome to Quest — here's your 5-step setup",
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Welcome to Quest</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>You're in, founding price locked in for life.</p>
    <p><strong>Your first 30 minutes:</strong></p>
    <ol style="padding-left:18px;line-height:1.8;">
      <li>Check your trial classes carried over</li>
      <li>Generate a quiz from a YouTube video your students already watched</li>
      <li>Share the join code and assign the quiz</li>
      <li>Watch the analytics and each student's knowledge map fill in</li>
    </ol>
    <p>The AI Panda Tutor is already on for every enrolled student &mdash;
       nothing to flip on.</p>
    ${cta('Open my dashboard', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// W1 — Week 1 check (scheduled +7d after subscription_created)
export const W1: Template = (ctx) => ({
  subject: "How's week 1 going?",
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Week 1 check-in</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>A week in &mdash; how's Quest fitting your routine? In one line each:
       what surprised you, what feature do you wish existed, and what's
       broken or confusing?</p>
    <p>Reply with even short answers &mdash; it shapes what I build next.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// W2 — Month 1 report (scheduled +30d after subscription_created)
export const W2: Template = (ctx) => ({
  subject: 'Your first month with Quest',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Your first month on Quest</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>30 days in. Here's what your dashboard logged:</p>
    <ul style="padding-left:18px;line-height:1.7;">
      <li>Classes active: ${ctx.classCount ?? '—'}</li>
      <li>Quizzes generated: ${ctx.quizCount ?? '—'}</li>
      <li>Case studies generated: ${ctx.caseStudyCount ?? '—'}</li>
      <li>Students enrolled: ${ctx.studentCount ?? '—'}</li>
      <li>Auto-graded submissions: ${ctx.gradingCount ?? '—'}</li>
    </ul>
    <p>Rough math: that's 8&ndash;20 hours of grading + prep the platform handled
       instead of you.</p>
    ${cta('Open my dashboard', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

// W3 — annual renewal heads-up (scheduled +335d after subscription_created
// when subscription is annual; cron handles last-mile gating)
export const W3: Template = (ctx) => ({
  subject: 'Heads up — your annual renews in 30 days',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Your renewal is coming up</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>Your annual Quest subscription renews in about 30 days. <strong>Founding
       member pricing stays locked in for the renewal &mdash; same rate you've
       been paying.</strong></p>
    <p>No action required. Just letting you know so it isn't a surprise on
       your statement.</p>
    <p>If you want to switch to monthly, change card on file, or cancel,
       all of that's in your billing portal:</p>
    ${cta('Manage billing', ctx.ctaUrl)}`,
    ctx.unsubscribeUrl,
  ),
});

export const TEMPLATES: Record<string, Template> = {
  A1, A2, B, C, D, E1, E2, E3, E4,
  T0, T1, T2, T3, T4, T5, T6, T7,
  P1, P2, P3, P4,
  W0, W1, W2, W3,
};
