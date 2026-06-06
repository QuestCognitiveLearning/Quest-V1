-- Lifecycle drip needs more state on each lead than the original Day-0-only
-- design. Additive only — no drops; existing rows get sensible defaults.

alter table public.leads
  add column if not exists first_name              text,
  add column if not exists generations_used        integer not null default 0,
  add column if not exists generations_limit       integer not null default 5,
  add column if not exists trial_started_at        timestamptz,
  add column if not exists trial_expired_at        timestamptz,
  add column if not exists converted_to_paid       boolean not null default false,
  add column if not exists sequence_phase          text not null default 'phase_1',
  add column if not exists first_class_at          timestamptz,
  add column if not exists first_student_quiz_at  timestamptz,
  add column if not exists unsubscribe_token       text;

-- Relax email_sequence_status enum; the email_log table is the new source of
-- truth for what was sent. Keep the column as a coarse phase indicator only.
do $$ begin
  alter table public.leads drop constraint if exists leads_email_sequence_status_check;
exception when undefined_object then null;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_sequence_phase_check'
  ) then
    alter table public.leads
      add constraint leads_sequence_phase_check
        check (sequence_phase in ('phase_1','phase_2','phase_3','phase_4','quarterly','unsubscribed'));
  end if;
end $$;

-- One-click unsubscribe token; generated lazily on first email send so old
-- rows pick it up without a backfill.
create index if not exists leads_sequence_phase_idx on public.leads (sequence_phase)
  where unsubscribed_at is null;
create index if not exists leads_unsubscribe_token_idx on public.leads (unsubscribe_token)
  where unsubscribe_token is not null;
