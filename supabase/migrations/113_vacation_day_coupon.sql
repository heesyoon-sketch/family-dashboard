-- Migration 113: turning on Special Day Mode also grants every family
-- member one perfect-day coupon for that local day, redeemable for either
-- game or media time (the choice already happens at redemption -- see
-- redeem_perfect_day_coupon). Reuses the perfect_day_coupons table's
-- (user_id, day_started_at) uniqueness so this is idempotent per member per
-- day: flipping the toggle on and off repeatedly the same day, or a day that
-- was already a genuine perfect day, never awards more than one coupon.

drop function if exists public.admin_set_penalty_pause(boolean);

create or replace function public.admin_set_penalty_pause(
  p_enabled boolean,
  p_day_start timestamptz default null,
  p_day_key text default null,
  p_earned_for_day date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_enabled boolean := coalesce(p_enabled, false);
  v_now timestamptz := statement_timestamp();
  v_expected_day_key text;
  v_member record;
  v_coupons_awarded integer := 0;
begin
  insert into public.family_settings (key, value, updated_at, family_id)
  values ('penalty_pause', jsonb_build_object('enabled', v_enabled)::text, now(), v_family_id)
  on conflict (key, family_id) do update
    set value = excluded.value,
        updated_at = excluded.updated_at;

  if v_enabled and p_day_start is not null and p_day_key is not null and p_earned_for_day is not null then
    v_expected_day_key := case extract(isodow from p_earned_for_day)
      when 1 then 'MON' when 2 then 'TUE' when 3 then 'WED'
      when 4 then 'THU' when 5 then 'FRI' when 6 then 'SAT' else 'SUN'
    end;

    if p_day_key = v_expected_day_key and abs(p_earned_for_day - p_day_start::date) <= 1 then
      for v_member in
        select u.id
        from public.users u
        where u.family_id = v_family_id
          and u.deleted_at is null
      loop
        insert into public.perfect_day_coupons (
          family_id, user_id, day_started_at, earned_for_day, status, awarded_at, updated_at
        ) values (
          v_family_id, v_member.id, p_day_start, p_earned_for_day, 'available', v_now, v_now
        )
        on conflict (user_id, day_started_at) do nothing;

        if found then
          v_coupons_awarded := v_coupons_awarded + 1;
        end if;
      end loop;
    end if;
  end if;

  return jsonb_build_object('enabled', v_enabled, 'couponsAwarded', v_coupons_awarded);
end;
$$;

revoke all on function public.admin_set_penalty_pause(boolean, timestamptz, text, date) from public, anon;
grant execute on function public.admin_set_penalty_pause(boolean, timestamptz, text, date) to authenticated;

notify pgrst, 'reload schema';
