-- 0051: allow 'student' in users.tier
--
-- The Student Pro plan maps Stripe subscriptions to tier = 'student'
-- (see supabase/functions/_shared/tier.ts), but the check constraint from
-- 0007 only allowed ('free','classroom','studio','enterprise'). Every sync
-- for a paying student failed with users_tier_check, leaving them on the
-- free 5-generation cap. Widen the constraint.

alter table public.users drop constraint if exists users_tier_check;
alter table public.users
  add constraint users_tier_check
    check (tier in ('free','student','classroom','studio','enterprise'));
