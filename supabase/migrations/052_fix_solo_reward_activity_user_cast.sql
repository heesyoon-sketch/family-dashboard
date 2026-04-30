-- Migration 052: Fix solo reward purchase activity logging.
--
-- reward_redemptions.user_id is text, while family_activities.user_id is uuid.
-- Joint purchases already log uuid joint_user*_id values, but solo purchases
-- were inserting new.user_id directly and could fail after the redemption row
-- was created.

create or replace function public.log_reward_redemption_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_reward_title text;
begin
  select u.family_id, coalesce(r.title, '(deleted reward)')
  into v_family_id, v_reward_title
  from public.users u
  left join public.rewards r on r.id = new.reward_id
  where u.id = new.user_id;

  if v_family_id is null then
    return new;
  end if;

  if coalesce(new.is_joint_purchase, false) then
    if new.joint_user1_id is not null and coalesce(new.joint_user1_amount, 0) > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, message, created_at
      )
      values (
        v_family_id,
        new.joint_user1_id,
        'REWARD_PURCHASED',
        coalesce(new.joint_user1_amount, 0),
        v_reward_title,
        coalesce(new.redeemed_at, now())
      );
    end if;

    if new.joint_user2_id is not null and coalesce(new.joint_user2_amount, 0) > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, message, created_at
      )
      values (
        v_family_id,
        new.joint_user2_id,
        'REWARD_PURCHASED',
        coalesce(new.joint_user2_amount, 0),
        v_reward_title,
        coalesce(new.redeemed_at, now())
      );
    end if;
  elsif new.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    insert into public.family_activities (
      family_id, user_id, type, amount, message, created_at
    )
    values (
      v_family_id,
      new.user_id::uuid,
      'REWARD_PURCHASED',
      coalesce(new.cost_charged, 0),
      v_reward_title,
      coalesce(new.redeemed_at, now())
    );
  end if;

  return new;
end;
$$;
