-- Run after deploying the function and creating notemap_project_url in Vault.
-- The cleanup credential is generated inside Postgres; no service-role key is copied.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$ begin
  if not exists(select 1 from vault.secrets where name='notemap_cleanup_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'notemap_cleanup_token');
  end if;
end $$;

create or replace function public.notemap_cleanup_authorized(_token text)
returns boolean language sql security definer set search_path = '' as $$
  select exists(select 1 from vault.decrypted_secrets where name='notemap_cleanup_token' and decrypted_secret=_token);
$$;
revoke all on function public.notemap_cleanup_authorized(text) from public,anon,authenticated;
grant execute on function public.notemap_cleanup_authorized(text) to service_role;

do $$
declare existing bigint;
begin
  select jobid into existing from cron.job where jobname='notemap-expired-shares';
  if existing is not null then perform cron.unschedule(existing); end if;
end $$;
select cron.schedule('notemap-expired-shares','7 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='notemap_project_url') || '/functions/v1/share-snapshot',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-share-action','cleanup',
      'x-notemap-cleanup',(select decrypted_secret from vault.decrypted_secrets where name='notemap_cleanup_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
