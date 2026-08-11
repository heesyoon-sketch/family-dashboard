-- Migration 104: Replace passive store goals with repeatable three-day
-- Perfect Quests. Perfect days award 1 pass on day one, 1 on day two,
-- and 2 on day three. Unscheduled days pause the chain.

alter table public.perfect_day_coupons
  add column if not exists quest_day smallint,
  add column if not exists chain_length integer,
  add column if not exists reward_slot smallint not null default 1;

alter table public.perfect_day_coupons
  drop constraint if exists perfect_day_coupons_user_id_day_started_at_key;

alter table public.perfect_day_coupons
  drop constraint if exists perfect_day_coupons_quest_day_check,
  drop constraint if exists perfect_day_coupons_chain_length_check,
  drop constraint if exists perfect_day_coupons_reward_slot_check,
  drop constraint if exists perfect_day_coupons_second_slot_check;

alter table public.perfect_day_coupons
  add constraint perfect_day_coupons_quest_day_check
    check (quest_day is null or quest_day between 1 and 3),
  add constraint perfect_day_coupons_chain_length_check
    check (chain_length is null or chain_length >= 1),
  add constraint perfect_day_coupons_reward_slot_check
    check (reward_slot between 1 and 2),
  add constraint perfect_day_coupons_second_slot_check
    check (reward_slot = 1 or quest_day = 3),
  add constraint perfect_day_coupons_user_day_slot_key
    unique (user_id, day_started_at, reward_slot);

create index if not exists perfect_day_coupons_quest_progress_idx
  on public.perfect_day_coupons (family_id, user_id, earned_for_day desc)
  where quest_day is not null and status <> 'revoked';

-- The old shop-goal feature is intentionally retired. Existing settings carry
-- no monetary state, so removing them cannot affect points or purchases.
delete from public.family_settings where key like 'reward_goal:%';
drop function if exists public.set_member_reward_goal(text, text);

create or replace function public.perfect_quest_day_is_eligible(
  p_user_id text,
  p_family_id uuid,
  p_day date
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.tasks t
      where t.user_id = p_user_id
        and t.family_id = p_family_id
        and t.active = 1
        and t.deleted_at is null
        and public.task_is_due_today(
          t.days_of_week,
          t.recurrence,
          t.time_window,
          (array['MON','TUE','WED','THU','FRI','SAT','SUN'])[extract(isodow from p_day)::integer],
          'morning'
        )
    )
    and exists (
      select 1
      from public.tasks t
      where t.user_id = p_user_id
        and t.family_id = p_family_id
        and t.active = 1
        and t.deleted_at is null
        and public.task_is_due_today(
          t.days_of_week,
          t.recurrence,
          t.time_window,
          (array['MON','TUE','WED','THU','FRI','SAT','SUN'])[extract(isodow from p_day)::integer],
          'evening'
        )
    );
$$;

