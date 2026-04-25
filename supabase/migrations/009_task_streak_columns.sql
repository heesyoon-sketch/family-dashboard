-- 009_task_streak_columns.sql
-- Idempotent: columns may already exist if added manually via the Supabase dashboard.
-- streak_count  — current consecutive-day streak for this task/user pair
-- last_completed_at — UTC timestamp of the most recent completion (local-tz comparison in app)

alter table public.tasks
  add column if not exists streak_count      integer not null default 0,
  add column if not exists last_completed_at timestamptz;
