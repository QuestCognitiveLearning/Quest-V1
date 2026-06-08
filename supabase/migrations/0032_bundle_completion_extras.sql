-- Extend student_bundle_completion with attention-check + case-study
-- scoring fields so an assigned session can carry the same per-phase
-- detail as a regular learning session: attention checks during the
-- video and AI-graded case study free responses after the quiz.

alter table public.student_bundle_completion
  add column if not exists attention_check_responses jsonb,  -- [{ q_index, picked, correct, is_correct }]
  add column if not exists attention_check_total int,
  add column if not exists attention_check_correct int,
  add column if not exists case_study_responses jsonb,        -- [{ q_index, question, answer, score, max, feedback }]
  add column if not exists case_study_score numeric,          -- sum of scores
  add column if not exists case_study_max numeric;            -- # of questions
