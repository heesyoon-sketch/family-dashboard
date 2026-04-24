-- ============================================================
-- Migration 005: Enforce parent/admin writes with RLS + RPCs
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_my_family_parent()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.family_id = public.get_my_family_id()
      AND u.role = 'PARENT'
  );
$$;

-- Tighten direct writes. Reads remain family-scoped; writes require a linked parent.
DROP POLICY IF EXISTS "users_family" ON public.users;
DROP POLICY IF EXISTS "tasks_family" ON public.tasks;
DROP POLICY IF EXISTS "rewards_family" ON public.rewards;
DROP POLICY IF EXISTS "family_settings_family" ON public.family_settings;

CREATE POLICY "users_family_select" ON public.users
  FOR SELECT USING (family_id = public.get_my_family_id());
CREATE POLICY "users_parent_insert" ON public.users
  FOR INSERT WITH CHECK (family_id = public.get_my_family_id() AND public.is_my_family_parent());
CREATE POLICY "users_parent_update" ON public.users
  FOR UPDATE USING (family_id = public.get_my_family_id() AND public.is_my_family_parent())
  WITH CHECK (family_id = public.get_my_family_id() AND public.is_my_family_parent());
CREATE POLICY "users_parent_delete" ON public.users
  FOR DELETE USING (family_id = public.get_my_family_id() AND public.is_my_family_parent());

CREATE POLICY "tasks_family_select" ON public.tasks
  FOR SELECT USING (family_id = public.get_my_family_id());
CREATE POLICY "tasks_parent_insert" ON public.tasks
  FOR INSERT WITH CHECK (family_id = public.get_my_family_id() AND public.is_my_family_parent());
CREATE POLICY "tasks_parent_update" ON public.tasks
  FOR UPDATE USING (family_id = public.get_my_family_id() AND public.is_my_family_parent())
  WITH CHECK (family_id = public.get_my_family_id() AND public.is_my_family_parent());
CREATE POLICY "tasks_parent_delete" ON public.tasks
  FOR DELETE USING (family_id = public.get_my_family_id() AND public.is_my_family_parent());

CREATE POLICY "rewards_family_select" ON public.rewards
  FOR SELECT USING (family_id = public.get_my_family_id());
CREATE POLICY "rewards_parent_insert" ON public.rewards
  FOR INSERT WITH CHECK (family_id = public.get_my_family_id() AND public.is_my_family_parent());
CREATE POLICY "rewards_parent_update" ON public.rewards
  FOR UPDATE USING (family_id = public.get_my_family_id() AND public.is_my_family_parent())
  WITH CHECK (family_id = public.get_my_family_id() AND public.is_my_family_parent());
CREATE POLICY "rewards_parent_delete" ON public.rewards
  FOR DELETE USING (family_id = public.get_my_family_id() AND public.is_my_family_parent());

CREATE POLICY "family_settings_family_select" ON public.family_settings
  FOR SELECT USING (family_id = public.get_my_family_id());
CREATE POLICY "family_settings_parent_insert" ON public.family_settings
  FOR INSERT WITH CHECK (family_id = public.get_my_family_id() AND public.is_my_family_parent());
CREATE POLICY "family_settings_parent_update" ON public.family_settings
  FOR UPDATE USING (family_id = public.get_my_family_id() AND public.is_my_family_parent())
  WITH CHECK (family_id = public.get_my_family_id() AND public.is_my_family_parent());
CREATE POLICY "family_settings_parent_delete" ON public.family_settings
  FOR DELETE USING (family_id = public.get_my_family_id() AND public.is_my_family_parent());

CREATE OR REPLACE FUNCTION public.assert_parent_admin()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_family_id uuid := public.get_my_family_id();
BEGIN
  IF v_family_id IS NULL OR NOT public.is_my_family_parent() THEN
    RAISE EXCEPTION 'Parent admin access required';
  END IF;
  RETURN v_family_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_family_setting(p_key text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid := public.assert_parent_admin();
BEGIN
  INSERT INTO public.family_settings (key, value, updated_at, family_id)
  VALUES (p_key, p_value, now(), v_family_id)
  ON CONFLICT (key, family_id) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_name(p_user_id text, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid := public.assert_parent_admin();
BEGIN
  UPDATE public.users
  SET name = trim(p_name)
  WHERE id = p_user_id
    AND family_id = v_family_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_insert_task(
  p_user_id text,
  p_title text,
  p_icon text,
  p_difficulty text,
  p_base_points int,
  p_recurrence text,
  p_days_of_week text[],
  p_active int,
  p_sort_order int
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid := public.assert_parent_admin();
  v_task public.tasks;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND family_id = v_family_id) THEN
    RAISE EXCEPTION 'User is not in your family';
  END IF;

  INSERT INTO public.tasks (
    id, user_id, title, icon, difficulty, base_points, recurrence,
    days_of_week, active, sort_order, family_id
  )
  VALUES (
    gen_random_uuid()::text, p_user_id, trim(p_title), p_icon, p_difficulty,
    p_base_points, p_recurrence, p_days_of_week, p_active, p_sort_order,
    v_family_id
  )
  RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_task(p_task_id text, p_patch jsonb)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid := public.assert_parent_admin();
  v_task public.tasks;
BEGIN
  UPDATE public.tasks
  SET title = COALESCE(p_patch->>'title', title),
      icon = COALESCE(p_patch->>'icon', icon),
      base_points = COALESCE((p_patch->>'base_points')::int, base_points),
      active = COALESCE((p_patch->>'active')::int, active),
      sort_order = COALESCE((p_patch->>'sort_order')::int, sort_order),
      time_window = CASE
        WHEN p_patch ? 'time_window' THEN NULLIF(p_patch->>'time_window', '')
        ELSE time_window
      END,
      days_of_week = CASE
        WHEN p_patch ? 'days_of_week' THEN ARRAY(SELECT jsonb_array_elements_text(p_patch->'days_of_week'))
        ELSE days_of_week
      END
  WHERE id = p_task_id
    AND family_id = v_family_id
  RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_task(p_task_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid := public.assert_parent_admin();
BEGIN
  DELETE FROM public.tasks
  WHERE id = p_task_id
    AND family_id = v_family_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_insert_reward(p_title text, p_cost_points int, p_icon text)
RETURNS public.rewards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid := public.assert_parent_admin();
  v_reward public.rewards;
BEGIN
  INSERT INTO public.rewards (id, title, cost_points, icon, family_id)
  VALUES (gen_random_uuid()::text, trim(p_title), p_cost_points, p_icon, v_family_id)
  RETURNING * INTO v_reward;
  RETURN v_reward;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_reward(p_reward_id text, p_title text, p_cost_points int)
RETURNS public.rewards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid := public.assert_parent_admin();
  v_reward public.rewards;
BEGIN
  UPDATE public.rewards
  SET title = trim(p_title),
      cost_points = p_cost_points
  WHERE id = p_reward_id
    AND family_id = v_family_id
  RETURNING * INTO v_reward;
  RETURN v_reward;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_reward(p_reward_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid := public.assert_parent_admin();
BEGIN
  DELETE FROM public.rewards
  WHERE id = p_reward_id
    AND family_id = v_family_id;
END;
$$;
