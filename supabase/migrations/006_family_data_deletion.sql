-- ============================================================
-- Migration 006: Allow linked parent admins to delete family data
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "families_owner_delete" ON public.families;
DROP POLICY IF EXISTS "families_parent_delete" ON public.families;

CREATE POLICY "families_parent_delete" ON public.families
  FOR DELETE
  USING (id = public.get_my_family_id() AND public.is_my_family_parent());
