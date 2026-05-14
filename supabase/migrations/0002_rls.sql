-- RLS lockdown for Quest Learning.
--
-- Access model (high level):
--   * Content (curricula, units, subunits, videos, articles, quizzes, questions,
--     attention_checks, inquiry_sessions, case_studies, unit_images):
--       - readable by ANY signed-in user (students need to browse for joining
--         classes, teachers need to browse for assembling curricula)
--       - writable only by the owning teacher (matched via curriculum chain)
--   * Classrooms (classes, assignments, live_sessions):
--       - teacher manages their own; students see classes they're enrolled in
--   * Personal records (student_progress, learning_sessions, quiz_results,
--     question_responses, attention_check_responses, inquiry_responses,
--     case_study_responses, session_feedback, questathon_tests, test_improvements,
--     questathon_points, questathon_referrals, referral_codes, questathon_feedback,
--     achievements, notifications, video_question_responses):
--       - student reads/writes their OWN rows
--       - teacher reads (NOT writes) rows of students enrolled in their classes
--   * Users:
--       - everyone reads their own row
--       - teachers read profiles of students in their classes (for class rosters)
--       - users update only their own row
--       - insert/delete handled by triggers + service role
--
-- All writes happen via PostgREST (user JWT) — Edge Functions use the
-- service-role key which bypasses RLS for admin operations.

set search_path = public;

-- ============================================================
-- 1. Drop the permissive dev-only policies from 0001_init.sql
-- ============================================================

-- Drop every existing policy on every public.* table so this migration is
-- safely re-runnable.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ============================================================
-- 2. Helpers. SECURITY DEFINER + STABLE so they can be called inside
--    policies without triggering recursion or per-row re-evaluation.
-- ============================================================

create or replace function public.my_user_id() returns varchar
language sql security definer stable
set search_path = public, pg_temp
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.my_account_type() returns varchar
language sql security definer stable
set search_path = public, pg_temp
as $$
  select account_type from public.users where auth_user_id = auth.uid() limit 1;
$$;

-- Is the current user a teacher who owns this curriculum?
create or replace function public.is_my_curriculum(c_id varchar) returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.curricula
     where id = c_id and teacher_id = public.my_user_id()
  );
$$;

-- Is the current user a teacher who owns this class?
create or replace function public.is_my_class(c_id varchar) returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.classes
     where id = c_id and teacher_id = public.my_user_id()
  );
$$;

-- Is the current user enrolled in this class as a student?
create or replace function public.is_enrolled(c_id varchar) returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.student_enrollments
     where class_id = c_id and student_id = public.my_user_id()
  );
$$;

-- Is `s_id` a student in any class that the current user teaches?
create or replace function public.is_my_student(s_id varchar) returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.student_enrollments se
      join public.classes c on c.id = se.class_id
     where se.student_id = s_id and c.teacher_id = public.my_user_id()
  );
$$;

grant execute on function public.my_user_id(),
                         public.my_account_type(),
                         public.is_my_curriculum(varchar),
                         public.is_my_class(varchar),
                         public.is_enrolled(varchar),
                         public.is_my_student(varchar)
  to authenticated, anon;

-- ============================================================
-- 3. users
-- ============================================================

create policy users_read_self on users for select to authenticated
  using (id = public.my_user_id());

-- A teacher reads profiles of students enrolled in any of their classes.
create policy users_read_my_students on users for select to authenticated
  using (public.my_account_type() = 'teacher' and public.is_my_student(id));

create policy users_update_self on users for update to authenticated
  using (id = public.my_user_id())
  with check (id = public.my_user_id());

-- ============================================================
-- 4. CONTENT TABLES — readable by all authenticated; writable by owning teacher
-- ============================================================

-- curricula
create policy curricula_read on curricula for select to authenticated using (true);
create policy curricula_owner_write on curricula for all to authenticated
  using (teacher_id = public.my_user_id())
  with check (teacher_id = public.my_user_id());

