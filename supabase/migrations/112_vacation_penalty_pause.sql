-- Migration 112: family-wide "vacation mode" that pauses the morning and
-- evening routine point penalties, independent of the automatic weekend/
-- holiday sale schedule. A parent toggles it from the dashboard header for
-- travel days or other special occasions; while active, missed routines are
-- never deducted. Turning it off resumes normal penalty enforcement.

create or replace function public.penalty_pause_active(p_family_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_value text;
begin
  begin
    select value into v_value
    from public.family_settings
    where family_id = p_family_id
      and key = 'penalty_pause'
    limit 1;
  exception when others then
    return false;
  end;

  if v_value is null then return false; end if;
  return coalesce((v_value::jsonb->>'enabled')::boolean, false);
exception when others then
  return false;
end;
$$;

revoke all on function public.penalty_pause_active(uuid) from public, anon, authenticated;

create or replace function public.admin_set_penalty_pause(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_enabled boolean := coalesce(p_enabled, false);
begin
  insert into public.family_settings (key, value, updated_at, family_id)
  values ('penalty_pause', jsonb_build_object('enabled', v_enabled)::text, now(), v_family_id)
  on conflict (key, family_id) do update
    set value = excluded.value,
        updated_at = excluded.updated_at;

  return jsonb_build_object('enabled', v_enabled);
end;
$$;

revoke all on function public.admin_set_penalty_pause(boolean) from public, anon;
grant execute on function public.admin_set_penalty_pause(boolean) to authenticated;

-- --------------------------------------------------------------------------
-- Wire the pause into both routine penalty RPCs, ahead of the automatic-sale
-- exemption check. Same response shape as the sale exemption so the client
-- doesn't need to special-case it.
-- --------------------------------------------------------------------------

create or replace function public.apply_morning_routine_penalties(
  p_day_start timestamptz,
  p_day_key text,
  p_penalty_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_now timestamptz := statement_timestamp();
  v_expected_day_key text;
  v_sale_context jsonb;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_penalty_date is null then
    raise exception 'Invalid routine day';
  end if;

  v_expected_day_key := case extract(isodow from p_penalty_date)
    when 1 then 'MON' when 2 then 'TUE' when 3 then 'WED'
    when 4 then 'THU' when 5 then 'FRI' when 6 then 'SAT' else 'SUN'
  end;
  if p_day_key is distinct from v_expected_day_key then
    raise exception 'Routine weekday does not match the date';
  end if;
  if abs(p_penalty_date - p_day_start::date) > 1 then
    raise exception 'Routine date does not match its start time';
  end if;
  if v_now < p_day_start + interval '12 hours' then
    raise exception 'Morning routine deadline has not passed';
  end if;
  if v_now >= p_day_start + interval '1 day' then
    raise exception 'Morning routine penalty can only be checked on the same local day';
  end if;

  if public.penalty_pause_active(v_family_id) then
    return jsonb_build_object(
      'checked', true,
      'penaltyDate', p_penalty_date,
      'penalties', '[]'::jsonb,
      'exempt', true,
      'exemptionReason', 'vacation'
    );
  end if;

  -- Use the same server-authoritative sale clock and family timezone as
  -- checkout. A manual item sale does not create an exemption; only an active
  -- configured weekend/public-holiday automatic sale does.
  v_sale_context := public.automatic_reward_sale_context(v_family_id, v_now);
  if coalesce((v_sale_context->>'active')::boolean, false)
    and v_sale_context->>'localDate' = p_penalty_date::text
  then
    return jsonb_build_object(
      'checked', true,
      'penaltyDate', p_penalty_date,
      'penalties', '[]'::jsonb,
      'exempt', true,
      'exemptionReason', v_sale_context->>'reason'
    );
  end if;

  return public.apply_morning_routine_penalties_before_sale_exemption(
    p_day_start, p_day_key, p_penalty_date
  );
end;
$$;

revoke all on function public.apply_morning_routine_penalties(
  timestamptz, text, date
) from public, anon;
grant execute on function public.apply_morning_routine_penalties(
  timestamptz, text, date
) to authenticated;

create or replace function public.apply_evening_routine_penalties(
  p_day_start timestamptz,
  p_day_key text,
  p_penalty_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_now timestamptz := statement_timestamp();
  v_expected_day_key text;
  v_sale_context jsonb;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_penalty_date is null then
    raise exception 'Invalid routine day';
  end if;

  v_expected_day_key := case extract(isodow from p_penalty_date)
    when 1 then 'MON' when 2 then 'TUE' when 3 then 'WED'
    when 4 then 'THU' when 5 then 'FRI' when 6 then 'SAT' else 'SUN'
  end;
  if p_day_key is distinct from v_expected_day_key then
    raise exception 'Routine weekday does not match the date';
  end if;
  if abs(p_penalty_date - p_day_start::date) > 1 then
    raise exception 'Routine date does not match its start time';
  end if;
  if v_now < p_day_start + interval '21 hours' then
    raise exception 'Evening routine deadline has not passed';
  end if;
  if v_now >= p_day_start + interval '1 day' then
    raise exception 'Evening routine penalty can only be checked on the same local day';
  end if;

  if public.penalty_pause_active(v_family_id) then
    return jsonb_build_object(
      'checked', true,
      'penaltyDate', p_penalty_date,
      'penalties', '[]'::jsonb,
      'exempt', true,
      'exemptionReason', 'vacation'
    );
  end if;

  -- Same server-authoritative sale clock and exemption rule as the morning
  -- penalty: an active automatic weekend/holiday sale skips the deduction.
  v_sale_context := public.automatic_reward_sale_context(v_family_id, v_now);
  if coalesce((v_sale_context->>'active')::boolean, false)
    and v_sale_context->>'localDate' = p_penalty_date::text
  then
    return jsonb_build_object(
      'checked', true,
      'penaltyDate', p_penalty_date,
      'penalties', '[]'::jsonb,
      'exempt', true,
      'exemptionReason', v_sale_context->>'reason'
    );
  end if;

  return public.apply_evening_routine_penalties_before_sale_exemption(
    p_day_start, p_day_key, p_penalty_date
  );
end;
$$;

revoke all on function public.apply_evening_routine_penalties(
  timestamptz, text, date
) from public, anon;
grant execute on function public.apply_evening_routine_penalties(
  timestamptz, text, date
) to authenticated;

notify pgrst, 'reload schema';
