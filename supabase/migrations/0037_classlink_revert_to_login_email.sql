-- Revert 0036: certification was submitted with Email + LoginId as the SSO
-- authentication fields, so the implementation matches on classlink_login_id
-- then email. Drop the tenant/sourcedId columns + composite indexes added in
-- 0036 and keep a plain lookup index on classlink_login_id.
-- (Applied to prod 2026-06-15 via the Management API; recorded here for parity.)

drop index if exists users_classlink_tenant_login_idx;
drop index if exists users_classlink_tenant_sourced_idx;

alter table public.users
  drop column if exists classlink_tenant_id,
  drop column if exists classlink_sourced_id;

create index if not exists users_classlink_login_id_idx
  on public.users (classlink_login_id)
  where classlink_login_id is not null;
