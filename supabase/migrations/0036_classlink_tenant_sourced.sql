-- ClassLink SSO: store TenantId + SourcedId so we can authenticate on
-- ClassLink's recommended identifier precedence — (tenant + sourcedId), then
-- (tenant + loginId), then email. LoginId is only unique WITHIN a tenant, so
-- the old global unique index on classlink_login_id is dropped in favour of
-- tenant-namespaced lookup indexes.
-- (Applied to prod 2026-06-15 via the Management API; recorded here for parity.)

alter table public.users
  add column if not exists classlink_tenant_id varchar,
  add column if not exists classlink_sourced_id varchar;

drop index if exists users_classlink_login_id_key;

create index if not exists users_classlink_tenant_login_idx
  on public.users (classlink_tenant_id, classlink_login_id);

create index if not exists users_classlink_tenant_sourced_idx
  on public.users (classlink_tenant_id, classlink_sourced_id);
