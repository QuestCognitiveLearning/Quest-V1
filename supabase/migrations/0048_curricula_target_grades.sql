-- 0048_curricula_target_grades.sql
-- Add target_grades to curricula. curriculum_difficulty stays as the coarse
-- band that drives existing UI grouping ('Elementary'/'Middle'/'High'/
-- 'Undergraduate'/'Graduate'); target_grades is the fine-grained list used
-- for standards filtering — Common Standards Project queries and future
-- CASE alignments need specific grade codes, not bands.
--
-- Fallback chain at standards-fetch time:
--   1. class.grade_levels (most specific, roster- or teacher-supplied)
--   2. curriculum.target_grades
--   3. prompt the teacher

alter table public.curricula
  add column if not exists target_grades text[];

create index if not exists curricula_target_grades_idx
  on public.curricula using gin (target_grades)
  where target_grades is not null;
