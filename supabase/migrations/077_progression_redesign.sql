-- Migration 077: progression redesign.
--
-- 1. Streak multipliers are removed. `apply_streak_bonus` is preserved for
--    backwards compatibility but always returns the points unchanged. The
--    new client-side Momentum module replaces this loop.
-- 2. Level math is replaced with the gentle polynomial curve
--      cumulative XP for level n = round(100 * n^1.35)
--    Levels can now extend well past 10 — a long-term identity journey.
-- 3. `levels.current_level` is recomputed for every existing row using the
--    new curve so the client and server immediately agree.
--
-- Apply with: supabase migration up (or psql directly against your
-- Supabase project). Safe to run on production: changes are forward-only
-- and idempotent.

-- ── 1. Disable streak multiplier ─────────────────────────────────────────────
create or replace function public.streak_bonus_multiplier(p_streak integer)
returns numeric
language sql
immutable
as $$
  -- Always 1.0. The progression redesign moves rhythm rewards out of the
  -- per-completion bonus into the dashboard-level Momentum/Harmony surface,
  -- so the old multiplier is no longer applied.
  select 1::numeric;
$$;

create or replace function public.apply_streak_bonus(p_points integer, p_streak integer)
returns integer
language sql
immutable
as $$
  -- Pass-through. Kept callable so existing RPCs that already invoke it
  -- continue to work; semantically a no-op now.
  select coalesce(p_points, 0);
$$;

-- ── 2. New gentle level curve ────────────────────────────────────────────────
create or replace function public.level_for_points(p_points integer)
returns integer
language sql
immutable
as $$
  select greatest(
    1,
    floor(power(greatest(coalesce(p_points, 0), 0)::numeric / 100.0, 1.0 / 1.35))::integer
  );
$$;

-- ── 3. Recompute existing level rows so client/server agree on day 1 ─────────
update public.levels
set current_level = public.level_for_points(total_points),
    updated_at = now();

notify pgrst, 'reload schema';
