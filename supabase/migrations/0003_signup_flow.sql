-- 0003_signup_flow.sql — fix the new-teacher signup flow.
--
-- Two problems this fixes:
--   1) `users.subscription_status` defaulted to 'free'. That meant brand-new
--      teachers were created with subscription_status already set, so the
--      Pricing page's `isFirstTimeTeacher` check failed and the Layout's
--      free-teacher gate kicked them off /Pricing before they could choose
--      a plan. Default is now NULL until they explicitly pick.
--   2) There was no trigger creating a public.users row when a new
--      auth.users row was created. Existing rows came from the CSV import.
--      Fresh signups would either fail or get stuck in the
--      USER_NOT_FOUND retry loop. This trigger fixes that.

-- 1. Make subscription_status default to NULL.
alter table public.users alter column subscription_status drop default;

-- 2. Trigger that creates a public.users row on auth.users insert.
--    SECURITY DEFINER so it runs as the table owner (bypasses RLS).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    auth_user_id,
    email,
    full_name,
    created_date,
    updated_date
  ) values (
    gen_id(),
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    now(),
    now()
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
