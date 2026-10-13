-- Transactional: everything is rolled back.
begin;
do $$
declare a record; b record; v jsonb; n int; payload jsonb; v_award uuid;
begin
  select u.family_id, u.auth_user_id, u.id as user_id into a from public.users u where u.deleted_at is null and u.auth_user_id is not null order by u.family_id, u.id limit 1;
  select u.family_id, u.auth_user_id, u.id as user_id into b from public.users u where u.deleted_at is null and u.auth_user_id is not null and u.family_id <> a.family_id order by u.family_id, u.id limit 1;
  if a.family_id is null or b.family_id is null then raise exception 'Need two auth-linked families'; end if;

  payload := jsonb_build_object(
    'family_id', a.family_id, 'user_id', a.user_id, 'period_type', 'week',
    'period_start', '2001-01-01', 'period_end', '2001-01-07',
    'candidate_results', '[]'::jsonb, 'selected_candidate', null,
    'evaluation_status', 'awarded', 'eligibility_summary', '{}'::jsonb, 'evaluation_version', 'test',
    'award', jsonb_build_object('shield_type', 'consistency', 'tier', 'gold', 'category', null, 'qualification_metrics', '{"currentRate":90}'::jsonb));

  -- Idempotency: the second identical finalization writes nothing.
  v := public.finalize_shield_period(payload);
  if (v ->> 'created')::boolean is not true then raise exception 'First finalize failed'; end if;
  v_award := (v ->> 'award_id')::uuid;
  v := public.finalize_shield_period(payload);
  if (v ->> 'created')::boolean is not false then raise exception 'Second finalize created another row'; end if;
  select count(*) into n from public.shield_awards where user_id = a.user_id and period_type = 'week' and period_start = '2001-01-01';
  if n <> 1 then raise exception 'Expected exactly one award, got %', n; end if;

  -- A period that has not ended cannot be finalized.
  begin
    perform public.finalize_shield_period(payload || jsonb_build_object('period_start', '2999-01-01', 'period_end', '2999-01-07'));
    raise exception 'Future period finalized';
  exception when raise_exception then
    if sqlerrm = 'Future period finalized' then raise; end if;
  end;

  -- Wrong family for the member is refused.
  begin
    perform public.finalize_shield_period(payload || jsonb_build_object('family_id', b.family_id, 'period_start', '2001-02-05', 'period_end', '2001-02-11'));
    raise exception 'Cross-family finalize allowed';
  exception when raise_exception then
    if sqlerrm = 'Cross-family finalize allowed' then raise; end if;
  end;

  -- Awards are immutable and permanent.
  begin
    update public.shield_awards set tier = 'legendary' where id = v_award;
    raise exception 'Award update allowed';
  exception when raise_exception then
    if sqlerrm = 'Award update allowed' then raise; end if;
  end;
  begin
    delete from public.shield_awards where id = v_award;
    raise exception 'Award delete allowed';
  exception when raise_exception then
    if sqlerrm = 'Award delete allowed' then raise; end if;
  end;

  -- The audited correction path works and logs.
  perform public.correct_shield_award(v_award, 'consistency', 'epic', null, 'test correction');
  select count(*) into n from public.shield_award_corrections c where c.award_id = v_award;
  if n <> 1 then raise exception 'Correction not logged'; end if;

  perform set_config('hall_test.family_a', a.family_id::text, true);
  perform set_config('hall_test.family_b', b.family_id::text, true);
  perform set_config('hall_test.user_a', a.user_id, true);
  perform set_config('hall_test.payload', payload::text, true);
  -- Act as a member of family B.
  perform set_config('request.jwt.claim.sub', b.auth_user_id::text, true);
end $$;

set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.shield_awards where family_id = current_setting('hall_test.family_a')::uuid;
  if n <> 0 then raise exception 'Cross-family award read'; end if;
  select count(*) into n from public.shield_evaluations where family_id = current_setting('hall_test.family_a')::uuid;
  if n <> 0 then raise exception 'Cross-family evaluation read'; end if;

  begin
    insert into public.shield_awards (family_id, user_id, evaluation_id, period_type, period_start, period_end, shield_type, tier, qualification_metrics, evaluation_version)
    values (current_setting('hall_test.family_b')::uuid, 'x', gen_random_uuid(), 'week', '2001-03-05', '2001-03-11', 'consistency', 'legendary', '{}', 'x');
    raise exception 'Client award insert allowed';
  exception when insufficient_privilege then null; end;

  begin
    perform public.finalize_shield_period(current_setting('hall_test.payload')::jsonb);
    raise exception 'Client finalize allowed';
  exception when insufficient_privilege then null; end;

  begin
    perform public.capture_shield_daily_schedules();
    raise exception 'Client snapshot capture allowed';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.shield_daily_schedules (family_id, user_id, day, timezone, slots, source)
    values (current_setting('hall_test.family_b')::uuid, 'x', '2001-01-01', 'UTC', '[]', 'on_time');
    raise exception 'Client snapshot insert allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Deleting family data (cascade from users/families) still works.
do $$
declare n int;
begin
  delete from public.families where id = current_setting('hall_test.family_a')::uuid;
  select count(*) into n from public.shield_awards where family_id = current_setting('hall_test.family_a')::uuid;
  if n <> 0 then raise exception 'Awards survived family deletion'; end if;
end $$;
select 'PASS: idempotent single award, ended periods only, immutable awards with audited corrections, family isolation, no client writes, family deletion cascades' as result;
rollback;
