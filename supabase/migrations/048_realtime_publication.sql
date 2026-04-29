-- Migration 048: Enable Supabase Realtime for cross-device sync.
--
-- task_completions and levels must be in the supabase_realtime publication
-- for postgres_changes subscriptions to receive events on other devices.
-- Using a DO block so the statement is idempotent (safe to re-run).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'task_completions' and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.task_completions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'levels' and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.levels;
  end if;
end;
$$;
