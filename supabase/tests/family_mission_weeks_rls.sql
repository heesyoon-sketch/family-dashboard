-- Transactional: every test row is rolled back.
begin;
do $$
declare a record; b record;
begin
  select family_id, auth_user_id into a from public.users where deleted_at is null and auth_user_id is not null order by family_id, id limit 1;
  select family_id, auth_user_id into b from public.users where deleted_at is null and auth_user_id is not null and family_id <> a.family_id and auth_user_id <> a.auth_user_id order by family_id, id limit 1;
  if a.family_id is null or b.family_id is null then raise exception 'Need two auth-linked families'; end if;
  perform set_config('mission_test.family_a', a.family_id::text, true);
  perform set_config('mission_test.family_b', b.family_id::text, true);
  insert into public.family_mission_weeks(family_id, week_start, mission_id, rules)
  values (b.family_id, '2001-01-01', 'all-together', '{"version":1}');
  perform set_config('request.jwt.claim.sub', a.auth_user_id::text, true);
end $$;
set local role authenticated;
do $$
declare n int;
begin
  -- Own family: start a week, read it, finalize it once.
  insert into public.family_mission_weeks(family_id, week_start, mission_id, rules)
  values (current_setting('mission_test.family_a')::uuid, '2001-01-01', 'strong-week', '{"version":1}');
  select count(*) into n from public.family_mission_weeks where family_id = current_setting('mission_test.family_a')::uuid and week_start = '2001-01-01';
  if n <> 1 then raise exception 'Own family read failed'; end if;

  begin
    update public.family_mission_weeks set rules = '{"version":1,"edited":true}', status = 'completed', finalized_at = now()
    where family_id = current_setting('mission_test.family_a')::uuid and week_start = '2001-01-01';
    raise exception 'Rules were editable';
  exception when raise_exception then
    if sqlerrm = 'Rules were editable' then raise; end if;
  end;

  update public.family_mission_weeks set status = 'completed', result = '{"complete":true}', finalized_at = now()
  where family_id = current_setting('mission_test.family_a')::uuid and week_start = '2001-01-01';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Finalize failed'; end if;

  update public.family_mission_weeks set status = 'missed', finalized_at = now()
  where family_id = current_setting('mission_test.family_a')::uuid and week_start = '2001-01-01';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A finalized week was changed'; end if;

  -- Starting a week as already completed is refused.
  begin
    insert into public.family_mission_weeks(family_id, week_start, mission_id, rules, status, finalized_at)
    values (current_setting('mission_test.family_a')::uuid, '2001-01-08', 'strong-week', '{"version":1}', 'completed', now());
    raise exception 'Pre-completed insert allowed';
  exception when insufficient_privilege then null; end;

  -- Other family: invisible, not writable.
  select count(*) into n from public.family_mission_weeks where family_id = current_setting('mission_test.family_b')::uuid;
  if n <> 0 then raise exception 'Cross-family read allowed'; end if;
  begin
    insert into public.family_mission_weeks(family_id, week_start, mission_id, rules)
    values (current_setting('mission_test.family_b')::uuid, '2001-01-08', 'strong-week', '{"version":1}');
    raise exception 'Cross-family insert allowed';
  exception when insufficient_privilege then null; end;
  update public.family_mission_weeks set status = 'completed', finalized_at = now() where family_id = current_setting('mission_test.family_b')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Cross-family update allowed'; end if;
end $$;
reset role;
select 'PASS: family isolation, frozen rules, single finalize, no pre-completed weeks' as result;
rollback;
