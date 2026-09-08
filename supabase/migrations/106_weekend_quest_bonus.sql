-- Migration 106: Add one weekend bonus pass when both Saturday and Sunday
-- are perfect routine days. The weekday 3-of-5 reward remains unchanged, so
-- a member can earn at most two passes per Monday-Sunday week.

alter table public.school_week_quest_marks
  drop constraint if exists school_week_quest_marks_earned_for_day_check,
  drop constraint if exists school_week_quest_marks_check;

alter table public.school_week_quest_marks
  add constraint school_week_quest_marks_day_in_week_check
    check (earned_for_day between week_start and week_start + 6);

drop index if exists public.perfect_day_coupons_user_school_week_key;
create unique index perfect_day_coupons_user_school_week_reward_key
  on public.perfect_day_coupons (user_id, week_start, reward_slot)
  where week_start is not null;

create or replace function public.school_week_quest_progress_for_member(
  p_user_id text,
  p_family_id uuid,
  p_today date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_week_start date := p_today - (extract(isodow from p_today)::integer - 1);
  v_week_perfect_days integer;
  v_weekend_perfect_days integer;
  v_best_week integer;
  v_completed_quests integer;
  v_last_perfect_day date;
  v_weekday_reward_earned boolean;
  v_weekend_reward_earned boolean;
begin
  select
    count(*) filter (where extract(isodow from m.earned_for_day) between 1 and 5)::integer,
    count(*) filter (where extract(isodow from m.earned_for_day) between 6 and 7)::integer,
    max(m.earned_for_day)
  into v_week_perfect_days, v_weekend_perfect_days, v_last_perfect_day
  from public.school_week_quest_marks m
  where m.family_id = p_family_id
    and m.user_id = p_user_id
    and m.week_start = v_week_start
    and m.earned_for_day <= p_today;

  select coalesce(max(weekly.total), 0)::integer
    into v_best_week
  from (
    select count(*) filter (
      where extract(isodow from m.earned_for_day) between 1 and 5
    )::integer as total
    from public.school_week_quest_marks m
    where m.family_id = p_family_id and m.user_id = p_user_id
    group by m.week_start
  ) weekly;

  select count(*)::integer
    into v_completed_quests
  from public.perfect_day_coupons c
  where c.family_id = p_family_id
    and c.user_id = p_user_id
    and c.week_start is not null
    and c.status <> 'revoked';

  select exists (
    select 1
    from public.perfect_day_coupons c
    where c.family_id = p_family_id
      and c.user_id = p_user_id
      and c.week_start = v_week_start
      and c.reward_slot = 1
      and c.status <> 'revoked'
  ) into v_weekday_reward_earned;

  select exists (
    select 1
    from public.perfect_day_coupons c
    where c.family_id = p_family_id
      and c.user_id = p_user_id
      and c.week_start = v_week_start
      and c.reward_slot = 2
      and c.status <> 'revoked'
  ) into v_weekend_reward_earned;

  return jsonb_build_object(
    'userId', p_user_id,
    'currentDay', least(v_week_perfect_days, 3),
    'currentStreak', v_week_perfect_days,
    'bestStreak', v_best_week,
    'completedQuests', v_completed_quests,
    'lastPerfectDay', v_last_perfect_day,
    'nextRewardCount', 1,
    'weekPerfectDays', v_week_perfect_days,
    'weekdayGoal', 3,
    'weekdayTotal', 5,
    'rewardEarnedThisWeek', v_weekday_reward_earned,
    'weekendPerfectDays', v_weekend_perfect_days,
    'weekendGoal', 2,
    'weekendTotal', 2,
    'weekendRewardEarnedThisWeek', v_weekend_reward_earned
  );
end;
$$;

revoke all on function public.school_week_quest_progress_for_member(text, uuid, date)
  from public, anon, authenticated;

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
  v_week_start date;
  v_morning_due integer;
  v_evening_due integer;
  v_morning_done integer;
  v_evening_done integer;
  v_qualifying_days integer;
  v_required_days integer;
  v_reward_slot integer;
  v_reward_kind text;
  v_awarded boolean := false;
  v_coupon public.perfect_day_coupons%rowtype;
  v_coupons jsonb := '[]'::jsonb;
  v_quest jsonb;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_earned_for_day is null or p_now is null then
    raise exception 'Weekly quest boundary is required';
  end if;
  if p_day_key not in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN') then
    raise exception 'Invalid weekly quest day';
  end if;
  if p_day_key <> (array['MON','TUE','WED','THU','FRI','SAT','SUN'])[
    extract(isodow from p_earned_for_day)::integer
  ] then
    raise exception 'Weekday does not match local date';
  end if;

  select u.id into v_locked_user_id
  from public.users u
  where u.id = p_user_id
    and u.family_id = v_family_id
    and u.deleted_at is null
  for update;
  if not found then raise exception 'Member not found'; end if;

  v_week_start := p_earned_for_day - (extract(isodow from p_earned_for_day)::integer - 1);
  if extract(isodow from p_earned_for_day) <= 5 then
    v_reward_slot := 1;
    v_reward_kind := 'weekday';
    v_required_days := 3;
  else
    v_reward_slot := 2;
    v_reward_kind := 'weekend';
    v_required_days := 2;
  end if;

  with due as (
    select t.id, t.time_window
    from public.tasks t
    where t.user_id = p_user_id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and public.task_is_due_today(
        t.days_of_week, t.recurrence, t.time_window, p_day_key, 'morning'
      )
  )
  select count(*), count(*) filter (where exists (
    select 1 from public.task_completions tc
    where tc.user_id = p_user_id
      and tc.task_id = due.id
      and tc.completed_at >= public.task_completion_window_start(
        p_day_start, due.time_window, 'morning'
      )
      and tc.completed_at < public.task_completion_window_end(
        p_day_start, due.time_window, 'morning'
      )
  )) into v_morning_due, v_morning_done from due;

  with due as (
    select t.id, t.time_window
    from public.tasks t
    where t.user_id = p_user_id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and public.task_is_due_today(
        t.days_of_week, t.recurrence, t.time_window, p_day_key, 'evening'
      )
  )
  select count(*), count(*) filter (where exists (
    select 1 from public.task_completions tc
    where tc.user_id = p_user_id
      and tc.task_id = due.id
      and tc.completed_at >= public.task_completion_window_start(
        p_day_start, due.time_window, 'evening'
      )
      and tc.completed_at < public.task_completion_window_end(
        p_day_start, due.time_window, 'evening'
      )
  )) into v_evening_due, v_evening_done from due;

  if v_morning_due = 0 or v_evening_due = 0
    or v_morning_done <> v_morning_due
    or v_evening_done <> v_evening_due
  then
    v_quest := public.school_week_quest_progress_for_member(
      p_user_id, v_family_id, p_earned_for_day
    ) || jsonb_build_object('couponsAwarded', 0, 'rewardKind', null);
    return jsonb_build_object('awarded', false, 'coupons', v_coupons, 'quest', v_quest);
  end if;

  insert into public.school_week_quest_marks (
    family_id, user_id, week_start, earned_for_day, day_started_at, created_at
  ) values (
    v_family_id, p_user_id, v_week_start, p_earned_for_day, p_day_start, p_now
  )
  on conflict (user_id, earned_for_day) do nothing;

  select count(*)::integer into v_qualifying_days
  from public.school_week_quest_marks m
  where m.family_id = v_family_id
    and m.user_id = p_user_id
    and m.week_start = v_week_start
    and (
      (v_reward_slot = 1 and extract(isodow from m.earned_for_day) between 1 and 5)
      or (v_reward_slot = 2 and extract(isodow from m.earned_for_day) between 6 and 7)
    );

  select * into v_coupon
  from public.perfect_day_coupons c
  where c.family_id = v_family_id
    and c.user_id = p_user_id
    and c.week_start = v_week_start
    and c.reward_slot = v_reward_slot
  for update;

  if v_qualifying_days >= v_required_days then
    if not found then
      insert into public.perfect_day_coupons (
        family_id, user_id, day_started_at, earned_for_day, status,
        awarded_at, updated_at, quest_day, chain_length, reward_slot, week_start
      ) values (
        v_family_id,
        p_user_id,
        (v_week_start::timestamp + interval '12 hours') at time zone 'UTC',
        p_earned_for_day,
        'available',
        p_now,
        p_now,
        3,
        v_qualifying_days,
        v_reward_slot,
        v_week_start
      )
      returning * into v_coupon;
      v_awarded := true;
    elsif v_coupon.status = 'revoked' then
      update public.perfect_day_coupons
      set status = 'available',
          redeemed_for = null,
          redeemed_at = null,
          earned_for_day = p_earned_for_day,
          awarded_at = p_now,
          updated_at = p_now,
          chain_length = v_qualifying_days
      where id = v_coupon.id
      returning * into v_coupon;
      v_awarded := true;
    end if;
  end if;

  if v_coupon.id is not null and v_coupon.status <> 'revoked' then
    v_coupons := jsonb_build_array(jsonb_build_object(
      'id', v_coupon.id,
      'familyId', v_coupon.family_id,
      'userId', v_coupon.user_id,
      'earnedForDay', v_coupon.earned_for_day,
      'status', v_coupon.status,
      'redeemedFor', v_coupon.redeemed_for,
      'awardedAt', v_coupon.awarded_at,
      'redeemedAt', v_coupon.redeemed_at,
      'questDay', 3,
      'chainLength', v_qualifying_days,
      'rewardSlot', v_reward_slot
    ));
  end if;

  v_quest := public.school_week_quest_progress_for_member(
    p_user_id, v_family_id, p_earned_for_day
  ) || jsonb_build_object(
    'couponsAwarded', case when v_awarded then 1 else 0 end,
    'rewardKind', case when v_awarded then v_reward_kind else null end
  );

  return jsonb_build_object(
    'awarded', v_awarded,
    'coupons', v_coupons,
    'quest', v_quest
  );
end;
$$;

revoke all on function public.claim_perfect_day_coupon(text, timestamptz, text, date, timestamptz)
  from public, anon;
grant execute on function public.claim_perfect_day_coupon(text, timestamptz, text, date, timestamptz)
  to authenticated;

create or replace function public.reconcile_school_week_mark_on_completion_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mark public.school_week_quest_marks%rowtype;
  v_mark_count integer;
  v_reward_slot integer;
  v_required_days integer;
  v_coupon public.perfect_day_coupons%rowtype;
begin
  perform 1 from public.users where id = old.user_id for update;

  select * into v_mark
  from public.school_week_quest_marks m
  where m.user_id = old.user_id
    and old.completed_at >= m.day_started_at
    and old.completed_at < m.day_started_at + interval '1 day'
  order by m.day_started_at desc
  limit 1
  for update;

  if not found then return old; end if;

  if extract(isodow from v_mark.earned_for_day) <= 5 then
    v_reward_slot := 1;
    v_required_days := 3;
  else
    v_reward_slot := 2;
    v_required_days := 2;
  end if;

  select count(*)::integer into v_mark_count
  from public.school_week_quest_marks m
  where m.user_id = v_mark.user_id
    and m.family_id = v_mark.family_id
    and m.week_start = v_mark.week_start
    and (
      (v_reward_slot = 1 and extract(isodow from m.earned_for_day) between 1 and 5)
      or (v_reward_slot = 2 and extract(isodow from m.earned_for_day) between 6 and 7)
    );

  if v_mark_count <= v_required_days then
    select * into v_coupon
    from public.perfect_day_coupons c
    where c.user_id = v_mark.user_id
      and c.family_id = v_mark.family_id
      and c.week_start = v_mark.week_start
      and c.reward_slot = v_reward_slot
    for update;

    if found and v_coupon.status = 'redeemed' then
      raise exception '이미 사용한 주간 퀘스트 이용권이 있어 완료를 취소할 수 없어요';
    end if;

    if found and v_coupon.status = 'available' then
      update public.perfect_day_coupons
      set status = 'revoked', updated_at = now()
      where id = v_coupon.id;
    end if;
  end if;

  delete from public.school_week_quest_marks where id = v_mark.id;
  return old;
end;
$$;

revoke all on function public.reconcile_school_week_mark_on_completion_delete()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
