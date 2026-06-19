-- Migration 088: fix achievement bonus/refund activity feed user casts.
--
-- `family_activities.user_id` is uuid, while the achievement RPC public API
-- accepts text user ids to match the rest of the client code. Re-emit both
-- functions with the same behavior and route activity inserts through the
-- validated UUID value selected from public.users.

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
  v_new_total integer;
  v_new_balance integer;
  v_new_level integer;
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

  insert into public.achievement_awards (user_id, achievement_id, points_awarded)
  values (p_user_id, p_achievement_id, p_points)
  on conflict (user_id, achievement_id) do nothing
  returning id into v_award_id;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  if v_award_id is not null then
    v_new_total := coalesce(v_level.total_points, 0) + p_points;
    v_new_balance := coalesce(v_level.spendable_balance, 0) + p_points;
    v_new_level := public.level_for_points(v_new_total);

    update public.levels
    set total_points = v_new_total,
        spendable_balance = v_new_balance,
        current_level = v_new_level,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_level;

    insert into public.family_activities (
      id,
      family_id,
      user_id,
      type,
      amount,
      message,
      created_at
    )
    values (
      gen_random_uuid(),
      v_family_id,
      v_activity_user_id,
      'SYSTEM_MESSAGE',
      p_points,
      coalesce(p_message, 'Achievement bonus'),
      now()
    );
  end if;

  return jsonb_build_object(
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
  v_award public.achievement_awards;
  v_level public.levels%rowtype;
  v_new_total integer;
  v_new_balance integer;
  v_new_level integer;
begin
  select u.family_id, u.id::uuid
  into v_family_id, v_activity_user_id
  from public.users u
  where u.id = p_user_id
    and u.family_id = public.get_my_family_id();

  if v_family_id is null then
    raise exception 'not allowed';
  end if;

  delete from public.achievement_awards
  where user_id = p_user_id
    and achievement_id = p_achievement_id
  returning * into v_award;

  if v_award.id is null then
    select * into v_level
    from public.levels
    where user_id = p_user_id;

    return jsonb_build_object(
      'refunded', 0,
      'userId', coalesce(v_level.user_id, p_user_id),
      'currentLevel', coalesce(v_level.current_level, 1),
      'totalPoints', coalesce(v_level.total_points, 0),
      'spendableBalance', coalesce(v_level.spendable_balance, 0),
      'updatedAt', coalesce(v_level.updated_at, now())
    );
  end if;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  v_new_total := greatest(0, coalesce(v_level.total_points, 0) - v_award.points_awarded);
  v_new_balance := greatest(0, coalesce(v_level.spendable_balance, 0) - v_award.points_awarded);
  v_new_level := public.level_for_points(v_new_total);

  update public.levels
  set total_points = v_new_total,
      spendable_balance = v_new_balance,
      current_level = v_new_level,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_level;

  insert into public.family_activities (
    id, family_id, user_id, type, amount, message, created_at
  )
  values (
    gen_random_uuid(),
    v_family_id,
    v_activity_user_id,
    'SYSTEM_MESSAGE',
    -v_award.points_awarded,
    'Shield revoked: requirement no longer met',
    now()
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

grant execute on function public.award_achievement_bonus(text, text, integer, text) to authenticated;
grant execute on function public.revoke_achievement_bonus(text, text) to authenticated;

notify pgrst, 'reload schema';
