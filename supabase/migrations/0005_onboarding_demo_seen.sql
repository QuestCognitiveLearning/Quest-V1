-- 0005_onboarding_demo_seen.sql
--
-- Server-side "first-time demo seen" flag for the Navattic onboarding
-- overlay shown on /KnowledgeMap (students) and /TeacherDashboard (teachers).
--
-- Why this exists:
--   The original gate relied on a localStorage flag set when the user CLOSED
--   the demo. If the Navattic iframe errored mid-flow, or the user navigated
--   away before clicking Close, the flag never landed — so the demo popped
--   again on every visit until the 24h "brand new account" window expired.
--   A server-side flag is durable across browsers, devices, and localStorage
--   clears, and is set the instant the gate decides to fire the demo.
--
-- Backfilling existing rows:
--   The default is FALSE, but every user that existed before this migration
--   has presumably either already seen the demo or is past the 24h brand-new
--   window. We backfill `true` for any user older than 24h so they don't
--   suddenly get the demo on their next login.

alter table public.users
  add column if not exists onboarding_demo_seen boolean default false;

-- Mark every existing-and-not-brand-new user as "demo already seen". Safe
-- to run repeatedly: only flips false → true, never overwrites true.
update public.users
  set onboarding_demo_seen = true
  where onboarding_demo_seen = false
    and created_date < now() - interval '24 hours';