create or replace function public.perfect_quest_chain_continues(
  p_user_id text,
  p_family_id uuid,
  p_last_day date,
  p_current_day date
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select p_last_day is not null
    and p_current_day > p_last_day
    and not exists (
      select 1
      from generate_series(
        p_last_day + 1,
        p_current_day - 1,
        interval '1 day'
      ) as gap(day)
      where public.perfect_quest_day_is_eligible(p_user_id, p_family_id, gap.day::date)
        and not exists (
          select 1
          from public.perfect_day_coupons c
          where c.user_id = p_user_id
            and c.family_id = p_family_id
            and c.earned_for_day = gap.day::date
            and c.quest_day is not null
            and c.status <> 'revoked'
        )
    );
$$;

revoke all on function public.perfect_quest_day_is_eligible(text, uuid, date) from public, anon, authenticated;
revoke all on function public.perfect_quest_chain_continues(text, uuid, date, date) from public, anon, authenticated;

create or replace function public.get_perfect_quest_progress(p_today date)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_member record;
  v_latest_day date;
  v_latest_quest_day integer;
  v_latest_chain integer;
  v_has_latest boolean;
  v_continues boolean;
  v_current_day integer;
  v_current_streak integer;
  v_best_streak integer;
  v_completed_quests integer;
  v_result jsonb := '[]'::jsonb;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_today is null then
    raise exception 'Local date is required';
  end if;

  for v_member in
    select u.id
    from public.users u
    where u.family_id = v_family_id and u.deleted_at is null
    order by u.display_order, u.created_at
  loop
    v_latest_day := null;
    v_latest_quest_day := null;
    v_latest_chain := null;

    select c.earned_for_day, max(c.quest_day), max(c.chain_length)
      into v_latest_day, v_latest_quest_day, v_latest_chain
    from public.perfect_day_coupons c
    where c.family_id = v_family_id
      and c.user_id = v_member.id
      and c.quest_day is not null
      and c.status <> 'revoked'
      and c.earned_for_day <= p_today
    group by c.earned_for_day
    order by c.earned_for_day desc
    limit 1;
    v_has_latest := found;

    select coalesce(max(c.chain_length), 0)
      into v_best_streak
    from public.perfect_day_coupons c
    where c.family_id = v_family_id
      and c.user_id = v_member.id
      and c.quest_day is not null
      and c.status <> 'revoked';

    select count(distinct c.day_started_at)::integer
      into v_completed_quests
    from public.perfect_day_coupons c
    where c.family_id = v_family_id
      and c.user_id = v_member.id
      and c.quest_day = 3
      and c.status <> 'revoked';

    if not v_has_latest then
      v_current_day := 0;
      v_current_streak := 0;
    else
      v_continues := v_latest_day = p_today
        or public.perfect_quest_chain_continues(
          v_member.id,
          v_family_id,
          v_latest_day,
          p_today
        );

      if not v_continues then
        v_current_day := 0;
        v_current_streak := 0;
      else
        v_current_streak := coalesce(v_latest_chain, 0);
        v_current_day := case
          when v_latest_quest_day = 3 and v_latest_day < p_today then 0
          else coalesce(v_latest_quest_day, 0)
        end;
      end if;
    end if;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'userId', v_member.id,
      'currentDay', v_current_day,
      'currentStreak', v_current_streak,
      'bestStreak', coalesce(v_best_streak, 0),
      'completedQuests', coalesce(v_completed_quests, 0),
      'lastPerfectDay', v_latest_day,
      'nextRewardCount', case when v_current_day = 2 then 2 else 1 end
    ));
  end loop;

  return v_result;
end;
$$;

revoke all on function public.get_perfect_quest_progress(date) from public, anon;
grant execute on function public.get_perfect_quest_progress(date) to authenticated;

