-- Migration 082: counterpart to award_achievement_bonus.
--
-- When a child undoes a task completion that pushed them past an achievement
-- threshold, the achievement should also come off — both the badge itself
-- (handled in the local Insignia Wall ledger) and the bonus points the badge
-- granted. This RPC removes the achievement_awards row and refunds the
-- exact points originally awarded back out of total_points and
-- spendable_balance, then recomputes current_level. If the row was never
-- written (e.g. award failed silently the first time), the call is a no-op.
--
-- Apply with: supabase migration up
-- Safe on production — only the affected user's award row and level are
-- touched, and refunds are non-negative.

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
  v_award public.achievement_awards;
  v_level public.levels%rowtype;
  v_new_total integer;
  v_new_balance integer;
  v_new_level integer;
begin
  select family_id into v_family_id
  from public.users
  where id = p_user_id
    and family_id = public.get_my_family_id();

  if v_family_id is null then
    raise exception 'not allowed';
  end if;

  delete from public.achievement_awards
  where user_id = p_user_id
    and achievement_id = p_achievement_id
  returning * into v_award;

  if v_award.id is null then
    -- Nothing was awarded for this achievement on this user; nothing to refund.
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
    p_user_id,
    'SYSTEM_MESSAGE',
    -v_award.points_awarded,
    'Insignia revoked: requirement no longer met',
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

grant execute on function public.revoke_achievement_bonus(text, text) to authenticated;

notify pgrst, 'reload schema';
