-- Extend the existing branding table (0008) with the fields the Studio tutor
-- experience needs but didn't ship in v1:
--   * bio                  — short blurb shown on the public booking page
--   * custom_report_intro  — replaces the default paragraph in parent emails
--   * booking_slug         — used by the public `/Book/:slug` page (Phase 6),
--                            but claimed in the signup wizard / settings page
--                            so the tutor can share the link as soon as they
--                            have one.
--   * created_at           — backfilled to updated_at for existing rows.
--
-- Adds a public-read policy keyed on `booking_slug IS NOT NULL` so the public
-- booking page can fetch branding without authentication. The existing
-- "Users read own branding" / "Users write own branding" policies stay as-is.

alter table public.branding
  add column if not exists bio                  text,
  add column if not exists custom_report_intro  text,
  add column if not exists booking_slug         text,
  add column if not exists created_at           timestamptz default now();

update public.branding set created_at = updated_at where created_at is null;

create unique index if not exists branding_booking_slug_unique
  on public.branding (booking_slug)
  where booking_slug is not null;

drop policy if exists "Public reads branding by booking slug" on public.branding;
create policy "Public reads branding by booking slug"
  on public.branding
  for select
  to public
  using (booking_slug is not null);
