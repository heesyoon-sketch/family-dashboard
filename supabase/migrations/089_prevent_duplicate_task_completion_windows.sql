-- Migration 089: guard against duplicate task completions in one local window.
--
-- The completion RPC checks for an existing row before insert, but a fast
-- double-submit or multi-tab race can still pass that read concurrently. This
-- index makes the invariant durable in Postgres: one row per user/task/local
-- date/morning-or-evening window. It still permits "both" tasks to be done
-- once in the morning and once after the 13:00 evening split.

create unique index if not exists task_completions_one_per_task_window_idx
on public.task_completions (
  user_id,
  task_id,
  (((completed_at at time zone 'America/Toronto')::date)),
  (
    case
      when extract(hour from completed_at at time zone 'America/Toronto') < 13 then 'morning'
      else 'evening'
    end
  )
);
