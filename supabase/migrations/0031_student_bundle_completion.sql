-- Assignment-level completion tracking for student-side bundle plays.
-- The existing student_bundle_item_progress requires a lesson_bundle_items
-- row per item, but Generate writes the whole session into
-- lesson_bundles.payload as jsonb and never creates item rows. So we track
-- completion + quiz scoring at the (student, assignment) granularity.

create table if not exists public.student_bundle_completion (
  id              uuid primary key default gen_random_uuid(),
  student_id      varchar not null references public.users(id) on delete cascade,
  assignment_id   uuid not null references public.lesson_bundle_assignments(id) on delete cascade,
  quiz_total      integer,
  quiz_correct    integer,
  quiz_score_pct  numeric,
  quiz_responses  jsonb,        -- [{ q_index, picked, correct, is_correct }]
  started_at      timestamptz default now(),
  completed_at    timestamptz default now(),
  unique (student_id, assignment_id)
);

create index if not exists student_bundle_completion_student_idx
  on public.student_bundle_completion (student_id, completed_at desc);
create index if not exists student_bundle_completion_assignment_idx
  on public.student_bundle_completion (assignment_id);

alter table public.student_bundle_completion enable row level security;

-- Students fully manage their own completion rows.
drop policy if exists "Students manage own bundle completion"
  on public.student_bundle_completion;
create policy "Students manage own bundle completion"
  on public.student_bundle_completion
  for all
  using (
    exists (
      select 1 from public.users u
      where u.id = student_bundle_completion.student_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = student_bundle_completion.student_id
        and u.auth_user_id = auth.uid()
    )
  );

-- Teachers see completion rows for assignments tied to their bundles.
-- Wrapped in a SECURITY DEFINER helper to mirror the 0030 pattern — keeps
-- the cross-table join from re-entering RLS on lesson_bundle_assignments /
-- lesson_bundles.
create or replace function public.teacher_owns_assignment(p_assignment_id uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.lesson_bundle_assignments a
    join public.lesson_bundles b on b.id = a.bundle_id
    join public.users u on u.id = b.teacher_id
    where a.id = p_assignment_id
      and u.auth_user_id = auth.uid()
  );
$$;

revoke all on function public.teacher_owns_assignment(uuid) from public;
grant execute on function public.teacher_owns_assignment(uuid) to authenticated;

drop policy if exists "Teachers see completion for their assignments"
  on public.student_bundle_completion;
create policy "Teachers see completion for their assignments"
  on public.student_bundle_completion
  for select
  using (public.teacher_owns_assignment(assignment_id));
