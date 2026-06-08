-- Students need to see lesson_bundle_assignments + lesson_bundles for
-- classes they're enrolled in. The original 0018 policies only granted
-- access to the owning teacher, so the student LearningHub couldn't
-- display assigned learning sessions at all.
--
-- These are SELECT-only — students never insert/update/delete bundles
-- or assignments; the existing teacher-write policies stay intact.

drop policy if exists "Students see assignments for their classes"
  on public.lesson_bundle_assignments;
create policy "Students see assignments for their classes"
  on public.lesson_bundle_assignments
  for select
  using (
    exists (
      select 1
      from public.student_enrollments se
      join public.users u on u.id = se.student_id
      where se.class_id = lesson_bundle_assignments.class_id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Students see bundles assigned to their classes"
  on public.lesson_bundles;
create policy "Students see bundles assigned to their classes"
  on public.lesson_bundles
  for select
  using (
    exists (
      select 1
      from public.lesson_bundle_assignments a
      join public.student_enrollments se on se.class_id = a.class_id
      join public.users u on u.id = se.student_id
      where a.bundle_id = lesson_bundles.id
        and u.auth_user_id = auth.uid()
    )
  );
