-- Tag each quiz response with which review it belongs to (0 = the initial learn
-- session, 1..N = review sessions) so the teacher's per-student view can show
-- responses for a specific review instead of lumping every review together.
alter table question_responses
  add column if not exists review_number integer;
