-- 0017 tried to create a learning_sessions table, but prod already had
-- one (a student-progress tracking table from the original 0001_init era
-- that wasn't in migrations). Renaming the new concept to "lesson_bundles"
-- to avoid the clash while keeping the user-facing "Learning Session"
-- terminology in the UI.

create table if not exists public.lesson_bundles (
  id                  uuid primary key default gen_random_uuid(),
  teacher_id          varchar not null references public.users(id) on delete cascade,
  title               text not null,
  description         text,
  source_type         text check (source_type in ('youtube','pdf','article','standard','manual')),
  source_url          text,
  grade_level         varchar,
  subject             varchar,
  estimated_minutes   integer,
  payload             jsonb,
  is_archived         boolean default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists lesson_bundles_teacher_idx
  on public.lesson_bundles (teacher_id, created_at desc);

alter table public.lesson_bundles enable row level security;
drop policy if exists "Teachers manage own lesson bundles" on public.lesson_bundles;
create policy "Teachers manage own lesson bundles"
  on public.lesson_bundles
  for all
  using (
    exists (select 1 from public.users u
            where u.id = lesson_bundles.teacher_id
              and u.auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.users u
            where u.id = lesson_bundles.teacher_id
              and u.auth_user_id = auth.uid())
  );

create trigger lesson_bundles_set_updated
  before update on public.lesson_bundles
  for each row execute function set_updated_date();

create table if not exists public.lesson_bundle_items (
  id            uuid primary key default gen_random_uuid(),
  bundle_id     uuid not null references public.lesson_bundles(id) on delete cascade,
  content_type  text not null check (content_type in
                  ('inquiry_session','attention_check','article','quiz','case_study','video')),
  content_id    varchar,
  position      integer not null,
  payload       jsonb,
  unique (bundle_id, position)
);
create index if not exists lesson_bundle_items_bundle_idx
  on public.lesson_bundle_items (bundle_id, position);

alter table public.lesson_bundle_items enable row level security;
drop policy if exists "Teachers manage own bundle items" on public.lesson_bundle_items;
create policy "Teachers manage own bundle items"
  on public.lesson_bundle_items
  for all
  using (
    exists (
      select 1 from public.lesson_bundles b
      join public.users u on u.id = b.teacher_id
      where b.id = lesson_bundle_items.bundle_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lesson_bundles b
      join public.users u on u.id = b.teacher_id
      where b.id = lesson_bundle_items.bundle_id
        and u.auth_user_id = auth.uid()
    )
  );

create table if not exists public.lesson_bundle_assignments (
  id                uuid primary key default gen_random_uuid(),
  bundle_id         uuid not null references public.lesson_bundles(id) on delete cascade,
  class_id          varchar not null references public.classes(id) on delete cascade,
  assigned_at       timestamptz default now(),
  available_from    timestamptz default now(),
  due_at            timestamptz,
  notify_students   boolean default true,
  notified_at       timestamptz,
  unassigned_at     timestamptz,
  unique (bundle_id, class_id)
);
create index if not exists lesson_bundle_assignments_class_idx
  on public.lesson_bundle_assignments (class_id, assigned_at desc);

alter table public.lesson_bundle_assignments enable row level security;
drop policy if exists "Teachers manage own bundle assignments" on public.lesson_bundle_assignments;
create policy "Teachers manage own bundle assignments"
  on public.lesson_bundle_assignments
  for all
  using (
    exists (
      select 1 from public.lesson_bundles b
      join public.users u on u.id = b.teacher_id
      where b.id = lesson_bundle_assignments.bundle_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lesson_bundles b
      join public.users u on u.id = b.teacher_id
      where b.id = lesson_bundle_assignments.bundle_id
        and u.auth_user_id = auth.uid()
    )
  );

create table if not exists public.student_bundle_item_progress (
  id            uuid primary key default gen_random_uuid(),
  student_id    varchar not null references public.users(id) on delete cascade,
  assignment_id uuid not null references public.lesson_bundle_assignments(id) on delete cascade,
  item_id       uuid not null references public.lesson_bundle_items(id) on delete cascade,
  status        text default 'not_started'
                check (status in ('not_started','in_progress','completed')),
  score_pct     numeric,
  started_at    timestamptz,
  completed_at  timestamptz,
  attempts      jsonb,
  unique (student_id, assignment_id, item_id)
);
create index if not exists student_bundle_item_progress_student_idx
  on public.student_bundle_item_progress (student_id, completed_at desc);
create index if not exists student_bundle_item_progress_assignment_idx
  on public.student_bundle_item_progress (assignment_id, status);

alter table public.student_bundle_item_progress enable row level security;
drop policy if exists "Students see own progress; teachers see their bundles" on public.student_bundle_item_progress;
create policy "Students see own progress; teachers see their bundles"
  on public.student_bundle_item_progress
  for all
  using (
    exists (
      select 1 from public.users u
      where u.id = student_bundle_item_progress.student_id
        and u.auth_user_id = auth.uid()
    )
    or exists (
      select 1 from public.lesson_bundle_assignments a
      join public.lesson_bundles b on b.id = a.bundle_id
      join public.users u on u.id = b.teacher_id
      where a.id = student_bundle_item_progress.assignment_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = student_bundle_item_progress.student_id
        and u.auth_user_id = auth.uid()
    )
  );

-- And finally — drop the NOT NULL constraint on classes.curriculum_id so
-- a class can be created without one (Generate-only / tutor / sub teacher
-- patterns). 0017 tried this but failed earlier in the file so the alter
-- never ran.
alter table public.classes alter column curriculum_id drop not null;
