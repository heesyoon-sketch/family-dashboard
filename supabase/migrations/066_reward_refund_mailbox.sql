-- Migration 066: Put reward refunds into each payer's mailbox.
--
-- A refund changes balances, so the affected member should see what reward was
-- refunded and how many points came back. Joint refunds write one mailbox row
-- for each participant who actually paid, using the same compact split label as
-- joint purchases.

alter table public.family_activities
  drop constraint if exists family_activities_type_check;

alter table public.family_activities
  add constraint family_activities_type_check
  check (type in (
    'GIFT_RECEIVED',
    'GIFT_SENT',
    'REWARD_PURCHASED',
    'REWARD_REFUNDED',
    'TASK_COMPLETED',
    'SYSTEM_MESSAGE'
  ));

create or replace function public.admin_refund_reward_redemption(
  p_redemption_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_redemption public.reward_redemptions;
  v_user_name text;
  v_reward_title text;
  v_new_balance integer;
  v_user1_balance integer;
  v_user2_balance integer;
  v_user1_name text;
  v_user2_name text;
  v_user1_amount integer;
  v_user2_amount integer;
  v_total_refunded integer;
  v_refunded_at timestamptz := now();
begin
  select rr.* into v_redemption
  from public.reward_redemptions rr
  join public.users u on u.id = rr.user_id::text
  where rr.id = p_redemption_id::uuid
    and u.family_id = v_family_id
  for update;

  if not found then
    raise exception 'Redemption not found';
  end if;

  if v_redemption.refunded_at is not null then
    raise exception 'Already refunded';
  end if;

  select r.title into v_reward_title
  from public.rewards r
  where r.id = v_redemption.reward_id;

  v_reward_title := coalesce(v_reward_title, '(deleted reward)');

  if coalesce(v_redemption.is_joint_purchase, false) then
    if v_redemption.joint_user1_id is null or v_redemption.joint_user2_id is null then
      raise exception 'Joint redemption is missing participant IDs';
    end if;

    v_user1_amount := greatest(coalesce(v_redemption.joint_user1_amount, 0), 0);
    v_user2_amount := greatest(coalesce(v_redemption.joint_user2_amount, 0), 0);
    v_total_refunded := v_user1_amount + v_user2_amount;

    if v_total_refunded <> greatest(coalesce(v_redemption.cost_charged, 0), 0) then
      raise exception 'Joint refund split does not match charged cost';
    end if;

    insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
    values
      (v_redemption.joint_user1_id::text, 1, 0, 0, v_refunded_at),
      (v_redemption.joint_user2_id::text, 1, 0, 0, v_refunded_at)
    on conflict (user_id) do nothing;

    update public.levels
    set spendable_balance = coalesce(spendable_balance, 0) + v_user1_amount,
        updated_at = v_refunded_at
    where user_id = v_redemption.joint_user1_id::text
    returning spendable_balance into v_user1_balance;

    update public.levels
    set spendable_balance = coalesce(spendable_balance, 0) + v_user2_amount,
        updated_at = v_refunded_at
    where user_id = v_redemption.joint_user2_id::text
    returning spendable_balance into v_user2_balance;

    update public.reward_redemptions
    set refunded_at = v_refunded_at,
        refunded_by = auth.uid(),
        refund_reason = nullif(trim(coalesce(p_reason, '')), '')
    where id = v_redemption.id;

    select u.name into v_user1_name
    from public.users u
    where u.id = v_redemption.joint_user1_id::text;

    select u.name into v_user2_name
    from public.users u
    where u.id = v_redemption.joint_user2_id::text;

    if v_user1_amount > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, related_user_name, message, created_at
      )
      values (
        v_family_id,
        v_redemption.joint_user1_id,
        'REWARD_REFUNDED',
        v_user1_amount,
        coalesce(v_user1_name, '?') || ' ' || v_user1_amount || 'pt + ' ||
          coalesce(v_user2_name, '?') || ' ' || v_user2_amount || 'pt',
        v_reward_title,
        v_refunded_at
      );
    end if;

    if v_user2_amount > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, related_user_name, message, created_at
      )
      values (
        v_family_id,
        v_redemption.joint_user2_id,
        'REWARD_REFUNDED',
        v_user2_amount,
        coalesce(v_user2_name, '?') || ' ' || v_user2_amount || 'pt + ' ||
          coalesce(v_user1_name, '?') || ' ' || v_user1_amount || 'pt',
        v_reward_title,
        v_refunded_at
      );
    end if;

    return jsonb_build_object(
      'redemptionId', v_redemption.id::text,
      'isJointPurchase', true,
      'rewardId', v_redemption.reward_id::text,
      'rewardTitle', v_reward_title,
      'refundedPoints', v_total_refunded,
      'user1Id', v_redemption.joint_user1_id::text,
      'user1Name', v_user1_name,
      'user1Refunded', v_user1_amount,
      'user1Balance', v_user1_balance,
      'user2Id', v_redemption.joint_user2_id::text,
      'user2Name', v_user2_name,
      'user2Refunded', v_user2_amount,
      'user2Balance', v_user2_balance
    );
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (v_redemption.user_id::text, 1, 0, 0, v_refunded_at)
  on conflict (user_id) do nothing;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) + greatest(coalesce(v_redemption.cost_charged, 0), 0),
      updated_at = v_refunded_at
  where user_id = v_redemption.user_id::text
  returning spendable_balance into v_new_balance;

  update public.reward_redemptions
  set refunded_at = v_refunded_at,
      refunded_by = auth.uid(),
      refund_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = v_redemption.id;

  select u.name into v_user_name
  from public.users u
  where u.id = v_redemption.user_id::text;

  insert into public.family_activities (
    family_id, user_id, type, amount, message, created_at
  )
  values (
    v_family_id,
    v_redemption.user_id,
    'REWARD_REFUNDED',
    greatest(coalesce(v_redemption.cost_charged, 0), 0),
    v_reward_title,
    v_refunded_at
  );

  return jsonb_build_object(
    'redemptionId', v_redemption.id::text,
    'isJointPurchase', false,
    'userId', v_redemption.user_id::text,
    'userName', v_user_name,
    'rewardId', v_redemption.reward_id::text,
    'rewardTitle', v_reward_title,
    'refundedPoints', greatest(coalesce(v_redemption.cost_charged, 0), 0),
    'spendableBalance', v_new_balance
  );
