-- Migration 099: Award one durable 30-minute coupon for a true perfect day.
--
-- A perfect day requires at least one scheduled routine in both windows and
-- every scheduled morning/evening slot to be completed in its own window.
-- Tasks configured for "both" therefore need two completions. Coupon claiming
-- is idempotent per member/local-day and redemption is RPC-only.

create table if not exists public.perfect_day_coupons (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,
  user_id          text not null references public.users(id) on delete cascade,
  day_started_at   timestamptz not null,
  earned_for_day   date not null,
  status           text not null default 'available'
    check (status in ('available', 'redeemed', 'revoked')),
  redeemed_for     text default null
    check (redeemed_for is null or redeemed_for in ('game', 'media')),
  awarded_at       timestamptz not null default now(),
  redeemed_at      timestamptz default null,
  updated_at       timestamptz not null default now(),
  unique (user_id, day_started_at),
  check (
    (status = 'redeemed' and redeemed_for is not null and redeemed_at is not null)
    or (status <> 'redeemed' and redeemed_for is null and redeemed_at is null)
  )
);

create index if not exists perfect_day_coupons_family_user_status_idx
  on public.perfect_day_coupons (family_id, user_id, status, awarded_at desc);

alter table public.perfect_day_coupons enable row level security;

drop policy if exists perfect_day_coupons_family_select on public.perfect_day_coupons;
create policy perfect_day_coupons_family_select on public.perfect_day_coupons
  for select to authenticated
  using (family_id = (select public.get_my_family_id()));

revoke insert, update, delete on public.perfect_day_coupons from authenticated, anon;
grant select on public.perfect_day_coupons to authenticated;

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
  v_morning_due integer;
  v_evening_due integer;
  v_morning_done integer;
  v_evening_done integer;
  v_coupon public.perfect_day_coupons%rowtype;
  v_awarded boolean := false;
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

  if not exists (
    select 1
    from public.users u
    where u.id = p_user_id
      and u.family_id = v_family_id
      and u.deleted_at is null
  ) then
    raise exception 'Member not found';
  end if;

  with due as (
    select t.id, t.time_window
    from public.tasks t
    where t.user_id = p_user_id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and public.task_is_due_today(
        t.days_of_week,
        t.recurrence,
        t.time_window,
        p_day_key,
        'morning'
      )
  )
  select
    count(*),
    count(*) filter (where exists (
      select 1
      from public.task_completions tc
      where tc.user_id = p_user_id
        and tc.task_id = due.id
        and tc.completed_at >= public.task_completion_window_start(p_day_start, due.time_window, 'morning')
        and tc.completed_at < public.task_completion_window_end(p_day_start, due.time_window, 'morning')
    ))
  into v_morning_due, v_morning_done
  from due;

  with due as (
    select t.id, t.time_window
    from public.tasks t
    where t.user_id = p_user_id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and public.task_is_due_today(
        t.days_of_week,
        t.recurrence,
        t.time_window,
        p_day_key,
        'evening'
      )
  )
  select
    count(*),
    count(*) filter (where exists (
      select 1
      from public.task_completions tc
      where tc.user_id = p_user_id
        and tc.task_id = due.id
        and tc.completed_at >= public.task_completion_window_start(p_day_start, due.time_window, 'evening')
        and tc.completed_at < public.task_completion_window_end(p_day_start, due.time_window, 'evening')
    ))
  into v_evening_due, v_evening_done
  from due;

  if v_morning_due = 0
    or v_evening_due = 0
    or v_morning_done <> v_morning_due
    or v_evening_done <> v_evening_due
  then
    return jsonb_build_object('awarded', false, 'coupon', null);
  end if;

  insert into public.perfect_day_coupons (
    family_id,
    user_id,
    day_started_at,
    earned_for_day,
    status,
    awarded_at,
    updated_at
  ) values (
    v_family_id,
    p_user_id,
    p_day_start,
    p_earned_for_day,
    'available',
    p_now,
    p_now
  )
  on conflict (user_id, day_started_at) do nothing
  returning * into v_coupon;

  if found then
    v_awarded := true;
  else
    select * into v_coupon
    from public.perfect_day_coupons
    where user_id = p_user_id
      and day_started_at = p_day_start
    for update;

    if v_coupon.status = 'revoked' then
      update public.perfect_day_coupons
      set status = 'available',
          redeemed_for = null,
          redeemed_at = null,
          awarded_at = p_now,
          updated_at = p_now
      where id = v_coupon.id
      returning * into v_coupon;
      v_awarded := true;
    end if;
  end if;

  return jsonb_build_object(
    'awarded', v_awarded,
    'coupon', jsonb_build_object(
      'id', v_coupon.id,
      'familyId', v_coupon.family_id,
      'userId', v_coupon.user_id,
      'earnedForDay', v_coupon.earned_for_day,
      'status', v_coupon.status,
      'redeemedFor', v_coupon.redeemed_for,
      'awardedAt', v_coupon.awarded_at,
      'redeemedAt', v_coupon.redeemed_at
    )
  );
