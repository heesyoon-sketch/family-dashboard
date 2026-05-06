-- Migration 061: Correctly refund joint reward purchases and surface joint
-- purchase context in admin history and the family activity feed.
--
-- Background:
--   purchase_reward_joint stores the redemption with user_id = joint_user1_id
--   and cost_charged = full reward cost. The previous refund logic returned
--   the full cost_charged to that single user_id, which over-credited user1
--   (they got back their share AND user2's share) and left user2 short. This
--   migration refunds each joint participant their actual contribution.
--
--   We also expose joint fields in admin_list_reward_redemptions so the admin
--   purchase history can clearly mark shared purchases, and we record the
--   partner's name on each side of a joint REWARD_PURCHASED activity so the
--   child's mailbox can label it as a shared purchase.

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
    v_user1_amount := greatest(coalesce(v_redemption.joint_user1_amount, 0), 0);
    v_user2_amount := greatest(coalesce(v_redemption.joint_user2_amount, 0), 0);

    if v_redemption.joint_user1_id is not null and v_user1_amount > 0 then
      insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
      values (v_redemption.joint_user1_id::text, 1, 0, 0, now())
      on conflict (user_id) do nothing;

      update public.levels
      set spendable_balance = coalesce(spendable_balance, 0) + v_user1_amount,
          updated_at = now()
      where user_id = v_redemption.joint_user1_id::text
      returning spendable_balance into v_user1_balance;
    end if;

    if v_redemption.joint_user2_id is not null and v_user2_amount > 0 then
      insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
      values (v_redemption.joint_user2_id::text, 1, 0, 0, now())
      on conflict (user_id) do nothing;

      update public.levels
      set spendable_balance = coalesce(spendable_balance, 0) + v_user2_amount,
          updated_at = now()
      where user_id = v_redemption.joint_user2_id::text
      returning spendable_balance into v_user2_balance;
    end if;

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

    v_total_refunded := v_user1_amount + v_user2_amount;

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

-- Surface joint-purchase fields and partner names in admin purchase history.
create or replace function public.admin_list_reward_redemptions(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_limit integer := least(200, greatest(1, coalesce(p_limit, 50)));
  v_result jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  into v_result
  from (
    select
      rr.id::text as id,
      rr.user_id::text as user_id,
      u.name as user_name,
      rr.reward_id::text as reward_id,
      coalesce(r.title, '(deleted reward)') as reward_title,
      coalesce(r.icon, 'gift') as reward_icon,
      rr.cost_charged,
      rr.redeemed_at,
      rr.refunded_at,
      rr.refunded_by::text as refunded_by,
      rr.refund_reason,
      coalesce(rr.is_joint_purchase, false) as is_joint_purchase,
      rr.joint_user1_id::text as joint_user1_id,
      u1.name as joint_user1_name,
      rr.joint_user1_amount,
      rr.joint_user2_id::text as joint_user2_id,
      u2.name as joint_user2_name,
      rr.joint_user2_amount
    from public.reward_redemptions rr
    join public.users u on u.id = rr.user_id::text
    left join public.rewards r on r.id = rr.reward_id
    left join public.users u1 on u1.id = rr.joint_user1_id::text
    left join public.users u2 on u2.id = rr.joint_user2_id::text
    where u.family_id = v_family_id
    order by rr.redeemed_at desc
    limit v_limit
  ) x;

  return v_result;
end;
$$;

grant execute on function public.admin_list_reward_redemptions(int) to authenticated;

-- Tag joint-purchase activity rows with the partner's display name so the
-- mailbox can show "Bought X with Y" for both children.
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

    if new.joint_user1_id is not null and coalesce(new.joint_user1_amount, 0) > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, related_user_name, message, created_at
      )
      values (
        v_family_id,
        new.joint_user1_id,
        'REWARD_PURCHASED',
        coalesce(new.joint_user1_amount, 0),
        v_user2_name,
        v_reward_title,
        coalesce(new.redeemed_at, now())
      );
    end if;

    if new.joint_user2_id is not null and coalesce(new.joint_user2_amount, 0) > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, related_user_name, message, created_at
      )
      values (
        v_family_id,
        new.joint_user2_id,
        'REWARD_PURCHASED',
        coalesce(new.joint_user2_amount, 0),
        v_user1_name,
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

-- Backfill related_user_name on existing joint REWARD_PURCHASED activity
-- rows so the mailbox shows "with <partner>" for past shared purchases too.
-- Match a redemption to its activity row by side (user + that user's share)
-- and by created_at proximity to redeemed_at.
update public.family_activities fa
set related_user_name = partner.name
from public.reward_redemptions rr,
     public.users partner
where fa.type = 'REWARD_PURCHASED'
  and fa.related_user_name is null
  and coalesce(rr.is_joint_purchase, false) = true
  and abs(extract(epoch from (fa.created_at - rr.redeemed_at))) < 5
  and (
    (fa.user_id = rr.joint_user1_id
       and fa.amount = coalesce(rr.joint_user1_amount, 0)
       and partner.id::uuid = rr.joint_user2_id)
    or
    (fa.user_id = rr.joint_user2_id
       and fa.amount = coalesce(rr.joint_user2_amount, 0)
       and partner.id::uuid = rr.joint_user1_id)
  );
