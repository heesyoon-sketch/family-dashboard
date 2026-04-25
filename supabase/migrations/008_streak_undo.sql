-- 008_streak_undo.sql
-- Store the streak state immediately before each completion so that
-- processUndo can perfectly restore it without recalculating from history.

alter table public.task_completions
  add column if not exists streak_before         integer,
  add column if not exists last_completed_before  timestamptz;
