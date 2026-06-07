-- live_sessions_teacher_write previously required is_my_class(class_id),
-- which evaluates false when class_id is NULL. Class-less live sessions
-- created from /Generate (a quick join-code session that doesn't belong
-- to any class) need a fallback: the teacher_id matches the caller.
--
-- Extends both the read and write policies. Same authority model — only
-- the row owner or someone with class membership can read; only the row
-- owner or class teacher can write.

drop policy if exists live_sessions_teacher_write on public.live_sessions;
create policy live_sessions_teacher_write
  on public.live_sessions
  for all
  using (
    teacher_id = public.my_user_id()
    or (class_id is not null and public.is_my_class(class_id))
  )
  with check (
    teacher_id = public.my_user_id()
    or (class_id is not null and public.is_my_class(class_id))
  );

drop policy if exists live_sessions_read on public.live_sessions;
create policy live_sessions_read
  on public.live_sessions
  for select
  using (
    teacher_id = public.my_user_id()
    or (class_id is not null and (public.is_my_class(class_id) or public.is_enrolled(class_id)))
  );

-- Students also need to be able to read a live session by its join code
-- without being enrolled (so they can join from /join). Add a separate
-- policy that grants read when the join_code matches a code the student
-- is participating in.
drop policy if exists live_sessions_participant_read on public.live_sessions;
create policy live_sessions_participant_read
  on public.live_sessions
  for select
  using (
    exists (
      select 1 from public.live_session_participants p
      where p.live_session_id = live_sessions.id
        and p.student_id = public.my_user_id()
    )
  );

-- live_session_responses + participants: anyone the row references should
-- be able to write their own response. Tighten the policies if they were
-- absent, since classless sessions break the prior class-based model.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'live_session_participants' and policyname = 'live_session_participants_self') then
    alter table public.live_session_participants enable row level security;
    create policy live_session_participants_self
      on public.live_session_participants
      for all
      using (student_id = public.my_user_id()
             or exists (select 1 from public.live_sessions s
                        where s.id = live_session_participants.live_session_id
                          and s.teacher_id = public.my_user_id()))
      with check (student_id = public.my_user_id()
                  or exists (select 1 from public.live_sessions s
                             where s.id = live_session_participants.live_session_id
                               and s.teacher_id = public.my_user_id()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'live_session_responses' and policyname = 'live_session_responses_self') then
    alter table public.live_session_responses enable row level security;
    create policy live_session_responses_self
      on public.live_session_responses
      for all
      using (student_id = public.my_user_id()
             or exists (select 1 from public.live_sessions s
                        where s.id = live_session_responses.live_session_id
                          and s.teacher_id = public.my_user_id()))
      with check (student_id = public.my_user_id()
                  or exists (select 1 from public.live_sessions s
                             where s.id = live_session_responses.live_session_id
                               and s.teacher_id = public.my_user_id()));
  end if;
end $$;
