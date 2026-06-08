-- Spaced-repetition fields for assigned learning sessions.
--
-- Today student_progress (keyed by subunit_id) drives the SM2-style review
-- queue surfaced in the student LearningHub. Assigned learning sessions
-- live in lesson_bundles (no subunit anchor), so they never enrolled in
-- that queue. This migration adds parallel review fields directly to
-- student_bundle_completion so the student-side LearningHub can include
-- bundle-based reviews alongside subunit ones, and the teacher class
-- detail page can show how each student is doing on assigned sessions.

alter table public.student_bundle_completion
  add column if not exists next_review_date  timestamptz,
  add column if not exists last_review_date  timestamptz,
  add column if not exists review_count      integer default 0,
  add column if not exists urgency_status    varchar
    check (urgency_status in ('Low','Medium','Critical'));

-- Hot path: the student LearningHub asks "what's due for me right now?".
-- Filtering by (student_id, next_review_date) only is the typical query,
-- so a composite index covers it.
create index if not exists student_bundle_completion_due_idx
  on public.student_bundle_completion (student_id, next_review_date)
  where next_review_date is not null;

notify pgrst, 'reload schema';
