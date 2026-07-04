-- 0049_oneroster_sync.sql
-- Schema for the ClassLink OneRoster roster sync (the "rosterSync" Edge
-- Function). 0043–0048 prepared the destination tables (organizations,
-- class_teachers, class lifecycle, grade_levels); this migration adds what
-- the sync engine itself needs:
--
--   1. classlink_sync_tenants — one row per district that granted Quest
--      access via ClassLink's OAuth2 proxy. Holds the per-entity
--      dateLastModified high-water marks (delta cursors) so nightly runs
--      only pull what changed.
--   2. classlink_sync_runs — append-only run log. This is the observability
--      surface for ClassLink certification testing: every run records
--      per-entity fetched/created/updated/archived counts and any error.
--   3. academic_sessions — terms/semesters/school years. Quest has no terms
--      concept of its own; these rows exist so classes can activate at term
--      start and archive after term end (classes.term_sourced_ids joins
--      against them).
--   4. Roster identity columns on classes / student_enrollments /
--      class_teachers — the (tenant, sourcedId) upsert keys, mirroring the
--      partial-unique-index pattern established on organizations in 0044.
--      Partial so manually-created rows (no ClassLink IDs) coexist freely.
--   5. classes.managed_by + raw roster_* fields — the sync composes the
--      display class_name from title/location/periods ("Biology 1 — Rm 204
--      — P3") but must never clobber a teacher's manual rename; keeping the
--      raw parts lets the engine detect whether class_name is still the
--      composed value before rewriting it.
--   6. organizations.status — 0044 shipped no lifecycle column; tobedeleted
--      orgs are archived (soft), never hard-deleted, because classes and
--      memberships reference them.
--
-- Data contract: the sync consumes ONLY the fields marked Required/Supported
-- in docs/classlink-roster-server-profile.md. Nothing else is stored.

-- ============================================================
-- 1. Sync tenants (one per connected district)
-- ============================================================

create table if not exists public.classlink_sync_tenants (
  id                         varchar primary key default gen_id(),
  -- ClassLink proxy identity: the oneroster_applications_id returned by
  -- GET https://oneroster-proxy.apis.classlink.com/applications
  oneroster_application_id   varchar not null unique,
  -- TenantId as it appears on SSO profiles / user rows (scopes sourcedIds).
  classlink_tenant_id        varchar,
  name                       varchar,
  enabled                    boolean not null default true,
  -- Resolved OneRoster data base URL for this tenant. The proxy's data-path
  -- shape is probed on first sync and recorded here so later runs skip the
  -- probe (see _shared/oneroster.ts).
  data_base_url              varchar,
  -- Per-entity delta cursors: {"orgs": "<iso>", "users": "<iso>", ...}.
  -- A cursor only advances after that entity's pass commits cleanly.
  delta_cursors              jsonb not null default '{}'::jsonb,
  last_full_sync_at          timestamptz,
  last_delta_sync_at         timestamptz,
  created_date               timestamptz not null default now(),
  updated_date               timestamptz not null default now()
);

create trigger classlink_sync_tenants_set_updated
  before update on public.classlink_sync_tenants
  for each row execute function set_updated_date();

-- Service-role only: RLS on with no policies. No user-facing reader in v1.
alter table public.classlink_sync_tenants enable row level security;

-- ============================================================
-- 2. Run log
-- ============================================================

create table if not exists public.classlink_sync_runs (
  id            varchar primary key default gen_id(),
  tenant_id     varchar references public.classlink_sync_tenants(id) on delete cascade,
  mode          varchar not null check (mode in ('full','delta')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ok            boolean,
  -- {"orgs": {"fetched": 12, "created": 2, "updated": 10, "archived": 0}, ...}
  counts        jsonb not null default '{}'::jsonb,
  error         text
);

create index if not exists classlink_sync_runs_tenant_idx
  on public.classlink_sync_runs (tenant_id, started_at desc);

alter table public.classlink_sync_runs enable row level security;

-- ============================================================
-- 3. Academic sessions (terms / semesters / school years)
-- ============================================================

create table if not exists public.academic_sessions (
  id                     varchar primary key default gen_id(),
  classlink_tenant_id    varchar not null,
  classlink_sourced_id   varchar not null,
  type                   varchar,          -- term | semester | schoolYear | gradingPeriod
  title                  varchar,
  start_date             date,
  end_date               date,
  school_year            varchar,
  parent_sourced_id      varchar,          -- grading periods roll up to their term
  status                 varchar not null default 'active'
                           check (status in ('active','archived')),
  created_date           timestamptz not null default now(),
  updated_date           timestamptz not null default now()
);

create unique index if not exists academic_sessions_classlink_key
  on public.academic_sessions (classlink_tenant_id, classlink_sourced_id);

create trigger academic_sessions_set_updated
  before update on public.academic_sessions
  for each row execute function set_updated_date();

alter table public.academic_sessions enable row level security;

-- Terms carry no PII; any signed-in user may read them (class detail pages
-- show term labels). Writes are service-role only.
create policy academic_sessions_read
  on public.academic_sessions
  for select
  to authenticated
  using (true);

-- ============================================================
-- 4. Org lifecycle
-- ============================================================

alter table public.organizations
  add column if not exists status varchar not null default 'active'
    check (status in ('active','archived'));

-- ============================================================
-- 5. Roster identity + raw fields on classes
-- ============================================================

alter table public.classes
  add column if not exists classlink_tenant_id  varchar,
  add column if not exists classlink_sourced_id varchar,
  add column if not exists term_sourced_ids     text[],
  add column if not exists roster_title         varchar,
  add column if not exists roster_location      varchar,
  add column if not exists roster_periods       varchar,
  add column if not exists managed_by           varchar not null default 'manual'
    check (managed_by in ('manual','classlink'));

create unique index if not exists classes_classlink_key
  on public.classes (classlink_tenant_id, classlink_sourced_id)
  where classlink_tenant_id is not null and classlink_sourced_id is not null;

-- ============================================================
-- 6. User deactivation tracking
-- ============================================================
-- enabledUser=false / status=tobedeleted on a rostered user bans the auth
-- account (blocks SSO + magic-link login without touching classlinkSso).
-- This flag records that WE set the ban, so a later enabledUser=true can
-- lift it without an auth-API read per user, and so support can see why a
-- rostered login fails.

alter table public.users
  add column if not exists classlink_disabled boolean not null default false;

-- ============================================================
-- 7. Roster identity on enrollments
-- ============================================================

alter table public.student_enrollments
  add column if not exists classlink_tenant_id  varchar,
  add column if not exists classlink_sourced_id varchar;

create unique index if not exists student_enrollments_classlink_key
  on public.student_enrollments (classlink_tenant_id, classlink_sourced_id)
  where classlink_tenant_id is not null and classlink_sourced_id is not null;

alter table public.class_teachers
  add column if not exists classlink_tenant_id  varchar,
  add column if not exists classlink_sourced_id varchar;

create unique index if not exists class_teachers_classlink_key
  on public.class_teachers (classlink_tenant_id, classlink_sourced_id)
  where classlink_tenant_id is not null and classlink_sourced_id is not null;

-- ============================================================
-- Cron schedule (created out-of-band, same pattern as 0014/0026, so the
-- internal token never lands in git). Run once via psql:
--
--   select cron.schedule(
--     'quest-roster-sync-nightly',
--     '0 7 * * *',  -- 07:00 UTC daily (~2-3am US, off-peak for districts)
--     $cmd$
--     select net.http_post(
--       url := 'https://lgymrkodypbqghyjocxg.supabase.co/functions/v1/rosterSync',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'X-Quest-Internal-Token', '<YOUR_TOKEN>'
--       ),
--       body := '{}'::jsonb
--     );
--     $cmd$
--   );
--
-- To remove:  select cron.unschedule('quest-roster-sync-nightly');
-- ============================================================

select 1;
