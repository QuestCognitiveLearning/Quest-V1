-- Per-user counter for free-tier student generations. Increments every
-- time a student account successfully invokes the Generate flow.
-- Capped at 5 in the UI for tier='free' student accounts; tier='classroom'
-- (paid student or teacher) is unbounded.

alter table public.users
  add column if not exists student_generations_used int default 0;

-- Index isn't strictly needed (we always lookup by id), but adds a tiny
-- safety net on the auth_user_id join path used by RLS-bound reads.
