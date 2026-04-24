-- ============================================================
-- Migration 004: Link Google accounts to dashboard member profiles
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- A dashboard member profile remains public.users.id.
-- auth_user_id links that profile to the signed-in Google account.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_key
  ON public.users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Backfill old invite-created rows where users.id was auth.uid() text.
UPDATE public.users
SET auth_user_id = id::uuid
WHERE auth_user_id IS NULL
  AND id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Backfill each family owner's account onto the first parent profile when possible.
WITH owner_profiles AS (
  SELECT DISTINCT ON (f.id)
    u.id AS profile_id,
    f.owner_id
  FROM public.families f
  JOIN public.users u ON u.family_id = f.id
  WHERE u.role = 'PARENT'
    AND u.auth_user_id IS NULL
  ORDER BY f.id, u.created_at ASC
)
UPDATE public.users u
SET auth_user_id = op.owner_id
FROM owner_profiles op
WHERE u.id = op.profile_id
  AND NOT EXISTS (
    SELECT 1 FROM public.users taken WHERE taken.auth_user_id = op.owner_id
  );

-- Resolve the caller's family by linked member profile first, with compatibility
-- fallback for old rows whose profile id equals auth.uid(), then owner fallback.
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
      WHERE u.auth_user_id = auth.uid()
        AND u.family_id IS NOT NULL
      LIMIT 1
    ),
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

-- Public-to-authenticated RPC used by /setup after a user enters an invite code.
CREATE OR REPLACE FUNCTION public.get_invite_profiles(p_invite_code text)
RETURNS TABLE (
  id text,
  name text,
  role text,
  theme text,
  claimed boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    u.id,
    u.name,
    u.role,
    u.theme,
    u.auth_user_id IS NOT NULL AS claimed
  FROM public.families f
  JOIN public.users u ON u.family_id = f.id
  WHERE f.invite_code = upper(trim(p_invite_code))
  ORDER BY
    CASE u.role WHEN 'PARENT' THEN 0 ELSE 1 END,
    u.created_at ASC;
$$;

-- Claim an existing dashboard profile for the signed-in Google account.
CREATE OR REPLACE FUNCTION public.join_family_by_invite(
  p_invite_code text,
  p_profile_id text,
  p_user_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id    uuid := auth.uid();
  v_family_id  uuid;
  v_claimed_by uuid;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT f.id, u.auth_user_id
  INTO v_family_id, v_claimed_by
  FROM public.families f
  JOIN public.users u ON u.family_id = f.id
  WHERE f.invite_code = upper(trim(p_invite_code))
    AND u.id = p_profile_id
  LIMIT 1;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation code or profile';
  END IF;

  IF v_claimed_by IS NOT NULL AND v_claimed_by <> v_auth_id THEN
    RAISE EXCEPTION 'Profile is already linked to another account';
  END IF;

  -- One account can only represent one dashboard profile.
  UPDATE public.users
  SET auth_user_id = NULL
  WHERE auth_user_id = v_auth_id
    AND id <> p_profile_id;

  UPDATE public.users
  SET auth_user_id = v_auth_id
  WHERE id = p_profile_id;

  RETURN v_family_id;
END;
$$;