end;
$$;

grant execute on function public.admin_refund_reward_redemption(text, text) to authenticated;

with refund_events as (
  select
    owner.family_id,
    rr.joint_user1_id as user_id,
    greatest(coalesce(rr.joint_user1_amount, 0), 0) as amount,
    coalesce(u1.name, '?') || ' ' || greatest(coalesce(rr.joint_user1_amount, 0), 0) || 'pt + ' ||
      coalesce(u2.name, '?') || ' ' || greatest(coalesce(rr.joint_user2_amount, 0), 0) || 'pt' as related_user_name,
    coalesce(r.title, '(deleted reward)') as message,
    rr.refunded_at as created_at
  from public.reward_redemptions rr
  join public.users owner on owner.id = rr.user_id::text
  left join public.rewards r on r.id = rr.reward_id
  left join public.users u1 on u1.id = rr.joint_user1_id::text
  left join public.users u2 on u2.id = rr.joint_user2_id::text
  where coalesce(rr.is_joint_purchase, false) = true
    and rr.refunded_at is not null
    and rr.joint_user1_id is not null

  union all

  select
    owner.family_id,
    rr.joint_user2_id as user_id,
    greatest(coalesce(rr.joint_user2_amount, 0), 0) as amount,
    coalesce(u2.name, '?') || ' ' || greatest(coalesce(rr.joint_user2_amount, 0), 0) || 'pt + ' ||
      coalesce(u1.name, '?') || ' ' || greatest(coalesce(rr.joint_user1_amount, 0), 0) || 'pt' as related_user_name,
    coalesce(r.title, '(deleted reward)') as message,
    rr.refunded_at as created_at
  from public.reward_redemptions rr
  join public.users owner on owner.id = rr.user_id::text
  left join public.rewards r on r.id = rr.reward_id
  left join public.users u1 on u1.id = rr.joint_user1_id::text
  left join public.users u2 on u2.id = rr.joint_user2_id::text
  where coalesce(rr.is_joint_purchase, false) = true
    and rr.refunded_at is not null
    and rr.joint_user2_id is not null

  union all

  select
    owner.family_id,
    rr.user_id::uuid as user_id,
    greatest(coalesce(rr.cost_charged, 0), 0) as amount,
    null::text as related_user_name,
    coalesce(r.title, '(deleted reward)') as message,
    rr.refunded_at as created_at
  from public.reward_redemptions rr
  join public.users owner on owner.id = rr.user_id::text
  left join public.rewards r on r.id = rr.reward_id
  where coalesce(rr.is_joint_purchase, false) = false
    and rr.refunded_at is not null
)
insert into public.family_activities (
  family_id, user_id, type, amount, related_user_name, message, created_at
)
select
  family_id,
  user_id,
  'REWARD_REFUNDED',
  amount,
  related_user_name,
  message,
  created_at
from refund_events e
where e.user_id is not null
  and e.amount > 0
  and not exists (
    select 1
    from public.family_activities fa
    where fa.type = 'REWARD_REFUNDED'
      and fa.user_id = e.user_id
      and fa.amount = e.amount
      and coalesce(fa.message, '') = coalesce(e.message, '')
      and abs(extract(epoch from (fa.created_at - e.created_at))) < 5
  );

notify pgrst, 'reload schema';
