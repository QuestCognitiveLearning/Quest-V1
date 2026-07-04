-- The branding table was created with an `updated_at` column (0008) but the
-- trigger attached to it calls set_updated_date(), which sets `new.updated_date`.
-- Every UPDATE/UPSERT failed with:
--   record "new" has no field "updated_date" (42703)
-- so /BrandingSettings could never save.
--
-- Fix: drop the broken trigger and install one that touches the column that
-- actually exists on this table. set_updated_at() mirrors set_updated_date()
-- but writes to `updated_at` so we don't have to rename the column (the
-- frontend already sorts on `updated_at`).

create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists branding_set_updated on public.branding;

create trigger branding_set_updated
  before update on public.branding
  for each row execute function public.set_updated_at();
