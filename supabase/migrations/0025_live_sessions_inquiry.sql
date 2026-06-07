-- Live sessions need to carry the inquiry hook (hook_question +
-- hook_image_url + tutor messages) so the ManageLiveSession lobby and
-- the student-facing flow can render it. Same jsonb pattern used for
-- questions and attention_checks.

alter table public.live_sessions
  add column if not exists inquiry_session jsonb;
