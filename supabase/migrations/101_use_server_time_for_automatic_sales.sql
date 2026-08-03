-- Migration 101: Automatic sale eligibility must use the database clock.
-- redeem_reward_atomic accepts a client timestamp for legacy activity timing,
-- but that timestamp must never control whether a checkout receives a sale.

create or replace function public.automatic_reward_sale_context(
  p_family_id uuid,
  p_at timestamptz default now()
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
    return jsonb_build_object('active', false, 'percentage', 0, 'reason', null, 'localDate', null);
  end if;

  v_timezone := coalesce(nullif(v_config->>'timezone', ''), 'UTC');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    v_timezone := 'UTC';
  end if;

  -- Deliberately ignore p_at. It remains in the signature for compatibility
  -- with callers deployed in migration 100.
  v_local := timezone(v_timezone, statement_timestamp());
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
    'percentage', case when v_reason is null then 0 else v_percentage end,
    'reason', v_reason,
    'localDate', v_date
  );
exception when others then
  return jsonb_build_object('active', false, 'percentage', 0, 'reason', null, 'localDate', null);
end;
$$;

revoke all on function public.automatic_reward_sale_context(uuid, timestamptz) from public, anon, authenticated;
