-- Migration 090: snapshot achievement categories at task completion time.
--
-- Category shields used to infer a completion's categories from the task's
-- current title/icon/time_window. Renaming a habit later could therefore
-- rewrite historical shield progress. Store the category snapshot on each
-- completion row instead.

create or replace function public.task_achievement_categories(
  p_title text,
  p_icon text,
  p_time_window text
)
returns text[]
language sql
immutable
set search_path = public
as $$
  with matched as (
    select array_remove(array[
      case when lower(coalesce(p_title, '') || ' ' || coalesce(p_icon, '')) ~ '(read|book|diary|workbook|homework|page|독서|책|일기|문제집|숙제)' then 'learning' end,
      case when lower(coalesce(p_title, '') || ' ' || coalesce(p_icon, '')) ~ '(bible|qt|pray|prayer|faith|reflection|묵상|성경|기도)' then 'faith' end,
      case when lower(coalesce(p_title, '') || ' ' || coalesce(p_icon, '')) ~ '(clean|cleanup|laundry|room|toy|bed|pajama|정리|빨래|장난감|침구|잠옷)' then 'responsibility' end,
      case when lower(coalesce(p_title, '') || ' ' || coalesce(p_icon, '')) ~ '(exercise|workout|move|run|운동|스트레칭)' then 'exercise' end,
      case when lower(coalesce(p_title, '') || ' ' || coalesce(p_icon, '')) ~ '(brush|tooth|wash|lotion|vitamin|supplement|hygiene|양치|세수|로션|비타민|영양제)' then 'health' end,
      case when lower(coalesce(p_title, '') || ' ' || coalesce(p_icon, '')) ~ '(school|backpack|bag|prepare|학교|가방|준비)' then 'school' end,
      case when lower(coalesce(p_title, '') || ' ' || coalesce(p_icon, '')) ~ '(morning|affirmation|아침|확언)' or p_time_window = 'morning' then 'morning' end,
      case when lower(coalesce(p_title, '') || ' ' || coalesce(p_icon, '')) ~ '(evening|night|pajama|저녁|밤|잠옷)' or p_time_window = 'evening' then 'evening' end
    ], null) as categories
  )
  select case
    when coalesce(array_length(categories, 1), 0) = 0 then array['responsibility']::text[]
    else categories
  end
  from matched;
$$;

alter table public.task_completions
  add column if not exists achievement_categories text[];

update public.task_completions tc
set achievement_categories = public.task_achievement_categories(t.title, t.icon, t.time_window)
from public.tasks t
where t.id = tc.task_id
  and (
    tc.achievement_categories is null
    or cardinality(tc.achievement_categories) = 0
  );

update public.task_completions
set achievement_categories = array['responsibility']::text[]
where achievement_categories is null
   or cardinality(achievement_categories) = 0;

alter table public.task_completions
  alter column achievement_categories set default array['responsibility']::text[],
  alter column achievement_categories set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.task_completions'::regclass
      and conname = 'task_completions_achievement_categories_check'
  ) then
    alter table public.task_completions
      add constraint task_completions_achievement_categories_check
      check (
        cardinality(achievement_categories) > 0
        and achievement_categories <@ array[
          'health',
          'learning',
          'faith',
          'responsibility',
          'exercise',
          'school',
          'morning',
          'evening'
        ]::text[]
      );
  end if;
end;
$$;

