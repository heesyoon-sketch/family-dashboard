-- Migration 094: make Shield bonus claims permanent and repair the June 19/20
-- duplicate-award incident for the Yoon family.
--
-- The uniqueness constraint on achievement_awards was not sufficient because
-- revoke_achievement_bonus deleted the unique receipt. A later sync could then
-- insert the same (user, achievement) again and pay it again. Receipts now stay
-- permanently, while a real refund is represented by refunded_at.

alter table public.achievement_awards
  add column if not exists refunded_at timestamptz null;

create or replace function public.award_achievement_bonus(
  p_user_id text,
  p_achievement_id text,
  p_points integer,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_activity_user_id uuid;
  v_award_id uuid;
  v_level public.levels%rowtype;
begin
  if p_points <= 0 then
    raise exception 'points must be positive';
  end if;

  select u.family_id, u.id::uuid
  into v_family_id, v_activity_user_id
  from public.users u
  where u.id = p_user_id
    and u.family_id = public.get_my_family_id();

  if v_family_id is null then
    raise exception 'not allowed';
  end if;

  -- This insert is the single atomic decision about whether points are paid.
  -- A receipt is never deleted, so another device can never reopen the claim.
  insert into public.achievement_awards (user_id, achievement_id, points_awarded)
  values (p_user_id, p_achievement_id, p_points)
  on conflict (user_id, achievement_id) do nothing
  returning id into v_award_id;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  if v_award_id is not null then
    select * into v_level
    from public.levels
    where user_id = p_user_id
    for update;

    update public.levels
    set total_points = coalesce(v_level.total_points, 0) + p_points,
        spendable_balance = coalesce(v_level.spendable_balance, 0) + p_points,
        current_level = public.level_for_points(coalesce(v_level.total_points, 0) + p_points),
        updated_at = now()
    where user_id = p_user_id
    returning * into v_level;

    insert into public.family_activities (
      id, family_id, user_id, type, amount, message, created_at
    ) values (
      gen_random_uuid(), v_family_id, v_activity_user_id, 'SYSTEM_MESSAGE',
      p_points, coalesce(p_message, 'Achievement bonus'), now()
    );
  else
    -- A duplicate needs no write lock and must be reported as a no-op. Older
    -- clients interpreted any successful RPC response as a fresh award.
    select * into v_level
    from public.levels
    where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'awarded', v_award_id is not null,
    'userId', v_level.user_id,
    'currentLevel', v_level.current_level,
    'totalPoints', v_level.total_points,
    'spendableBalance', v_level.spendable_balance,
    'updatedAt', v_level.updated_at
  );
end;
$$;

