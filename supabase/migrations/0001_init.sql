-- Quest Learning — initial schema
-- All IDs are VARCHAR to preserve existing Quest hex IDs from CSV exports.
-- New rows generated post-migration default to random UUIDs cast to text.
-- created_date / updated_date column names mirror the Quest spec verbatim
-- so the existing frontend code does not need field-name remapping.

set search_path = public;

create extension if not exists "pgcrypto";

-- ============================================================
-- helpers
-- ============================================================

create or replace function set_updated_date() returns trigger as $$
begin
  new.updated_date = now();
  return new;
end;
$$ language plpgsql;

create or replace function gen_id() returns text as $$
  select replace(gen_random_uuid()::text, '-', '');
$$ language sql;

-- ============================================================
-- users  (mirrors Supabase auth.users; auth_user_id is the FK to auth)
-- ============================================================

create table users (
  id                          varchar primary key default gen_id(),
  auth_user_id                uuid unique references auth.users(id) on delete set null,
  email                       varchar unique not null,
  full_name                   varchar,
  role                        varchar default 'user' check (role in ('admin','user')),
  account_type                varchar check (account_type in ('teacher','student')),
  subscription_status         varchar default 'free'
                                check (subscription_status in ('free','trial','premium','grace_period')),
  subscription_tier           varchar default 'free' check (subscription_tier in ('free','premium')),
  subscription_id             varchar,
  trial_end_date              timestamptz,
  grace_period_end_date       timestamptz,
  last_subscription_update    timestamptz,
  referral_code               varchar,
  referred_by_code            varchar,
  created_by_id               varchar,
  created_by                  varchar,
  is_sample                   boolean default false,
  created_date                timestamptz default now(),
  updated_date                timestamptz default now()
);
create trigger users_set_updated before update on users for each row execute function set_updated_date();
create index on users (email);
create index on users (account_type);

-- ============================================================
-- curricula
-- ============================================================

create table curricula (
  id                       varchar primary key default gen_id(),
  teacher_id               varchar not null references users(id) on delete cascade,
  subject_name             varchar not null,
  curriculum_difficulty    varchar not null
                             check (curriculum_difficulty in
                               ('Elementary','Middle','High','Undergraduate','Graduate')),
  color                    varchar default 'blue'
                             check (color in
                               ('blue','purple','pink','green','orange','red','indigo','cyan')),
  created_by_id            varchar,
  created_by               varchar,
  is_sample                boolean default false,
  created_date             timestamptz default now(),
  updated_date             timestamptz default now()
);
create trigger curricula_set_updated before update on curricula for each row execute function set_updated_date();
create index on curricula (teacher_id);

-- ============================================================
-- units
-- ============================================================

