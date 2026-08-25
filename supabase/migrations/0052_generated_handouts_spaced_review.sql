-- 0052: spaced repetition for student self-study sessions
--
-- Self-generated learning sessions (generated_handouts, played via
-- StudentSessionPlay) join the same review ladder as curriculum subunits
-- (student_progress) and assigned bundles (student_bundle_completion).
-- Same column shape as 0034 so the shared spacedRepetition.js helpers and
-- the LearningHub review queue treat all three sources identically.

alter table public.generated_handouts
  add column if not exists completed_at     timestamptz,
  add column if not exists last_score_pct   numeric,
  add column if not exists next_review_date timestamptz,
  add column if not exists last_review_date timestamptz,
  add column if not exists review_count     int default 0,
  add column if not exists urgency_status   varchar
    check (urgency_status is null or urgency_status in ('Low','Medium','Critical'));

-- The LearningHub due-review query filters by owner + due date.
create index if not exists idx_generated_handouts_review
  on public.generated_handouts (teacher_id, next_review_date)
  where next_review_date is not null;
