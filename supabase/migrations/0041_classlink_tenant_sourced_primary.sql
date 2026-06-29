-- ClassLink SSO: switch the primary authentication identifier to ClassLink's
-- recommended GUID — (TenantId + SourcedId) — re-adding the columns dropped in
-- 0037. Match precedence in the classlinkSso edge function becomes:
--   1. (classlink_tenant_id + classlink_sourced_id)   ← recommended GUID
--   2. (classlink_tenant_id + classlink_login_id)      ← LoginId is unique only within a tenant
--   3. classlink_login_id                              ← legacy rows provisioned before tenant was stored
--   4. email                                           ← final fallback
-- The plain classlink_login_id index from 0037 is kept for step 3.

alter table public.users
  add column if not exists classlink_tenant_id varchar,
  add column if not exists classlink_sourced_id varchar;

create index if not exists users_classlink_tenant_sourced_idx
  on public.users (classlink_tenant_id, classlink_sourced_id);

create index if not exists users_classlink_tenant_login_idx
  on public.users (classlink_tenant_id, classlink_login_id);
