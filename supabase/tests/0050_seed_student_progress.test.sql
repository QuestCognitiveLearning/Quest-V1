-- Tests for seed_student_progress() (migration 0050, task A-B1).
-- Runs inside a transaction and rolls back — safe on the scratch stack.
begin;

-- ---------------------------------------------------------------------------
-- Fixture: teacher, curriculum (1 unit, 3 subunits), class; a second
-- curriculum/class pair for the self-seed case; two students with auth rows.
--
-- Students go through auth.users so handle_new_auth_user provisions their
-- public.users rows exactly as production does (the trigger requires an
-- email); we then stamp account_type and mint stable aliases for the test.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'seedtest-stud1@test.local'),
  ('00000000-0000-4000-8000-00000000a002', 'seedtest-stud2@test.local');

update public.users set account_type = 'student', full_name = 'Seed Student'
 where auth_user_id = '00000000-0000-4000-8000-00000000a001';
update public.users set account_type = 'student', full_name = 'Other Student'
 where auth_user_id = '00000000-0000-4000-8000-00000000a002';

-- Re-key the trigger-generated ids to the stable aliases used below.
update public.users set id = 't_stud1'
 where auth_user_id = '00000000-0000-4000-8000-00000000a001';
update public.users set id = 't_stud2'
 where auth_user_id = '00000000-0000-4000-8000-00000000a002';

insert into public.users (id, email, full_name, account_type, auth_user_id) values
  ('t_teach1', 'seedtest-teacher@test.local', 'Seed Teacher', 'teacher', null);

insert into public.curricula (id, teacher_id, subject_name, curriculum_difficulty) values
  ('t_curr1', 't_teach1', 'Biology', 'High'),
  ('t_curr2', 't_teach1', 'Chemistry', 'High');

insert into public.units (id, curriculum_id, unit_name, unit_order) values
  ('t_unit1', 't_curr1', 'Cells', 1),
  ('t_unit2', 't_curr2', 'Atoms', 1);

insert into public.subunits (id, unit_id, subunit_name) values
  ('t_sub1', 't_unit1', 'Membranes'),
  ('t_sub2', 't_unit1', 'Organelles'),
  ('t_sub3', 't_unit1', 'Mitosis'),
  ('t_sub4', 't_unit2', 'Protons');

insert into public.classes (id, teacher_id, class_name, curriculum_id, join_code) values
  ('t_cls1', 't_teach1', 'Bio P1',  't_curr1', 'SEED01'),
  ('t_cls2', 't_teach1', 'Chem P2', 't_curr2', 'SEED02'),
  ('t_cls3', 't_teach1', 'No Curriculum Yet', null, 'SEED03');

-- ---------------------------------------------------------------------------
-- 1+2. Service role seeds 3 rows for the curriculum class; re-run seeds 0.
-- 3. A curriculum-less class seeds 0 without erroring.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
begin
  assert public.seed_student_progress('t_stud1', 't_cls1') = 3,
    'service role first seed should insert 3 rows';
  assert public.seed_student_progress('t_stud1', 't_cls1') = 0,
    'second seed must be a no-op (idempotent)';
  assert (select count(*) from public.student_progress
           where student_id = 't_stud1') = 3,
    'exactly 3 progress rows exist';
  assert public.seed_student_progress('t_stud1', 't_cls3') = 0,
    'class without curriculum seeds nothing';
end $$;

-- ---------------------------------------------------------------------------
-- 4. A student may seed their own rows (lazy client path).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a001', true);
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-4000-8000-00000000a001"}', true);

do $$
begin
  assert public.seed_student_progress('t_stud1', 't_cls2') = 1,
    'student self-seed for a new curriculum inserts its subunit row';
end $$;

-- ---------------------------------------------------------------------------
-- 5. A different student may NOT seed someone else's rows.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-4000-8000-00000000a002"}', true);

do $$
declare
  v int;
begin
  begin
    v := public.seed_student_progress('t_stud1', 't_cls1');
    raise exception 'impostor seed should have been rejected';
  exception
    when others then
      if sqlerrm like '%not allowed for this student%' then
        null; -- expected rejection
      else
        raise;
      end if;
  end;
end $$;

rollback;
