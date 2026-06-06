-- Enable pg_cron + pg_net so the lifecycle drip can fire processTimeTriggers
-- on an hourly schedule. The actual schedule is created via a separate
-- authenticated SQL command (not committed) so the internal shared-secret
-- token doesn't leak into git.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Helper function: schedules the hourly drip job. Call it once with the
-- internal token as the argument; pass the SAME token you set as the
-- QUEST_INTERNAL_TOKEN secret on the Edge Functions.
--
-- Example (run via psql as a one-off):
--   select quest_schedule_drip('YOUR_TOKEN_HERE');
create or replace function public.quest_schedule_drip(p_token text)
returns void
language plpgsql
security definer
as $$
declare
  v_url text := 'https://lgymrkodypbqghyjocxg.supabase.co/functions/v1/processTimeTriggers';
begin
  -- Unschedule any existing copy so re-runs are idempotent.
  perform cron.unschedule('quest-drip-hourly');
exception when others then null;
end;
$$;

-- The actual scheduling SQL (runs cron.schedule). Run via psql:
--   select cron.schedule(
--     'quest-drip-hourly',
--     '0 * * * *',
--     $cmd$
--     select net.http_post(
--       url := 'https://lgymrkodypbqghyjocxg.supabase.co/functions/v1/processTimeTriggers',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'X-Quest-Internal-Token', '<YOUR_TOKEN>'
--       ),
--       body := '{}'::jsonb
--     );
--     $cmd$
--   );
