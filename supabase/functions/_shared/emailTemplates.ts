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
    <p>You're on generation #4 &mdash; one more on the free plan.</p>
    <p><strong>When you want #6, two options:</strong></p>
    <ul style="padding-left:18px;line-height:1.7;">
      <li><strong>Wait</strong> &mdash; your free generations don't reset
        (they're lifetime, not monthly).</li>
      <li><strong>Start a trial</strong> &mdash; 14 days of unlimited generations
        + your students can take quizzes online. No card. Cancel any time.</li>
    </ul>
    <p>All 4 quizzes you've generated so far automatically transfer to your
       account when you sign up. Nothing lost.</p>
    ${cta('Start trial', ctx.ctaUrl)}
    <p style="font-size:13px;color:#475569;">Either is fine.</p>`,
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
    <p>Noticed you haven't opened your starter class yet &mdash; probably
       because life happens.</p>
    <p><strong>If you want, reply with:</strong></p>
    <ul style="padding-left:18px;line-height:1.7;">
      <li>Your class name</li>
      <li>The subject you teach</li>
      <li>Your school name (or "homeschool")</li>
    </ul>
    <p>I'll set up the class, link your imported quizzes, generate a join
       code, and send everything back in a single Loom video. Takes me
       5 minutes.</p>
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
    <p><strong>Single most important next step: get one student to join.</strong>
       Even one. Doesn't matter if it's your own kid, a TA, or a student you
       trust to test things.</p>
    <p>Why: the moment you see Quest grade a student's quiz, you understand
       the value in your bones. Until then it's theoretical.</p>
    <p>Your join code is in your class settings.</p>
    ${cta('Open my class', ctx.ctaUrl)}
    <p><strong>Once you have a student enrolled, two features to turn on:</strong></p>
    <ol style="padding-left:18px;line-height:1.7;">
      <li><strong>AI Panda Tutor</strong> &mdash; every enrolled student can talk
        to an AI Socratic tutor that helps them think through concepts without
        giving direct answers.</li>
      <li><strong>Knowledge map</strong> &mdash; auto-builds as students complete
        work.</li>
    </ol>`,
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
    <p>Just saw a student in your class complete their first quiz on Quest.
       <strong>That's the moment most teachers go "oh &mdash; this actually
       works."</strong></p>
    <p><strong>Two things to check right now:</strong></p>
    <ol style="padding-left:18px;line-height:1.7;">
      <li><strong>Per-student analytics</strong> &mdash; already loading in your
        dashboard. See exactly which questions they got wrong and why.</li>
      <li><strong>Knowledge map for that student</strong> &mdash; shows what
        they've mastered vs. what they need to review.</li>
    </ol>
    ${cta('Open dashboard', ctx.ctaUrl)}
    <p>And &mdash; quick gut check &mdash; how was the experience for you and
       the student? Any friction? Any "wait, why does it do that?" moments?</p>
    <p>Genuinely asking. Replies shape what I build next.</p>`,
    ctx.unsubscribeUrl,
  ),
});

// -------------------- T4 — Day 5 (Panda Tutor push) --------------------
export const T4: Template = (ctx) => ({
  subject: '9 days left — turn on the Panda Tutor today',
  html: wrap(
    `
    <h1 style="font-size:22px;margin:0 0 14px;">Don't sleep on the Panda Tutor</h1>
    <p>${greet(ctx.firstName)}</p>
    <p>A third of your trial down.</p>
    <p>One thing 90% of teachers wait too long to try: <strong>the AI Panda
       Tutor.</strong></p>
    <p>Every enrolled student gets their own AI tutor that walks them through
       concepts via Socratic dialogue &mdash; never giving direct answers,
       always asking the question that gets them to figure it out.</p>
    <p>It's the thing that differentiates Quest from MagicSchool, SchoolAI,
       and the other AI quiz tools. They generate content. Quest teaches.</p>
    ${cta('Turn on Panda Tutor', ctx.ctaUrl)}`,
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
    <p><strong>If you upgrade today:</strong></p>
    <ul style="padding-left:18px;line-height:1.7;">
      <li>All your classes, students, and generated content stay live</li>
      <li>Founding member price locked in ($29/mo &mdash; will go to $49 once
        we're out of founding cohort)</li>
      <li>Nothing breaks for your students mid-week</li>
    </ul>
    <p><strong>If you don't:</strong></p>
    <ul style="padding-left:18px;line-height:1.7;">
      <li>Account pauses (everything preserved for 12 months &mdash; nothing
        is deleted)</li>
      <li>Students see "Quest is being upgraded" when they log in</li>
      <li>You can resume any time</li>
    </ul>
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
    <p>You're in. Your account is live, your founding member price is locked
       in for life.</p>
    <p><strong>Your first 30 minutes (5 quick wins):</strong></p>
    <ol style="padding-left:18px;line-height:1.8;">
      <li>Open your dashboard and check that all trial classes carried over</li>
      <li>Turn on the AI Panda Tutor in your class settings</li>
      <li>Generate a new quiz from a YouTube video your students already
        watched (zero ramp-up)</li>
      <li>Share the join code with your students</li>
      <li>Watch the analytics fill in as students complete the first quiz</li>
    </ol>
    ${cta('Open my dashboard', ctx.ctaUrl)}
    <p>Anything confusing in the first few days? Hit reply &mdash; I'd
       rather you ping me than wonder.</p>`,
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
    <p>You've been on Quest for a week. Quick founder check-in &mdash; how
       has it actually fit into your routine?</p>
    <p>Three things I always want to know from new paid users:</p>
    <ol style="padding-left:18px;line-height:1.7;">
      <li>What's the first thing that surprised you (good or bad)?</li>
      <li>What's one feature you wish existed?</li>
      <li>Anything broken or confusing?</li>
    </ol>
    <p>Hit reply with even one-line answers. I read every reply and your
       feedback directly shapes the next two weeks of work.</p>`,
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
    <p>Reasonable rough math: that's somewhere between 8 and 20 hours of
       grading + prep that the platform handled instead of you.</p>
    ${cta('Open my dashboard', ctx.ctaUrl)}
    <p>If you want a 15-minute call to talk about scaling this to more
       classes, hit reply.</p>`,
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
