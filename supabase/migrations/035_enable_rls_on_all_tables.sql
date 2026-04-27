-- Migration 035: Enable Row Level Security on all family-scoped tables
--
-- Root cause of the cross-family data leak:
--   Migrations 002–034 created RLS policies on users, tasks, task_completions,
--   streaks, levels, user_badges, reward_redemptions, and family_settings but
--   NEVER called ALTER TABLE ... ENABLE ROW LEVEL SECURITY on them.
--   Policies on a table where RLS is off are completely ignored — every
--   authenticated user could read and write every row from every family.
--
-- Only families and rewards had RLS explicitly enabled (migration 002 and
-- some subsequent migration). This migration closes the gap for all others.

alter table public.users              enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_completions   enable row level security;
alter table public.streaks            enable row level security;
alter table public.levels             enable row level security;
alter table public.user_badges        enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.family_settings    enable row level security;
alter table public.badges             enable row level security;