create or replace function public.claim_perfect_day_coupon(
  p_user_id text,
  p_day_start timestamptz,
  p_day_key text,
  p_earned_for_day date,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_locked_user_id text;
  v_morning_due integer;
  v_evening_due integer;
  v_morning_done integer;
  v_evening_done integer;
  v_existing_count integer;
  v_existing_active integer;
  v_previous_day date;
  v_previous_chain integer;
  v_chain_length integer;
  v_quest_day integer;
  v_reward_count integer;
  v_completed_quests integer;
  v_best_streak integer;
  v_awarded boolean := false;
  v_coupon_id uuid;
  v_coupons jsonb;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_earned_for_day is null or p_now is null then
    raise exception 'Perfect-day boundary is required';
  end if;
  if p_day_key not in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN') then
    raise exception 'Invalid perfect-day weekday';
  end if;

  select u.id into v_locked_user_id
  from public.users u
  where u.id = p_user_id
    and u.family_id = v_family_id
    and u.deleted_at is null
  for update;
  if not found then raise exception 'Member not found'; end if;

  with due as (
    select t.id, t.time_window
    from public.tasks t
    where t.user_id = p_user_id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and public.task_is_due_today(t.days_of_week, t.recurrence, t.time_window, p_day_key, 'morning')
  )
  select count(*), count(*) filter (where exists (
    select 1 from public.task_completions tc
    where tc.user_id = p_user_id
      and tc.task_id = due.id
      and tc.completed_at >= public.task_completion_window_start(p_day_start, due.time_window, 'morning')
      and tc.completed_at < public.task_completion_window_end(p_day_start, due.time_window, 'morning')
  )) into v_morning_due, v_morning_done from due;

  with due as (
    select t.id, t.time_window
    from public.tasks t
    where t.user_id = p_user_id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and public.task_is_due_today(t.days_of_week, t.recurrence, t.time_window, p_day_key, 'evening')
  )
  select count(*), count(*) filter (where exists (
    select 1 from public.task_completions tc
    where tc.user_id = p_user_id
      and tc.task_id = due.id
      and tc.completed_at >= public.task_completion_window_start(p_day_start, due.time_window, 'evening')
      and tc.completed_at < public.task_completion_window_end(p_day_start, due.time_window, 'evening')
  )) into v_evening_due, v_evening_done from due;

  if v_morning_due = 0 or v_evening_due = 0
    or v_morning_done <> v_morning_due
    or v_evening_done <> v_evening_due
  then
    return jsonb_build_object('awarded', false, 'coupons', '[]'::jsonb, 'quest', null);
  end if;

  select count(*), count(*) filter (where status <> 'revoked'),
         max(quest_day), max(chain_length)
    into v_existing_count, v_existing_active, v_quest_day, v_chain_length
  from public.perfect_day_coupons
  where user_id = p_user_id
    and family_id = v_family_id
    and day_started_at = p_day_start
    and quest_day is not null;

  if v_existing_count > 0 then
    v_reward_count := case when v_quest_day = 3 then 2 else 1 end;
    if v_existing_active = 0 then
      update public.perfect_day_coupons
      set status = 'available', redeemed_for = null, redeemed_at = null,
          awarded_at = p_now, updated_at = p_now
      where user_id = p_user_id
        and family_id = v_family_id
        and day_started_at = p_day_start
        and quest_day is not null;
      v_awarded := true;
    end if;
  else
    select c.earned_for_day, max(c.chain_length)
      into v_previous_day, v_previous_chain
    from public.perfect_day_coupons c
    where c.user_id = p_user_id
      and c.family_id = v_family_id
      and c.quest_day is not null
      and c.status <> 'revoked'
      and c.earned_for_day < p_earned_for_day
    group by c.earned_for_day
    order by c.earned_for_day desc
    limit 1;

    if found and public.perfect_quest_chain_continues(
      p_user_id, v_family_id, v_previous_day, p_earned_for_day
    ) then
      v_chain_length := coalesce(v_previous_chain, 0) + 1;
    else
      v_chain_length := 1;
    end if;

    v_quest_day := ((v_chain_length - 1) % 3) + 1;
    v_reward_count := case when v_quest_day = 3 then 2 else 1 end;

    -- Adopt a same-day legacy coupon when present so deployment never grants a
    -- duplicate day-one pass. Re-completing a previously undone day restores it.
    update public.perfect_day_coupons
    set quest_day = v_quest_day,
        chain_length = v_chain_length,
        reward_slot = 1,
        status = case when status = 'revoked' then 'available' else status end,
        redeemed_for = case when status = 'revoked' then null else redeemed_for end,
        redeemed_at = case when status = 'revoked' then null else redeemed_at end,
        updated_at = p_now
    where id = (
      select id from public.perfect_day_coupons
      where user_id = p_user_id
        and family_id = v_family_id
        and day_started_at = p_day_start
        and quest_day is null
      order by awarded_at
      limit 1
      for update
    )
    returning id into v_coupon_id;

    if v_coupon_id is null then
      insert into public.perfect_day_coupons (
        family_id, user_id, day_started_at, earned_for_day, status,
        awarded_at, updated_at, quest_day, chain_length, reward_slot
      ) values (
        v_family_id, p_user_id, p_day_start, p_earned_for_day, 'available',
        p_now, p_now, v_quest_day, v_chain_length, 1
      );
    end if;

    if v_reward_count = 2 then
      insert into public.perfect_day_coupons (
        family_id, user_id, day_started_at, earned_for_day, status,
        awarded_at, updated_at, quest_day, chain_length, reward_slot
      ) values (
        v_family_id, p_user_id, p_day_start, p_earned_for_day, 'available',
        p_now, p_now, v_quest_day, v_chain_length, 2
      ) on conflict (user_id, day_started_at, reward_slot) do nothing;
    end if;
    v_awarded := true;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'familyId', c.family_id,
    'userId', c.user_id,
    'earnedForDay', c.earned_for_day,
    'status', c.status,
    'redeemedFor', c.redeemed_for,
    'awardedAt', c.awarded_at,
    'redeemedAt', c.redeemed_at,
    'questDay', c.quest_day,
    'chainLength', c.chain_length,
    'rewardSlot', c.reward_slot
  ) order by c.reward_slot), '[]'::jsonb)
    into v_coupons
  from public.perfect_day_coupons c
  where c.user_id = p_user_id
    and c.family_id = v_family_id
    and c.day_started_at = p_day_start
    and c.quest_day is not null;

  select count(distinct c.day_started_at)::integer
    into v_completed_quests
  from public.perfect_day_coupons c
  where c.user_id = p_user_id and c.family_id = v_family_id
    and c.quest_day = 3 and c.status <> 'revoked';

  select coalesce(max(c.chain_length), 0)
    into v_best_streak
  from public.perfect_day_coupons c
  where c.user_id = p_user_id and c.family_id = v_family_id
    and c.quest_day is not null and c.status <> 'revoked';

  return jsonb_build_object(
    'awarded', v_awarded,
    'coupons', v_coupons,
    'quest', jsonb_build_object(
      'userId', p_user_id,
      'currentDay', v_quest_day,
      'currentStreak', v_chain_length,
      'bestStreak', v_best_streak,
      'completedQuests', v_completed_quests,
      'lastPerfectDay', p_earned_for_day,
      'nextRewardCount', case when v_quest_day = 2 then 2 else 1 end,
      'couponsAwarded', v_reward_count
    )
  );
