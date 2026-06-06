-- Parallel role + tier columns alongside the existing users.role
-- (admin/user) and users.subscription_tier (free/premium). Old columns stay
-- in place so existing reads keep working; app code dual-writes during the
-- transition. See [[quest-learning-project]] for context.

alter table public.users
  add column if not exists new_role          text not null default 'teacher',
  add column if not exists tier              text not null default 'free',
  add column if not exists tier_started_at   timestamptz,
  add column if not exists founding_member   boolean default false;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_new_role_check'
  ) then
    alter table public.users
      add constraint users_new_role_check
        check (new_role in ('teacher','tutor','admin'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_tier_check'
  ) then
    alter table public.users
      add constraint users_tier_check
        check (tier in ('free','classroom','studio','enterprise'));
  end if;
end $$;

-- Backfill: existing paying users → 'classroom' tier, founding members.
-- We key off subscription_status because there is no stripe_subscriptions
-- table; subscription_id + premium/trial status is the source of truth.
update public.users
   set tier              = 'classroom',
       founding_member   = true,
       tier_started_at   = coalesce(tier_started_at, created_date)
 where tier = 'free'
   and subscription_status in ('trial','premium','grace_period');

-- Map account_type → new_role where it makes sense. Default is already
-- 'teacher'; only 'student' accounts deviate and they don't sign in here.
update public.users
   set new_role = 'teacher'
 where new_role is null and account_type = 'teacher';

create index if not exists users_tier_idx on public.users (tier);
create index if not exists users_new_role_idx on public.users (new_role);
