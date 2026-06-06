-- Parent contact info on the student_enrollments table. Quest does not have a
-- separate `students` table — students are `users` rows with
-- account_type='student' and student_enrollments is the per-class link.
-- Per-tutor parent contact lives on the enrollment so different tutors can
-- track different parent contacts for the same student.

alter table public.student_enrollments
  add column if not exists parent_email             text,
  add column if not exists parent_name              text,
  add column if not exists parent_email_secondary   text,
  add column if not exists parent_email_opted_in    boolean default false;

create index if not exists student_enrollments_parent_email_idx
  on public.student_enrollments (parent_email)
  where parent_email is not null;
