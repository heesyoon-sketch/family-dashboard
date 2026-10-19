-- Let each family choose how many spendable points a missed routine deadline
-- costs. family_settings 'routine_penalty' becomes
-- {"enabled": bool, "points": int (1-1000), "enabledAt": timestamptz}.
-- Missing/invalid points fall back to the original 50. "enabledAt" records
-- when the switch was last turned on, so editing only the points no longer
-- moves the no-retroactive-deduction cutoff (rows without it keep using
-- updated_at).

create or replace function public.routine_penalty_points(p_family_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_value text;
  v_points integer;
begin
  select value into v_value
  from public.family_settings
  where family_id = p_family_id
    and key = 'routine_penalty'
  limit 1;

  v_points := (v_value::jsonb->>'points')::integer;
  if v_points is null or v_points < 1 or v_points > 1000 then return 50; end if;
  return v_points;
exception when others then
  return 50;
end;
$$;

revoke all on function public.routine_penalty_points(uuid) from public, anon, authenticated;

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
  v_enabled_at timestamptz;
begin
  select value, updated_at into v_value, v_updated_at
  from public.family_settings
  where family_id = p_family_id
    and key = 'routine_penalty'
  limit 1;

  if v_value is null then return true; end if;
  if not coalesce((v_value::jsonb->>'enabled')::boolean, true) then return false; end if;
  begin
    v_enabled_at := (v_value::jsonb->>'enabledAt')::timestamptz;
  exception when others then
    v_enabled_at := null;
  end;
  v_enabled_at := coalesce(v_enabled_at, v_updated_at);
  return v_enabled_at is null or p_deadline is null or v_enabled_at <= p_deadline;
exception when others then
  return true;
end;
$$;

drop function if exists public.admin_set_routine_penalty(boolean);

create or replace function public.admin_set_routine_penalty(p_enabled boolean, p_points integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_old jsonb;
  v_old_updated_at timestamptz;
  v_old_enabled boolean;
  v_enabled boolean := coalesce(p_enabled, true);
  v_points integer;
  v_enabled_at text;
  v_next jsonb;
begin
  if p_points is not null and (p_points < 1 or p_points > 1000) then
    raise exception 'Penalty points must be between 1 and 1000';
  end if;

  select value::jsonb, updated_at into v_old, v_old_updated_at
  from public.family_settings
  where family_id = v_family_id and key = 'routine_penalty'
  for update;

  v_old_enabled := coalesce((v_old->>'enabled')::boolean, true);
  v_points := coalesce(p_points, public.routine_penalty_points(v_family_id));
  v_enabled_at := case
    when v_enabled and (v_old is null or not v_old_enabled) then now()::text
    else coalesce(v_old->>'enabledAt', v_old_updated_at::text)
  end;

  v_next := jsonb_build_object('enabled', v_enabled, 'points', v_points);
  if v_enabled_at is not null then
    v_next := v_next || jsonb_build_object('enabledAt', v_enabled_at);
  end if;

  insert into public.family_settings (key, value, updated_at, family_id)
  values ('routine_penalty', v_next::text, now(), v_family_id)
  on conflict (key, family_id) do update
    set value = excluded.value,
        updated_at = excluded.updated_at;

  return v_next;
end;
$$;

revoke all on function public.admin_set_routine_penalty(boolean, integer) from public, anon;
grant execute on function public.admin_set_routine_penalty(boolean, integer) to authenticated;

-- Deduct the family's configured points instead of the hard-coded 50.
do $$
declare
  v_fn text;
  v_def text;
begin
  foreach v_fn in array array[
    'public.apply_morning_routine_penalties_before_sale_exemption(timestamptz, text, date)',
    'public.apply_evening_routine_penalties_before_sale_exemption(timestamptz, text, date)'
  ] loop
    select pg_get_functiondef(v_fn::regprocedure) into v_def;
    if position('p_day_start, 50, 0, v_now' in v_def) = 0
      or position('least(50, v_balance)' in v_def) = 0
      or position('v_penalties jsonb := ''[]''::jsonb;' in v_def) = 0
    then
      raise exception '% not in expected shape', v_fn;
    end if;
    v_def := replace(v_def, 'v_penalties jsonb := ''[]''::jsonb;',
      'v_penalties jsonb := ''[]''::jsonb;' || chr(10) || '  v_points integer := public.routine_penalty_points(v_family_id);');
    v_def := replace(v_def, 'p_day_start, 50, 0, v_now', 'p_day_start, v_points, 0, v_now');
    v_def := replace(v_def, 'least(50, v_balance)', 'least(v_points, v_balance)');
    execute v_def;
  end loop;
end $$;

notify pgrst, 'reload schema';
