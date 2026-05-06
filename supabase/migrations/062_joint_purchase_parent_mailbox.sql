-- Migration 062: Notify parents in their mailbox when children share-buy.
--
-- Migration 061 wrote a REWARD_PURCHASED activity row for each joint
-- participant only. Parents who weren't part of the purchase had no
-- mailbox entry, so they couldn't tell at a glance which kids shared a
-- payment. This migration adds an "observer" activity row for every
-- parent in the family who isn't one of the joint participants, and
-- backfills the same rows for existing joint redemptions.
--
-- The observer row uses related_user_name = "<user1> · <user2>" with the
-- middle-dot separator. The mailbox UI splits on that separator to
-- decide whether to render "Bought X with Y!" (participant) or
-- "X · Y bought Z together!" (observer). Amount holds the total cost so
-- the parent can see how much was spent without it implying they paid.

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
  v_observer_label text;
  v_total_cost integer;
  v_parent record;
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

    -- Observer rows for parents who are not part of the joint purchase,
    -- so they see a "user1 · user2 bought X" line in their mailbox.
    v_observer_label := coalesce(v_user1_name, '?') || ' · ' || coalesce(v_user2_name, '?');
    v_total_cost := coalesce(new.cost_charged,
      coalesce(new.joint_user1_amount, 0) + coalesce(new.joint_user2_amount, 0));

    for v_parent in
      select id from public.users
      where family_id = v_family_id
        and role = 'PARENT'
        and id::uuid <> coalesce(new.joint_user1_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and id::uuid <> coalesce(new.joint_user2_id, '00000000-0000-0000-0000-000000000000'::uuid)
    loop
      insert into public.family_activities (
        family_id, user_id, type, amount, related_user_name, message, created_at
      )
      values (
        v_family_id,
        v_parent.id::uuid,
        'REWARD_PURCHASED',
        v_total_cost,
        v_observer_label,
        v_reward_title,
        coalesce(new.redeemed_at, now())
      );
    end loop;
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

-- Backfill observer rows for past joint redemptions. Skip pairs that
-- already have a row at the same created_at to keep the migration
-- idempotent if it ever reruns.
insert into public.family_activities (
  family_id, user_id, type, amount, related_user_name, message, created_at
)
select
  u.family_id,
  parent.id::uuid,
  'REWARD_PURCHASED',
  coalesce(rr.cost_charged,
    coalesce(rr.joint_user1_amount, 0) + coalesce(rr.joint_user2_amount, 0)),
  coalesce(u1.name, '?') || ' · ' || coalesce(u2.name, '?'),
  coalesce(r.title, '(deleted reward)'),
  rr.redeemed_at
from public.reward_redemptions rr
join public.users u on u.id = rr.user_id::text
left join public.rewards r on r.id = rr.reward_id
left join public.users u1 on u1.id = rr.joint_user1_id::text
left join public.users u2 on u2.id = rr.joint_user2_id::text
join public.users parent
  on parent.family_id = u.family_id
 and parent.role = 'PARENT'
 and parent.id::uuid not in (
   coalesce(rr.joint_user1_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(rr.joint_user2_id, '00000000-0000-0000-0000-000000000000'::uuid)
 )
where coalesce(rr.is_joint_purchase, false) = true
  and not exists (
    select 1 from public.family_activities fa
    where fa.user_id = parent.id::uuid
      and fa.type = 'REWARD_PURCHASED'
      and fa.related_user_name like '% · %'
      and abs(extract(epoch from (fa.created_at - rr.redeemed_at))) < 5
  );
