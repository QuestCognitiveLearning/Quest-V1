-- Parent contact info on the students table. Optional for teachers (Classroom
-- tier), required-ish for tutors (Studio tier — enforced at the app layer).

alter table public.students
  add column if not exists parent_email             text,
  add column if not exists parent_name              text,
  add column if not exists parent_email_secondary   text,
  add column if not exists parent_email_opted_in    boolean default false;

create index if not exists students_parent_email_idx on public.students (parent_email)
  where parent_email is not null;
