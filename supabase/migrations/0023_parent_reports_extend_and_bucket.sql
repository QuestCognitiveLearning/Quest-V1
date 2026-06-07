-- Extends the existing parent_reports table (0010) and creates a private
-- storage bucket the generated PDFs live in.
--
-- Existing parent_reports columns: id, tutor_id, student_id, class_id,
-- date_range_start, date_range_end, topics_covered, accuracy_summary,
-- strengths, areas_to_practice, tutor_notes, questions_for_parent, pdf_url,
-- sent_to, sent_at, created_at.
--
-- New columns this migration adds (all nullable so existing rows are valid):
--   * trigger_type                ('session_end' | 'weekly_digest' | 'manual')
--   * tutor_personal_note         freeform note appended to the email body
--   * next_session_recommendation what to cover next, from the AI summary
--   * email_message_id            Resend message id for delivery tracking
--   * email_opened_at             webhook will fill in when supported

alter table public.parent_reports
  add column if not exists trigger_type                 text,
  add column if not exists tutor_personal_note          text,
  add column if not exists next_session_recommendation  text,
  add column if not exists email_message_id             text,
  add column if not exists email_opened_at              timestamptz;

alter table public.parent_reports
  drop constraint if exists parent_reports_trigger_type_check;
alter table public.parent_reports
  add constraint parent_reports_trigger_type_check
  check (trigger_type is null
    or trigger_type in ('session_end','weekly_digest','manual'));

-- Private storage bucket. Public is false so PDFs require a signed URL or
-- service-role read. Tutor owns the folder ({tutor_id}/{report_id}.pdf) and
-- can read/write it; nobody else can.

insert into storage.buckets (id, name, public)
values ('parent-reports', 'parent-reports', false)
on conflict (id) do nothing;

drop policy if exists "Tutors read own parent report PDFs" on storage.objects;
create policy "Tutors read own parent report PDFs"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'parent-reports'
    and (storage.foldername(name))[1] in (
      select u.id::text from public.users u where u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Tutors write own parent report PDFs" on storage.objects;
create policy "Tutors write own parent report PDFs"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'parent-reports'
    and (storage.foldername(name))[1] in (
      select u.id::text from public.users u where u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Tutors update own parent report PDFs" on storage.objects;
create policy "Tutors update own parent report PDFs"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'parent-reports'
    and (storage.foldername(name))[1] in (
      select u.id::text from public.users u where u.auth_user_id = auth.uid()
    )
  );
