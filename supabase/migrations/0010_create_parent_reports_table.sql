-- Studio-tier parent progress reports. One row per generated report.
-- Tutor owns the row; row-level access is by auth.uid() → users.id.

create table if not exists public.parent_reports (
  id                      uuid primary key default gen_random_uuid(),
  tutor_id                varchar not null references public.users(id) on delete cascade,
  student_id              varchar not null references public.students(id) on delete cascade,
  class_id                varchar references public.classes(id) on delete set null,
  date_range_start        timestamptz,
  date_range_end          timestamptz,
  topics_covered          jsonb,
  accuracy_summary        jsonb,
  strengths               text,
  areas_to_practice       text,
  tutor_notes             text,
  questions_for_parent    jsonb,
  pdf_url                 text,
  sent_to                 text[],
  sent_at                 timestamptz,
  created_at              timestamptz default now()
);

create index if not exists parent_reports_tutor_idx on public.parent_reports (tutor_id, created_at desc);
create index if not exists parent_reports_student_idx on public.parent_reports (student_id, created_at desc);

alter table public.parent_reports enable row level security;

drop policy if exists "Tutors manage own reports" on public.parent_reports;
create policy "Tutors manage own reports"
  on public.parent_reports
  for all
  using (
    exists (
      select 1 from public.users u
      where u.id = parent_reports.tutor_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = parent_reports.tutor_id
        and u.auth_user_id = auth.uid()
    )
  );
