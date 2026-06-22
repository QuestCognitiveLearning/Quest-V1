-- Assignable tests — replaces the name-based Pre-Test/Post-Test concept.
-- A teacher picks subunits + easy/medium/hard counts; questions are drawn from
-- the curriculum question bank and frozen onto the assignment (question_ids),
-- so every student in the class takes the same test. Mirrors the lesson-bundle
-- assignment/completion RLS patterns (0018/0029/0030/0031).
-- (Applied to prod 2026-06-18 via the Management API; recorded here for parity.)

create table if not exists public.test_assignments (
  id              uuid primary key default gen_random_uuid(),
  teacher_id      varchar not null references public.users(id) on delete cascade,
  class_id        varchar not null references public.classes(id) on delete cascade,
  curriculum_id   varchar references public.curricula(id) on delete set null,
  title           varchar not null,
  subunit_ids     jsonb default '[]'::jsonb,
  easy_count      integer default 0,
  medium_count    integer default 0,
  hard_count      integer default 0,
  question_ids    jsonb default '[]'::jsonb,
  due_at          timestamptz,
  assigned_at     timestamptz default now(),
  created_at      timestamptz default now()
);
create index if not exists test_assignments_class_idx on public.test_assignments (class_id, assigned_at desc);
create index if not exists test_assignments_teacher_idx on public.test_assignments (teacher_id);

alter table public.test_assignments enable row level security;

create policy "Teachers manage own test assignments"
  on public.test_assignments for all
  using (exists (select 1 from public.users u where u.id = test_assignments.teacher_id and u.auth_user_id = auth.uid()))
  with check (exists (select 1 from public.users u where u.id = test_assignments.teacher_id and u.auth_user_id = auth.uid()));

create policy "Students see test assignments for their classes"
  on public.test_assignments for select
  using (exists (
    select 1 from public.student_enrollments se
    join public.users u on u.id = se.student_id
    where se.class_id = test_assignments.class_id and u.auth_user_id = auth.uid()
  ));

create table if not exists public.test_completions (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references public.test_assignments(id) on delete cascade,
  student_id      varchar not null references public.users(id) on delete cascade,
  total           integer,
  correct         integer,
  score_pct       numeric,
  responses       jsonb,
  completed_at    timestamptz default now(),
  unique (student_id, assignment_id)
);
create index if not exists test_completions_assignment_idx on public.test_completions (assignment_id);
create index if not exists test_completions_student_idx on public.test_completions (student_id, completed_at desc);

alter table public.test_completions enable row level security;

create policy "Students manage own test completion"
  on public.test_completions for all
  using (exists (select 1 from public.users u where u.id = test_completions.student_id and u.auth_user_id = auth.uid()))
  with check (exists (select 1 from public.users u where u.id = test_completions.student_id and u.auth_user_id = auth.uid()));

-- SECURITY DEFINER helper so the teacher-read policy doesn't recurse (0030/0031 pattern).
create or replace function public.teacher_owns_test_assignment(p_assignment_id uuid)
  returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.test_assignments ta
    join public.users u on u.id = ta.teacher_id
    where ta.id = p_assignment_id and u.auth_user_id = auth.uid()
  );
$$;
revoke all on function public.teacher_owns_test_assignment(uuid) from public;
grant execute on function public.teacher_owns_test_assignment(uuid) to authenticated;

create policy "Teachers see test completion for their assignments"
  on public.test_completions for select
  using (public.teacher_owns_test_assignment(assignment_id));
