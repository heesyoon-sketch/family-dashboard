-- Migration 049: Delete family_activities TASK_COMPLETED entry on task undo.
--
-- When a task is completed, trg_log_task_completion_activity (migration 044)
-- inserts a TASK_COMPLETED row into family_activities where:
--   created_at = task_completions.completed_at   (set explicitly)
--   amount     = task_completions.points_awarded
--   user_id    = task_completions.user_id::uuid
--
-- When a task is undone, the task_completions row is deleted but the
-- family_activities entry was never removed, leaving a ghost entry in the feed.
-- This trigger cleans it up atomically on DELETE.

create or replace function public.delete_task_completion_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.family_activities
  where user_id  = old.user_id::uuid
    and type     = 'TASK_COMPLETED'
    and created_at = old.completed_at
    and amount   = coalesce(old.points_awarded, 0);
  return old;
end;
$$;

drop trigger if exists trg_delete_task_completion_activity on public.task_completions;
create trigger trg_delete_task_completion_activity
after delete on public.task_completions
for each row
execute function public.delete_task_completion_activity();
