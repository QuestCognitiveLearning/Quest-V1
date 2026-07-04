-- Student-created learning sessions: bundles a student generated for
-- themselves on the Create tab, with a scheduled date that drives when
-- they appear on the Learning Hub. Each "session" can spawn N review
-- entries (review_number 1..5 at +1/+3/+7/+14/+30 days) via the
-- parent_session_id self-FK.
--
-- This is intentionally separate from lesson_bundle_assignments — that
-- table requires a class_id FK and represents a teacher push. Self-
-- created sessions have no class and belong only to the student.

create table if not exists public.student_self_sessions (
  id                  uuid primary key default gen_random_uuid(),
  student_id          varchar not null references public.users(id) on delete cascade,
  bundle_id           uuid not null references public.lesson_bundles(id) on delete cascade,

  scheduled_for       date not null default current_date,
  review_enabled      boolean default true,

  -- 0 = the original session; 1..5 = its review entries.
  -- Reviews back-reference the original via parent_session_id so the
  -- LearningHub can group "due today" rows by source bundle if needed.
  parent_session_id   uuid references public.student_self_sessions(id) on delete cascade,
  review_number       int default 0,

  completed_at        timestamptz,
  quiz_score_pct      numeric,
  case_study_score    numeric,
  case_study_max      numeric,
  responses           jsonb,           -- { quiz_responses, case_study_responses }

  created_at          timestamptz default now()
);

create index if not exists student_self_sessions_student_idx
  on public.student_self_sessions (student_id, scheduled_for desc);
create index if not exists student_self_sessions_due_idx
  on public.student_self_sessions (student_id, scheduled_for)
  where completed_at is null;
create index if not exists student_self_sessions_parent_idx
  on public.student_self_sessions (parent_session_id);

alter table public.student_self_sessions enable row level security;

-- Students fully manage their own self-session rows.
drop policy if exists "Students manage own self-sessions"
  on public.student_self_sessions;
create policy "Students manage own self-sessions"
  on public.student_self_sessions
  for all
  using (
    exists (
      select 1 from public.users u
      where u.id = student_self_sessions.student_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = student_self_sessions.student_id
        and u.auth_user_id = auth.uid()
    )
  );

-- Students need to read the lesson_bundles row referenced by their own
-- self-sessions. The 0029 policy only granted SELECT for class-assigned
-- bundles, which excluded the student's own creations. Extend the
-- SECURITY DEFINER helper to also accept self-session ownership.
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
  )
  or exists (
    select 1
    from public.student_self_sessions s
    join public.users u on u.id = s.student_id
    where s.bundle_id = p_bundle_id
      and u.auth_user_id = auth.uid()
  )
  or exists (
    -- Bundle's own teacher (covers the case where a student creates a
    -- bundle as the "teacher" via Generate — lesson_bundles.teacher_id
    -- is set to the student's users.id on insert).
    select 1
    from public.lesson_bundles b
    join public.users u on u.id = b.teacher_id
    where b.id = p_bundle_id
      and u.auth_user_id = auth.uid()
  );
$$;

-- Allow students to INSERT into lesson_bundles when they're the
-- teacher_id (Generate is account-type agnostic and writes
-- teacher_id = current user). The existing "Teachers manage own"
-- policy already uses the correct check but is scoped to "for all"
-- which works; this is documentation that we rely on that policy for
-- student-created bundles too.