end;
$$;

revoke all on function public.claim_perfect_day_coupon(text, timestamptz, text, date, timestamptz) from public, anon;
grant execute on function public.claim_perfect_day_coupon(text, timestamptz, text, date, timestamptz) to authenticated;

create or replace function public.redeem_perfect_day_coupon(
  p_coupon_id uuid,
  p_user_id text,
  p_redeemed_for text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_coupon public.perfect_day_coupons%rowtype;
  v_message text;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_redeemed_for not in ('game', 'media') then
    raise exception 'Choose game or media time';
  end if;

  select * into v_coupon
  from public.perfect_day_coupons
  where id = p_coupon_id
    and user_id = p_user_id
    and family_id = v_family_id
  for update;

  if not found then
    raise exception 'Coupon not found';
  end if;

  if v_coupon.status <> 'available' then
    raise exception 'Coupon is no longer available';
  end if;

  update public.perfect_day_coupons
  set status = 'redeemed',
      redeemed_for = p_redeemed_for,
      redeemed_at = p_now,
      updated_at = p_now
  where id = p_coupon_id
  returning * into v_coupon;

  v_message := 'PERFECT_DAY_COUPON:' || p_redeemed_for;
  insert into public.family_activities (
    family_id, user_id, type, amount, message, created_at
  ) values (
    v_family_id, p_user_id::uuid, 'SYSTEM_MESSAGE', 0, v_message, p_now
  );

  return jsonb_build_object(
    'id', v_coupon.id,
    'familyId', v_coupon.family_id,
    'userId', v_coupon.user_id,
    'earnedForDay', v_coupon.earned_for_day,
    'status', v_coupon.status,
    'redeemedFor', v_coupon.redeemed_for,
    'awardedAt', v_coupon.awarded_at,
    'redeemedAt', v_coupon.redeemed_at
  );
end;
$$;

revoke all on function public.redeem_perfect_day_coupon(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.redeem_perfect_day_coupon(uuid, text, text, timestamptz) to authenticated;

-- Replace the latest undo function so coupon state and completion truth move
-- together in the same transaction.
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
  v_coupon public.perfect_day_coupons%rowtype;
  v_completion_window_start timestamptz;
  v_completion_window_end timestamptz;
  v_points_to_deduct integer;
  v_restored_streak integer;
  v_new_total integer;
  v_new_balance integer;
  v_new_level integer;
  v_max_streak integer;
  v_longest_streak integer;
  v_revoked_coupon_id uuid;
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  select t.* into v_task
  from public.tasks t
  join public.users u on u.id = t.user_id
  where t.id = p_task_id
    and t.user_id = p_user_id
    and u.family_id = v_family_id
  for update of t;

  if not found then
    raise exception 'Task % not found', p_task_id;
  end if;

  v_completion_window_start := public.task_completion_window_start(p_day_start, v_task.time_window, p_time_window);
  v_completion_window_end := public.task_completion_window_end(p_day_start, v_task.time_window, p_time_window);

  select * into v_completion
  from public.task_completions
  where user_id = p_user_id
    and task_id = p_task_id
    and completed_at >= v_completion_window_start
    and completed_at < v_completion_window_end
  order by completed_at desc
  limit 1
  for update;

  if not found then
    select coalesce(max(current), 0), coalesce(max(longest), 0)
      into v_max_streak, v_longest_streak
    from public.streaks
    where user_id = p_user_id;

    return jsonb_build_object(
      'level', null,
      'maxStreak', v_max_streak,
      'longestStreak', v_longest_streak,
      'taskStreakCount', coalesce(v_task.streak_count, 0),
      'taskLastCompletedAt', v_task.last_completed_at,
      'revokedCouponId', null
    );
  end if;

  select * into v_coupon
  from public.perfect_day_coupons
  where user_id = p_user_id
    and family_id = v_family_id
    and day_started_at = p_day_start
  for update;

  if found and v_coupon.status = 'redeemed' then
    raise exception '이미 사용한 퍼펙트 데이 쿠폰이 있어 완료를 취소할 수 없어요';
  end if;

  if found and v_coupon.status = 'available' then
    update public.perfect_day_coupons
    set status = 'revoked',
        updated_at = p_now
    where id = v_coupon.id;
    v_revoked_coupon_id := v_coupon.id;
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, p_now)
  on conflict (user_id) do nothing;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  select * into v_streak
  from public.streaks
  where user_id = p_user_id and task_id = p_task_id
  order by last_completed_at desc nulls last
  limit 1
  for update;

  v_points_to_deduct := greatest(coalesce(v_completion.points_awarded, 0), 0);

  if coalesce(v_level.spendable_balance, 0) < v_points_to_deduct then
    raise exception '이미 사용한 포인트라 완료를 취소할 수 없어요';
  end if;

  v_restored_streak := greatest(coalesce(v_completion.streak_before, 0), 0);
  v_new_total := greatest(coalesce(v_level.total_points, 0) - v_points_to_deduct, 0);
  v_new_balance := greatest(coalesce(v_level.spendable_balance, 0) - v_points_to_deduct, 0);
  v_new_level := public.level_for_points(v_new_total);

  delete from public.task_completions where id = v_completion.id;

  update public.tasks
  set streak_count = v_restored_streak,
      last_completed_at = v_completion.last_completed_before
  where id = p_task_id;

  if v_streak.id is not null then
    update public.streaks
    set current = v_restored_streak,
        last_completed_at = v_completion.last_completed_before
    where id = v_streak.id;
  end if;

  update public.levels
  set current_level = v_new_level,
      total_points = v_new_total,
      spendable_balance = v_new_balance,
      updated_at = p_now
  where user_id = p_user_id;

  select coalesce(max(current), 0), coalesce(max(longest), 0)
    into v_max_streak, v_longest_streak
  from public.streaks
  where user_id = p_user_id;

  return jsonb_build_object(
    'level', jsonb_build_object(
      'userId', p_user_id,
      'currentLevel', v_new_level,
      'totalPoints', v_new_total,
      'spendableBalance', v_new_balance,
      'updatedAt', p_now
    ),
    'maxStreak', v_max_streak,
    'longestStreak', v_longest_streak,
    'taskStreakCount', v_restored_streak,
    'taskLastCompletedAt', v_completion.last_completed_before,
    'revokedCouponId', v_revoked_coupon_id
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
  select array_agg(id) into v_user_ids
  from public.users
  where family_id = v_family_id;

  if coalesce(array_length(v_user_ids, 1), 0) = 0 then return; end if;

  delete from public.perfect_day_coupons where family_id = v_family_id;
  delete from public.task_completions where user_id = any(v_user_ids);
  delete from public.streaks where user_id = any(v_user_ids);
  delete from public.user_badges where user_id = any(v_user_ids);
  delete from public.family_activities
  where family_id = v_family_id
    and (
      type = 'TASK_COMPLETED'
      or (type = 'SYSTEM_MESSAGE' and message like 'PERFECT_DAY_COUPON:%')
    );

  update public.tasks
  set streak_count = 0, last_completed_at = null
  where family_id = v_family_id;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  select id, 1, 0, 0, now()
  from public.users
  where family_id = v_family_id
  on conflict (user_id) do update
  set current_level = excluded.current_level,
      total_points = excluded.total_points,
      spendable_balance = excluded.spendable_balance,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.admin_reset_family_progress() from public, anon;
grant execute on function public.admin_reset_family_progress() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'perfect_day_coupons'
  ) then
    execute 'alter publication supabase_realtime add table public.perfect_day_coupons';
  end if;
end;
$$;

notify pgrst, 'reload schema';
