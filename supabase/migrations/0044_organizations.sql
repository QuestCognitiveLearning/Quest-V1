-- 0044_organizations.sql
-- Districts / schools as first-class entities, and users-in-many-orgs support.
--
-- Prior to this migration, Quest's only "org-like" concept was
-- users.classlink_tenant_id (a bare identifier used for SSO scoping). This
-- migration promotes districts and schools into real rows with a hierarchy
-- and lets a user belong to multiple orgs (teachers who teach at multiple
-- schools; students who take a class at another school).
--
-- Design:
--   - organizations table with self-referential parent_org_id so a district
--     row can have child school rows.
--   - user_org_memberships as the many-to-many. primary_org flags the user's
--     "home" org for UI defaults.
--   - classes.org_id is the class's home org (denormalized pointer for
--     dashboard filtering).
--   - OneRoster's `orgs` endpoint and `sourced_id` map directly onto
--     (classlink_tenant_id, classlink_org_sourced_id) — the unique index
--     below is what lets nightly deltas idempotently upsert.

create table if not exists public.organizations (
  id                          varchar primary key default gen_id(),
  classlink_org_sourced_id    varchar,
  classlink_tenant_id         varchar,
  name                        varchar not null,
  type                        varchar not null default 'school'
                                check (type in ('district','school','department')),
  parent_org_id               varchar references public.organizations(id) on delete set null,
  created_date                timestamptz not null default now(),
  updated_date                timestamptz not null default now()
);

-- Upsert key for the roster sync. Partial to allow manually-created orgs
-- (no ClassLink IDs) to coexist without violating the constraint.
create unique index if not exists organizations_classlink_key
  on public.organizations (classlink_tenant_id, classlink_org_sourced_id)
  where classlink_tenant_id is not null and classlink_org_sourced_id is not null;

create index if not exists organizations_tenant_idx on public.organizations (classlink_tenant_id);
create index if not exists organizations_parent_idx on public.organizations (parent_org_id);

create trigger organizations_set_updated
  before update on public.organizations
  for each row execute function set_updated_date();

create table if not exists public.user_org_memberships (
  user_id      varchar not null references public.users(id) on delete cascade,
  org_id       varchar not null references public.organizations(id) on delete cascade,
  role         varchar,
  primary_org  boolean not null default false,
  created_date timestamptz not null default now(),
  primary key (user_id, org_id)
);
create index if not exists user_org_memberships_org_idx on public.user_org_memberships (org_id);

-- Denormalized pointer on classes to their home org. Nullable so existing
-- manually-created classes don't need backfill.
alter table public.classes
  add column if not exists org_id varchar references public.organizations(id) on delete set null;
create index if not exists classes_org_idx on public.classes (org_id);

-- RLS
alter table public.organizations       enable row level security;
alter table public.user_org_memberships enable row level security;

-- Any authenticated user can read organizations they belong to. District
-- admins additionally see child orgs. Service role handles writes.
create policy organizations_read
  on public.organizations
  for select
  using (
    exists (
      select 1 from public.user_org_memberships m
      where m.user_id = public.my_user_id() and m.org_id = organizations.id
    )
    or exists (
      select 1
        from public.user_org_memberships m
        join public.users u on u.id = m.user_id
       where m.user_id = public.my_user_id()
         and u.account_type = 'district_admin'
         and (organizations.parent_org_id = m.org_id or organizations.id = m.org_id)
    )
  );

create policy user_org_memberships_read
  on public.user_org_memberships
  for select
  using (
    user_id = public.my_user_id()
    or exists (
      select 1
        from public.user_org_memberships m2
        join public.users u on u.id = m2.user_id
       where m2.user_id = public.my_user_id()
         and u.account_type = 'district_admin'
         and m2.org_id = user_org_memberships.org_id
    )
  );
