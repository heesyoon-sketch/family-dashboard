-- Migration 109: automatic weekend/holiday sale days also relax child locks.
--
-- On an active automatic sale day, child profiles use the normal logical
-- windows: morning tasks remain actionable until the 12:00 switch and
-- afternoon/evening tasks remain actionable until midnight. The 09:00 and
-- 21:00 school-day deadlines still apply on non-sale days.

create or replace function public.routine_automatic_sale_context_at(
  p_family_id uuid,
  p_at timestamptz
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_config jsonb;
  v_timezone text;
  v_local timestamp;
  v_date text;
  v_weekend boolean := false;
  v_holiday boolean := false;
  v_percentage integer := 0;
  v_reason text := null;
begin
  begin
    select value::jsonb into v_config
    from public.family_settings
    where family_id = p_family_id
      and key = 'automatic_reward_sale'
    limit 1;
  exception when others then
    v_config := null;
  end;

  if v_config is null or jsonb_typeof(v_config) <> 'object' then
    return jsonb_build_object('active', false, 'reason', null, 'localDate', null);
  end if;

  v_timezone := coalesce(nullif(v_config->>'timezone', ''), 'UTC');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    v_timezone := 'UTC';
  end if;

  -- Completion and undo RPCs support queued offline actions, so their recorded
  -- action time is authoritative for this routine-only exemption.
  v_local := timezone(v_timezone, coalesce(p_at, statement_timestamp()));
  v_date := to_char(v_local, 'YYYY-MM-DD');
  v_percentage := least(100, greatest(0, coalesce((v_config->>'percentage')::integer, 0)));
  v_weekend := coalesce((v_config->>'weekendEnabled')::boolean, false)
    and extract(isodow from v_local) in (6, 7);
  v_holiday := coalesce((v_config->>'holidayEnabled')::boolean, false)
    and coalesce(v_config->'holidayDates', '[]'::jsonb) ? v_date;

  v_reason := case
    when v_weekend and v_holiday then 'weekend_holiday'
    when v_holiday then 'holiday'
    when v_weekend then 'weekend'
    else null
  end;

  return jsonb_build_object(
    'active', v_reason is not null and v_percentage > 0,
    'reason', v_reason,
    'localDate', v_date
  );
exception when others then
  return jsonb_build_object('active', false, 'reason', null, 'localDate', null);
end;
$$;

revoke all on function public.routine_automatic_sale_context_at(uuid, timestamptz)
  from public, anon, authenticated;

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
  v_role text;
  v_expected_window text;
  v_sale_context jsonb;
  v_sale_day boolean := false;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_now is null or p_time_window not in ('morning', 'evening') then
    raise exception 'Invalid routine time';
  end if;
  if p_now < p_day_start or p_now >= p_day_start + interval '1 day' then
    raise exception 'Task action must belong to the current routine day';
  end if;

  select u.role into v_role
  from public.tasks t
  join public.users u on u.id = t.user_id
  where t.id = p_task_id
    and t.user_id = p_user_id
    and u.family_id = v_family_id
    and u.deleted_at is null
    and t.deleted_at is null;

  if not found then raise exception 'Task % not found', p_task_id; end if;

  v_expected_window := case
    when p_now < p_day_start + interval '12 hours' then 'morning'
    else 'evening'
  end;
  if p_time_window <> v_expected_window then
    raise exception 'Task is not available in this routine window';
  end if;

  if v_role = 'CHILD' then
    v_sale_context := public.routine_automatic_sale_context_at(v_family_id, p_now);
    v_sale_day := coalesce((v_sale_context->>'active')::boolean, false);
  end if;

  if v_role = 'CHILD' and not v_sale_day and (
    (p_time_window = 'morning' and p_now >= p_day_start + interval '9 hours')
    or (p_time_window = 'evening' and p_now >= p_day_start + interval '21 hours')
  ) then
    raise exception '아이 루틴 마감 시간이 지났어요';
  end if;

  return public.process_task_completion_atomic_before_routine_deadlines(
    p_user_id, p_task_id, p_partial, p_day_start, p_day_key,
    p_time_window, p_now, p_bonus_percent
  );
end;
$$;

revoke all on function public.process_task_completion_atomic(
  text, text, boolean, timestamptz, text, text, timestamptz, numeric
) from public, anon;
grant execute on function public.process_task_completion_atomic(
  text, text, boolean, timestamptz, text, text, timestamptz, numeric
) to authenticated;

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
  v_role text;
  v_expected_window text;
  v_sale_context jsonb;
  v_sale_day boolean := false;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_now is null or p_time_window not in ('morning', 'evening') then
    raise exception 'Invalid routine time';
  end if;
  if p_now < p_day_start or p_now >= p_day_start + interval '1 day' then
    raise exception 'Task action must belong to the current routine day';
  end if;

  select u.role into v_role
  from public.tasks t
  join public.users u on u.id = t.user_id
  where t.id = p_task_id
    and t.user_id = p_user_id
    and u.family_id = v_family_id
    and u.deleted_at is null
    and t.deleted_at is null;

  if not found then raise exception 'Task % not found', p_task_id; end if;

  v_expected_window := case
    when p_now < p_day_start + interval '12 hours' then 'morning'
    else 'evening'
  end;
  if p_time_window <> v_expected_window then
    raise exception 'Task is not available in this routine window';
  end if;

  if v_role = 'CHILD' then
    v_sale_context := public.routine_automatic_sale_context_at(v_family_id, p_now);
    v_sale_day := coalesce((v_sale_context->>'active')::boolean, false);
  end if;

  if v_role = 'CHILD' and not v_sale_day and (
    (p_time_window = 'morning' and p_now >= p_day_start + interval '9 hours')
    or (p_time_window = 'evening' and p_now >= p_day_start + interval '21 hours')
  ) then
    raise exception '아이 루틴 마감 시간이 지났어요';
  end if;

  return public.process_task_undo_atomic_before_routine_deadlines(
    p_user_id, p_task_id, p_day_start, p_day_key, p_time_window, p_now
  );
end;
$$;

revoke all on function public.process_task_undo_atomic(
  text, text, timestamptz, text, text, timestamptz
) from public, anon;
grant execute on function public.process_task_undo_atomic(
  text, text, timestamptz, text, text, timestamptz
) to authenticated;

notify pgrst, 'reload schema';
