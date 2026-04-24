-- ============================================================
-- Migration 002: Multi-tenant families
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Create families table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.families (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT families_owner_id_key UNIQUE (owner_id)
);
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- ── 2. Add family_id columns ──────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.family_settings
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

-- ── 3. Rework family_settings primary key ─────────────────
-- Old PK was (key) alone; new unique scope is (key, family_id).
-- Add a surrogate id column as the new stable PK.
ALTER TABLE public.family_settings
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.family_settings DROP CONSTRAINT IF EXISTS family_settings_pkey;
ALTER TABLE public.family_settings ADD PRIMARY KEY (id);

ALTER TABLE public.family_settings
  DROP CONSTRAINT IF EXISTS family_settings_key_family_id_key;
ALTER TABLE public.family_settings
  ADD CONSTRAINT family_settings_key_family_id_key UNIQUE (key, family_id);

-- ── 4. Drop old catch-all RLS policies ───────────────────
DROP POLICY IF EXISTS "auth users full access" ON public.users;
DROP POLICY IF EXISTS "auth users full access" ON public.tasks;
DROP POLICY IF EXISTS "auth users full access" ON public.rewards;
DROP POLICY IF EXISTS "auth users full access" ON public.family_settings;
DROP POLICY IF EXISTS "auth users full access" ON public.task_completions;
DROP POLICY IF EXISTS "auth users full access" ON public.streaks;
DROP POLICY IF EXISTS "auth users full access" ON public.badges;
DROP POLICY IF EXISTS "auth users full access" ON public.user_badges;
DROP POLICY IF EXISTS "auth users full access" ON public.levels;

-- ── 5. Helper: get the calling user's family_id ───────────
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT id FROM public.families WHERE owner_id = auth.uid() LIMIT 1; $$;

-- ── 6. New family-scoped RLS policies ────────────────────

-- families: each owner can only see/modify their own row
CREATE POLICY "families_owner" ON public.families
  FOR ALL
  USING     (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- tables with a direct family_id column
CREATE POLICY "users_family" ON public.users
  FOR ALL
  USING     (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "tasks_family" ON public.tasks
  FOR ALL
  USING     (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "rewards_family" ON public.rewards
  FOR ALL
  USING     (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "family_settings_family" ON public.family_settings
  FOR ALL
  USING     (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

-- tables without a direct family_id: join through users
CREATE POLICY "task_completions_family" ON public.task_completions
  FOR ALL USING (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  );

CREATE POLICY "streaks_family" ON public.streaks
  FOR ALL USING (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  );

CREATE POLICY "levels_family" ON public.levels
  FOR ALL USING (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  );

CREATE POLICY "user_badges_family" ON public.user_badges
  FOR ALL USING (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  );

CREATE POLICY "reward_redemptions_family" ON public.reward_redemptions
  FOR ALL USING (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  );

-- badges: global catalog, readable by any authenticated user
CREATE POLICY "badges_read_all" ON public.badges
  FOR SELECT USING (true);

-- ── 7. RPC: atomic family creation + NULL-data migration ──
-- SECURITY DEFINER allows it to UPDATE rows that have family_id IS NULL,
-- which bypasses the new RLS policies (safe because it always sets
-- family_id to the caller's own family).
CREATE OR REPLACE FUNCTION public.setup_family(p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_owner_id  uuid := auth.uid();
  v_family_id uuid;
BEGIN
  -- Idempotent: return existing family if already created
  SELECT id INTO v_family_id
  FROM public.families
  WHERE owner_id = v_owner_id;

  IF v_family_id IS NOT NULL THEN
    RETURN v_family_id;
  END IF;

  -- Create the family record
  INSERT INTO public.families (owner_id, name)
  VALUES (v_owner_id, p_name)
  RETURNING id INTO v_family_id;

  -- Claim any pre-existing unowned rows (single-tenant → multi-tenant migration)
  UPDATE public.users          SET family_id = v_family_id WHERE family_id IS NULL;
  UPDATE public.tasks          SET family_id = v_family_id WHERE family_id IS NULL;
  UPDATE public.rewards        SET family_id = v_family_id WHERE family_id IS NULL;
  UPDATE public.family_settings SET family_id = v_family_id WHERE family_id IS NULL;

  RETURN v_family_id;
END;
$$;
