-- ClassLink SSO: store the ClassLink LoginId as a stable secondary identifier
-- so SSO can resolve a returning user even if their email changes. The
-- classlinkSso edge function matches on this first, then falls back to email.
-- (Applied to prod 2026-06-15 via the Management API; recorded here for parity.)

alter table public.users
  add column if not exists classlink_login_id varchar;

create unique index if not exists users_classlink_login_id_key
  on public.users (classlink_login_id)
  where classlink_login_id is not null;
