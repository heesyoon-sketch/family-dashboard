-- Exercises the live RPC under the authenticated role. All settings and coupon
-- changes are rolled back; no member data or test awards are retained.
-- Run: npx supabase db query --linked --file supabase/tests/special_day_mode.sql
begin;

do $$
declare
  v_auth uuid;
begin
  select u.auth_user_id into v_auth
  from public.users u
  where u.role = 'PARENT' and u.deleted_at is null and u.auth_user_id is not null
    and u.id = (
      select latest.id from public.users latest
      where latest.auth_user_id = u.auth_user_id and latest.family_id is not null
      order by latest.created_at desc limit 1
    )
  order by u.created_at limit 1;
  if v_auth is null then raise exception 'Test needs an auth-linked parent'; end if;
  perform set_config('request.jwt.claim.sub', v_auth::text, true);
  if has_function_privilege('anon', 'public.admin_set_penalty_pause(boolean,timestamptz,text,date)', 'EXECUTE') then
    raise exception 'Anonymous callers must not be able to toggle Special Day Mode';
  end if;
end;
$$;

set local role authenticated;

do $$
declare
  v_family uuid := public.get_my_family_id();
  v_day date := current_date;
  v_start timestamptz := current_date::timestamptz;
  v_day_key text := (array['MON','TUE','WED','THU','FRI','SAT','SUN'])[extract(isodow from current_date)::int];
  v_expected integer;
  v_before integer;
  v_after integer;
  v_result jsonb;
begin
  select count(*) into v_expected from public.users u
  where u.family_id = v_family and u.deleted_at is null
    and not exists (
      select 1 from public.perfect_day_coupons c
      where c.user_id = u.id and c.day_started_at = v_start and c.reward_slot = 1
    );
  select count(*) into v_before from public.perfect_day_coupons where family_id = v_family;

  v_result := public.admin_set_penalty_pause(true, v_start, v_day_key, v_day);
  if (v_result->>'enabled')::boolean is distinct from true
    or (v_result->>'couponsAwarded')::int is distinct from v_expected then
    raise exception 'Enabling must grant exactly one missing slot-1 coupon per active member: %', v_result;
  end if;
  if not exists (select 1 from public.family_settings where family_id = v_family and key = 'penalty_pause' and (value::jsonb->>'enabled')::boolean) then
    raise exception 'Enable state was not persisted';
  end if;

  v_result := public.admin_set_penalty_pause(false, null, null, null);
  if (v_result->>'enabled')::boolean is distinct from false
    or (v_result->>'couponsAwarded')::int is distinct from 0 then
    raise exception 'Disabling must not award coupons: %', v_result;
  end if;
  if not exists (select 1 from public.family_settings where family_id = v_family and key = 'penalty_pause' and not (value::jsonb->>'enabled')::boolean) then
    raise exception 'Disable state was not persisted';
  end if;

  v_result := public.admin_set_penalty_pause(true, v_start, v_day_key, v_day);
  if (v_result->>'couponsAwarded')::int is distinct from 0 then
    raise exception 'Re-enabling must not duplicate coupons: %', v_result;
  end if;
  select count(*) into v_after from public.perfect_day_coupons where family_id = v_family;
  if v_after <> v_before + v_expected then
    raise exception 'Unexpected coupon count after repeated toggles';
  end if;
end;
$$;

reset role;
rollback;
select 'PASS: enable, disable, daily idempotency, anonymous denial; changes rolled back' as result;
