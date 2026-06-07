-- generated_handouts: a teacher's library of AI-generated content
-- (quizzes + case studies) that aren't tied to a curriculum or class.
-- Powers /Generate's library section and the "Run live without picking a
-- class" flow. The full payload is denormalized into jsonb because the
-- in-memory shape from publicTryFunnel already matches what the live
-- session, PDF, and Word exports all consume.

create table if not exists public.generated_handouts (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   varchar not null references public.users(id) on delete cascade,
  title        text not null,
  source_type  text check (source_type in ('youtube','pdf','article','standard')) default 'youtube',
  source_url   text,
  payload      jsonb not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists generated_handouts_teacher_idx
  on public.generated_handouts (teacher_id, created_at desc);

alter table public.generated_handouts enable row level security;

drop policy if exists "Teachers read own handouts" on public.generated_handouts;
create policy "Teachers read own handouts"
  on public.generated_handouts
  for select
  using (
    exists (
      select 1 from public.users u
      where u.id = generated_handouts.teacher_id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Teachers write own handouts" on public.generated_handouts;
create policy "Teachers write own handouts"
  on public.generated_handouts
  for all
  using (
    exists (
      select 1 from public.users u
      where u.id = generated_handouts.teacher_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = generated_handouts.teacher_id
        and u.auth_user_id = auth.uid()
    )
  );

create trigger generated_handouts_set_updated
  before update on public.generated_handouts
  for each row execute function set_updated_date();
