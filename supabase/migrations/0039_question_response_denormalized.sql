-- Denormalize the human-readable question + choice text onto each quiz
-- response so the teacher's per-student view stays correct even when the
-- underlying question is later edited, regenerated (new ids), or paged out of
-- an unbounded .list(). The choices are shuffled per attempt, so selected_choice
-- (an index) can't be resolved back to the original choice anyway — capturing
-- the actual text the student saw is the only reliable record.
alter table question_responses
  add column if not exists question_text text,
  add column if not exists selected_choice_text text,
  add column if not exists correct_choice_text text;
