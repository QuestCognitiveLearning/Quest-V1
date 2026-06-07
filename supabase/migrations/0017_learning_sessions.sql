-- Learning Sessions — a parallel content concept that lives outside the
-- Curriculum → Unit → Subunit hierarchy. A Learning Session is a
-- self-contained bundle of items (inquiry session + video w/ attention
-- checks + quiz + case study + supplementary article — any subset) a
-- teacher generates for one moment: a review day, a sub plan, "they need
-- this now." Assignable to a class with progress tracked identically to
-- curriculum content.
--
-- The actual content (quizzes, case studies, etc.) reuses the existing
-- tables so analytics + knowledge map updates work out of the box.
-- learning_session_items just point at content rows by id+type.

create table if not exists public.learning_sessions (
  id                  uuid primary key default gen_random_uuid(),
  teacher_id          varchar not null references public.users(id) on delete cascade,
  title               text not null,
  description         text,
  source_type         text check (source_type in ('youtube','pdf','article','standard','manual')),
  source_url          text,
  grade_level         varchar,
  subject             varchar,
  estimated_minutes   integer,
  payload             jsonb,            -- snapshot of the generated content (for live sessions / Library use)
  is_archived         boolean default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists learning_sessions_teacher_idx
  on public.learning_sessions (teacher_id, created_at desc);

alter table public.learning_sessions enable row level security;
drop policy if exists "Teachers manage own learning sessions" on public.learning_sessions;
create policy "Teachers manage own learning sessions"
  on public.learning_sessions
  for all
  using (
    exists (select 1 from public.users u
            where u.id = learning_sessions.teacher_id
              and u.auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.users u
            where u.id = learning_sessions.teacher_id
              and u.auth_user_id = auth.uid())
  );

create trigger learning_sessions_set_updated
  before update on public.learning_sessions
  for each row execute function set_updated_date();

-- Polymorphic item links. content_id is varchar (matches existing entity
-- PKs which are varchar gen_id) NOT uuid — the underlying content tables
-- use varchar PKs. Position is ordered within a session.
create table if not exists public.learning_session_items (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.learning_sessions(id) on delete cascade,
  content_type  text not null check (content_type in
                  ('inquiry_session','attention_check','article','quiz','case_study','video')),
  content_id    varchar,            -- nullable when content is embedded in session.payload
  position      integer not null,
  payload       jsonb,              -- inline copy for embedded items (live sessions, library exports)
  unique (session_id, position)
);
create index if not exists learning_session_items_session_idx
  on public.learning_session_items (session_id, position);

alter table public.learning_session_items enable row level security;
drop policy if exists "Teachers manage own session items" on public.learning_session_items;
create policy "Teachers manage own session items"
  on public.learning_session_items
  for all
  using (
    exists (
      select 1 from public.learning_sessions s
      join public.users u on u.id = s.teacher_id
      where s.id = learning_session_items.session_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.learning_sessions s
      join public.users u on u.id = s.teacher_id
      where s.id = learning_session_items.session_id
        and u.auth_user_id = auth.uid()
    )
  );

-- Assigning a learning session to a class.
create table if not exists public.learning_session_assignments (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.learning_sessions(id) on delete cascade,
  class_id          varchar not null references public.classes(id) on delete cascade,
  assigned_at       timestamptz default now(),
  available_from    timestamptz default now(),
  due_at            timestamptz,
  notify_students   boolean default true,
  notified_at       timestamptz,
  unassigned_at     timestamptz,
  unique (session_id, class_id)
);
create index if not exists learning_session_assignments_class_idx
  on public.learning_session_assignments (class_id, assigned_at desc);

alter table public.learning_session_assignments enable row level security;
drop policy if exists "Teachers manage assignments for their sessions" on public.learning_session_assignments;
create policy "Teachers manage assignments for their sessions"
  on public.learning_session_assignments
  for all
  using (
    exists (
      select 1 from public.learning_sessions s
      join public.users u on u.id = s.teacher_id
      where s.id = learning_session_assignments.session_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.learning_sessions s
      join public.users u on u.id = s.teacher_id
      where s.id = learning_session_assignments.session_id
        and u.auth_user_id = auth.uid()
    )
  );

-- Per-student progress on a session item. student_id references users.id
-- (account_type='student') for consistency with the rest of the schema —
-- the spec called for students(id) but that table doesn't exist here.
create table if not exists public.student_session_item_progress (
  id            uuid primary key default gen_random_uuid(),
  student_id    varchar not null references public.users(id) on delete cascade,
  assignment_id uuid not null references public.learning_session_assignments(id) on delete cascade,
  item_id       uuid not null references public.learning_session_items(id) on delete cascade,
  status        text default 'not_started'
                check (status in ('not_started','in_progress','completed')),
  score_pct     numeric,
  started_at    timestamptz,
  completed_at  timestamptz,
  attempts      jsonb,
  unique (student_id, assignment_id, item_id)
);
create index if not exists student_session_item_progress_student_idx
  on public.student_session_item_progress (student_id, completed_at desc);
create index if not exists student_session_item_progress_assignment_idx
  on public.student_session_item_progress (assignment_id, status);

alter table public.student_session_item_progress enable row level security;
drop policy if exists "Students own progress; teachers see assigned classes" on public.student_session_item_progress;
create policy "Students own progress; teachers see assigned classes"
  on public.student_session_item_progress
  for all
  using (
    -- Student owns the row OR teacher owns the session being progressed against.
    exists (
      select 1 from public.users u
      where u.id = student_session_item_progress.student_id
        and u.auth_user_id = auth.uid()
    )
    or exists (
      select 1 from public.learning_session_assignments a
      join public.learning_sessions s on s.id = a.session_id
      join public.users u on u.id = s.teacher_id
      where a.id = student_session_item_progress.assignment_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = student_session_item_progress.student_id
        and u.auth_user_id = auth.uid()
    )
  );

-- Allow a class to exist without a curriculum so the Generate-only workflow
-- and tutor session-class patterns are first-class.
alter table public.classes alter column curriculum_id drop not null;
