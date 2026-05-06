-- Migration 065: Store joint purchase mailbox labels as compact text.
--
-- Migration 064 used JSON text in family_activities.related_user_name so the
-- client could render exact split details. That data is user-visible when an
-- older client or fallback path displays it directly, so keep the same data in
-- a readable compact form: "Name 35pt + Partner 35pt".

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

    if new.joint_user1_id is not null and v_user1_amount > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, related_user_name, message, created_at
      )
      values (
        v_family_id,
        new.joint_user1_id,
        'REWARD_PURCHASED',
        v_user1_amount,
        coalesce(v_user1_name, '?') || ' ' || v_user1_amount || 'pt + ' ||
          coalesce(v_user2_name, '?') || ' ' || v_user2_amount || 'pt',
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
        coalesce(v_user2_name, '?') || ' ' || v_user2_amount || 'pt + ' ||
          coalesce(v_user1_name, '?') || ' ' || v_user1_amount || 'pt',
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

update public.family_activities fa
set related_user_name = case
  when fa.user_id = rr.joint_user1_id then
    coalesce(u1.name, '?') || ' ' || greatest(coalesce(rr.joint_user1_amount, 0), 0) || 'pt + ' ||
      coalesce(u2.name, '?') || ' ' || greatest(coalesce(rr.joint_user2_amount, 0), 0) || 'pt'
  else
    coalesce(u2.name, '?') || ' ' || greatest(coalesce(rr.joint_user2_amount, 0), 0) || 'pt + ' ||
      coalesce(u1.name, '?') || ' ' || greatest(coalesce(rr.joint_user1_amount, 0), 0) || 'pt'
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

notify pgrst, 'reload schema';
