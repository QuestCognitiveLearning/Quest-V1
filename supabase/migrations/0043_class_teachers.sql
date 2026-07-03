-- 0043_class_teachers.sql
-- Multi-instructor support for classes.
--
-- Real classes have co-teachers, subs, push-in special-ed, TAs. OneRoster
-- enrollments will surface all of them; keeping `classes.teacher_id` as a
-- single scalar would silently drop everyone except the primary.
--
-- Design:
--   - class_teachers is the source of truth for who teaches a class.
--   - classes.teacher_id is preserved as a DENORMALIZED pointer to the
--     "primary" teacher for backward compatibility with existing queries
--     (LearningHub, TeacherLayout, LiveSessionHost, etc. all read
--     classes.teacher_id directly and stay green with no code change).
--   - Roster ingestion + any future co-teacher UX writes to class_teachers.

create table if not exists public.class_teachers (
  class_id     varchar not null references public.classes(id) on delete cascade,
  teacher_id   varchar not null references public.users(id) on delete cascade,
  role         varchar not null default 'primary'
                 check (role in ('primary','co_teacher','assistant','substitute')),
  created_date timestamptz not null default now(),
  primary key (class_id, teacher_id)
);

create index if not exists class_teachers_teacher_idx on public.class_teachers (teacher_id);
create index if not exists class_teachers_class_idx   on public.class_teachers (class_id);

-- Backfill: every existing class with a teacher_id becomes a 'primary' row.
insert into public.class_teachers (class_id, teacher_id, role)
select id, teacher_id, 'primary'
from public.classes
where teacher_id is not null
on conflict (class_id, teacher_id) do nothing;

alter table public.class_teachers enable row level security;

-- Reads: any authenticated teacher or admin can read the mapping. Students
-- don't need direct visibility (they see teachers via class detail pages
-- gated by their own enrollment RLS).
create policy class_teachers_read
  on public.class_teachers
  for select
  using (
    public.my_account_type() = 'teacher'
    or exists (select 1 from public.users u where u.id = public.my_user_id() and u.role = 'admin')
  );

-- Writes: service role only. Roster sync + admin ops write here; there is
-- no user-facing writer in v1 (co-teacher management UI is phase 2).
