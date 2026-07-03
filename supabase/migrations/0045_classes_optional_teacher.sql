-- 0045_classes_optional_teacher.sql
-- Allow classes to exist without a primary teacher assigned.
--
-- OneRoster ingestion creates classes as soon as the district SIS surfaces
-- them, which is often before a teacher is assigned. The prior schema had
-- classes.teacher_id NOT NULL, forcing the roster sync to either drop the
-- class or pick a bogus stand-in — both bad.
--
-- After this migration:
--   - classes.teacher_id is nullable. class_teachers (see 0043) remains the
--     source of truth for who teaches; classes.teacher_id is a denormalized
--     pointer to the primary and is null when no primary has been resolved.
--   - classes.status distinguishes the lifecycle state. Dashboards must
--     filter out 'pending_instructor' (invisible to teachers/students until
--     a teacher enrollment arrives from the SIS).

alter table public.classes alter column teacher_id drop not null;

alter table public.classes
  add column if not exists status varchar not null default 'active'
    check (status in ('pending_instructor','pending_students','active','archived'));

create index if not exists classes_status_idx on public.classes (status);

-- Every existing class was manually created with a teacher_id, so 'active'
-- is the correct backfill state; the default already covers new rows.
