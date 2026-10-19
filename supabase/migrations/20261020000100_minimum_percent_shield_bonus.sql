-- Pay the larger of the tier minimum and ceil(base points × tier percentage).
-- Applies to new completions with existing equipment. Undo keeps using the
-- original immutable credit, so earlier fixed or percentage payouts reverse exactly.
update public.shield_config
set version = 'weekly-v5-minimum-percent', updated_at = now(),
    rules = jsonb_set(rules, '{rateBp}', '{"bronze":0,"silver":200,"gold":500,"epic":1000,"legendary":1500}'::jsonb)
where id = 1;

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
  v_bonus integer := 0;
  v_points integer;
  v_tier text;
  v_rate integer := 0;
  v_row_rate integer;
  v_minimum integer;
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
    v_row_rate := coalesce((v_cfg.rules #>> array['rateBp', v_row.tier])::integer, 0);
    v_minimum := coalesce((v_cfg.rules #>> array['pointsByTier', v_row.tier])::integer, 0);
    v_points := case when v_applies and p_base_points > 0 then greatest(
      v_minimum,
      ((p_base_points::bigint * v_row_rate + 9999) / 10000)::integer
    ) else 0 end;
    if v_points > v_bonus then
      v_bonus := v_points;
      v_tier := v_row.tier;
      v_rate := v_row_rate;
    end if;
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object('equipmentId', v_row.equipment_id, 'awardId', v_row.award_id, 'type', v_row.shield_type, 'tier', v_row.tier, 'minimumPoints', v_minimum, 'rateBp', v_row_rate, 'bonusPoints', v_points, 'scope', v_row.scope, 'applies', v_applies));
  end loop;
  if jsonb_array_length(v_snapshot) = 0 then return null; end if;

  return jsonb_build_object(
    'month', v_week,
    'snapshot', v_snapshot,
    'sumBp', v_rate,
    'rateBp', v_rate,
    'shieldTier', v_tier,
    'basePoints', greatest(p_base_points, 0),
    'bonusPoints', v_bonus,
    'mode', v_cfg.mode,
    'version', v_cfg.version,
    'countsTowardXp', coalesce((v_cfg.rules ->> 'countsTowardXp')::boolean, false),
    'maxClockSkewHours', coalesce((v_cfg.rules ->> 'maxClockSkewHours')::integer, 36)
  );
end;
$function$;
revoke all on function public.shield_bonus_quote(text, text, text, integer, timestamptz) from public, anon, authenticated;

