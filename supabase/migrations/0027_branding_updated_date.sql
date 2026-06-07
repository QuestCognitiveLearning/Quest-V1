-- Fix the branding upsert error:
--   record "new" has no field "updated_date"
--
-- The shared set_updated_date() trigger function (defined in 0001_init.sql)
-- writes new.updated_date = now() on every UPDATE. Migration 0008 created
-- the branding table with `updated_at` instead of `updated_date`, so the
-- trigger fired by branding_set_updated would throw on every UPDATE.
--
-- This migration adds the missing column with the same default + index,
-- backfills it from updated_at for the rows that already exist, then keeps
-- updated_at around for code paths that already read from it (e.g.,
-- BrandingSettings.jsx orders by -updated_at).

alter table public.branding
  add column if not exists updated_date timestamptz default now();

update public.branding
   set updated_date = coalesce(updated_at, now())
 where updated_date is null;
