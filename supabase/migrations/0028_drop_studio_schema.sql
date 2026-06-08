-- Drop the entire Studio surface. Removes the tables, columns, buckets,
-- and cron jobs introduced by 0008–0027 for the tutor / Studio tier.
--
-- Per user direction: "remove the Studio dashboard entirely and the
-- Studio subscription model entirely we will just do student and teacher."
-- Existing tier='studio' rows on users.tier are coerced to 'classroom'
-- by the application-level getUserTier helper, so any rows in these
-- tables are no longer reachable from the app. This migration removes
-- them from the schema.
--
-- DESTRUCTIVE. Any data in these tables is gone.

-- Cron — unschedule before anything else; safe if it wasn't scheduled.
do $$
begin
  begin
    perform cron.unschedule('quest-parent-digest-weekly');
  exception when others then null;
  end;
end$$;

-- Tables
drop table if exists public.parent_reports        cascade;
drop table if exists public.bookings              cascade;
drop table if exists public.tutor_blocked_dates   cascade;
drop table if exists public.tutor_availability    cascade;
drop table if exists public.branding              cascade;

-- Columns on classes (added by 0022 — session lifecycle for tutors)
alter table public.classes
  drop column if exists session_started_at,
  drop column if exists session_ended_at,
  drop column if exists session_notes,
  drop column if exists session_topics_covered,
  drop column if exists scheduled_for,
  drop column if exists scheduled_duration_minutes;

-- Index from 0022
drop index if exists public.classes_scheduled_for_idx;

-- Columns on student_enrollments (added by 0009 — parent contact for reports)
alter table public.student_enrollments
  drop column if exists parent_email,
  drop column if exists parent_name,
  drop column if exists parent_email_secondary,
  drop column if exists parent_email_opted_in;

drop index if exists public.student_enrollments_parent_email_idx;

-- Storage buckets — drop policies first so the bucket delete succeeds.
drop policy if exists "Branding logos are public"          on storage.objects;
drop policy if exists "Users upload own branding logo"     on storage.objects;
drop policy if exists "Users update own branding logo"     on storage.objects;
drop policy if exists "Users delete own branding logo"     on storage.objects;
drop policy if exists "Tutors read own parent report PDFs" on storage.objects;
drop policy if exists "Tutors write own parent report PDFs" on storage.objects;
drop policy if exists "Tutors update own parent report PDFs" on storage.objects;

-- Best-effort: empty the buckets then drop them.
do $$
begin
  begin
    delete from storage.objects where bucket_id = 'branding-logos';
  exception when others then null;
  end;
  begin
    delete from storage.objects where bucket_id = 'parent-reports';
  exception when others then null;
  end;
  begin
    delete from storage.buckets where id = 'branding-logos';
  exception when others then null;
  end;
  begin
    delete from storage.buckets where id = 'parent-reports';
  exception when others then null;
  end;
end$$;
