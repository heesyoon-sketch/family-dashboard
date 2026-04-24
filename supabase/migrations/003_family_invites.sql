-- ============================================================
-- Migration 003: Family invitation codes + member-based RLS
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Invitation code generator ──────────────────────────
CREATE OR REPLACE FUNCTION public.random_invite_code(p_length int DEFAULT 6)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code  text := '';
  v_byte  int;
  i       int;
BEGIN
  FOR i IN 1..GREATEST(6, LEAST(COALESCE(p_length, 6), 8)) LOOP
    v_byte := get_byte(gen_random_bytes(1), 0);
    v_code := v_code || substr(v_chars, (v_byte % length(v_chars)) + 1, 1);
  END LOOP;
  RETURN v_code;
END;
$$;

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS invite_code text;

UPDATE public.families
SET invite_code = public.random_invite_code(6)
WHERE invite_code IS NULL;

ALTER TABLE public.families
  ALTER COLUMN invite_code SET DEFAULT public.random_invite_code(6),
  ALTER COLUMN invite_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS families_invite_code_key
  ON public.families (invite_code);

-- ── 2. Helper: resolve the caller's family by membership ──
-- Prefer a public.users row whose id matches auth.uid(); fall back to
-- families.owner_id for existing tenants created by the previous migration.
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT u.family_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
        AND u.family_id IS NOT NULL
      LIMIT 1
    ),
    (
      SELECT f.id
      FROM public.families f
      WHERE f.owner_id = auth.uid()
      LIMIT 1
    )
  );
$$;

-- ── 3. RPC: join a family using an invite code ────────────
CREATE OR REPLACE FUNCTION public.join_family_by_invite(
  p_invite_code text,
  p_user_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id   uuid := auth.uid();
  v_family_id uuid;
  v_name      text := NULLIF(trim(COALESCE(p_user_name, '')), '');
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_family_id
  FROM public.families
  WHERE invite_code = upper(trim(p_invite_code))
  LIMIT 1;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation code';
  END IF;

  INSERT INTO public.users (id, name, role, theme, family_id, created_at)
  VALUES (
    v_auth_id::text,
    COALESCE(v_name, 'Family Member'),
    'PARENT',
    'warm_minimal',
    v_family_id,
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET family_id = EXCLUDED.family_id;

  RETURN v_family_id;
END;
$$;

-- ── 4. RLS refactor: family access is by membership ───────
DROP POLICY IF EXISTS "families_owner" ON public.families;
DROP POLICY IF EXISTS "families_member_select" ON public.families;
DROP POLICY IF EXISTS "families_owner_insert" ON public.families;
DROP POLICY IF EXISTS "families_owner_update" ON public.families;
DROP POLICY IF EXISTS "families_owner_delete" ON public.families;

CREATE POLICY "families_member_select" ON public.families
  FOR SELECT
  USING (id = public.get_my_family_id());

CREATE POLICY "families_owner_insert" ON public.families
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "families_owner_update" ON public.families
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "families_owner_delete" ON public.families
  FOR DELETE
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "users_family" ON public.users;
DROP POLICY IF EXISTS "tasks_family" ON public.tasks;
DROP POLICY IF EXISTS "rewards_family" ON public.rewards;
DROP POLICY IF EXISTS "family_settings_family" ON public.family_settings;
DROP POLICY IF EXISTS "task_completions_family" ON public.task_completions;
DROP POLICY IF EXISTS "streaks_family" ON public.streaks;
DROP POLICY IF EXISTS "levels_family" ON public.levels;
DROP POLICY IF EXISTS "user_badges_family" ON public.user_badges;
DROP POLICY IF EXISTS "reward_redemptions_family" ON public.reward_redemptions;

CREATE POLICY "users_family" ON public.users
  FOR ALL
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "tasks_family" ON public.tasks
  FOR ALL
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "rewards_family" ON public.rewards
  FOR ALL
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "family_settings_family" ON public.family_settings
  FOR ALL
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "task_completions_family" ON public.task_completions
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  );

CREATE POLICY "streaks_family" ON public.streaks
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  );

CREATE POLICY "levels_family" ON public.levels
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  );

CREATE POLICY "user_badges_family" ON public.user_badges
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  );

CREATE POLICY "reward_redemptions_family" ON public.reward_redemptions
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE family_id = public.get_my_family_id()
    )
  );
