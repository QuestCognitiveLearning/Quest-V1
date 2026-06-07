-- 0019 introduced cross-table policy references that Postgres detects as
-- mutually recursive — live_sessions.participant_read joins
-- live_session_participants, and live_session_participants.self joins
-- live_sessions. Insert/select both 500 with code 42P17.
--
-- Break the cycle by making the dependent-table policies *self-referential
-- only* (student_id checks) and using SECURITY DEFINER helper functions
-- for the teacher-side reads on those tables. Postgres treats SECURITY
-- DEFINER calls as opaque, so the planner can't recurse into them.

create or replace function public.live_session_is_teachers(p_session_id varchar)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.live_sessions s
    where s.id = p_session_id
      and s.teacher_id = public.my_user_id()
  );
$function$;

-- live_session_participants: student owns their own row OR teacher owns
-- the session. Use the SECURITY DEFINER helper for the teacher path so
-- the planner sees it as a black box (no recursion).
drop policy if exists live_session_participants_self on public.live_session_participants;
create policy live_session_participants_self
  on public.live_session_participants
  for all
  using (
    student_id = public.my_user_id()
    or public.live_session_is_teachers(live_session_id)
  )
  with check (
    student_id = public.my_user_id()
    or public.live_session_is_teachers(live_session_id)
  );

-- Same pattern for live_session_responses.
drop policy if exists live_session_responses_self on public.live_session_responses;
create policy live_session_responses_self
  on public.live_session_responses
  for all
  using (
    student_id = public.my_user_id()
    or public.live_session_is_teachers(live_session_id)
  )
  with check (
    student_id = public.my_user_id()
    or public.live_session_is_teachers(live_session_id)
  );

-- live_sessions.participant_read: rewrite to use a SECURITY DEFINER helper
-- to avoid recursion into the live_session_participants policy. Function
-- queries the underlying table directly with definer privileges.
create or replace function public.live_session_has_participant(p_session_id varchar, p_user_id varchar)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.live_session_participants
    where live_session_id = p_session_id
      and student_id = p_user_id
  );
$function$;

drop policy if exists live_sessions_participant_read on public.live_sessions;
create policy live_sessions_participant_read
  on public.live_sessions
  for select
  using (
    public.live_session_has_participant(id, public.my_user_id())
  );
