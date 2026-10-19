-- Weekly Shields: Morning, Evening and Bonus.
--
-- EARN LAST WEEK. EQUIP THIS WEEK. Every Monday each member is evaluated on
-- the week that just ended (Mon–Sun, family time) and can earn up to three
-- Shields, one of each kind, which are equipped automatically for the new
-- week:
--
--   Morning  required morning-routine slots completed (schedule snapshots)
--   Evening  required afternoon/evening slots completed
--   Bonus    days with a bonus-task completion, only when the required
--            routine was at least 70% done (bonus never replaces required)
--
-- Each Shield boosts only its own area — morning required tasks, evening
-- required tasks, bonus tasks — so scopes never overlap and a completion is
-- boosted by at most one Shield (legendary +15%), down from a 30% cap.
--
-- The evaluation now runs here, server-side, from the same snapshots and
-- completions as before; the browser only mirrors it for progress display.
-- The monthly design produced no awards, equipment or ledger rows yet, so
-- nothing earned is lost. Table and column names keep their monthly names;
-- the *_month date columns now hold the Monday of a week.

do $$
begin
  if exists (select 1 from public.shield_monthly_awards)
     or exists (select 1 from public.shield_equipment)
     or exists (select 1 from public.shield_bonus_ledger) then
    raise exception 'Shield awards already exist; the weekly switch expects the unused monthly tables';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Awards are weekly and of the three new kinds
-- ---------------------------------------------------------------------------
alter table public.shield_monthly_awards
  drop constraint if exists shield_monthly_awards_check,
  drop constraint if exists shield_monthly_awards_check1,
  drop constraint if exists shield_monthly_awards_evaluation_month_check,
  drop constraint if exists shield_monthly_awards_shield_type_check;

alter table public.shield_monthly_awards
  add constraint shield_awards_week_starts_monday check (extract(isodow from evaluation_month) = 1),
  add constraint shield_awards_equip_next_week check (equipment_month = evaluation_month + 7),
  add constraint shield_awards_kind check (shield_type in ('morning', 'evening', 'bonus')),
  add constraint shield_awards_no_category check (category is null);

comment on table public.shield_monthly_awards is 'Weekly Shield awards (Morning / Evening / Bonus). Name kept from the monthly design.';
comment on column public.shield_monthly_awards.evaluation_month is 'Monday of the week the Shield was earned.';
comment on column public.shield_monthly_awards.equipment_month is 'Monday of the week the Shield is equipped (evaluation week + 7 days).';
comment on column public.shield_equipment.equipment_month is 'Monday of the equipment week.';
comment on column public.shield_bonus_ledger.equipment_month is 'Monday of the equipment week.';

-- One source of truth for the rules; lib/shields/weekly.ts mirrors these
-- numbers and a test keeps them equal.
update public.shield_config
set version = 'weekly-v1',
    rules = '{"rateBp":{"silver":200,"gold":500,"epic":1000,"legendary":1500},"capBp":1500,"countsTowardXp":false,"maxClockSkewHours":36,"minCoveredDays":6,"window":{"minSlots":5,"minDays":3,"silver":70,"gold":85,"epic":95,"legendary":100},"bonus":{"silver":3,"gold":4,"epic":5,"legendary":7,"minRequiredRate":70}}'::jsonb,
    updated_at = now()
where id = 1;

-- ---------------------------------------------------------------------------
-- 2. Week helpers
-- ---------------------------------------------------------------------------
create or replace function public.shield_current_week(p_family_id uuid, p_at timestamptz default statement_timestamp())
returns date
language sql
stable
set search_path = public
as $$
  select date_trunc('week', p_at at time zone public.shield_family_timezone(p_family_id))::date;
$$;
grant execute on function public.shield_current_week(uuid, timestamptz) to authenticated, service_role;

