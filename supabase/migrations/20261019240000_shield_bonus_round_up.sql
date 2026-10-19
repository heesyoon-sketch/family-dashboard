-- Shield bonus rounds up instead of down.
--
-- Most habits are 10–15 points, so floor(base × rate) paid nothing for
-- Silver/Gold (10 × 5% = 0.5 → 0) and the Shields felt broken. Rounding up
-- (integer math: (base × rate + 9999) / 10000) gives every boosted
-- completion at least +1, matching how the app rounded bonuses before
-- (080_round_bonus_up). Bronze and non-matching scopes stay at 0.

CREATE OR REPLACE FUNCTION public.shield_bonus_quote(p_user_id text, p_task_id text, p_current_window text, p_base_points integer, p_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_task public.tasks;
  v_cfg public.shield_config;
  v_week date;
  v_sum integer := 0;
  v_rate integer;
  v_snapshot jsonb := '[]'::jsonb;
  v_row record;
  v_applies boolean;
begin
  select * into v_cfg from public.shield_config where id = 1;
  if coalesce(v_cfg.mode, 'off') = 'off' then return null; end if;
  select * into v_task from public.tasks where id = p_task_id and user_id = p_user_id;
  if not found then return null; end if;
  v_week := public.shield_current_week(v_task.family_id, p_at);

  for v_row in
    select e.id as equipment_id, a.id as award_id, a.shield_type, a.tier, a.scope, a.bonus_rate_bp, e.slot_number
    from public.shield_equipment e
    join public.shield_monthly_awards a on a.id = e.award_id
    where e.user_id = p_user_id
      and e.equipment_month = v_week
      and a.equipment_month = v_week
      and e.equipped_at <= p_at
      and (e.unequipped_at is null or e.unequipped_at > p_at)
    order by e.slot_number
  loop
    v_applies := case v_row.scope ->> 'kind'
      when 'window' then v_task.task_type <> 'optional' and v_row.scope ->> 'window' = p_current_window
      when 'bonus' then v_task.task_type = 'optional'
      else false
    end;
    if v_applies then v_sum := v_sum + v_row.bonus_rate_bp; end if;
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object('equipmentId', v_row.equipment_id, 'awardId', v_row.award_id, 'type', v_row.shield_type, 'tier', v_row.tier, 'rateBp', v_row.bonus_rate_bp, 'scope', v_row.scope, 'applies', v_applies));
  end loop;
  if jsonb_array_length(v_snapshot) = 0 then return null; end if;

  v_rate := least(v_sum, coalesce((v_cfg.rules ->> 'capBp')::integer, 1500));
  return jsonb_build_object(
    'month', v_week,
    'snapshot', v_snapshot,
    'sumBp', v_sum,
    'rateBp', v_rate,
    'basePoints', greatest(p_base_points, 0),
    -- Rounded up, so even a 10-point habit feels its Shield (+1). A 0% rate
    -- (Bronze, or another area's Shield) still yields 0.
    'bonusPoints', (greatest(p_base_points, 0) * v_rate + 9999) / 10000,
    'mode', v_cfg.mode,
    'version', v_cfg.version,
    'countsTowardXp', coalesce((v_cfg.rules ->> 'countsTowardXp')::boolean, false),
    'maxClockSkewHours', coalesce((v_cfg.rules ->> 'maxClockSkewHours')::integer, 36)
  );
end;
$function$;
revoke all on function public.shield_bonus_quote(text, text, text, integer, timestamptz) from public, anon, authenticated;
