-- Fix: undoing a completion whose Shield bonus rounded down to 0 failed.
--
-- apply_shield_bonus recorded 0-point awards (e.g. 2% of 10 points), and
-- reverse_shield_bonus then tried to write a 0-point reversal, which the
-- ledger's sign check rejects — so the whole undo was rolled back. Now a
-- 0-point bonus writes no ledger row, and reversing an existing 0-point award
-- is a no-op (the award row is an immutable record and simply stays).

create or replace function public.reverse_shield_bonus(p_completion_id text, p_user_id text, p_points_awarded integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.shield_bonus_ledger;
  v_level public.levels;
  v_total integer;
begin
  select * into v_entry from public.shield_bonus_ledger
  where task_completion_id = p_completion_id and entry_type = 'award' and user_id = p_user_id;
  if not found then return 0; end if;
  -- Nothing was paid, so there is nothing to take back.
  if v_entry.bonus_points <= 0 then return 0; end if;
  if exists (select 1 from public.shield_bonus_ledger where task_completion_id = p_completion_id and entry_type = 'reversal') then return 0; end if;

  if v_entry.mode = 'live' then
    select * into v_level from public.levels where user_id = p_user_id for update;
    if coalesce(v_level.spendable_balance, 0) < v_entry.bonus_points + greatest(coalesce(p_points_awarded, 0), 0) then
      raise exception '이미 사용한 포인트라 완료를 취소할 수 없어요';
    end if;
    v_total := greatest(v_level.total_points - case when v_entry.counted_toward_xp then v_entry.bonus_points else 0 end, 0);
    update public.levels
    set spendable_balance = spendable_balance - v_entry.bonus_points,
        total_points = v_total,
        current_level = case when v_entry.counted_toward_xp then public.level_for_points(v_total) else current_level end,
        updated_at = statement_timestamp()
    where user_id = p_user_id;
  end if;

  insert into public.shield_bonus_ledger (family_id, user_id, task_completion_id, task_id, entry_type, mode, equipment_month, equipment_snapshot, eligible_base_points, applicable_rate_bp, bonus_points, counted_toward_xp, calculation_version, reverses_entry_id)
  values (v_entry.family_id, v_entry.user_id, v_entry.task_completion_id, v_entry.task_id, 'reversal', v_entry.mode, v_entry.equipment_month, v_entry.equipment_snapshot, v_entry.eligible_base_points, v_entry.applicable_rate_bp, -v_entry.bonus_points, v_entry.counted_toward_xp, v_entry.calculation_version, v_entry.id);
  return case when v_entry.mode = 'live' then v_entry.bonus_points else 0 end;
end;
$$;
revoke all on function public.reverse_shield_bonus(text, text, integer) from public, anon, authenticated;

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
  if coalesce((v_quote ->> 'rateBp')::integer, 0) = 0 then return null; end if;
  select family_id into v_family from public.users where id = p_user_id;
  if abs(extract(epoch from (v_server_now - p_completed_at))) > (v_quote ->> 'maxClockSkewHours')::integer * 3600
     or public.shield_current_week(v_family, p_completed_at) <> (v_quote ->> 'month')::date then
    return jsonb_build_object('bonusPoints', 0, 'reason', 'time_mismatch');
  end if;

  v_bonus := (v_quote ->> 'bonusPoints')::integer;
  -- A bonus that rounds down to 0 writes nothing (and so has nothing to undo).
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
  return jsonb_build_object('bonusPoints', case when v_quote ->> 'mode' = 'live' then v_bonus else 0 end, 'simulatedBonusPoints', v_bonus, 'rateBp', (v_quote ->> 'rateBp')::integer, 'mode', v_quote ->> 'mode', 'ledgerId', v_entry);
end;
$function$;
revoke all on function public.apply_shield_bonus(text, text, text, text, integer, timestamptz) from public, anon, authenticated;
