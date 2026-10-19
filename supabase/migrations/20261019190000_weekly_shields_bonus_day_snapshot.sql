-- Weekly Shields: a bonus day needs a schedule snapshot for that day.
--
-- Without a snapshot (e.g. the day before the first capture) a completion of
-- a task that is now a bonus task cannot be told apart from a required one,
-- so it must not count as a bonus day.

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
