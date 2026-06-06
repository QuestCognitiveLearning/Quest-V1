-- One row per email-in-the-funnel. Used as both schedule (rows with
-- scheduled_for in the future, sent_at NULL) and audit log (rows with
-- sent_at populated). Cancellations are soft (cancelled_at).

create table if not exists public.email_log (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads(id) on delete cascade,
  email           text not null,
  sequence_id     text not null,  -- 'A1','A2','B','C','D','E1','E2','E3','E4','T0'...
  trigger_type    text not null check (trigger_type in ('time','event')),
  scheduled_for   timestamptz not null,
  sent_at         timestamptz,
  cancelled_at    timestamptz,
  cancelled_reason text,
  resend_id       text,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  bounced         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists email_log_due_idx
  on public.email_log (scheduled_for)
  where sent_at is null and cancelled_at is null;

create index if not exists email_log_lead_idx
  on public.email_log (lead_id, sequence_id);

alter table public.email_log enable row level security;

-- Service role only; the cron job + edge functions use the service key.
create policy "Block authenticated email_log access"
  on public.email_log
  for all
  to authenticated
  using (false)
  with check (false);
