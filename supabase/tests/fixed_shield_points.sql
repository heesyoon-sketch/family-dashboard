-- Run inside a transaction; fixture rows and point changes must be rolled back.
do $$
declare
  fam uuid; uid text; task text; ev uuid; award uuid; wk date;
  tier text; expected int; q jsonb; credit jsonb; cid text;
  balance0 int; balance1 int; xp0 int; xp1 int; scope jsonb; kind text; win text; actor uuid; tz text; day_start timestamptz; action_at timestamptz; day_key text;
begin
  select family_id,auth_user_id into fam,actor from public.users where auth_user_id is not null and role='PARENT' and deleted_at is null order by id limit 1;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  tz := public.shield_family_timezone(fam);
  day_start := date_trunc('day', statement_timestamp() at time zone tz) at time zone tz;
  day_key := upper(to_char(day_start at time zone tz, 'DY'));
  if fam is null then raise exception 'Need a family fixture'; end if;
  wk := public.shield_current_week(fam, statement_timestamp());
  update public.shield_config set mode = 'live';
  foreach tier in array array['bronze','silver','gold','epic','legendary'] loop
    expected := case tier when 'bronze' then 0 when 'silver' then 1 when 'gold' then 2 when 'epic' then 3 else 4 end;
    foreach kind in array array['morning','evening','bonus'] loop
      uid := gen_random_uuid()::text; task := gen_random_uuid()::text;
      insert into public.users(id,name,role,theme,family_id) values(uid,'Shield test','CHILD','blue',null);
      update public.users set family_id=fam where id=uid;
      insert into public.levels(user_id,current_level,total_points,spendable_balance,updated_at) values(uid,1,100,100,now()) on conflict(user_id) do update set total_points=100,spendable_balance=100;
      insert into public.tasks(id,user_id,family_id,title,icon,difficulty,base_points,recurrence,time_window,days_of_week,task_type)
      select task,uid,fam,'Shield test','book',t.difficulty,10,'daily','both',array['MON','TUE','WED','THU','FRI','SAT','SUN'],case when kind='bonus' then 'optional' else 'required' end from public.tasks t limit 1;
      insert into public.shield_evaluations(family_id,user_id,period_type,period_start,period_end,candidate_results,evaluation_status,eligibility_summary,evaluation_version)
      values(fam,uid,'week',wk-7,wk-1,'[]','awarded','{}','test') returning id into ev;
      scope := case when kind='bonus' then '{"kind":"bonus"}'::jsonb else jsonb_build_object('kind','window','window',kind) end;
      insert into public.shield_monthly_awards(family_id,user_id,evaluation_id,evaluation_month,equipment_month,shield_type,tier,scope,bonus_rate_bp,qualification_metrics,config_version,evaluation_version)
      values(fam,uid,ev,wk-7,wk,kind,tier,scope,500,'{}','test','test') returning id into award;
      insert into public.shield_equipment(family_id,user_id,award_id,shield_type,slot_number,equipment_month,equipped_at)
      values(fam,uid,award,kind,case kind when 'morning' then 1 when 'evening' then 2 else 3 end,wk,statement_timestamp()-interval '1 minute');
      win := case when kind='morning' then 'morning' else 'evening' end;
      q := public.shield_bonus_quote(uid,task,win,10,statement_timestamp());
      if (q->>'bonusPoints')::int <> expected then raise exception 'Quote % %: %',tier,kind,q; end if;
      if expected>0 and q->>'shieldTier' <> tier then raise exception 'Tier missing: %',q; end if;
      if (public.shield_bonus_quote(uid,task,win,0,statement_timestamp())->>'bonusPoints')::int <> 0 then raise exception 'Zero base paid'; end if;
      if kind<>'bonus' and (public.shield_bonus_quote(uid,task,case win when 'morning' then 'evening' else 'morning' end,10,statement_timestamp())->>'bonusPoints')::int <> 0 then raise exception 'Wrong window paid'; end if;
      select spendable_balance,total_points into balance0,xp0 from public.levels where user_id=uid;
      cid := gen_random_uuid()::text;
      credit := public.apply_shield_bonus(cid,uid,task,win,10,statement_timestamp());
      select spendable_balance,total_points into balance1,xp1 from public.levels where user_id=uid;
      if balance1-balance0<>expected or xp1<>xp0 then raise exception 'Wrong balance or XP: % %',tier,kind; end if;
      if expected>0 then
        if credit->>'tier'<>tier or (credit->>'bonusPoints')::int<>expected then raise exception 'Wrong RPC credit: %',credit; end if;
        credit := public.apply_shield_bonus(cid,uid,task,win,10,statement_timestamp());
        if (credit->>'bonusPoints')::int<>0 then raise exception 'Duplicate paid'; end if;
        perform public.reverse_shield_bonus(cid,uid,0);
        select spendable_balance into balance1 from public.levels where user_id=uid;
        if balance1<>balance0 then raise exception 'Undo failed'; end if;
        update public.shield_config set mode='simulate';
        credit := public.apply_shield_bonus(gen_random_uuid()::text,uid,task,win,10,statement_timestamp());
        select spendable_balance into balance1 from public.levels where user_id=uid;
        if balance1<>balance0 or (credit->>'bonusPoints')::int<>0 or (credit->>'simulatedBonusPoints')::int<>expected then raise exception 'Simulation paid'; end if;
        update public.shield_config set mode='live';
      elsif credit is not null then raise exception 'Bronze wrote a credit'; end if;
      action_at := day_start + case when win='morning' then interval '9 hours' else interval '13 hours' end;
      q := public.process_task_completion_atomic(uid,task,false,day_start,day_key,win,action_at,0);
      if (q->>'pointsAwarded')::int<>10 or coalesce((q#>>'{shieldBonus,bonusPoints}')::int,0)<>expected then raise exception 'Completion RPC wrong: %',q; end if;
      select spendable_balance,total_points into balance1,xp1 from public.levels where user_id=uid;
      if balance1<>balance0+10+expected or xp1<>xp0+10 then raise exception 'Completion balance wrong'; end if;
      q := public.process_task_completion_atomic(uid,task,false,day_start,day_key,win,action_at,0);
      if (q->>'pointsAwarded')::int<>0 then raise exception 'Duplicate RPC paid'; end if;
      perform public.process_task_undo_atomic(uid,task,day_start,day_key,win,action_at);
      select spendable_balance,total_points into balance1,xp1 from public.levels where user_id=uid;
      if balance1<>balance0 or xp1<>xp0 then raise exception 'RPC undo failed'; end if;
    end loop;
  end loop;
  if has_function_privilege('authenticated','public.apply_shield_bonus(text,text,text,text,integer,timestamptz)','execute')
     or has_function_privilege('anon','public.shield_bonus_quote(text,text,text,integer,timestamptz)','execute') then raise exception 'Internal function exposed'; end if;
end $$;
select 'PASS: 5 tiers × 3 scopes, exact balances, XP, duplicate, undo, simulation, zero base, wrong window, permissions' as result;
