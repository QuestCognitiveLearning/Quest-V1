-- Supabase Storage bucket for tutor logos. Public-read so PDFs/emails can
-- reference logo URLs without signed URL juggling. Per-user write via RLS
-- (owner-only: `auth.uid()` must own the file).

insert into storage.buckets (id, name, public)
values ('branding-logos', 'branding-logos', true)
on conflict (id) do nothing;

drop policy if exists "Branding logos are public" on storage.objects;
create policy "Branding logos are public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'branding-logos');

drop policy if exists "Users upload own branding logo" on storage.objects;
create policy "Users upload own branding logo"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'branding-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own branding logo" on storage.objects;
create policy "Users update own branding logo"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'branding-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own branding logo" on storage.objects;
create policy "Users delete own branding logo"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'branding-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
