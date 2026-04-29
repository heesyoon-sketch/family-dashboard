-- Migration 046: Auto-prune old TASK_COMPLETED activity records.
--
-- TASK_COMPLETED events are logged on every completion, so the table grows
-- unboundedly. GIFT_SENT / GIFT_RECEIVED / REWARD_PURCHASED are kept forever
-- (they are meaningful history). TASK_COMPLETED older than 90 days is safe to
-- drop — it is only used for the activity feed, which shows recent entries.

create or replace function public.prune_old_task_activities()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.family_activities
  where type = 'TASK_COMPLETED'
    and created_at < now() - interval '90 days';
end;
$$;

grant execute on function public.prune_old_task_activities() to authenticated;

-- Prune on migration run to clean up any existing accumulation.
select public.prune_old_task_activities();
