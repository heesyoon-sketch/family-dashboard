-- Migration 059: Broaden Supabase Realtime to admin-driven tables.
--
-- 048 only published task_completions and levels. Admin actions on tasks,
-- users, rewards, and family_activities (gifts, mailbox) need to propagate
-- across devices too. Idempotent — safe to re-run.

do $$
declare
  v_table text;
begin
  for v_table in select unnest(array['tasks', 'users', 'rewards', 'family_activities']) loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and tablename = v_table
        and schemaname = 'public'
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
