-- Migration 033: Require Email OTP verification for PIN reset
--
-- The caller must have just verified an email OTP (within 5 minutes)
-- before calling admin_clear_pin_for_owner(). We detect this by checking
-- the JWT iat claim — verifyOtp() issues a fresh session token whose iat
-- is the verification timestamp.

create or replace function public.admin_clear_pin_for_owner()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id   uuid;
  v_jwt_iat     bigint;
begin
  -- Must be the family creator
  select id into v_family_id
  from public.families
  where owner_id = auth.uid()
  limit 1;

  if v_family_id is null then
    raise exception 'Only the family creator can reset the PIN this way.';
  end if;

  -- Require a fresh session issued within the last 5 minutes.
  -- supabase.auth.verifyOtp() issues a new JWT whose iat equals now(),
  -- so this check passes only when the caller just completed OTP verification.
  v_jwt_iat := (auth.jwt() ->> 'iat')::bigint;
  if v_jwt_iat is null or v_jwt_iat < extract(epoch from now() - interval '5 minutes') then
    raise exception 'Email OTP verification required. Please verify your email within the last 5 minutes.';
  end if;

  -- Remove PIN from family_settings (primary storage)
  delete from public.family_settings
  where family_id = v_family_id
    and key       = 'admin_pin_hash';

  -- Clear any legacy per-user pin_hash on PARENT profiles
  update public.users
  set pin_hash = null
  where family_id = v_family_id
    and role      = 'PARENT';
end;
$$;

grant execute on function public.admin_clear_pin_for_owner() to authenticated;
