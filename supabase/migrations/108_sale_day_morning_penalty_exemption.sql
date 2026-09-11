-- Migration 108: automatic weekend/holiday sale days are no-penalty mornings.
-- Child task cards still close at 09:00; only the 50-point deduction is skipped.

alter function public.apply_morning_routine_penalties(
  timestamptz, text, date
) rename to apply_morning_routine_penalties_before_sale_exemption;

revoke all on function public.apply_morning_routine_penalties_before_sale_exemption(
  timestamptz, text, date
) from public, anon, authenticated;

create function public.apply_morning_routine_penalties(
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
  if v_now < p_day_start + interval '9 hours' then
    raise exception 'Morning routine deadline has not passed';
  end if;
  if v_now >= p_day_start + interval '1 day' then
    raise exception 'Morning routine penalty can only be checked on the same local day';
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

notify pgrst, 'reload schema';