create or replace function public.revoke_achievement_bonus(
  p_user_id text,
  p_achievement_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_activity_user_id uuid;
  v_award public.achievement_awards%rowtype;
  v_level public.levels%rowtype;
begin
  select u.family_id, u.id::uuid
  into v_family_id, v_activity_user_id
  from public.users u
  where u.id = p_user_id
    and u.family_id = public.get_my_family_id();

  if v_family_id is null then
    raise exception 'not allowed';
  end if;

  select * into v_award
  from public.achievement_awards
  where user_id = p_user_id
    and achievement_id = p_achievement_id
  for update;

  select * into v_level
  from public.levels
  where user_id = p_user_id;

  if v_award.id is null or v_award.refunded_at is not null or v_award.points_awarded <= 0 then
    return jsonb_build_object(
      'refunded', 0,
      'userId', coalesce(v_level.user_id, p_user_id),
      'currentLevel', coalesce(v_level.current_level, 1),
      'totalPoints', coalesce(v_level.total_points, 0),
      'spendableBalance', coalesce(v_level.spendable_balance, 0),
      'updatedAt', coalesce(v_level.updated_at, now())
    );
  end if;

  update public.achievement_awards
  set refunded_at = now()
  where id = v_award.id;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  update public.levels
  set total_points = greatest(0, coalesce(v_level.total_points, 0) - v_award.points_awarded),
      spendable_balance = greatest(0, coalesce(v_level.spendable_balance, 0) - v_award.points_awarded),
      current_level = public.level_for_points(
        greatest(0, coalesce(v_level.total_points, 0) - v_award.points_awarded)
      ),
      updated_at = now()
  where user_id = p_user_id
  returning * into v_level;

  insert into public.family_activities (
    id, family_id, user_id, type, amount, message, created_at
  ) values (
    gen_random_uuid(), v_family_id, v_activity_user_id, 'SYSTEM_MESSAGE',
    -v_award.points_awarded, 'Shield revoked: requirement no longer met', now()
  );

  return jsonb_build_object(
    'refunded', v_award.points_awarded,
    'userId', v_level.user_id,
    'currentLevel', v_level.current_level,
    'totalPoints', v_level.total_points,
    'spendableBalance', v_level.spendable_balance,
    'updatedAt', v_level.updated_at
  );
end;
$$;

revoke all on function public.award_achievement_bonus(text, text, integer, text) from public;
revoke all on function public.revoke_achievement_bonus(text, text) from public;
grant execute on function public.award_achievement_bonus(text, text, integer, text) to authenticated;
grant execute on function public.revoke_achievement_bonus(text, text) to authenticated;

-- Stop application inserts while the live incident is reconciled. This lock is
-- held only for the short, set-based repair below.
begin;

lock table public.achievement_awards in share row exclusive mode;
lock table public.levels in share row exclusive mode;

create temporary table shield_duplicate_repair on commit drop as
select aa.user_id, sum(aa.points_awarded)::integer as duplicate_points
from public.achievement_awards aa
where aa.user_id in (
  '5676ea84-fed9-4314-bec3-faaae8c6f260',
  'cab88c6f-f4c5-469a-8c82-0196fcde979a',
  'd0c7caf8-6257-4951-998b-23a808f182b2',
  'e512e073-1d5b-46fd-a0f0-7ecd6f34e35f'
)
  and aa.refunded_at is null
group by aa.user_id;

update public.levels l
set total_points = greatest(0, l.total_points - r.duplicate_points),
    spendable_balance = greatest(0, l.spendable_balance - r.duplicate_points),
    current_level = public.level_for_points(greatest(0, l.total_points - r.duplicate_points)),
    updated_at = now()
from shield_duplicate_repair r
where l.user_id = r.user_id;

-- Preserve the unique rows as zero-value permanent receipts. Deleting them is
-- what made the original duplicate payout possible.
update public.achievement_awards aa
set points_awarded = 0,
    refunded_at = coalesce(aa.refunded_at, now())
where aa.user_id in (
  '5676ea84-fed9-4314-bec3-faaae8c6f260',
  'cab88c6f-f4c5-469a-8c82-0196fcde979a',
  'd0c7caf8-6257-4951-998b-23a808f182b2',
  'e512e073-1d5b-46fd-a0f0-7ecd6f34e35f'
);

-- Every already-unlocked shield gets a receipt, including shields whose old
-- receipt was deleted by a revoke. No points are granted during this backfill.
insert into public.achievement_awards (
  user_id, achievement_id, points_awarded, awarded_at, refunded_at
)
select s.user_id, unlocked.achievement_id, 0, now(), now()
from public.achievement_states s
cross join lateral jsonb_object_keys(s.unlocked_at_by_achievement_id)
  as unlocked(achievement_id)
where s.family_id = '1eff37f6-5df9-4475-a572-6c8423c85f51'
on conflict (user_id, achievement_id) do nothing;

-- Keep the client-side cache marker aligned with the permanent server receipt.
select set_config('app.allow_achievement_state_replace', 'on', true);
update public.achievement_states s
set awarded_achievement_ids = coalesce((
  select jsonb_agg(key order by key)
  from jsonb_object_keys(s.unlocked_at_by_achievement_id) as keys(key)
), '[]'::jsonb)
where s.family_id = '1eff37f6-5df9-4475-a572-6c8423c85f51';

-- Remove the incident's noisy award/refund feed and audit rows. The current
-- achievement_states rows remain the canonical unlock history.
delete from public.family_activities
where family_id = '1eff37f6-5df9-4475-a572-6c8423c85f51'
  and type = 'SYSTEM_MESSAGE'
  and (message like 'Shield unlocked:%' or message like 'Shield revoked:%');

delete from public.achievement_audit_events
where family_id = '1eff37f6-5df9-4475-a572-6c8423c85f51';

commit;

notify pgrst, 'reload schema';