create or replace function public.process_task_completion_atomic(
  p_user_id text,
  p_task_id text,
  p_partial boolean,
  p_day_start timestamptz,
  p_day_key text,
  p_time_window text,
  p_now timestamptz,
  p_bonus_percent numeric default 0
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
  v_existing_completion public.task_completions;
  v_streak public.streaks;
  v_completion_window_start timestamptz;
  v_completion_window_end timestamptz;
  v_achievement_categories text[];
  v_streak_before integer;
  v_last_completed_before timestamptz;
  v_gap integer;
  v_streak_current integer;
  v_streak_longest integer;
  v_base_points integer;
  v_bonus_pct numeric;
  v_points integer;
  v_old_level integer;
  v_new_total integer;
  v_new_balance integer;
  v_new_level integer;
  v_max_streak integer;
  v_longest_streak integer;
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

  if not public.task_is_due_today(
    v_task.days_of_week,
    v_task.recurrence,
    v_task.time_window,
    p_day_key,
    p_time_window
  ) then
    raise exception 'Task % is not due in the current window', p_task_id;
  end if;

  v_completion_window_start := public.task_completion_window_start(p_day_start, v_task.time_window, p_time_window);
  v_completion_window_end := public.task_completion_window_end(p_day_start, v_task.time_window, p_time_window);
  v_achievement_categories := public.task_achievement_categories(v_task.title, v_task.icon, v_task.time_window);

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, p_now)
  on conflict (user_id) do nothing;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  select * into v_existing_completion
  from public.task_completions
  where user_id = p_user_id
    and task_id = p_task_id
    and completed_at >= v_completion_window_start
    and completed_at < v_completion_window_end
  order by completed_at desc
  limit 1
  for update;

  if found then
    select * into v_streak
    from public.streaks
    where user_id = p_user_id and task_id = p_task_id
    order by last_completed_at desc nulls last
    limit 1;

    select coalesce(max(current), 0), coalesce(max(longest), 0)
      into v_max_streak, v_longest_streak
    from public.streaks
    where user_id = p_user_id;

    return jsonb_build_object(
      'pointsAwarded', 0,
      'level', jsonb_build_object(
        'userId', p_user_id,
        'currentLevel', coalesce(v_level.current_level, 1),
        'totalPoints', coalesce(v_level.total_points, 0),
        'spendableBalance', coalesce(v_level.spendable_balance, 0),
        'updatedAt', coalesce(v_level.updated_at, p_now)
      ),
      'maxStreak', v_max_streak,
      'longestStreak', v_longest_streak,
      'streakCurrent', coalesce(v_streak.current, v_task.streak_count, 0),
      'streakLongest', coalesce(v_streak.longest, v_task.streak_count, 0),
      'taskLastCompletedAt', v_task.last_completed_at
    );
  end if;

  v_streak_before := coalesce(v_task.streak_count, 0);
  v_last_completed_before := v_task.last_completed_at;

  v_gap := case
    when v_last_completed_before is null then 999
    when v_last_completed_before >= p_day_start then 0
    when v_last_completed_before >= p_day_start - interval '1 day' then 1
    else 999
  end;

  v_streak_current := case
    when v_gap = 0 then greatest(v_streak_before, 1)
    when v_gap = 1 then v_streak_before + 1
    else 1
  end;

  v_base_points := case
    when p_partial then ceil(v_task.base_points * 0.5)::integer
    else v_task.base_points
  end;

  v_bonus_pct := greatest(0::numeric, least(50::numeric, coalesce(p_bonus_percent, 0)));
  v_points := ceil(v_base_points * (1 + v_bonus_pct / 100.0))::integer;
  v_points := public.apply_streak_bonus(v_points, v_streak_current);

  v_old_level := coalesce(v_level.current_level, 1);
  v_new_total := coalesce(v_level.total_points, 0) + v_points;
  v_new_balance := coalesce(v_level.spendable_balance, 0) + v_points;
  v_new_level := public.level_for_points(v_new_total);

  select * into v_streak
  from public.streaks
  where user_id = p_user_id and task_id = p_task_id
  order by last_completed_at desc nulls last
  limit 1
  for update;

  v_streak_longest := greatest(coalesce(v_streak.longest, 0), v_streak_current);

  insert into public.task_completions (
    id, user_id, task_id, completed_at, points_awarded,
    streak_before, last_completed_before, partial, forgiveness_used,
    achievement_categories
  )
  values (
    gen_random_uuid()::text, p_user_id, p_task_id, p_now, v_points,
    v_streak_before, v_last_completed_before, p_partial, false,
    v_achievement_categories
  );

  update public.tasks
  set streak_count = v_streak_current,
      last_completed_at = p_now
  where id = p_task_id;

  if v_streak.id is null then
    insert into public.streaks (id, user_id, task_id, current, longest, last_completed_at)
    values (gen_random_uuid()::text, p_user_id, p_task_id, v_streak_current, v_streak_longest, p_now);
  else
    update public.streaks
    set current = v_streak_current,
        longest = v_streak_longest,
        last_completed_at = p_now
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
    'pointsAwarded', v_points,
    'level', jsonb_build_object(
      'userId', p_user_id,
      'currentLevel', v_new_level,
      'totalPoints', v_new_total,
      'spendableBalance', v_new_balance,
      'updatedAt', p_now
    ),
    'leveledUp', v_new_level > v_old_level,
    'maxStreak', v_max_streak,
    'longestStreak', v_longest_streak,
    'streakCurrent', v_streak_current,
    'streakLongest', v_streak_longest,
    'taskLastCompletedAt', p_now
  );
end;
$$;

grant execute on function public.process_task_completion_atomic(
  text, text, boolean, timestamptz, text, text, timestamptz, numeric
) to authenticated;

notify pgrst, 'reload schema';