end;
$$;

revoke all on function public.claim_perfect_day_coupon(text, timestamptz, text, date, timestamptz) from public, anon;
grant execute on function public.claim_perfect_day_coupon(text, timestamptz, text, date, timestamptz) to authenticated;

-- Coupon state and completion truth move together. A day-three undo revokes
-- both passes; if either pass was used, the completion cannot be undone.
create or replace function public.process_task_undo_atomic(
  p_user_id text,
  p_task_id text,
  p_day_start timestamptz,
  p_day_key text,
  p_time_window text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_task public.tasks;
  v_level public.levels;
  v_completion public.task_completions;
  v_streak public.streaks;
  v_completion_window_start timestamptz;
  v_completion_window_end timestamptz;
  v_points_to_deduct integer;
  v_restored_streak integer;
  v_new_total integer;
  v_new_balance integer;
  v_new_level integer;
  v_max_streak integer;
  v_longest_streak integer;
  v_revoked_coupon_ids uuid[] := array[]::uuid[];
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select t.* into v_task
  from public.tasks t
  join public.users u on u.id = t.user_id
  where t.id = p_task_id and t.user_id = p_user_id
    and u.family_id = v_family_id
  for update of t;
  if not found then raise exception 'Task % not found', p_task_id; end if;

  v_completion_window_start := public.task_completion_window_start(p_day_start, v_task.time_window, p_time_window);
  v_completion_window_end := public.task_completion_window_end(p_day_start, v_task.time_window, p_time_window);

  select * into v_completion
  from public.task_completions
  where user_id = p_user_id and task_id = p_task_id
    and completed_at >= v_completion_window_start
    and completed_at < v_completion_window_end
  order by completed_at desc limit 1 for update;

  if not found then
    select coalesce(max(current), 0), coalesce(max(longest), 0)
      into v_max_streak, v_longest_streak
    from public.streaks where user_id = p_user_id;
    return jsonb_build_object(
      'level', null, 'maxStreak', v_max_streak,
      'longestStreak', v_longest_streak,
      'taskStreakCount', coalesce(v_task.streak_count, 0),
      'taskLastCompletedAt', v_task.last_completed_at,
      'revokedCouponId', null,
      'revokedCouponIds', '[]'::jsonb
    );
  end if;

  perform 1 from public.perfect_day_coupons
  where user_id = p_user_id and family_id = v_family_id
    and day_started_at = p_day_start
  for update;

  if exists (
    select 1 from public.perfect_day_coupons
    where user_id = p_user_id and family_id = v_family_id
      and day_started_at = p_day_start and status = 'redeemed'
  ) then
    raise exception '이미 사용한 퍼펙트 데이 쿠폰이 있어 완료를 취소할 수 없어요';
  end if;

  select coalesce(array_agg(id order by reward_slot), array[]::uuid[])
    into v_revoked_coupon_ids
  from public.perfect_day_coupons
  where user_id = p_user_id and family_id = v_family_id
    and day_started_at = p_day_start and status = 'available';

  update public.perfect_day_coupons
  set status = 'revoked', updated_at = p_now
  where id = any(v_revoked_coupon_ids);

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, p_now) on conflict (user_id) do nothing;
  select * into v_level from public.levels where user_id = p_user_id for update;

  select * into v_streak from public.streaks
  where user_id = p_user_id and task_id = p_task_id
  order by last_completed_at desc nulls last limit 1 for update;

  v_points_to_deduct := greatest(coalesce(v_completion.points_awarded, 0), 0);
  if coalesce(v_level.spendable_balance, 0) < v_points_to_deduct then
    raise exception '이미 사용한 포인트라 완료를 취소할 수 없어요';
  end if;

  v_restored_streak := greatest(coalesce(v_completion.streak_before, 0), 0);
  v_new_total := greatest(coalesce(v_level.total_points, 0) - v_points_to_deduct, 0);
  v_new_balance := greatest(coalesce(v_level.spendable_balance, 0) - v_points_to_deduct, 0);
  v_new_level := public.level_for_points(v_new_total);

  delete from public.task_completions where id = v_completion.id;
  update public.tasks set streak_count = v_restored_streak,
    last_completed_at = v_completion.last_completed_before where id = p_task_id;
  if v_streak.id is not null then
    update public.streaks set current = v_restored_streak,
      last_completed_at = v_completion.last_completed_before where id = v_streak.id;
  end if;
  update public.levels set current_level = v_new_level,
    total_points = v_new_total, spendable_balance = v_new_balance,
    updated_at = p_now where user_id = p_user_id;

  select coalesce(max(current), 0), coalesce(max(longest), 0)
    into v_max_streak, v_longest_streak
  from public.streaks where user_id = p_user_id;

  return jsonb_build_object(
    'level', jsonb_build_object(
      'userId', p_user_id, 'currentLevel', v_new_level,
      'totalPoints', v_new_total, 'spendableBalance', v_new_balance,
      'updatedAt', p_now
    ),
    'maxStreak', v_max_streak,
    'longestStreak', v_longest_streak,
    'taskStreakCount', v_restored_streak,
    'taskLastCompletedAt', v_completion.last_completed_before,
    'revokedCouponId', v_revoked_coupon_ids[1],
    'revokedCouponIds', to_jsonb(v_revoked_coupon_ids)
  );
