-- Migration 105: Replace repeatable three-day Perfect Quests with one
-- School Week Quest per Monday-Friday week.
--
-- Each weekday on which every scheduled morning and evening routine is
-- completed earns one mark. Three marks in the same week award exactly one
-- durable 30-minute pass. Existing passes remain valid.

alter table public.perfect_day_coupons
  add column if not exists week_start date;

create table if not exists public.school_week_quest_marks (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,
  user_id          text not null references public.users(id) on delete cascade,
  week_start       date not null,
  earned_for_day   date not null,
  day_started_at   timestamptz not null,
  created_at       timestamptz not null default now(),
  unique (user_id, earned_for_day),
  check (extract(isodow from earned_for_day) between 1 and 5),
  check (earned_for_day between week_start and week_start + 4)
);

create index if not exists school_week_quest_marks_family_week_idx
  on public.school_week_quest_marks (family_id, week_start, user_id);

alter table public.school_week_quest_marks enable row level security;

drop policy if exists school_week_quest_marks_family_select on public.school_week_quest_marks;
create policy school_week_quest_marks_family_select on public.school_week_quest_marks
  for select to authenticated
  using (family_id = (select public.get_my_family_id()));

revoke insert, update, delete on public.school_week_quest_marks from authenticated, anon;
grant select on public.school_week_quest_marks to authenticated;

-- Preserve the current week's progress during rollout. Old coupons are not
-- removed; one existing pass is simply tagged as the historical weekly reward
-- when that week already contains at least three qualifying weekdays.
insert into public.school_week_quest_marks (
  family_id, user_id, week_start, earned_for_day, day_started_at, created_at
)
select distinct on (c.user_id, c.earned_for_day)
  c.family_id,
  c.user_id,
  c.earned_for_day - (extract(isodow from c.earned_for_day)::integer - 1),
  c.earned_for_day,
  c.day_started_at,
  c.awarded_at
from public.perfect_day_coupons c
where c.quest_day is not null
  and c.status <> 'revoked'
  and extract(isodow from c.earned_for_day) between 1 and 5
order by c.user_id, c.earned_for_day, c.reward_slot, c.awarded_at
on conflict (user_id, earned_for_day) do nothing;

with day_coupon as (
  select distinct on (c.user_id, c.earned_for_day)
    c.id,
    c.user_id,
    c.earned_for_day,
    c.earned_for_day - (extract(isodow from c.earned_for_day)::integer - 1) as week_start
  from public.perfect_day_coupons c
  where c.quest_day is not null
    and c.status <> 'revoked'
    and extract(isodow from c.earned_for_day) between 1 and 5
  order by c.user_id, c.earned_for_day, c.reward_slot, c.awarded_at
), ranked as (
  select
    id,
    week_start,
    row_number() over (partition by user_id, week_start order by earned_for_day) as weekday_number
  from day_coupon
)
update public.perfect_day_coupons c
set week_start = ranked.week_start
from ranked
where c.id = ranked.id
  and ranked.weekday_number = 3
  and c.week_start is null;

create unique index if not exists perfect_day_coupons_user_school_week_key
  on public.perfect_day_coupons (user_id, week_start)
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
  v_best_week integer;
  v_completed_quests integer;
  v_last_perfect_day date;
  v_reward_earned boolean;
begin
  select count(*)::integer, max(m.earned_for_day)
    into v_week_perfect_days, v_last_perfect_day
  from public.school_week_quest_marks m
  where m.family_id = p_family_id
    and m.user_id = p_user_id
    and m.week_start = v_week_start
    and m.earned_for_day <= p_today;

  select coalesce(max(weekly.total), 0)::integer
    into v_best_week
  from (
    select count(*)::integer as total
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
      and c.status <> 'revoked'
  ) into v_reward_earned;

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
    'rewardEarnedThisWeek', v_reward_earned
  );
end;
$$;

revoke all on function public.school_week_quest_progress_for_member(text, uuid, date)
  from public, anon, authenticated;

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
    v_result := v_result || jsonb_build_array(
      public.school_week_quest_progress_for_member(v_member.id, v_family_id, p_today)
    );
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
  v_week_start date;
  v_morning_due integer;
  v_evening_due integer;
  v_morning_done integer;
  v_evening_done integer;
  v_week_perfect_days integer;
  v_awarded boolean := false;
  v_coupon public.perfect_day_coupons%rowtype;
  v_coupons jsonb := '[]'::jsonb;
  v_quest jsonb;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_earned_for_day is null or p_now is null then
    raise exception 'School-week boundary is required';
  end if;
  if p_day_key not in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN') then
    raise exception 'Invalid school-week weekday';
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

  -- Saturday and Sunday never earn school-week marks.
  if extract(isodow from p_earned_for_day) > 5 then
    v_quest := public.school_week_quest_progress_for_member(
      p_user_id, v_family_id, p_earned_for_day
    ) || jsonb_build_object('couponsAwarded', 0);
    return jsonb_build_object('awarded', false, 'coupons', v_coupons, 'quest', v_quest);
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
    ) || jsonb_build_object('couponsAwarded', 0);
    return jsonb_build_object('awarded', false, 'coupons', v_coupons, 'quest', v_quest);
  end if;

  insert into public.school_week_quest_marks (
    family_id, user_id, week_start, earned_for_day, day_started_at, created_at
  ) values (
    v_family_id, p_user_id, v_week_start, p_earned_for_day, p_day_start, p_now
  )
  on conflict (user_id, earned_for_day) do nothing;

  select count(*)::integer into v_week_perfect_days
  from public.school_week_quest_marks m
  where m.family_id = v_family_id
    and m.user_id = p_user_id
    and m.week_start = v_week_start;

  select * into v_coupon
  from public.perfect_day_coupons c
  where c.family_id = v_family_id
    and c.user_id = p_user_id
    and c.week_start = v_week_start
  for update;

  if v_week_perfect_days >= 3 then
    if not found then
      -- Noon UTC is a stable weekly idempotency sentinel and intentionally
      -- cannot match a client-provided local midnight during an undo.
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
        v_week_perfect_days,
        1,
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
          chain_length = v_week_perfect_days
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
      'chainLength', v_week_perfect_days,
      'rewardSlot', 1
    ));
  end if;

  v_quest := public.school_week_quest_progress_for_member(
    p_user_id, v_family_id, p_earned_for_day
  ) || jsonb_build_object('couponsAwarded', case when v_awarded then 1 else 0 end);

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

-- Keep a weekday mark truthful when any completion from that perfect day is
-- undone. If the mark was necessary for the weekly reward, the pass is revoked;
-- a used pass blocks the undo just like the original Perfect Day behavior.
create or replace function public.reconcile_school_week_mark_on_completion_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mark public.school_week_quest_marks%rowtype;
  v_mark_count integer;
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

  select count(*)::integer into v_mark_count
  from public.school_week_quest_marks m
  where m.user_id = v_mark.user_id
    and m.family_id = v_mark.family_id
    and m.week_start = v_mark.week_start;

  if v_mark_count <= 3 then
    select * into v_coupon
    from public.perfect_day_coupons c
    where c.user_id = v_mark.user_id
      and c.family_id = v_mark.family_id
      and c.week_start = v_mark.week_start
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

drop trigger if exists reconcile_school_week_mark_before_completion_delete
  on public.task_completions;
create trigger reconcile_school_week_mark_before_completion_delete
before delete on public.task_completions
for each row execute function public.reconcile_school_week_mark_on_completion_delete();

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
  delete from public.school_week_quest_marks where family_id = v_family_id;
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
