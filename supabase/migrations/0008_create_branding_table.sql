-- Per-user branding (logo, business name, contact). Used by Studio tutors
-- to brand PDFs + parent emails. RLS: a user reads and writes their own row.

create table if not exists public.branding (
  user_id         varchar primary key references public.users(id) on delete cascade,
  logo_url        text,
  business_name   text,
  tutor_name      text,
  contact_email   text,
  contact_phone   text,
  website         text,
  accent_color    text default '#2563EB',
  updated_at      timestamptz default now()
);

alter table public.branding enable row level security;

drop policy if exists "Users read own branding" on public.branding;
create policy "Users read own branding"
  on public.branding
  for select
  using (
    exists (
      select 1 from public.users u
      where u.id = branding.user_id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Users write own branding" on public.branding;
create policy "Users write own branding"
  on public.branding
  for all
  using (
    exists (
      select 1 from public.users u
      where u.id = branding.user_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = branding.user_id
        and u.auth_user_id = auth.uid()
    )
  );

create trigger branding_set_updated
  before update on public.branding
  for each row execute function set_updated_date();