end;
$$;

revoke all on function public.process_task_undo_atomic(text, text, timestamptz, text, text, timestamptz) from public, anon;
grant execute on function public.process_task_undo_atomic(text, text, timestamptz, text, text, timestamptz) to authenticated;

create or replace function public.admin_reset_family_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_user_ids text[];
begin
  select array_agg(id) into v_user_ids from public.users where family_id = v_family_id;
  if coalesce(array_length(v_user_ids, 1), 0) = 0 then return; end if;

  delete from public.perfect_day_coupons where family_id = v_family_id;
  delete from public.task_completions where user_id = any(v_user_ids);
  delete from public.streaks where user_id = any(v_user_ids);
  delete from public.user_badges where user_id = any(v_user_ids);
  delete from public.family_activities
  where family_id = v_family_id
    and (type = 'TASK_COMPLETED'
      or (type = 'SYSTEM_MESSAGE' and message like 'PERFECT_DAY_COUPON:%'));

  update public.tasks set streak_count = 0, last_completed_at = null
  where family_id = v_family_id;
  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  select id, 1, 0, 0, now() from public.users where family_id = v_family_id
  on conflict (user_id) do update
  set current_level = excluded.current_level,
      total_points = excluded.total_points,
      spendable_balance = excluded.spendable_balance,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.admin_reset_family_progress() from public, anon;
grant execute on function public.admin_reset_family_progress() to authenticated;

notify pgrst, 'reload schema';
