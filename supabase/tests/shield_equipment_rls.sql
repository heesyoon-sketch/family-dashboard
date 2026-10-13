-- Shield Wall 4.0 integrity. Transactional: everything is rolled back.
begin;
do $$
declare
  a record; b record; v jsonb; n int; v_eval jsonb;
  v_task text := 'shield-test-' || gen_random_uuid()::text;
  v_tz text; v_day_start timestamptz; v_now timestamptz; v_prev_month date; v_month date;
  v_cons uuid; v_ded uuid; v_team uuid; v_growth uuid;
  lvl0 public.levels; lvl1 public.levels; p0 int; p int; bonus int;
begin
  select u.family_id, u.auth_user_id, u.id as user_id into a from public.users u where u.deleted_at is null and u.auth_user_id is not null order by u.family_id, u.id limit 1;
  select u.family_id, u.auth_user_id, u.id as user_id into b from public.users u where u.deleted_at is null and u.auth_user_id is not null and u.family_id <> a.family_id order by u.family_id, u.id limit 1;
  if a.family_id is null or b.family_id is null then raise exception 'Need two auth-linked families'; end if;
  perform set_config('request.jwt.claim.sub', a.auth_user_id::text, true);

  v_tz := public.shield_family_timezone(a.family_id);
  v_day_start := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
  v_now := v_day_start + interval '13 hours';
  v_month := public.shield_current_month(a.family_id);
  v_prev_month := (v_month - interval '1 month')::date;

  insert into public.tasks (id, user_id, family_id, title, icon, difficulty, base_points, recurrence, time_window, days_of_week)
  select v_task, a.user_id, a.family_id, '책 읽기 테스트', 'book', t.difficulty, 15, 'daily', 'both', array['MON','TUE','WED','THU','FRI','SAT','SUN']
  from public.tasks t limit 1;
  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at) values (a.user_id, 1, 0, 0, now()) on conflict (user_id) do nothing;

  -- 1. Baseline with the feature off: the completion RPC behaves exactly as before.
  update public.shield_config set mode = 'off';
  select * into lvl0 from public.levels where user_id = a.user_id;
  v := public.process_task_completion_atomic(a.user_id, v_task, false, v_day_start, upper(to_char(v_day_start at time zone v_tz, 'DY')), 'evening', v_now, 0);
  p0 := (v ->> 'pointsAwarded')::int;
  if p0 <= 0 or v ? 'shieldBonus' then raise exception 'Baseline completion changed: %', v; end if;
  v := public.process_task_undo_atomic(a.user_id, v_task, v_day_start, upper(to_char(v_day_start at time zone v_tz, 'DY')), 'evening', v_now);
  select * into lvl1 from public.levels where user_id = a.user_id;
  if lvl1.spendable_balance <> lvl0.spendable_balance or lvl1.total_points <> lvl0.total_points then raise exception 'Baseline undo did not restore points'; end if;

  -- 2. Monthly finalization: idempotent, ended months only, family-checked.
  v_eval := jsonb_build_object('family_id', a.family_id, 'user_id', a.user_id, 'evaluation_month', v_prev_month,
    'candidate_results', '[]'::jsonb, 'evaluation_status', 'awarded', 'eligibility_summary', '{}'::jsonb,
    'evaluation_version', 'test', 'config_version', 'equip-v1',
    'awards', jsonb_build_array(
      jsonb_build_object('shield_type', 'consistency', 'tier', 'gold', 'category', null, 'scope', '{"kind":"all"}'::jsonb, 'bonus_rate_bp', 500, 'qualification_metrics', '{}'::jsonb),
      jsonb_build_object('shield_type', 'dedication', 'tier', 'legendary', 'category', 'learning', 'scope', '{"kind":"categories","categories":["learning"]}'::jsonb, 'bonus_rate_bp', 1500, 'qualification_metrics', '{}'::jsonb),
      jsonb_build_object('shield_type', 'teamwork', 'tier', 'legendary', 'category', null, 'scope', '{"kind":"mission"}'::jsonb, 'bonus_rate_bp', 1500, 'qualification_metrics', '{}'::jsonb),
      jsonb_build_object('shield_type', 'growth', 'tier', 'legendary', 'category', null, 'scope', '{"kind":"all"}'::jsonb, 'bonus_rate_bp', 1500, 'qualification_metrics', '{}'::jsonb)));
  v := public.finalize_shield_month(v_eval);
  if (v ->> 'awards')::int <> 4 then raise exception 'finalize_shield_month failed: %', v; end if;
  v := public.finalize_shield_month(v_eval);
  if (v ->> 'created')::boolean then raise exception 'Second finalization created rows'; end if;
  begin
    perform public.finalize_shield_month(v_eval || jsonb_build_object('evaluation_month', v_month));
    raise exception 'Unfinished month finalized';
  exception when raise_exception then if sqlerrm = 'Unfinished month finalized' then raise; end if; end;
  begin
    perform public.finalize_shield_month(v_eval || jsonb_build_object('family_id', b.family_id));
    raise exception 'Cross-family finalize allowed';
  exception when raise_exception then if sqlerrm = 'Cross-family finalize allowed' then raise; end if; end;
  select id into v_cons from public.shield_monthly_awards where user_id = a.user_id and evaluation_month = v_prev_month and shield_type = 'consistency';
  select id into v_ded from public.shield_monthly_awards where user_id = a.user_id and evaluation_month = v_prev_month and shield_type = 'dedication';
  select id into v_team from public.shield_monthly_awards where user_id = a.user_id and evaluation_month = v_prev_month and shield_type = 'teamwork';
  select id into v_growth from public.shield_monthly_awards where user_id = a.user_id and evaluation_month = v_prev_month and shield_type = 'growth';
  begin
    update public.shield_monthly_awards set bonus_rate_bp = 3000 where id = v_cons;
    raise exception 'Award update allowed';
  exception when raise_exception then if sqlerrm = 'Award update allowed' then raise; end if; end;

  -- 3. Loadout validation.
  begin
    perform public.shield_set_loadout(a.user_id, array[v_cons, v_ded, v_team, v_growth]);
    raise exception 'Four shields equipped';
  exception when raise_exception then if sqlerrm = 'Four shields equipped' then raise; end if; end;
  begin
    perform public.shield_set_loadout(a.user_id, array[v_cons, v_cons]);
    raise exception 'Duplicate shield equipped';
  exception when raise_exception then if sqlerrm = 'Duplicate shield equipped' then raise; end if; end;
  begin
    perform public.shield_set_loadout(a.user_id, array[gen_random_uuid()]);
    raise exception 'Unknown shield equipped';
  exception when raise_exception then if sqlerrm = 'Unknown shield equipped' then raise; end if; end;
  -- Default loadout applies once; a later manual choice is never overridden.
  if not public.shield_auto_equip(a.user_id, array[v_cons, v_ded]) then raise exception 'Auto-equip did not apply'; end if;
  if public.shield_auto_equip(a.user_id, array[v_team]) then raise exception 'Auto-equip applied twice'; end if;
  perform public.shield_set_loadout(a.user_id, array[v_cons, v_ded, v_team]);
  select count(*) into n from public.shield_equipment where user_id = a.user_id and equipment_month = v_month and unequipped_at is null;
  if n <> 3 then raise exception 'Expected 3 equipped, got %', n; end if;
  -- Unchanged shields keep their slot row (no churn).
  select count(*) into n from public.shield_equipment where user_id = a.user_id and equipment_month = v_month;
  if n <> 3 then raise exception 'Loadout churned rows: %', n; end if;

  -- 4. Simulation: ledger only, points unchanged.
  update public.shield_config set mode = 'simulate';
  select * into lvl0 from public.levels where user_id = a.user_id;
  v := public.process_task_completion_atomic(a.user_id, v_task, false, v_day_start, upper(to_char(v_day_start at time zone v_tz, 'DY')), 'evening', v_now, 0);
  p := (v ->> 'pointsAwarded')::int;
  if p <> p0 then raise exception 'pointsAwarded changed in simulation: % vs %', p, p0; end if;
  bonus := (v -> 'shieldBonus' ->> 'simulatedBonusPoints')::int;
  -- consistency 5% (all) + dedication 15% (learning) = 20%; teamwork does not apply (not a mission task).
  if bonus <> (15 * 2000) / 10000 or (v -> 'shieldBonus' ->> 'bonusPoints')::int <> 0 then raise exception 'Simulated bonus wrong: %', v -> 'shieldBonus'; end if;
  select * into lvl1 from public.levels where user_id = a.user_id;
  if lvl1.spendable_balance - lvl0.spendable_balance <> p0 or lvl1.total_points - lvl0.total_points <> p0 then raise exception 'Simulation changed balances'; end if;
  select count(*) into n from public.shield_bonus_ledger where user_id = a.user_id and task_id = v_task and entry_type = 'award' and mode = 'simulate';
  if n <> 1 then raise exception 'Simulation ledger missing'; end if;
  -- Duplicate completion in the same window: no second award.
  v := public.process_task_completion_atomic(a.user_id, v_task, false, v_day_start, upper(to_char(v_day_start at time zone v_tz, 'DY')), 'evening', v_now + interval '1 minute', 0);
  if (v ->> 'pointsAwarded')::int <> 0 then raise exception 'Duplicate completion awarded points'; end if;
  select count(*) into n from public.shield_bonus_ledger where user_id = a.user_id and task_id = v_task;
  if n <> 1 then raise exception 'Duplicate completion wrote ledger'; end if;
  v := public.process_task_undo_atomic(a.user_id, v_task, v_day_start, upper(to_char(v_day_start at time zone v_tz, 'DY')), 'evening', v_now);
  select count(*) into n from public.shield_bonus_ledger where user_id = a.user_id and task_id = v_task and entry_type = 'reversal';
  if n <> 1 then raise exception 'Simulation reversal missing'; end if;
  select * into lvl1 from public.levels where user_id = a.user_id;
  if lvl1.spendable_balance <> lvl0.spendable_balance or lvl1.total_points <> lvl0.total_points then raise exception 'Simulation undo did not restore'; end if;

  -- 5. Live: bonus credited to spendable points only (not XP), reversed on undo.
  update public.shield_config set mode = 'live';
  perform public.shield_set_loadout(a.user_id, array[v_cons, v_ded, v_growth]); -- 5% + 15% + 15% = 35% → capped at 30%
  select * into lvl0 from public.levels where user_id = a.user_id;
  v := public.process_task_completion_atomic(a.user_id, v_task, false, v_day_start, upper(to_char(v_day_start at time zone v_tz, 'DY')), 'evening', v_now + interval '2 minutes', 0);
  if (v ->> 'pointsAwarded')::int <> p0 then raise exception 'pointsAwarded changed in live mode'; end if;
  bonus := (v -> 'shieldBonus' ->> 'bonusPoints')::int;
  if bonus <> (15 * 3000) / 10000 or (v -> 'shieldBonus' ->> 'rateBp')::int <> 3000 then raise exception 'Cap not applied: %', v -> 'shieldBonus'; end if;
  select * into lvl1 from public.levels where user_id = a.user_id;
  if lvl1.spendable_balance - lvl0.spendable_balance <> p0 + bonus then raise exception 'Live bonus not credited'; end if;
  if lvl1.total_points - lvl0.total_points <> p0 then raise exception 'Live bonus leaked into XP'; end if;
  if (v -> 'level' ->> 'spendableBalance')::int <> lvl1.spendable_balance then raise exception 'Returned level is stale'; end if;
  begin
    update public.shield_bonus_ledger set bonus_points = 99 where user_id = a.user_id and task_id = v_task;
    raise exception 'Ledger update allowed';
  exception when raise_exception then if sqlerrm = 'Ledger update allowed' then raise; end if; end;
  v := public.process_task_undo_atomic(a.user_id, v_task, v_day_start, upper(to_char(v_day_start at time zone v_tz, 'DY')), 'evening', v_now + interval '3 minutes');
  select * into lvl1 from public.levels where user_id = a.user_id;
  if lvl1.spendable_balance <> lvl0.spendable_balance or lvl1.total_points <> lvl0.total_points then raise exception 'Live undo did not restore: % %', lvl1.spendable_balance, lvl0.spendable_balance; end if;
  if (v -> 'level' ->> 'spendableBalance')::int <> lvl1.spendable_balance then raise exception 'Undo returned stale level'; end if;

  -- 6. Unequipped shields stop applying immediately.
  perform public.shield_set_loadout(a.user_id, array[]::uuid[]);
  v := public.process_task_completion_atomic(a.user_id, v_task, false, v_day_start, upper(to_char(v_day_start at time zone v_tz, 'DY')), 'evening', v_now + interval '4 minutes', 0);
  if v ? 'shieldBonus' then raise exception 'Bonus without equipment: %', v -> 'shieldBonus'; end if;

  perform set_config('eq_test.family_a', a.family_id::text, true);
  perform set_config('eq_test.user_a', a.user_id, true);
  perform set_config('eq_test.award', v_cons::text, true);
  perform set_config('request.jwt.claim.sub', b.auth_user_id::text, true);
