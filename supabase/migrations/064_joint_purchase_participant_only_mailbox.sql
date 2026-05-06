-- Migration 064: Joint purchases are participant-only mailbox events.
--
-- Stop creating observer rows such as "X · Y bought Z together" for parents
-- who did not pay. Each actual participant gets one mailbox row containing
-- both payer names and both exact contributions. Refunds also re-assert the
-- split refund behavior so both participants get only their own amount back.

create or replace function public.log_reward_redemption_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_reward_title text;
  v_user1_name text;
  v_user2_name text;
  v_user1_amount integer;
  v_user2_amount integer;
  v_total_cost integer;
begin
  select u.family_id, coalesce(r.title, '(deleted reward)')
  into v_family_id, v_reward_title
  from public.users u
  left join public.rewards r on r.id = new.reward_id
  where u.id = new.user_id::text;

  if v_family_id is null then
    return new;
  end if;

  if coalesce(new.is_joint_purchase, false) then
    select name into v_user1_name from public.users where id = new.joint_user1_id::text;
    select name into v_user2_name from public.users where id = new.joint_user2_id::text;

    v_user1_amount := greatest(coalesce(new.joint_user1_amount, 0), 0);
    v_user2_amount := greatest(coalesce(new.joint_user2_amount, 0), 0);
    v_total_cost := coalesce(new.cost_charged, v_user1_amount + v_user2_amount);

    if new.joint_user1_id is not null and v_user1_amount > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, related_user_name, message, created_at
      )
      values (
        v_family_id,
        new.joint_user1_id,
        'REWARD_PURCHASED',
        v_user1_amount,
        jsonb_build_object(
          'payerName', coalesce(v_user1_name, '?'),
          'partnerName', coalesce(v_user2_name, '?'),
          'payerAmount', v_user1_amount,
          'partnerAmount', v_user2_amount,
          'totalAmount', v_total_cost
        )::text,
        v_reward_title,
        coalesce(new.redeemed_at, now())
      );
    end if;

    if new.joint_user2_id is not null and v_user2_amount > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, related_user_name, message, created_at
      )
      values (
        v_family_id,
        new.joint_user2_id,
        'REWARD_PURCHASED',
        v_user2_amount,
        jsonb_build_object(
          'payerName', coalesce(v_user2_name, '?'),
          'partnerName', coalesce(v_user1_name, '?'),
          'payerAmount', v_user2_amount,
          'partnerAmount', v_user1_amount,
          'totalAmount', v_total_cost
        )::text,
        v_reward_title,
        coalesce(new.redeemed_at, now())
      );
    end if;
  else
    insert into public.family_activities (
      family_id, user_id, type, amount, message, created_at
    )
    values (
      v_family_id,
      new.user_id,
      'REWARD_PURCHASED',
      coalesce(new.cost_charged, 0),
      v_reward_title,
      coalesce(new.redeemed_at, now())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_reward_redemption_activity on public.reward_redemptions;
create trigger trg_log_reward_redemption_activity
after insert on public.reward_redemptions
for each row
execute function public.log_reward_redemption_activity();

-- Remove observer rows created by migration 062. Participant rows are kept.
delete from public.family_activities fa
using public.reward_redemptions rr
join public.users owner on owner.id = rr.user_id::text
where fa.type = 'REWARD_PURCHASED'
  and fa.family_id = owner.family_id
  and coalesce(rr.is_joint_purchase, false) = true
  and fa.related_user_name like '% · %'
  and fa.user_id <> coalesce(rr.joint_user1_id, '00000000-0000-0000-0000-000000000000'::uuid)
  and fa.user_id <> coalesce(rr.joint_user2_id, '00000000-0000-0000-0000-000000000000'::uuid)
  and abs(extract(epoch from (fa.created_at - rr.redeemed_at))) < 300;

-- Backfill participant rows with structured metadata so the mailbox can show
-- both names and the exact split. This intentionally overwrites the older
-- plain partner-name value.
update public.family_activities fa
set related_user_name = case
  when fa.user_id = rr.joint_user1_id then
    jsonb_build_object(
      'payerName', coalesce(u1.name, '?'),
      'partnerName', coalesce(u2.name, '?'),
      'payerAmount', greatest(coalesce(rr.joint_user1_amount, 0), 0),
      'partnerAmount', greatest(coalesce(rr.joint_user2_amount, 0), 0),
      'totalAmount', coalesce(rr.cost_charged, greatest(coalesce(rr.joint_user1_amount, 0), 0) + greatest(coalesce(rr.joint_user2_amount, 0), 0))
    )::text
  else
    jsonb_build_object(
      'payerName', coalesce(u2.name, '?'),
      'partnerName', coalesce(u1.name, '?'),
      'payerAmount', greatest(coalesce(rr.joint_user2_amount, 0), 0),
      'partnerAmount', greatest(coalesce(rr.joint_user1_amount, 0), 0),
      'totalAmount', coalesce(rr.cost_charged, greatest(coalesce(rr.joint_user1_amount, 0), 0) + greatest(coalesce(rr.joint_user2_amount, 0), 0))
    )::text
  end
from public.reward_redemptions rr
left join public.users u1 on u1.id = rr.joint_user1_id::text
left join public.users u2 on u2.id = rr.joint_user2_id::text
where fa.type = 'REWARD_PURCHASED'
  and coalesce(rr.is_joint_purchase, false) = true
  and abs(extract(epoch from (fa.created_at - rr.redeemed_at))) < 300
  and (
    (fa.user_id = rr.joint_user1_id and fa.amount = greatest(coalesce(rr.joint_user1_amount, 0), 0))
    or
    (fa.user_id = rr.joint_user2_id and fa.amount = greatest(coalesce(rr.joint_user2_amount, 0), 0))
  );

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
      (v_redemption.joint_user1_id::text, 1, 0, 0, now()),
      (v_redemption.joint_user2_id::text, 1, 0, 0, now())
    on conflict (user_id) do nothing;

    update public.levels
    set spendable_balance = coalesce(spendable_balance, 0) + v_user1_amount,
        updated_at = now()
    where user_id = v_redemption.joint_user1_id::text
    returning spendable_balance into v_user1_balance;

    update public.levels
    set spendable_balance = coalesce(spendable_balance, 0) + v_user2_amount,
        updated_at = now()
    where user_id = v_redemption.joint_user2_id::text
    returning spendable_balance into v_user2_balance;

    update public.reward_redemptions
    set refunded_at = now(),
        refunded_by = auth.uid(),
        refund_reason = nullif(trim(coalesce(p_reason, '')), '')
    where id = v_redemption.id;

    select u.name into v_user1_name
    from public.users u
    where u.id = v_redemption.joint_user1_id::text;

    select u.name into v_user2_name
    from public.users u
    where u.id = v_redemption.joint_user2_id::text;

    return jsonb_build_object(
      'redemptionId', v_redemption.id::text,
      'isJointPurchase', true,
      'rewardId', v_redemption.reward_id::text,
      'rewardTitle', coalesce(v_reward_title, '(deleted reward)'),
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
  values (v_redemption.user_id::text, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) + greatest(coalesce(v_redemption.cost_charged, 0), 0),
      updated_at = now()
  where user_id = v_redemption.user_id::text
  returning spendable_balance into v_new_balance;

  update public.reward_redemptions
  set refunded_at = now(),
      refunded_by = auth.uid(),
      refund_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = v_redemption.id;

  select u.name into v_user_name
  from public.users u
  where u.id = v_redemption.user_id::text;

  return jsonb_build_object(
    'redemptionId', v_redemption.id::text,
    'isJointPurchase', false,
    'userId', v_redemption.user_id::text,
    'userName', v_user_name,
    'rewardId', v_redemption.reward_id::text,
    'rewardTitle', coalesce(v_reward_title, '(deleted reward)'),
    'refundedPoints', greatest(coalesce(v_redemption.cost_charged, 0), 0),
    'spendableBalance', v_new_balance
  );
end;
$$;

grant execute on function public.admin_refund_reward_redemption(text, text) to authenticated;

notify pgrst, 'reload schema';
