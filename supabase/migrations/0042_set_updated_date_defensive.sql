-- Some tables (generated_handouts, leads, lesson_bundles) were created with the
-- shared set_updated_date() trigger but use `updated_at`/`created_at` columns,
-- so they have no `updated_date` field. Any UPDATE to them then fails with
-- `record "new" has no field "updated_date"`. Make the trigger tolerant: only
-- stamp updated_date when the row actually has that column. Tables that do have
-- it behave exactly as before.
create or replace function set_updated_date() returns trigger as $$
begin
  if to_jsonb(new) ? 'updated_date' then
    new.updated_date := now();
  end if;
  return new;
end;
$$ language plpgsql;
