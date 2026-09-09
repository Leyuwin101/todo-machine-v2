create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text default '',
  date date not null,
  time time,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  category text not null default 'General',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notification_enabled boolean not null default true,
  notification_time integer not null default 10 check (notification_time >= 0 and notification_time <= 10080),
  notification_at timestamptz
);

alter table public.tasks add column if not exists notification_at timestamptz;
alter table public.tasks enable row level security;

drop policy if exists "todo_select" on public.tasks;
drop policy if exists "todo_insert" on public.tasks;
drop policy if exists "todo_update" on public.tasks;
drop policy if exists "todo_delete" on public.tasks;

create policy "todo_select" on public.tasks for select to anon, authenticated using (true);
create policy "todo_insert" on public.tasks for insert to anon, authenticated with check (true);
create policy "todo_update" on public.tasks for update to anon, authenticated using (true) with check (true);
create policy "todo_delete" on public.tasks for delete to anon, authenticated using (true);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  endpoint text not null unique,
  subscription jsonb not null,
  timezone text not null default 'UTC',
  user_agent text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_select" on public.push_subscriptions;
drop policy if exists "push_insert" on public.push_subscriptions;
drop policy if exists "push_update" on public.push_subscriptions;
drop policy if exists "push_delete" on public.push_subscriptions;

create policy "push_select" on public.push_subscriptions for select to anon, authenticated using (true);
create policy "push_insert" on public.push_subscriptions for insert to anon, authenticated with check (true);
create policy "push_update" on public.push_subscriptions for update to anon, authenticated using (true) with check (true);
create policy "push_delete" on public.push_subscriptions for delete to anon, authenticated using (true);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(task_id, subscription_id)
);

alter table public.notification_deliveries enable row level security;
drop policy if exists "delivery_none" on public.notification_deliveries;

-- No browser access is needed for delivery records. The Edge Function uses its server-side secret key.
create policy "delivery_none" on public.notification_deliveries for all to anon, authenticated using (false) with check (false);

alter publication supabase_realtime add table public.tasks;


create or replace function public.reset_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.notification_at is distinct from old.notification_at
     or new.notification_enabled is distinct from old.notification_enabled
     or new.completed is distinct from old.completed then
    delete from public.notification_deliveries where task_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_reset_notification_deliveries on public.tasks;
create trigger tasks_reset_notification_deliveries
after update on public.tasks
for each row execute function public.reset_notification_deliveries();
