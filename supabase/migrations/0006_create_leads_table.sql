-- Anonymous leads captured by the public lead-magnet funnel at /Try
-- (and the alias /quiz-from-video). One row per email submission per session.
-- No FK to auth.users: leads are pre-signup. Service role + admins read.

create table if not exists public.leads (
  id                         uuid primary key default gen_random_uuid(),
  email                      text not null,
  source                     text not null default 'youtube_funnel',
  video_url                  text,
  video_title                text,
  grade_level                text,
  subject                    text,
  generated_quiz_payload     jsonb,
  email_sequence_status      text default 'pending'
                               check (email_sequence_status in
                                 ('pending','day_0_sent','day_1_sent','day_3_sent',
                                  'day_5_sent','day_7_sent','day_14_sent','complete','bounced')),
  last_email_sent_at         timestamptz,
  converted_to_user_at       timestamptz,
  converted_user_id          varchar references public.users(id) on delete set null,
  unsubscribed_at            timestamptz,
  user_agent                 text,
  ip_hash                    text,
  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now()
);

create index if not exists leads_email_idx        on public.leads (email);
create index if not exists leads_created_at_idx   on public.leads (created_at);
create index if not exists leads_seq_status_idx   on public.leads (email_sequence_status, created_at)
  where unsubscribed_at is null;

alter table public.leads enable row level security;

-- No public policies. The service role bypasses RLS so the captureLead
-- Edge Function can write rows; the nurture cron job reads via service role
-- too. Authenticated users have no need to see leads.
create policy "Block authenticated leads access"
  on public.leads
  for all
  to authenticated
  using (false)
  with check (false);

-- updated_at maintenance
create trigger leads_set_updated
  before update on public.leads
  for each row execute function set_updated_date();