-- Highest tier whose threshold the value meets, or null.
create or replace function public.shield_tier_for(p_value numeric, p_thresholds jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_value is null then null
    when p_value >= (p_thresholds ->> 'legendary')::numeric then 'legendary'
    when p_value >= (p_thresholds ->> 'epic')::numeric then 'epic'
    when p_value >= (p_thresholds ->> 'gold')::numeric then 'gold'
    when p_value >= (p_thresholds ->> 'silver')::numeric then 'silver'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Weekly evaluation + automatic equipment (service role only, idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.finalize_shield_week(p_family_id uuid, p_week date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.shield_config;
  v_rules jsonb;
  v_tz text := public.shield_family_timezone(p_family_id);
  v_today date := (statement_timestamp() at time zone v_tz)::date;
  v_end date := p_week + 6;
  v_from timestamptz := p_week::timestamp at time zone v_tz;
  v_to timestamptz := (p_week + 7)::timestamp at time zone v_tz;
  v_member record;
  v_eval uuid;
  v_covered integer;
  v_m_done integer; v_m_all integer; v_m_days integer;
  v_e_done integer; v_e_all integer; v_e_days integer;
  v_bonus_days integer;
  v_required_rate numeric;
  v_m_rate numeric; v_e_rate numeric;
  v_m_tier text; v_e_tier text; v_b_tier text;
  v_candidates jsonb;
  v_awards jsonb;
  v_award jsonb;
  v_status text;
  v_evaluated integer := 0;
  v_awarded integer := 0;
  v_equipped integer := 0;
begin
  select * into v_config from public.shield_config where id = 1;
  v_rules := v_config.rules;
  if extract(isodow from p_week) <> 1 then raise exception 'p_week must be a Monday'; end if;
  if v_end >= v_today then raise exception 'Week has not ended in the family timezone'; end if;

  for v_member in
    select id from public.users where family_id = p_family_id and deleted_at is null order by id
  loop
    select count(*) into v_covered
    from public.shield_daily_schedules
    where user_id = v_member.id and family_id = p_family_id and day between p_week and v_end;

    -- Required slots, exactly as the client's completedSlotKeys + tallyPeriod:
    -- a slot is done by any completion of that habit that local day, split at
    -- noon only when the habit had both a morning and an evening slot.
    with snap as (
      select s.day, e ->> 'taskId' as task_id, e ->> 'window' as win,
             count(*) over (partition by s.day, e ->> 'taskId') as windows_that_day
      from public.shield_daily_schedules s
      cross join lateral jsonb_array_elements(s.slots) e
      where s.user_id = v_member.id and s.family_id = p_family_id and s.day between p_week and v_end
    ),
    done as (
      select c.task_id,
             (c.completed_at at time zone v_tz)::date as day,
             case when extract(hour from c.completed_at at time zone v_tz) < 12 then 'morning' else 'evening' end as win
      from public.task_completions c
      where c.user_id = v_member.id and c.completed_at >= v_from and c.completed_at < v_to
    ),
    slots as (
      select snap.day, snap.win,
             exists (
               select 1 from done d
               where d.task_id = snap.task_id and d.day = snap.day
                 and (snap.windows_that_day = 1 or d.win = snap.win)
             ) as completed
      from snap
    )
    select
      count(*) filter (where win = 'morning' and completed),
      count(*) filter (where win = 'morning'),
      count(distinct day) filter (where win = 'morning'),
      count(*) filter (where win = 'evening' and completed),
      count(*) filter (where win = 'evening'),
      count(distinct day) filter (where win = 'evening')
    into v_m_done, v_m_all, v_m_days, v_e_done, v_e_all, v_e_days
    from slots;

    -- Bonus days: a completion of a bonus task that was not a required slot
    -- that day (a task switched from required keeps its required history).
    select count(distinct (c.completed_at at time zone v_tz)::date) into v_bonus_days
    from public.task_completions c
    join public.tasks t on t.id = c.task_id
    where c.user_id = v_member.id
      and c.completed_at >= v_from and c.completed_at < v_to
      and t.task_type = 'optional'
      and not exists (
        select 1 from public.shield_daily_schedules s
        cross join lateral jsonb_array_elements(s.slots) e
        where s.user_id = v_member.id
          and s.day = (c.completed_at at time zone v_tz)::date
          and e ->> 'taskId' = c.task_id
      );

    v_m_rate := case when v_m_all > 0 then round(v_m_done * 100.0 / v_m_all, 1) end;
    v_e_rate := case when v_e_all > 0 then round(v_e_done * 100.0 / v_e_all, 1) end;
    v_required_rate := case when v_m_all + v_e_all > 0 then round((v_m_done + v_e_done) * 100.0 / (v_m_all + v_e_all), 1) end;

    v_m_tier := case when v_m_all >= (v_rules #>> '{window,minSlots}')::int and v_m_days >= (v_rules #>> '{window,minDays}')::int
      then public.shield_tier_for(v_m_done * 100.0 / v_m_all, v_rules -> 'window') end;
    v_e_tier := case when v_e_all >= (v_rules #>> '{window,minSlots}')::int and v_e_days >= (v_rules #>> '{window,minDays}')::int
      then public.shield_tier_for(v_e_done * 100.0 / v_e_all, v_rules -> 'window') end;
    v_b_tier := case when coalesce(v_required_rate, 0) >= (v_rules #>> '{bonus,minRequiredRate}')::numeric
      then public.shield_tier_for(v_bonus_days, v_rules -> 'bonus') end;

    v_candidates := jsonb_build_array(
      jsonb_build_object('type', 'morning', 'tier', v_m_tier, 'completed', v_m_done, 'eligible', v_m_all, 'days', v_m_days, 'rate', v_m_rate),
      jsonb_build_object('type', 'evening', 'tier', v_e_tier, 'completed', v_e_done, 'eligible', v_e_all, 'days', v_e_days, 'rate', v_e_rate),
      jsonb_build_object('type', 'bonus', 'tier', v_b_tier, 'bonusDays', v_bonus_days, 'requiredRate', v_required_rate)
    );

    if v_covered < (v_rules ->> 'minCoveredDays')::int then
      v_status := 'insufficient_data';
      v_awards := '[]'::jsonb;
    else
      v_awards := '[]'::jsonb;
      if v_m_tier is not null then
        v_awards := v_awards || jsonb_build_array(jsonb_build_object('type', 'morning', 'tier', v_m_tier,
          'scope', jsonb_build_object('kind', 'window', 'window', 'morning'),
          'metrics', jsonb_build_object('completed', v_m_done, 'eligible', v_m_all, 'days', v_m_days, 'rate', v_m_rate)));
      end if;
      if v_e_tier is not null then
        v_awards := v_awards || jsonb_build_array(jsonb_build_object('type', 'evening', 'tier', v_e_tier,
          'scope', jsonb_build_object('kind', 'window', 'window', 'evening'),
          'metrics', jsonb_build_object('completed', v_e_done, 'eligible', v_e_all, 'days', v_e_days, 'rate', v_e_rate)));
      end if;
      if v_b_tier is not null then
        v_awards := v_awards || jsonb_build_array(jsonb_build_object('type', 'bonus', 'tier', v_b_tier,
          'scope', jsonb_build_object('kind', 'bonus'),
          'metrics', jsonb_build_object('bonusDays', v_bonus_days, 'requiredRate', v_required_rate)));
      end if;
      v_status := case when jsonb_array_length(v_awards) > 0 then 'awarded' else 'no_award' end;
    end if;

    v_eval := null;
    insert into public.shield_evaluations (family_id, user_id, period_type, period_start, period_end, candidate_results, selected_candidate, evaluation_status, eligibility_summary, evaluation_version)
    values (p_family_id, v_member.id, 'week', p_week, v_end, v_candidates, null, v_status,
            jsonb_build_object('coveredDays', v_covered, 'timezone', v_tz), v_config.version)
    on conflict (user_id, period_type, period_start) do nothing
    returning id into v_eval;

    if v_eval is not null then
      v_evaluated := v_evaluated + 1;
      for v_award in select * from jsonb_array_elements(v_awards) loop
        insert into public.shield_monthly_awards (family_id, user_id, evaluation_id, evaluation_month, equipment_month, shield_type, tier, category, scope, bonus_rate_bp, qualification_metrics, config_version, evaluation_version)
        values (p_family_id, v_member.id, v_eval, p_week, p_week + 7, v_award ->> 'type', v_award ->> 'tier', null, v_award -> 'scope',
                (v_rules #>> array['rateBp', v_award ->> 'tier'])::int, v_award -> 'metrics', v_config.version, v_config.version);
        v_awarded := v_awarded + 1;
      end loop;
    end if;

    -- Equip every Shield earned last week for the current week, unless the
    -- member's equipment for this week was already set.
    if p_week + 7 = public.shield_current_week(p_family_id)
       and not exists (select 1 from public.shield_equipment where user_id = v_member.id and equipment_month = p_week + 7) then
      insert into public.shield_equipment (family_id, user_id, award_id, shield_type, slot_number, equipment_month, equipped_at)
      select p_family_id, v_member.id, a.id, a.shield_type,
             case a.shield_type when 'morning' then 1 when 'evening' then 2 else 3 end,
             a.equipment_month, statement_timestamp()
      from public.shield_monthly_awards a
      where a.user_id = v_member.id and a.equipment_month = p_week + 7;
      if found then v_equipped := v_equipped + 1; end if;
    end if;
  end loop;

  return jsonb_build_object('week', p_week, 'evaluated', v_evaluated, 'awarded', v_awarded, 'equipped', v_equipped);
end;
$$;
revoke all on function public.finalize_shield_week(uuid, date) from public, anon, authenticated;
grant execute on function public.finalize_shield_week(uuid, date) to service_role;

-- Every ended week since the first one with enough snapshots (at most the
-- last four, so a long outage cannot flood old awards). Idempotent.
create or replace function public.finalize_due_shield_weeks(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current date := public.shield_current_week(p_family_id);
  v_first date;
  v_week date;
  v_results jsonb := '[]'::jsonb;
begin
  select date_trunc('week', min(day))::date into v_first from public.shield_daily_schedules where family_id = p_family_id;
  if v_first is null then return jsonb_build_object('skipped', 'no_snapshots_yet'); end if;
  v_week := greatest(v_first, v_current - 28);
  while v_week < v_current loop
    v_results := v_results || jsonb_build_array(public.finalize_shield_week(p_family_id, v_week));
    v_week := v_week + 7;
  end loop;
  return jsonb_build_object('weeks', v_results);
end;
$$;
revoke all on function public.finalize_due_shield_weeks(uuid) from public, anon, authenticated;
grant execute on function public.finalize_due_shield_weeks(uuid) to service_role;

drop function if exists public.finalize_shield_month(jsonb);

-- ---------------------------------------------------------------------------
-- 4. Equipment lifecycle moves to weeks
-- ---------------------------------------------------------------------------
create or replace function public.close_expired_shield_equipment()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.shield_equipment e
  set unequipped_at = greatest(e.equipped_at, ((e.equipment_month + 7)::timestamp at time zone public.shield_family_timezone(e.family_id)))
  where e.unequipped_at is null
    and e.equipment_month < public.shield_current_week(e.family_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.close_expired_shield_equipment() from public, anon, authenticated;
grant execute on function public.close_expired_shield_equipment() to service_role;

create or replace function public.shield_set_loadout(p_user_id text, p_award_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public.get_my_family_id();
  v_week date;
  v_ids uuid[] := coalesce(p_award_ids, array[]::uuid[]);
  v_award public.shield_monthly_awards;
  v_slot integer := 0;
  v_now timestamptz := statement_timestamp();
  v_existing public.shield_equipment;
begin
  if v_family is null or auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users where id = p_user_id and family_id = v_family and deleted_at is null) then
    raise exception 'Member not found';
  end if;
  if array_length(v_ids, 1) > 3 then raise exception 'At most three Shields can be equipped'; end if;
  if (select count(distinct x) from unnest(v_ids) x) <> coalesce(array_length(v_ids, 1), 0) then raise exception 'Duplicate Shield'; end if;

  perform pg_advisory_xact_lock(hashtextextended('shield-loadout:' || p_user_id, 0));
  v_week := public.shield_current_week(v_family, v_now);

  if exists (
    select 1 from unnest(v_ids) req(id)
    left join public.shield_monthly_awards a on a.id = req.id
    where a.id is null or a.user_id <> p_user_id or a.family_id <> v_family or a.equipment_month <> v_week
  ) then
    raise exception 'Only this week''s Shields earned by this member can be equipped';
  end if;
  if (select count(distinct a.shield_type) from public.shield_monthly_awards a where a.id = any(v_ids)) <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'Only one Shield per type can be equipped';
  end if;

  for v_existing in
    select * from public.shield_equipment
    where user_id = p_user_id and equipment_month = v_week and unequipped_at is null
    for update
  loop
    if array_position(v_ids, v_existing.award_id) is distinct from v_existing.slot_number then
      update public.shield_equipment set unequipped_at = v_now where id = v_existing.id;
    end if;
  end loop;

  foreach v_slot in array (select coalesce(array_agg(i), array[]::int[]) from generate_subscripts(v_ids, 1) i) loop
    if not exists (select 1 from public.shield_equipment where user_id = p_user_id and equipment_month = v_week and unequipped_at is null and award_id = v_ids[v_slot]) then
      select * into v_award from public.shield_monthly_awards where id = v_ids[v_slot];
      insert into public.shield_equipment (family_id, user_id, award_id, shield_type, slot_number, equipment_month, equipped_at)
      values (v_family, p_user_id, v_award.id, v_award.shield_type, v_slot, v_week, v_now);
    end if;
  end loop;

  return jsonb_build_object('equipmentWeek', v_week, 'equipped', to_jsonb(v_ids), 'at', v_now);
end;
$$;
revoke all on function public.shield_set_loadout(text, uuid[]) from public, anon;
grant execute on function public.shield_set_loadout(text, uuid[]) to authenticated;

drop function if exists public.shield_auto_equip(text, uuid[]);

-- ---------------------------------------------------------------------------
-- 5. Bonus calculation: window and bonus scopes, weekly equipment
-- ---------------------------------------------------------------------------
create or replace function public.shield_bonus_quote(p_user_id text, p_task_id text, p_current_window text, p_base_points integer, p_at timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
    -- Morning/Evening boost required tasks done in that window; Bonus boosts
    -- bonus tasks. The scopes never overlap.
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
    'bonusPoints', (greatest(p_base_points, 0) * v_rate) / 10000,
    'mode', v_cfg.mode,
    'version', v_cfg.version,
    'countsTowardXp', coalesce((v_cfg.rules ->> 'countsTowardXp')::boolean, false),
    'maxClockSkewHours', coalesce((v_cfg.rules ->> 'maxClockSkewHours')::integer, 36)
  );
end;
$$;
revoke all on function public.shield_bonus_quote(text, text, text, integer, timestamptz) from public, anon, authenticated;

create or replace function public.apply_shield_bonus(p_completion_id text, p_user_id text, p_task_id text, p_current_window text, p_base_points integer, p_completed_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  -- Equipment is judged at server time; a completion whose client timestamp
  -- is far from server time (offline replay, clock tampering) or from another
  -- equipment week earns nothing.
  v_quote := public.shield_bonus_quote(p_user_id, p_task_id, p_current_window, p_base_points, v_server_now);
  if v_quote is null then return null; end if;
  select family_id into v_family from public.users where id = p_user_id;
  if abs(extract(epoch from (v_server_now - p_completed_at))) > (v_quote ->> 'maxClockSkewHours')::integer * 3600
     or public.shield_current_week(v_family, p_completed_at) <> (v_quote ->> 'month')::date then
    return jsonb_build_object('bonusPoints', 0, 'reason', 'time_mismatch');
  end if;

  v_bonus := (v_quote ->> 'bonusPoints')::integer;
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
$$;
revoke all on function public.apply_shield_bonus(text, text, text, text, integer, timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';
