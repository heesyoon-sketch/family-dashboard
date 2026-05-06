-- Migration 063: Robust participant backfill for joint reward purchases.
--
-- Migration 061 already updates log_reward_redemption_activity to write
-- the partner's name into related_user_name for both joint participants
-- (this works for kids and parents alike — role is not consulted). But
-- 061's backfill matched activity rows to redemptions within a 5-second
-- window, which can miss rows whose timestamps drift slightly. This
-- migration repeats the backfill with a 5-minute window and matches on
-- (user_id, amount, message=reward title) so the participant format
-- ("X님과 같이 …를 구매했어요") shows up in everyone's mailbox even for
-- older joint purchases.
--
-- Idempotent — only updates rows where related_user_name is still null.

update public.family_activities fa
set related_user_name = partner.name
from public.reward_redemptions rr
left join public.rewards r on r.id = rr.reward_id
join public.users partner on true
where fa.type = 'REWARD_PURCHASED'
  and fa.related_user_name is null
  and coalesce(rr.is_joint_purchase, false) = true
  and abs(extract(epoch from (fa.created_at - rr.redeemed_at))) < 300
  and (fa.message is null or coalesce(r.title, '(deleted reward)') = fa.message)
  and (
    (fa.user_id = rr.joint_user1_id
      and partner.id::uuid = rr.joint_user2_id
      and fa.amount = coalesce(rr.joint_user1_amount, 0))
    or
    (fa.user_id = rr.joint_user2_id
      and partner.id::uuid = rr.joint_user1_id
      and fa.amount = coalesce(rr.joint_user2_amount, 0))
  );