create table units (
  id              varchar primary key default gen_id(),
  curriculum_id   varchar not null references curricula(id) on delete cascade,
  unit_name       varchar not null,
  unit_order      integer not null,
  icon            varchar,
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger units_set_updated before update on units for each row execute function set_updated_date();
create index on units (curriculum_id, unit_order);

-- ============================================================
-- subunits
-- ============================================================

create table subunits (
  id                  varchar primary key default gen_id(),
  unit_id             varchar not null references units(id) on delete cascade,
  subunit_name        varchar not null,
  learning_standard   varchar,
  icon                varchar,
  icon_text           varchar,
  subunit_order       integer,
  created_by_id       varchar,
  created_by          varchar,
  is_sample           boolean default false,
  created_date        timestamptz default now(),
  updated_date        timestamptz default now()
);
create trigger subunits_set_updated before update on subunits for each row execute function set_updated_date();
create index on subunits (unit_id, subunit_order);
create index on subunits (subunit_name);

-- ============================================================
-- classes
-- ============================================================

create table classes (
  id              varchar primary key default gen_id(),
  teacher_id      varchar not null references users(id) on delete cascade,
  class_name      varchar not null,
  curriculum_id   varchar not null references curricula(id) on delete cascade,
  join_code       varchar unique not null,
  is_questathon   boolean default false,
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger classes_set_updated before update on classes for each row execute function set_updated_date();
create index on classes (teacher_id);
create index on classes (join_code);

-- ============================================================
-- student_enrollments
-- ============================================================

create table student_enrollments (
  id                  varchar primary key default gen_id(),
  student_id          varchar not null references users(id) on delete cascade,
  class_id            varchar not null references classes(id) on delete cascade,
  student_full_name   varchar,
  student_email       varchar,
  enrollment_date     timestamptz default now(),
  created_by_id       varchar,
  created_by          varchar,
  is_sample           boolean default false,
  created_date        timestamptz default now(),
  updated_date        timestamptz default now(),
  unique (student_id, class_id)
);
create trigger student_enrollments_set_updated before update on student_enrollments for each row execute function set_updated_date();
create index on student_enrollments (class_id);
create index on student_enrollments (student_id);

-- ============================================================
-- videos
-- ============================================================

create table videos (
  id                varchar primary key default gen_id(),
  subunit_id        varchar not null references subunits(id) on delete cascade,
  video_url         varchar not null,
  video_transcript  text,
  duration_seconds  numeric,
  created_by_id     varchar,
  created_by        varchar,
  is_sample         boolean default false,
  created_date      timestamptz default now(),
  updated_date      timestamptz default now()
);
create trigger videos_set_updated before update on videos for each row execute function set_updated_date();
create index on videos (subunit_id);

-- ============================================================
-- articles
-- ============================================================

create table articles (
  id                     varchar primary key default gen_id(),
  subunit_id             varchar not null references subunits(id) on delete cascade,
  video_id               varchar references videos(id) on delete set null,
  text                   text not null,
  reading_time_minutes   numeric,
  created_by_id          varchar,
  created_by             varchar,
  is_sample              boolean default false,
  created_date           timestamptz default now(),
  updated_date           timestamptz default now()
);
create trigger articles_set_updated before update on articles for each row execute function set_updated_date();
create index on articles (subunit_id);

-- ============================================================
-- quizzes
-- ============================================================

create table quizzes (
  id              varchar primary key default gen_id(),
  subunit_id      varchar not null references subunits(id) on delete cascade,
  quiz_type       varchar check (quiz_type in ('new_topic','review')),
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger quizzes_set_updated before update on quizzes for each row execute function set_updated_date();
create index on quizzes (subunit_id, quiz_type);

-- ============================================================
-- questions
-- ============================================================

create table questions (
  id                varchar primary key default gen_id(),
  quiz_id           varchar not null references quizzes(id) on delete cascade,
  question_text     text not null,
  choice_1          text,
  choice_2          text,
  choice_3          text,
  choice_4          text,
  correct_choice    integer check (correct_choice between 1 and 4),
  question_order    integer,
  difficulty        varchar check (difficulty in ('easy','medium','hard')),
  created_by_id     varchar,
  created_by        varchar,
  is_sample         boolean default false,
  created_date      timestamptz default now(),
  updated_date      timestamptz default now()
);
create trigger questions_set_updated before update on questions for each row execute function set_updated_date();
create index on questions (quiz_id, question_order);
create index on questions (difficulty);

-- ============================================================
-- attention_checks
-- ============================================================

create table attention_checks (
  id              varchar primary key default gen_id(),
  video_id        varchar not null references videos(id) on delete cascade,
  timestamp       numeric not null,
  question        text not null,
  choice_a        text,
  choice_b        text,
  choice_c        text,
  choice_d        text,
  correct_choice  varchar check (correct_choice in ('A','B','C','D')),
  check_order     integer,
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger attention_checks_set_updated before update on attention_checks for each row execute function set_updated_date();
create index on attention_checks (video_id, check_order);

-- ============================================================
-- attention_check_responses
-- ============================================================

create table attention_check_responses (
  id                  varchar primary key default gen_id(),
  student_id          varchar not null references users(id) on delete cascade,
  video_id            varchar references videos(id) on delete set null,
  attention_check_id  varchar references attention_checks(id) on delete set null,
  subunit_id          varchar references subunits(id) on delete set null,
  session_type        varchar,
  selected_choice     varchar,
  is_correct          boolean,
  timestamp           numeric,
  created_by_id       varchar,
  created_by          varchar,
  is_sample           boolean default false,
  created_date        timestamptz default now(),
  updated_date        timestamptz default now()
);
create trigger attention_check_responses_set_updated before update on attention_check_responses for each row execute function set_updated_date();
create index on attention_check_responses (student_id);
create index on attention_check_responses (video_id);

-- ============================================================
-- quiz_results
-- ============================================================

create table quiz_results (
  id                varchar primary key default gen_id(),
  student_id        varchar not null references users(id) on delete cascade,
  quiz_id           varchar not null references quizzes(id) on delete cascade,
  score             numeric,
  correct_answers   integer,
  total_questions   integer,
  completed_at      timestamptz,
  created_by_id     varchar,
  created_by        varchar,
  is_sample         boolean default false,
  created_date      timestamptz default now(),
  updated_date      timestamptz default now()
);
create trigger quiz_results_set_updated before update on quiz_results for each row execute function set_updated_date();
create index on quiz_results (student_id, quiz_id);

-- ============================================================
-- question_responses
-- ============================================================

create table question_responses (
  id              varchar primary key default gen_id(),
  student_id      varchar not null references users(id) on delete cascade,
  quiz_id         varchar references quizzes(id) on delete set null,
  question_id     varchar references questions(id) on delete set null,
  subunit_id      varchar references subunits(id) on delete set null,
  session_type    varchar check (session_type in ('new_topic','review')),
  selected_choice integer,
  is_correct      boolean,
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger question_responses_set_updated before update on question_responses for each row execute function set_updated_date();
create index on question_responses (student_id, subunit_id, session_type);
create index on question_responses (question_id);

-- ============================================================
-- learning_sessions
-- ============================================================

create table learning_sessions (
  id                  varchar primary key default gen_id(),
  student_id          varchar not null references users(id) on delete cascade,
  subunit_id          varchar not null references subunits(id) on delete cascade,
  session_type        varchar check (session_type in ('new_topic','review')),
  start_time          timestamptz not null default now(),
  end_time            timestamptz,
  total_time_seconds  numeric,
  completed           boolean default false,
  review_number       integer,
  score               numeric,
  created_by_id       varchar,
  created_by          varchar,
  is_sample           boolean default false,
  created_date        timestamptz default now(),
  updated_date        timestamptz default now()
);
create trigger learning_sessions_set_updated before update on learning_sessions for each row execute function set_updated_date();
create index on learning_sessions (student_id, subunit_id);
create index on learning_sessions (student_id, completed, start_time desc);

-- ============================================================
-- student_progress
-- ============================================================

create table student_progress (
  id                      varchar primary key default gen_id(),
  student_id              varchar not null references users(id) on delete cascade,
  subunit_id              varchar not null references subunits(id) on delete cascade,
  new_session_completed   boolean default false,
  new_session_score       numeric,
  learned_status          boolean default false,
  urgency_status          varchar check (urgency_status in ('Low','Medium','Critical')),
  next_review_date        timestamptz,
  last_review_date        timestamptz,
  review_count            integer default 0,
  last_review_score       numeric,
  created_by_id           varchar,
  created_by              varchar,
  is_sample               boolean default false,
  created_date            timestamptz default now(),
  updated_date            timestamptz default now(),
  unique (student_id, subunit_id)
);
create trigger student_progress_set_updated before update on student_progress for each row execute function set_updated_date();
create index on student_progress (student_id);
create index on student_progress (next_review_date);

-- ============================================================
-- inquiry_sessions
-- ============================================================

create table inquiry_sessions (
  id                              varchar primary key default gen_id(),
  subunit_id                      varchar not null references subunits(id) on delete cascade,
  video_id                        varchar references videos(id) on delete set null,
  hook_image_prompt               text,
  hook_image_url                  text,
  hook_question                   text,
  anchor_question                 text,
  anchor_options                  jsonb,
  anchor_correct_index            integer,
  anchor_correct_feedback         text,
  anchor_wrong_feedback           text,
  bridge_question                 text,
  bridge_options                  jsonb,
  bridge_correct_index            integer,
  bridge_correct_feedback         text,
  bridge_wrong_feedback           text,
  stress_test_fr_question         text,
  stress_test_mc_question         text,
  stress_test_mc_options          jsonb,
  stress_test_mc_correct_index    integer,
  stress_test_feedback            text,
  transfer_scenario               text,
  transfer_question               text,
  socratic_system_prompt          text,
  relevant_past_memories          jsonb,
  created_by_id                   varchar,
  created_by                      varchar,
  is_sample                       boolean default false,
  created_date                    timestamptz default now(),
  updated_date                    timestamptz default now()
);
create trigger inquiry_sessions_set_updated before update on inquiry_sessions for each row execute function set_updated_date();
create index on inquiry_sessions (subunit_id);

-- ============================================================
-- inquiry_responses
-- ============================================================

create table inquiry_responses (
  id                    varchar primary key default gen_id(),
  student_id            varchar not null references users(id) on delete cascade,
  subunit_id            varchar references subunits(id) on delete set null,
  inquiry_session_id    varchar references inquiry_sessions(id) on delete set null,
  initial_guess         text,
  conversation_history  jsonb,
  created_by_id         varchar,
  created_by            varchar,
  is_sample             boolean default false,
  created_date          timestamptz default now(),
  updated_date          timestamptz default now()
);
create trigger inquiry_responses_set_updated before update on inquiry_responses for each row execute function set_updated_date();
create index on inquiry_responses (student_id);
create index on inquiry_responses (subunit_id);

-- ============================================================
-- case_studies
-- ============================================================

create table case_studies (
  id            varchar primary key default gen_id(),
  subunit_id    varchar not null references subunits(id) on delete cascade,
  video_id      varchar references videos(id) on delete set null,
  scenario      text,
  question_a    text,
  question_b    text,
  question_c    text,
  question_d    text,
  answer_a      text,
  answer_b      text,
  answer_c      text,
  answer_d      text,
  created_by_id varchar,
  created_by    varchar,
  is_sample     boolean default false,
  created_date  timestamptz default now(),
  updated_date  timestamptz default now()
);
create trigger case_studies_set_updated before update on case_studies for each row execute function set_updated_date();
create index on case_studies (subunit_id);

-- ============================================================
-- case_study_responses
-- ============================================================

create table case_study_responses (
  id              varchar primary key default gen_id(),
  student_id      varchar not null references users(id) on delete cascade,
  case_study_id   varchar references case_studies(id) on delete set null,
  subunit_id      varchar references subunits(id) on delete set null,
  answer_a        text,
  answer_b        text,
  answer_c        text,
  answer_d        text,
  score_a         numeric,
  score_b         numeric,
  score_c         numeric,
  score_d         numeric,
  feedback_a      text,
  feedback_b      text,
  feedback_c      text,
  feedback_d      text,
  total_score     numeric,
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger case_study_responses_set_updated before update on case_study_responses for each row execute function set_updated_date();
create index on case_study_responses (student_id);

-- ============================================================
-- assignments
-- ============================================================

create table assignments (
  id              varchar primary key default gen_id(),
  teacher_id      varchar references users(id) on delete set null,
  class_id        varchar not null references classes(id) on delete cascade,
  subunit_id      varchar not null references subunits(id) on delete cascade,
  due_date        date,
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger assignments_set_updated before update on assignments for each row execute function set_updated_date();
create index on assignments (class_id);
create index on assignments (due_date);

-- ============================================================
-- session_feedback
-- ============================================================

create table session_feedback (
  id                       varchar primary key default gen_id(),
  student_id               varchar not null references users(id) on delete cascade,
  subunit_id               varchar references subunits(id) on delete set null,
  subunit_name             varchar,
  class_id                 varchar references classes(id) on delete set null,
  session_id               varchar,
  session_type             varchar check (session_type in ('new_topic','review')),
  emoji_score              integer,
  difficulty               integer,
  tags                     jsonb,
  conditional_response     text,
  text_feedback            text,
  feedback_quality_score   integer,
  panda_points_awarded     integer,
  skipped                  boolean default false,
  submitted_at             timestamptz,
  created_by_id            varchar,
  created_by               varchar,
  is_sample                boolean default false,
  created_date             timestamptz default now(),
  updated_date             timestamptz default now()
);
create trigger session_feedback_set_updated before update on session_feedback for each row execute function set_updated_date();
create index on session_feedback (student_id);
create index on session_feedback (class_id, subunit_id);

-- ============================================================
-- live_sessions
-- ============================================================

create table live_sessions (
  id              varchar primary key default gen_id(),
  teacher_id      varchar references users(id) on delete set null,
  class_id        varchar references classes(id) on delete set null,
  title           varchar,
  join_code       varchar unique,
  start_time      timestamptz,
  end_time        timestamptz,
  status          varchar,
  current_phase   varchar,
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger live_sessions_set_updated before update on live_sessions for each row execute function set_updated_date();
create index on live_sessions (class_id);

create table live_session_participants (
  id                varchar primary key default gen_id(),
  live_session_id   varchar references live_sessions(id) on delete cascade,
  student_id        varchar references users(id) on delete cascade,
  current_phase     varchar,
  joined_at         timestamptz default now(),
  created_by_id     varchar,
  created_by        varchar,
  is_sample         boolean default false,
  created_date      timestamptz default now(),
  updated_date      timestamptz default now()
);
create trigger live_session_participants_set_updated before update on live_session_participants for each row execute function set_updated_date();
create index on live_session_participants (live_session_id);

create table live_session_responses (
  id                varchar primary key default gen_id(),
  live_session_id   varchar references live_sessions(id) on delete cascade,
  student_id        varchar references users(id) on delete cascade,
  question_id       varchar,
  response          text,
  is_correct        boolean,
  created_by_id     varchar,
  created_by        varchar,
  is_sample         boolean default false,
  created_date      timestamptz default now(),
  updated_date      timestamptz default now()
);
create trigger live_session_responses_set_updated before update on live_session_responses for each row execute function set_updated_date();
create index on live_session_responses (live_session_id);

-- ============================================================
-- video_question_responses
-- ============================================================

create table video_question_responses (
  id              varchar primary key default gen_id(),
  student_id      varchar references users(id) on delete cascade,
  video_id        varchar references videos(id) on delete set null,
  question_id     varchar,
  selected_choice varchar,
  is_correct      boolean,
  timestamp       numeric,
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger video_question_responses_set_updated before update on video_question_responses for each row execute function set_updated_date();
create index on video_question_responses (video_id);

-- ============================================================
-- achievements
-- ============================================================

create table achievements (
  id              varchar primary key default gen_id(),
  student_id      varchar not null references users(id) on delete cascade,
  type            varchar check (type in ('Day Streak','Subtopic Learning')),
  name            varchar,
  criteria        text,
  date_awarded    timestamptz default now(),
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger achievements_set_updated before update on achievements for each row execute function set_updated_date();
create index on achievements (student_id);

-- ============================================================
-- notifications
-- ============================================================

create table notifications (
  id            varchar primary key default gen_id(),
  user_id       varchar not null references users(id) on delete cascade,
  type          varchar,
  title         varchar,
  message       text,
  subunit_id    varchar references subunits(id) on delete set null,
  action_url    varchar,
  read          boolean default false,
  created_by_id varchar,
  created_by    varchar,
  is_sample     boolean default false,
  created_date  timestamptz default now(),
  updated_date  timestamptz default now()
);
create trigger notifications_set_updated before update on notifications for each row execute function set_updated_date();
create index on notifications (user_id, read);

-- ============================================================
-- unit_images
-- ============================================================

create table unit_images (
  id            varchar primary key default gen_id(),
  unit_id       varchar not null references units(id) on delete cascade,
  image_url     text,
  created_by_id varchar,
  created_by    varchar,
  is_sample     boolean default false,
  created_date  timestamptz default now(),
  updated_date  timestamptz default now()
);
create trigger unit_images_set_updated before update on unit_images for each row execute function set_updated_date();
create index on unit_images (unit_id);

-- ============================================================
-- questathon_tests
-- ============================================================

create table questathon_tests (
  id                varchar primary key default gen_id(),
  student_id        varchar not null references users(id) on delete cascade,
  class_id          varchar references classes(id) on delete set null,
  test_type         varchar check (test_type in ('pre_test','post_test')),
  score             numeric,
  correct_answers   integer,
  total_questions   integer,
  answers           jsonb,
  completed_at      timestamptz,
  created_by_id     varchar,
  created_by        varchar,
  is_sample         boolean default false,
  created_date      timestamptz default now(),
  updated_date      timestamptz default now()
);
create trigger questathon_tests_set_updated before update on questathon_tests for each row execute function set_updated_date();
create index on questathon_tests (student_id, class_id, test_type);

-- ============================================================
-- test_improvements
-- ============================================================

create table test_improvements (
  id                       varchar primary key default gen_id(),
  student_id               varchar not null references users(id) on delete cascade,
  class_id                 varchar references classes(id) on delete set null,
  curriculum_id            varchar references curricula(id) on delete set null,
  pretest_score            numeric,
  posttest_score           numeric,
  improvement_percentage   numeric,
  improvement_rate         numeric,
  categories               jsonb,
  pretest_completed_at     timestamptz,
  posttest_completed_at    timestamptz,
  created_by_id            varchar,
  created_by               varchar,
  is_sample                boolean default false,
  created_date             timestamptz default now(),
  updated_date             timestamptz default now()
);
create trigger test_improvements_set_updated before update on test_improvements for each row execute function set_updated_date();
create index on test_improvements (student_id, class_id);

-- ============================================================
-- questathon_points
-- ============================================================

create table questathon_points (
  id              varchar primary key default gen_id(),
  student_id      varchar not null references users(id) on delete cascade,
  class_id        varchar references classes(id) on delete set null,
  student_name    varchar,
  points          numeric,
  reason          varchar,
  reference_id    varchar,
  created_by_id   varchar,
  created_by      varchar,
  is_sample       boolean default false,
  created_date    timestamptz default now(),
  updated_date    timestamptz default now()
);
create trigger questathon_points_set_updated before update on questathon_points for each row execute function set_updated_date();
create index on questathon_points (class_id, student_id);

-- ============================================================
-- questathon_referrals
-- ============================================================

create table questathon_referrals (
  id                          varchar primary key default gen_id(),
  referrer_id                 varchar references users(id) on delete set null,
  referred_id                 varchar references users(id) on delete set null,
  referral_code               varchar,
  points_awarded              boolean default false,
  referred_reached_threshold  boolean default false,
  created_by_id               varchar,
  created_by                  varchar,
  is_sample                   boolean default false,
  created_date                timestamptz default now(),
  updated_date                timestamptz default now()
);
create trigger questathon_referrals_set_updated before update on questathon_referrals for each row execute function set_updated_date();
create index on questathon_referrals (referrer_id);
create index on questathon_referrals (referred_id);

-- ============================================================
-- referral_codes
-- ============================================================

create table referral_codes (
  id            varchar primary key default gen_id(),
  student_id    varchar references users(id) on delete cascade,
  code          varchar unique not null,
  is_active     boolean default true,
  created_by_id varchar,
  created_by    varchar,
  is_sample     boolean default false,
  created_date  timestamptz default now(),
  updated_date  timestamptz default now()
);
create trigger referral_codes_set_updated before update on referral_codes for each row execute function set_updated_date();
create index on referral_codes (student_id);

-- ============================================================
-- questathon_feedback
-- ============================================================

create table questathon_feedback (
  id                    varchar primary key default gen_id(),
  student_id            varchar not null references users(id) on delete cascade,
  subunit_id            varchar references subunits(id) on delete set null,
  class_id              varchar references classes(id) on delete set null,
  feedback_text         text,
  word_count            integer,
  points_awarded        boolean default false,
  learning_session_id   varchar references learning_sessions(id) on delete set null,
  created_by_id         varchar,
  created_by            varchar,
  is_sample             boolean default false,
  created_date          timestamptz default now(),
  updated_date          timestamptz default now()
);
create trigger questathon_feedback_set_updated before update on questathon_feedback for each row execute function set_updated_date();
create index on questathon_feedback (student_id);

-- ============================================================
-- RLS — enable everywhere, with permissive policies for now.
--      Tightening to per-role policies is a follow-up task.
-- ============================================================

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t);
    execute format(
      'create policy %I on %I for select to anon using (true)',
      t || '_anon_select', t);
  end loop;
end $$;

-- ============================================================
-- auth.users → public.users sync
--   On every new auth.users row, create a matching public.users row,
--   reusing the existing record if a public.users entry already exists
--   for that email (this is how imported Quest users get linked when
--   they sign in with Google for the first time).
-- ============================================================

create or replace function handle_new_auth_user() returns trigger as $$
declare
  existing_user_id varchar;
begin
  select id into existing_user_id from public.users where email = new.email;

  if existing_user_id is not null then
    update public.users
       set auth_user_id = new.id,
           full_name = coalesce(public.users.full_name, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
           updated_date = now()
     where id = existing_user_id;
  else
    insert into public.users (auth_user_id, email, full_name)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email)
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