-- units (owned via curricula.teacher_id)
create policy units_read on units for select to authenticated using (true);
create policy units_owner_write on units for all to authenticated
  using (public.is_my_curriculum(curriculum_id))
  with check (public.is_my_curriculum(curriculum_id));

-- subunits (chain through unit -> curriculum)
create policy subunits_read on subunits for select to authenticated using (true);
create policy subunits_owner_write on subunits for all to authenticated
  using (
    exists (
      select 1 from units u
       where u.id = subunits.unit_id and public.is_my_curriculum(u.curriculum_id)
    )
  )
  with check (
    exists (
      select 1 from units u
       where u.id = subunits.unit_id and public.is_my_curriculum(u.curriculum_id)
    )
  );

-- videos / articles / quizzes / inquiry_sessions / case_studies (via subunit -> unit -> curriculum)
do $$
declare t text;
begin
  for t in select unnest(array['videos','articles','quizzes','inquiry_sessions','case_studies'])
  loop
    execute format($f$
      create policy %1$I_read on %1$I for select to authenticated using (true);
      create policy %1$I_owner_write on %1$I for all to authenticated
        using (
          exists (
            select 1 from subunits s
             join units u on u.id = s.unit_id
            where s.id = %1$I.subunit_id and public.is_my_curriculum(u.curriculum_id)
          )
        )
        with check (
          exists (
            select 1 from subunits s
             join units u on u.id = s.unit_id
            where s.id = %1$I.subunit_id and public.is_my_curriculum(u.curriculum_id)
          )
        );
    $f$, t);
  end loop;
end $$;

-- questions (via quiz -> subunit -> unit -> curriculum)
create policy questions_read on questions for select to authenticated using (true);
create policy questions_owner_write on questions for all to authenticated
  using (
    exists (
      select 1 from quizzes q
       join subunits s on s.id = q.subunit_id
       join units u on u.id = s.unit_id
      where q.id = questions.quiz_id and public.is_my_curriculum(u.curriculum_id)
    )
  )
  with check (
    exists (
      select 1 from quizzes q
       join subunits s on s.id = q.subunit_id
       join units u on u.id = s.unit_id
      where q.id = questions.quiz_id and public.is_my_curriculum(u.curriculum_id)
    )
  );

-- attention_checks (via video -> subunit -> unit -> curriculum)
create policy attention_checks_read on attention_checks for select to authenticated using (true);
create policy attention_checks_owner_write on attention_checks for all to authenticated
  using (
    exists (
      select 1 from videos v
       join subunits s on s.id = v.subunit_id
       join units u on u.id = s.unit_id
      where v.id = attention_checks.video_id and public.is_my_curriculum(u.curriculum_id)
    )
  )
  with check (
    exists (
      select 1 from videos v
       join subunits s on s.id = v.subunit_id
       join units u on u.id = s.unit_id
      where v.id = attention_checks.video_id and public.is_my_curriculum(u.curriculum_id)
    )
  );

-- unit_images
create policy unit_images_read on unit_images for select to authenticated using (true);
create policy unit_images_owner_write on unit_images for all to authenticated
  using (
    exists (select 1 from units u where u.id = unit_images.unit_id and public.is_my_curriculum(u.curriculum_id))
  )
  with check (
    exists (select 1 from units u where u.id = unit_images.unit_id and public.is_my_curriculum(u.curriculum_id))
  );

-- ============================================================
-- 5. CLASSES + ENROLLMENTS + ASSIGNMENTS
-- ============================================================