end $$;

set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.shield_monthly_awards where family_id = current_setting('eq_test.family_a')::uuid;
  if n <> 0 then raise exception 'Cross-family award read'; end if;
  select count(*) into n from public.shield_bonus_ledger where family_id = current_setting('eq_test.family_a')::uuid;
  if n <> 0 then raise exception 'Cross-family ledger read'; end if;
  begin
    perform public.shield_set_loadout(current_setting('eq_test.user_a'), array[current_setting('eq_test.award')::uuid]);
    raise exception 'Cross-family loadout allowed';
  exception when raise_exception then if sqlerrm = 'Cross-family loadout allowed' then raise; end if; end;
  begin
    insert into public.shield_bonus_ledger (family_id, user_id, task_completion_id, task_id, entry_type, mode, equipment_month, equipment_snapshot, eligible_base_points, applicable_rate_bp, bonus_points, calculation_version)
    values (current_setting('eq_test.family_a')::uuid, 'x', 'x', 'x', 'award', 'live', '2001-01-01', '[]', 10, 100, 1, 'x');
    raise exception 'Client ledger insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.shield_config set mode = 'live';
    raise exception 'Client config update allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_shield_bonus('x', 'x', 'x', 'evening', 10, now());
    raise exception 'Client bonus call allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.finalize_shield_month('{}'::jsonb);
    raise exception 'Client month finalize allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.shield_auto_equip('x', array[]::uuid[]);
    raise exception 'Client auto-equip allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
declare n int;
begin
  delete from public.families where id = current_setting('eq_test.family_a')::uuid;
  select count(*) into n from public.shield_bonus_ledger where family_id = current_setting('eq_test.family_a')::uuid;
  if n <> 0 then raise exception 'Ledger survived family deletion'; end if;
end $$;
select 'PASS: base points unchanged, simulate = ledger only, live credits spendable only, 30% cap, scoped bonuses, once per completion, reversal on undo, loadout rules, immutable records, family isolation, no client writes, deletion cascades' as result;
rollback;
