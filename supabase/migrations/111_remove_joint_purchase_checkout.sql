-- Migration 111: remove the "pay together" (joint purchase) checkout path.
--
-- The client no longer offers a joint-purchase checkout mode, so the RPC that
-- creates new joint purchases is revoked from authenticated clients. The
-- function itself, the historical redemption columns (is_joint_purchase,
-- joint_user1_*, joint_user2_*), and the family_activities rows they produced
-- are left untouched so past joint purchases still display correctly in the
-- activity feed and admin reward history.

revoke execute on function public.purchase_reward_joint(text, text, int, text, int)
  from authenticated;

notify pgrst, 'reload schema';
