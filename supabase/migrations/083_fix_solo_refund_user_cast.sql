-- Migration 083: Fix solo refund mailbox insert.
--
-- reward_redemptions.user_id is TEXT, while family_activities.user_id is UUID.
-- Migration 066's solo branch inserted v_redemption.user_id directly, which
-- PostgreSQL refuses ("column user_id is of type uuid but expression is of
-- type text"). The whole refund transaction rolled back, so the admin saw
-- "환불 실패" and balances stayed unchanged. Cast it to uuid like the
-- joint branch already does (joint_user*_id columns are uuid).

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
    v_redemption.user_id::uuid,
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

notify pgrst, 'reload schema';
