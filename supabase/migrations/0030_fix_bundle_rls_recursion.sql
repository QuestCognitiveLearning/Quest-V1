-- 0029 added a SELECT policy on lesson_bundles that joined to
-- lesson_bundle_assignments. The existing teacher policy on
-- lesson_bundle_assignments joins back to lesson_bundles, so once both
-- policies coexist any query touching either table recurses:
--   lesson_bundles RLS → reads lesson_bundle_assignments
--   → its RLS reads lesson_bundles → its RLS reads lesson_bundle_assignments → …
-- Postgres aborts with 42P17 (infinite recursion). Generate's
-- `.insert(...).select("id")` against lesson_bundles is what hit this first.
--
-- Fix: replace the recursive policy with one that calls a SECURITY DEFINER
-- helper. The helper runs as its owner (postgres) and bypasses RLS on the
-- inner tables, so the policy can join freely without re-entering RLS.

create or replace function public.student_can_view_bundle(p_bundle_id uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.lesson_bundle_assignments a
    join public.student_enrollments se on se.class_id = a.class_id
    join public.users u on u.id = se.student_id
    where a.bundle_id = p_bundle_id
      and u.auth_user_id = auth.uid()
  );
$$;

revoke all on function public.student_can_view_bundle(uuid) from public;
grant execute on function public.student_can_view_bundle(uuid) to authenticated;

drop policy if exists "Students see bundles assigned to their classes"
  on public.lesson_bundles;
create policy "Students see bundles assigned to their classes"
  on public.lesson_bundles
  for select
  using (public.student_can_view_bundle(id));
