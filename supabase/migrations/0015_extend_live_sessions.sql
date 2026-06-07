-- The existing CreateLiveSession / ManageLiveSession / StudentLiveSession
-- code reads + writes fields that were never in the 0001_init schema —
-- session_code, session_name, subunit_name, video_url, questions, etc.
-- PostgREST silently drops them on insert and returns undefined on read,
-- so the flow has been broken in prod since launch. This migration adds
-- every column those pages reference, plus the columns the new "Convert
-- to live session" path from /Generate needs (embedded quiz + case study,
-- per-response points + LLM feedback).

alter table public.live_sessions
  add column if not exists session_code         varchar,
  add column if not exists session_name         varchar,
  add column if not exists subunit_name         varchar,
  add column if not exists video_url            text,
  add column if not exists video_duration       integer,
  add column if not exists questions            jsonb,
  add column if not exists attention_checks     jsonb,
  add column if not exists case_study           jsonb,
  add column if not exists question_difficulty  varchar,
  add column if not exists question_count       integer,
  add column if not exists source_subunit_id    varchar references public.subunits(id) on delete set null,
  add column if not exists source_quiz_id       varchar references public.quizzes(id)  on delete set null;

create index if not exists live_sessions_session_code_idx
  on public.live_sessions (session_code)
  where session_code is not null;

create index if not exists live_sessions_teacher_status_idx
  on public.live_sessions (teacher_id, status, created_date desc);

-- live_session_responses needs points + AI feedback for the LLM-graded
-- case study path. question_index is for embedded quiz answers (no FK
-- to questions table when content is embedded as jsonb).
alter table public.live_session_responses
  add column if not exists question_index   integer,
  add column if not exists question_type    varchar,
  add column if not exists points_earned    integer default 0,
  add column if not exists max_points       integer,
  add column if not exists ai_feedback      text,
  add column if not exists ai_score         integer,
  add column if not exists submitted_at     timestamptz default now();

create index if not exists live_session_responses_leaderboard_idx
  on public.live_session_responses (live_session_id, student_id);

-- live_session_participants gains a display_name so anonymous joiners
-- (visitor without a Quest account) can still appear on the leaderboard.
alter table public.live_session_participants
  add column if not exists display_name   varchar,
  add column if not exists is_anonymous   boolean default false,
  add column if not exists total_points   integer default 0;
