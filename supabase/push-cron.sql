-- Run this AFTER enabling pg_cron and pg_net in Supabase.
-- The Edge Function is called every minute by Supabase Cron.
-- Secrets are stored in Supabase Vault rather than in the cron SQL itself.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

-- Replace these values in the INSERT statements before running.
select vault.create_secret('https://wlxljlflbgxmolxmdzbp.supabase.co', 'todo_project_url');
select vault.create_secret('sb_publishable_5TRJRrzk8qNLfgNafWM84Q_QV9bKnUd', 'todo_publishable_key');
select vault.create_secret('9be14c934e0a47b0ae10faa95d7af52d', 'todo_cron_secret');

select cron.unschedule('todo-machine-send-reminders')
where exists (select 1 from cron.job where jobname = 'todo-machine-send-reminders');

select cron.schedule(
  'todo-machine-send-reminders',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'todo_project_url') || '/functions/v1/send-task-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'todo_publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'todo_cron_secret')
      ),
      body := jsonb_build_object('source', 'supabase-cron', 'time', now()),
      timeout_milliseconds := 10000
    ) as request_id;
  $$
);
