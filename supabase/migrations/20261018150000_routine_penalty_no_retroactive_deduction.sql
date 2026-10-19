-- Turning the family routine penalty back on must not deduct for a deadline
-- that already passed before the switch was flipped (e.g. enabling it at
-- 15:00 would otherwise immediately charge today's missed noon deadline).
create or replace function public.routine_penalty_enabled(p_family_id uuid, p_deadline timestamptz)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_value text;
  v_updated_at timestamptz;
begin
  select value, updated_at into v_value, v_updated_at
  from public.family_settings
  where family_id = p_family_id
    and key = 'routine_penalty'
  limit 1;

  if v_value is null then return true; end if;
  if not coalesce((v_value::jsonb->>'enabled')::boolean, true) then return false; end if;
  return v_updated_at is null or p_deadline is null or v_updated_at <= p_deadline;
exception when others then
  return true;
end;
$$;

revoke all on function public.routine_penalty_enabled(uuid, timestamptz) from public, anon, authenticated;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.apply_morning_routine_penalties(timestamptz, text, date)'::regprocedure) into v_def;
  if position('public.routine_penalty_enabled(v_family_id)' in v_def) = 0 then
    raise exception 'morning wrapper not in expected shape';
  end if;
  execute replace(v_def, 'public.routine_penalty_enabled(v_family_id)',
    'public.routine_penalty_enabled(v_family_id, p_day_start + interval ''12 hours'')');

  select pg_get_functiondef('public.apply_evening_routine_penalties(timestamptz, text, date)'::regprocedure) into v_def;
  if position('public.routine_penalty_enabled(v_family_id)' in v_def) = 0 then
    raise exception 'evening wrapper not in expected shape';
  end if;
  execute replace(v_def, 'public.routine_penalty_enabled(v_family_id)',
    'public.routine_penalty_enabled(v_family_id, p_day_start + interval ''22 hours'')');
end $$;

drop function if exists public.routine_penalty_enabled(uuid);

notify pgrst, 'reload schema';
