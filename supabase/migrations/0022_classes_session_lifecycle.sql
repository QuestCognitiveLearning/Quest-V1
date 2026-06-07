-- Tutor session lifecycle columns on the existing classes table. A "session"
-- for a tutor is the same row as a "class" for a teacher; we only need extra
-- per-session metadata. None of these break the teacher flow because every
-- column is nullable and the tutor UI is the only thing that reads them.
--
-- (curriculum_id has already been made nullable by 0018; parent contact
-- fields already exist on student_enrollments via 0009.)

alter table public.classes
  add column if not exists session_started_at         timestamptz,
  add column if not exists session_ended_at           timestamptz,
  add column if not exists session_notes              jsonb default '[]'::jsonb,
  add column if not exists session_topics_covered     jsonb default '[]'::jsonb,
  add column if not exists scheduled_for              timestamptz,
  add column if not exists scheduled_duration_minutes integer default 60;

create index if not exists classes_scheduled_for_idx
  on public.classes (teacher_id, scheduled_for)
  where scheduled_for is not null;
