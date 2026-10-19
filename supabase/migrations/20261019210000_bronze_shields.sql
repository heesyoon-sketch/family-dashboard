-- Bronze Shields: recognition below Silver, with no bonus.
--
--   Morning / Evening  50–69% of that window's required slots  → Bronze (+0%)
--   Bonus              1–2 bonus days, or any bonus days while the required
--                      routine was under 70%                       → Bronze (+0%)
--
-- Below 50% (or no bonus day) the slot stays empty. Bronze shields are
-- equipped like the others so the slot is filled, but apply_shield_bonus pays
-- nothing for them (no ledger row). Last week's evaluations are topped up
-- with the Bronze shields they now qualify for, from their stored metrics.

alter table public.shield_monthly_awards drop constraint if exists shield_monthly_awards_tier_check;
alter table public.shield_monthly_awards add constraint shield_monthly_awards_tier_check
  check (tier in ('bronze', 'silver', 'gold', 'epic', 'legendary'));

update public.shield_config
set rules = jsonb_set(jsonb_set(jsonb_set(rules,
      '{rateBp,bronze}', '0'),
      '{window,bronze}', '50'),
      '{bonus,bronze}', '1'),
    version = 'weekly-v2',
    updated_at = now()
where id = 1;

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
    when p_thresholds ? 'bronze' and p_value >= (p_thresholds ->> 'bronze')::numeric then 'bronze'
  end;
$$;

CREATE OR REPLACE FUNCTION public.finalize_shield_week(p_family_id uuid, p_week date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    select count(distinct (c.completed_at at time zone v_tz)::date) into v_bonus_days
    from public.task_completions c
    join public.tasks t on t.id = c.task_id
    where c.user_id = v_member.id
      and c.completed_at >= v_from and c.completed_at < v_to
      and t.task_type = 'optional'
      -- Only days with a snapshot: without one we cannot tell a bonus
      -- completion from a required one.
      and exists (
        select 1 from public.shield_daily_schedules s
        where s.user_id = v_member.id and s.day = (c.completed_at at time zone v_tz)::date
      )
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
    -- Below the required-routine gate, bonus days earn at most Bronze.
    v_b_tier := case
      when coalesce(v_required_rate, 0) >= (v_rules #>> '{bonus,minRequiredRate}')::numeric
        then public.shield_tier_for(v_bonus_days, v_rules -> 'bonus')
      when v_bonus_days >= (v_rules #>> '{bonus,bronze}')::int then 'bronze'
    end;

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
$function$;

revoke all on function public.finalize_shield_week(uuid, date) from public, anon, authenticated;
grant execute on function public.finalize_shield_week(uuid, date) to service_role;

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

-- Top up last week (and any evaluated week whose equipment week is current)
-- with the Bronze shields its stored metrics qualify for.
with cfg as (select rules from public.shield_config where id = 1),
cand as (
  select e.id as evaluation_id, e.family_id, e.user_id, e.period_start, c ->> 'type' as kind, c
  from public.shield_evaluations e
  cross join lateral jsonb_array_elements(e.candidate_results) c
  where e.period_type = 'week'
    and e.evaluation_status <> 'insufficient_data'
    and e.period_start + 7 = public.shield_current_week(e.family_id)
    and c ->> 'tier' is null
),
bronze as (
  select cand.* from cand, cfg
  where (cand.kind in ('morning', 'evening')
         and (cand.c ->> 'eligible')::int >= (cfg.rules #>> '{window,minSlots}')::int
         and (cand.c ->> 'days')::int >= (cfg.rules #>> '{window,minDays}')::int
         and (cand.c ->> 'rate')::numeric >= (cfg.rules #>> '{window,bronze}')::numeric)
     or (cand.kind = 'bonus' and (cand.c ->> 'bonusDays')::int >= (cfg.rules #>> '{bonus,bronze}')::int)
)
insert into public.shield_monthly_awards (family_id, user_id, evaluation_id, evaluation_month, equipment_month, shield_type, tier, category, scope, bonus_rate_bp, qualification_metrics, config_version, evaluation_version)
select b.family_id, b.user_id, b.evaluation_id, b.period_start, b.period_start + 7, b.kind, 'bronze', null,
       case when b.kind = 'bonus' then jsonb_build_object('kind', 'bonus') else jsonb_build_object('kind', 'window', 'window', b.kind) end,
       0,
       case when b.kind = 'bonus'
         then jsonb_build_object('bonusDays', b.c -> 'bonusDays', 'requiredRate', b.c -> 'requiredRate')
         else jsonb_build_object('completed', b.c -> 'completed', 'eligible', b.c -> 'eligible', 'days', b.c -> 'days', 'rate', b.c -> 'rate') end,
       'weekly-v2', 'weekly-v2'
from bronze b
on conflict (user_id, evaluation_month, shield_type) do nothing;

-- Evaluations are write-once audit records, so their status stays as
-- recorded; the added awards reference them.

-- Equip the new Bronze shields in their slots for the current week.
insert into public.shield_equipment (family_id, user_id, award_id, shield_type, slot_number, equipment_month, equipped_at)
select a.family_id, a.user_id, a.id, a.shield_type,
       case a.shield_type when 'morning' then 1 when 'evening' then 2 else 3 end,
       a.equipment_month, statement_timestamp()
from public.shield_monthly_awards a
where a.tier = 'bronze'
  and a.equipment_month = public.shield_current_week(a.family_id)
  and not exists (select 1 from public.shield_equipment q where q.user_id = a.user_id and q.equipment_month = a.equipment_month and q.shield_type = a.shield_type and q.unequipped_at is null);
