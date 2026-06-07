-- LiveSessionBuilder used to insert `current_question: 0` into live_sessions.
-- The column never existed on that table (it's on live_session_participants),
-- so every create-session call returned:
--   PGRST204 — Could not find the 'current_question' column of 'live_sessions'
--
-- The client code no longer sends the field, but cached JS bundles in users'
-- browsers still do, and Vercel's CDN can keep serving an older chunk hash
-- for tens of minutes. Adding the column is a forward-compatible no-op that
-- unblocks both old and new clients immediately.

alter table public.live_sessions
  add column if not exists current_question integer;

-- Force PostgREST to drop its schema cache so the new column is visible
-- without restarting the API.
notify pgrst, 'reload schema';
