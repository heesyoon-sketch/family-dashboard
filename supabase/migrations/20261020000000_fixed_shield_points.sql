-- Fixed bonuses replace percentages for new completions, including already equipped shields.
-- Legacy rates remain as historical metadata; fixed ledger entries use rate 0.
-- Past credits and their exact undo amounts are preserved.
update public.shield_config
set version = 'weekly-v4-fixed',
    rules = jsonb_set(rules, '{pointsByTier}', '{"bronze":0,"silver":1,"gold":2,"epic":3,"legendary":4}'::jsonb)
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
    v_points := case when v_applies and p_base_points > 0
      then coalesce((v_cfg.rules #>> array['pointsByTier', v_row.tier])::integer, 0)
      else 0 end;
    if v_points > v_bonus then
      v_bonus := v_points;
      v_tier := v_row.tier;
    end if;
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object('equipmentId', v_row.equipment_id, 'awardId', v_row.award_id, 'type', v_row.shield_type, 'tier', v_row.tier, 'fixedPoints', v_points, 'scope', v_row.scope, 'applies', v_applies));
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

CREATE OR REPLACE FUNCTION public.apply_shield_bonus(p_completion_id text, p_user_id text, p_task_id text, p_current_window text, p_base_points integer, p_completed_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_server_now timestamptz := statement_timestamp();
  v_quote jsonb;
  v_family uuid;
  v_bonus integer;
  v_entry uuid;
  v_xp boolean;
  v_level public.levels;
  v_new_total integer;
begin
  v_quote := public.shield_bonus_quote(p_user_id, p_task_id, p_current_window, p_base_points, v_server_now);
  if v_quote is null then return null; end if;
  -- Bronze shields (and shields for another area) pay nothing: no ledger row.
  if coalesce((v_quote ->> 'bonusPoints')::integer, 0) <= 0 then return null; end if;
  select family_id into v_family from public.users where id = p_user_id;
  if abs(extract(epoch from (v_server_now - p_completed_at))) > (v_quote ->> 'maxClockSkewHours')::integer * 3600
     or public.shield_current_week(v_family, p_completed_at) <> (v_quote ->> 'month')::date then
    return jsonb_build_object('bonusPoints', 0, 'reason', 'time_mismatch');
  end if;

  v_bonus := (v_quote ->> 'bonusPoints')::integer;
  -- Zero-point completions write nothing (and have nothing to undo).
  if v_bonus <= 0 then return null; end if;
  v_xp := (v_quote ->> 'countsTowardXp')::boolean;

  insert into public.shield_bonus_ledger (family_id, user_id, task_completion_id, task_id, entry_type, mode, equipment_month, equipment_snapshot, eligible_base_points, applicable_rate_bp, bonus_points, counted_toward_xp, calculation_version)
  values (v_family, p_user_id, p_completion_id, p_task_id, 'award', v_quote ->> 'mode', (v_quote ->> 'month')::date, v_quote -> 'snapshot', (v_quote ->> 'basePoints')::integer, (v_quote ->> 'rateBp')::integer, v_bonus, v_xp and v_quote ->> 'mode' = 'live', v_quote ->> 'version')
  on conflict (task_completion_id, entry_type) do nothing
  returning id into v_entry;
  if v_entry is null then return jsonb_build_object('bonusPoints', 0, 'reason', 'duplicate'); end if;

  if v_quote ->> 'mode' = 'live' and v_bonus > 0 then
    select * into v_level from public.levels where user_id = p_user_id for update;
    v_new_total := v_level.total_points + case when v_xp then v_bonus else 0 end;
    update public.levels
    set spendable_balance = spendable_balance + v_bonus,
        total_points = v_new_total,
        current_level = case when v_xp then public.level_for_points(v_new_total) else current_level end,
        updated_at = v_server_now
    where user_id = p_user_id;
  end if;
  return jsonb_build_object('bonusPoints', case when v_quote ->> 'mode' = 'live' then v_bonus else 0 end, 'simulatedBonusPoints', v_bonus, 'tier', v_quote ->> 'shieldTier', 'rateBp', (v_quote ->> 'rateBp')::integer, 'mode', v_quote ->> 'mode', 'ledgerId', v_entry);
end;
$function$;
revoke all on function public.apply_shield_bonus(text, text, text, text, integer, timestamptz) from public, anon, authenticated;
