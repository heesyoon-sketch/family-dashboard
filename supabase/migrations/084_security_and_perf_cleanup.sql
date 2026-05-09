-- Migration 084: drop leftover dev RLS policies, harden helper functions,
-- and tighten a few RLS init-plan invocations of auth.uid().
--
-- Findings come from `supabase db advisors --linked`. The headline issues:
--
-- 1. Eight tables still carried "always true" or role='authenticated' policies
--    written before the multi-tenant rewrite. The proper *_family_select and
--    *_parent_* policies already cover every command, so any authenticated
--    user can currently read/write any family's rows by going through the
--    permissive policy. Dropping those closes the holes without changing
--    legitimate access.
--
-- 2. Nine helper functions don't pin search_path. They run as INVOKER, so the
--    risk is small, but adding `SET search_path = public` matches the rest of
--    our SECURITY DEFINER functions and resolves the linter warning.
--
-- 3. Three policies on `families` invoke `auth.uid()` per row instead of
--    once per query. Wrapping the call in `(select auth.uid())` lets PG
--    cache the result via initplan optimization.
--
-- 4. Migration 080 expected to drop the legacy 5-arg signature of
--    `process_task_completion_atomic` but its IF EXISTS clause used the wrong
--    arg list, leaving the orphan in place. Drop it explicitly so we don't
--    rely on overload resolution between two near-identical functions.
--
-- Apply with: supabase db push. Forward-only, no data writes, idempotent.

-- ── 1. Drop bypass / overly-broad RLS policies ────────────────────────────
drop policy if exists "Temp bypass"                          on public.users;
drop policy if exists "Allow all operations for rewards"     on public.rewards;
drop policy if exists "Allow all users to select rewards"    on public.rewards;
drop policy if exists "Allow all users to update rewards"    on public.rewards;
drop policy if exists "Allow all operations for redemptions" on public.reward_redemptions;
drop policy if exists "Allow public insert"                  on public.family_settings;
drop policy if exists "Allow public read"                    on public.family_settings;
drop policy if exists "Allow public update"                  on public.family_settings;
drop policy if exists "Parents can update tasks"             on public.tasks;

-- ── 2. Pin search_path on helper functions ────────────────────────────────
alter function public.random_invite_code(integer)           set search_path = public;
alter function public.level_for_points(integer)              set search_path = public;
alter function public.reward_effective_cost(integer, text)   set search_path = public;
alter function public.task_is_due_today(text[], text, text, text, text) set search_path = public;
alter function public.task_completion_window_start(timestamptz, text, text) set search_path = public;
alter function public.task_completion_window_end(timestamptz, text, text)   set search_path = public;
alter function public.task_effective_window(text, text)      set search_path = public;
alter function public.streak_bonus_multiplier(integer)       set search_path = public;
alter function public.apply_streak_bonus(integer, integer)   set search_path = public;

-- ── 3. Cache auth.uid() in `families` policies ────────────────────────────
drop policy if exists families_owner_update         on public.families;
create policy families_owner_update on public.families
  for update to authenticated
  using       (owner_id = (select auth.uid()))
  with check  (owner_id = (select auth.uid()));

drop policy if exists families_owner_delete         on public.families;
create policy families_owner_delete on public.families
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists families_insert_authenticated on public.families;
create policy families_insert_authenticated on public.families
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- ── 4. Drop orphan completion-atomic signature ────────────────────────────
-- Two signatures were live: the legacy 5-arg version (no day_key/time_window)
-- and the current 8-arg version. The client only ever calls the 8-arg one;
-- the 5-arg overload is dead code and a hazard for resolution edge cases.
drop function if exists public.process_task_completion_atomic(
  text, text, boolean, timestamptz, timestamptz
);

notify pgrst, 'reload schema';