-- classes: teacher manages own; students read classes they joined; any signed-in
-- user can read by join_code for the enrollment flow (a student needs to look up
-- a class by code BEFORE they're enrolled).
create policy classes_read on classes for select to authenticated using (true);
create policy classes_teacher_write on classes for all to authenticated
  using (teacher_id = public.my_user_id())
  with check (teacher_id = public.my_user_id());

-- student_enrollments: students self-enroll; teachers see their class rosters
create policy enrollments_read_self on student_enrollments for select to authenticated
  using (student_id = public.my_user_id() or public.is_my_class(class_id));
create policy enrollments_self_insert on student_enrollments for insert to authenticated
  with check (student_id = public.my_user_id());
create policy enrollments_self_delete on student_enrollments for delete to authenticated
  using (student_id = public.my_user_id() or public.is_my_class(class_id));

-- assignments
create policy assignments_read on assignments for select to authenticated
  using (public.is_enrolled(class_id) or public.is_my_class(class_id));
create policy assignments_teacher_write on assignments for all to authenticated
  using (public.is_my_class(class_id))
  with check (public.is_my_class(class_id));

-- ============================================================
-- 6. PERSONAL STUDENT RECORDS
--    Student: full CRUD on own. Teacher: read-only for students in their classes.
-- ============================================================

do $$
declare t text;
begin
  for t in select unnest(array[
    'student_progress','learning_sessions','quiz_results',
    'question_responses','attention_check_responses','inquiry_responses',
    'case_study_responses','session_feedback','questathon_tests',
    'test_improvements','questathon_points',
    'referral_codes','questathon_feedback','achievements',
    'video_question_responses'
  ])
  loop
    execute format('drop policy if exists %I on %I', t || '_read_self', t);
    execute format('drop policy if exists %I on %I', t || '_self_insert', t);
    execute format('drop policy if exists %I on %I', t || '_self_update', t);
    execute format('drop policy if exists %I on %I', t || '_self_delete', t);
    execute format($f$
      create policy %1$I_read_self on %1$I for select to authenticated
        using (student_id = public.my_user_id() or
               (public.my_account_type() = 'teacher' and public.is_my_student(student_id)));
      create policy %1$I_self_insert on %1$I for insert to authenticated
        with check (student_id = public.my_user_id());
      create policy %1$I_self_update on %1$I for update to authenticated
        using (student_id = public.my_user_id())
        with check (student_id = public.my_user_id());
      create policy %1$I_self_delete on %1$I for delete to authenticated
        using (student_id = public.my_user_id());
    $f$, t);
  end loop;
end $$;

-- questathon_referrals uses referrer_id / referred_id (no student_id column).
drop policy if exists questathon_referrals_read on questathon_referrals;
drop policy if exists questathon_referrals_insert on questathon_referrals;
drop policy if exists questathon_referrals_update on questathon_referrals;
create policy questathon_referrals_read on questathon_referrals for select to authenticated
  using (referrer_id = public.my_user_id() or referred_id = public.my_user_id());
create policy questathon_referrals_insert on questathon_referrals for insert to authenticated
  with check (referred_id = public.my_user_id() or referrer_id = public.my_user_id());
create policy questathon_referrals_update on questathon_referrals for update to authenticated
  using (referrer_id = public.my_user_id() or referred_id = public.my_user_id())
  with check (referrer_id = public.my_user_id() or referred_id = public.my_user_id());

-- ============================================================
-- 7. notifications (user_id, not student_id)
-- ============================================================

create policy notifications_read_own on notifications for select to authenticated
  using (user_id = public.my_user_id());
create policy notifications_update_own on notifications for update to authenticated
  using (user_id = public.my_user_id())
  with check (user_id = public.my_user_id());
create policy notifications_delete_own on notifications for delete to authenticated
  using (user_id = public.my_user_id());

-- ============================================================
-- 8. live sessions
-- ============================================================

create policy live_sessions_read on live_sessions for select to authenticated
  using (public.is_my_class(class_id) or public.is_enrolled(class_id));
create policy live_sessions_teacher_write on live_sessions for all to authenticated
  using (public.is_my_class(class_id))
  with check (public.is_my_class(class_id));

create policy lsp_self on live_session_participants for all to authenticated
  using (student_id = public.my_user_id() or
         exists (select 1 from live_sessions ls
                  where ls.id = live_session_participants.live_session_id
                    and public.is_my_class(ls.class_id)))
  with check (student_id = public.my_user_id());

create policy lsr_self on live_session_responses for all to authenticated
  using (student_id = public.my_user_id() or
         exists (select 1 from live_sessions ls
                  where ls.id = live_session_responses.live_session_id
                    and public.is_my_class(ls.class_id)))
  with check (student_id = public.my_user_id());
