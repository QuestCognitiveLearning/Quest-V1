-- Studio booking system. Three tables, all owned by a tutor:
--   * tutor_availability  — weekly recurring availability windows
--   * tutor_blocked_dates — one-off blackout dates (vacation, holidays)
--   * bookings            — confirmed/cancelled appointments. A confirmed
--                            booking ALSO creates a classes row via the
--                            existing class creation flow; we link them so
--                            cancellations can find the class to update.
--
-- Public RLS:
--   * availability + blocked_dates are PUBLIC-READ so the unauthenticated
--     /Book/:slug page can render the calendar.
--   * bookings are PUBLIC-INSERT (no read) — a visitor can book, but cannot
--     query other people's bookings to derive someone's schedule.
--   * tutor reads/manages all of their rows.

create table if not exists public.tutor_availability (
  id           varchar primary key default gen_id(),
  tutor_id     varchar not null references public.users(id) on delete cascade,
  day_of_week  integer not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null check (end_time > start_time),
  time_zone    text default 'America/New_York',
  created_at   timestamptz default now()
);
create index if not exists tutor_availability_tutor_idx
  on public.tutor_availability (tutor_id, day_of_week);

create table if not exists public.tutor_blocked_dates (
  id            varchar primary key default gen_id(),
  tutor_id      varchar not null references public.users(id) on delete cascade,
  blocked_date  date not null,
  reason        text,
  created_at    timestamptz default now()
);
create index if not exists tutor_blocked_dates_idx
  on public.tutor_blocked_dates (tutor_id, blocked_date);

create table if not exists public.bookings (
  id                    varchar primary key default gen_id(),
  tutor_id              varchar not null references public.users(id) on delete cascade,
  class_id              varchar references public.classes(id) on delete set null,
  student_first_name    text not null,
  student_last_name     text,
  parent_name           text not null,
  parent_email          text not null,
  parent_phone          text,
  notes                 text,
  booked_for            timestamptz not null,
  duration_minutes      integer not null default 60,
  status                text default 'confirmed'
                         check (status in ('confirmed','cancelled','completed')),
  cancellation_reason   text,
  cancelled_at          timestamptz,
  created_at            timestamptz default now()
);
create index if not exists bookings_tutor_idx
  on public.bookings (tutor_id, booked_for);

alter table public.tutor_availability  enable row level security;
alter table public.tutor_blocked_dates enable row level security;
alter table public.bookings            enable row level security;

-- Tutor manages own rows
drop policy if exists "Tutors manage own availability" on public.tutor_availability;
create policy "Tutors manage own availability"
  on public.tutor_availability
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = tutor_availability.tutor_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = tutor_availability.tutor_id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Tutors manage own blocked dates" on public.tutor_blocked_dates;
create policy "Tutors manage own blocked dates"
  on public.tutor_blocked_dates
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = tutor_blocked_dates.tutor_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = tutor_blocked_dates.tutor_id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Tutors manage own bookings" on public.bookings;
create policy "Tutors manage own bookings"
  on public.bookings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = bookings.tutor_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = bookings.tutor_id
        and u.auth_user_id = auth.uid()
    )
  );

-- Public read (needed for the unauthenticated /Book/:slug page)
drop policy if exists "Public reads availability" on public.tutor_availability;
create policy "Public reads availability"
  on public.tutor_availability
  for select to public using (true);

drop policy if exists "Public reads blocked dates" on public.tutor_blocked_dates;
create policy "Public reads blocked dates"
  on public.tutor_blocked_dates
  for select to public using (true);

-- Public insert (a visitor can create their own booking)
drop policy if exists "Public creates bookings" on public.bookings;
create policy "Public creates bookings"
  on public.bookings
  for insert to public with check (true);
