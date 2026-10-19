-- Explicit point table replaces all percentage and minimum calculations.
-- Keep zero rate metadata for the existing award/ledger schema only.
-- Existing awards use the new table; prior credits still reverse their original amount.
update public.shield_config
set version = 'weekly-v6-point-table', updated_at = now(),
    rules = (rules - 'pointsByTier') || '{"pointTable":{"bronze":{"10":0,"15":0,"30":0,"50":0},"silver":{"10":1,"15":1,"30":2,"50":3},"gold":{"10":2,"15":2,"30":3,"50":4},"epic":{"10":3,"15":3,"30":4,"50":6},"legendary":{"10":4,"15":4,"30":6,"50":8}},"rateBp":{"bronze":0,"silver":0,"gold":0,"epic":0,"legendary":0},"capBp":0}'::jsonb
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
  v_bucket text;
  v_snapshot jsonb := '[]'::jsonb;
  v_row record;
  v_applies boolean;
begin
  select * into v_cfg from public.shield_config where id = 1;
  if coalesce(v_cfg.mode, 'off') = 'off' then return null; end if;
  select * into v_task from public.tasks where id = p_task_id and user_id = p_user_id;
  if not found then return null; end if;
  v_week := public.shield_current_week(v_task.family_id, p_at);

  -- Match the existing duration-point normalization for legacy/partial values.
  v_bucket := case when p_base_points <= 10 then '10' when p_base_points <= 15 then '15' when p_base_points <= 30 then '30' else '50' end;

  for v_row in
    select e.id as equipment_id, a.id as award_id, a.shield_type, a.tier, a.scope, e.slot_number
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
    v_points := case when v_applies and p_base_points > 0
      then coalesce((v_cfg.rules #>> array['pointTable', v_row.tier, v_bucket])::integer, 0)
      else 0 end;
    if v_points > v_bonus then
      v_bonus := v_points;
      v_tier := v_row.tier;
    end if;
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object('equipmentId', v_row.equipment_id, 'awardId', v_row.award_id, 'type', v_row.shield_type, 'tier', v_row.tier, 'pointBucket', v_bucket::integer, 'bonusPoints', v_points, 'scope', v_row.scope, 'applies', v_applies));
  end loop;
  if jsonb_array_length(v_snapshot) = 0 then return null; end if;

  return jsonb_build_object(
    'month', v_week,
    'snapshot', v_snapshot,
    'sumBp', 0,
    'rateBp', 0,
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

