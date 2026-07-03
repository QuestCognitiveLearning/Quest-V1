-- 0046_district_admin_role.sql
-- Add 'district_admin' as a third account_type.
--
-- Before this migration, ClassLink roles like "admin", "tenant", "district"
-- all collapsed into account_type='teacher' via the classlinkSso mapRole()
-- helper. That worked as a stopgap but meant we couldn't surface a distinct
-- county/district-admin experience, and district admins showed up in the
-- teacher directory.
--
-- After this migration:
--   - users.account_type accepts 'district_admin'.
--   - classlinkSso mapRole() (see 0043-adjacent code change) will route
--     admin/tenant/district roles to 'district_admin' going forward.
--   - Existing rows are untouched — every user is currently 'teacher' or
--     'student' and stays that way. New district admin sign-ins will be
--     labeled correctly on first provisioning.

alter table public.users
  drop constraint if exists users_account_type_check;

alter table public.users
  add constraint users_account_type_check
    check (account_type in ('teacher','student','district_admin'));
