-- ============================================================
-- Migration 007: Treat the family owner as a parent admin fallback
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
  )
  OR EXISTS (
    SELECT 1
    FROM public.families f
    WHERE f.owner_id = auth.uid()
      AND f.id = public.get_my_family_id()
  );
$$;

-- Best-effort repair: if the signed-in owner has no linked profile yet,
-- link them to the first parent profile in their family.
CREATE OR REPLACE FUNCTION public.claim_owner_parent_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_family_id uuid;
  v_profile_id text;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_family_id
  FROM public.families
  WHERE owner_id = v_auth_id
  LIMIT 1;

  IF v_family_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = v_auth_id
      AND family_id = v_family_id
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO v_profile_id
  FROM public.users
  WHERE family_id = v_family_id
    AND role = 'PARENT'
    AND auth_user_id IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    UPDATE public.users
    SET auth_user_id = v_auth_id
    WHERE id = v_profile_id;
  END IF;
END;
$$;
