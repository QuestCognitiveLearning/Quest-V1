-- 0050_seed_student_progress.sql
-- One seeding implementation for StudentProgress scaffolding, shared by every
-- caller (A-B1).
--
-- Progress rows are keyed (student_id, subunit_id) — unique since 0001 — and
-- are the scaffold KnowledgeMap/LearningHub render from. Today they are
-- seeded client-side at join time (JoinClass.jsx / Classes.jsx), which means
-- SIS-driven enrollments (rosterSync inserts student_enrollments directly)
-- produce students whose class opens with no scaffold at all.
--
-- This function is the single source of truth for "give this student their
-- progress rows for this class's curriculum":
--   - rosterSync calls it (service role) right after inserting a student
--     enrollment, so rostered students are seeded the moment the class has
--     a curriculum.
--   - The student client calls it lazily on class load (LearningHub /
--     KnowledgeMap paths), which heals organic edge cases too: curriculum
--     attached after join, subunits added later, seeding that failed at
--     join time.
--
-- Idempotent by construction (single INSERT ... ON CONFLICT DO NOTHING), so
-- re-running a sync or re-opening a class never duplicates. A class with no
-- curriculum seeds zero rows and returns 0 — callers don't need to check.
--
-- SECURITY DEFINER so the RLS insert policy on student_progress (student
-- writes own rows only) is not re-evaluated per row; the guard below
-- enforces the same rule explicitly: a caller may seed only THEIR OWN rows
-- unless they are the service role.

create or replace function public.seed_student_progress(
  p_student_id varchar,
  p_class_id   varchar
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  -- Same trust rule as the student_progress RLS write policy: students seed
  -- themselves; the service role (rosterSync) seeds anyone.
  if auth.role() is distinct from 'service_role'
     and public.my_user_id() is distinct from p_student_id then
    raise exception 'seed_student_progress: not allowed for this student';
  end if;

  insert into public.student_progress (student_id, subunit_id)
  select p_student_id, s.id
    from public.classes c
    join public.units u    on u.curriculum_id = c.curriculum_id
    join public.subunits s on s.unit_id = u.id
   where c.id = p_class_id
     and c.curriculum_id is not null
  on conflict (student_id, subunit_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- Callable by signed-in students (self-seeding guard above) and the service
-- role. Not anon: seeding requires an identity.
revoke all on function public.seed_student_progress(varchar, varchar) from public;
grant execute on function public.seed_student_progress(varchar, varchar)
  to authenticated, service_role;
