-- 0047_classes_grade_levels.sql
-- Add grade_levels to classes so class-scoped features (standards import,
-- content targeting, parent report tone, dashboard grouping) can filter by
-- the actual grade a class serves rather than the coarse
-- curriculum_difficulty band.
--
-- Text array because a class can span multiple grades (K-1 combo, MS block,
-- mixed 9/10 section). Nullable so the column is safe to backfill later and
-- doesn't break existing class-create flows that pre-date the picker.
--
-- Values mirror what the OneRoster ingest will receive on classes.grades
-- (single-char and two-digit codes) plus 'Undergraduate' and 'Graduate' for
-- post-secondary — the roster ingest normalizes any incoming values into
-- this vocabulary at write time.

alter table public.classes
  add column if not exists grade_levels text[];

create index if not exists classes_grade_levels_idx
  on public.classes using gin (grade_levels)
  where grade_levels is not null;
