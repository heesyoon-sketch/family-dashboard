-- Keep user_id as the earning member so quest uniqueness and progress survive gifts.
alter table public.perfect_day_coupons
  add column owner_id text references public.users(id) on delete cascade,
  add column last_transferred_at timestamptz;

update public.perfect_day_coupons set owner_id = user_id;
alter table public.perfect_day_coupons alter column owner_id set not null;
create index perfect_day_coupons_owner_status_idx
  on public.perfect_day_coupons (family_id, owner_id, status, awarded_at desc);

create function public.guard_coupon_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := coalesce(new.owner_id, new.user_id);
  elsif new.status = 'revoked' and old.status <> 'revoked'
    and old.last_transferred_at is not null then
    raise exception '이미 양도하거나 선물한 이용권이 있어 완료를 취소할 수 없어요';
  end if;
  if not exists (
    select 1 from public.users
    where id = new.owner_id and family_id = new.family_id and deleted_at is null
  ) then
    raise exception 'Coupon owner must be an active family member';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_coupon_ownership() from public, anon, authenticated;
create trigger guard_coupon_ownership
  before insert or update on public.perfect_day_coupons
  for each row execute function public.guard_coupon_ownership();

-- Existing award paths still pass only user_id. Include the current owner in
-- claim responses so reconciliation never returns a gifted pass to its earner.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.claim_perfect_day_coupon(text,timestamptz,text,date,timestamptz)'::regprocedure)
    into v_definition;
  if strpos(v_definition, '''userId'', v_coupon.user_id') = 0 then
    raise exception 'Unexpected coupon claim response format';
  end if;
  execute replace(v_definition, '''userId'', v_coupon.user_id',
    '''userId'', v_coupon.user_id, ''ownerId'', v_coupon.owner_id');
end;
$$;

create function public.transfer_perfect_day_coupon(
  p_coupon_id uuid,
  p_sender_id text,
  p_recipient_id text,
  p_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_coupon public.perfect_day_coupons%rowtype;
  v_sender_name text;
  v_recipient_name text;
  v_message text := btrim(coalesce(p_message, ''));
begin
  if auth.uid() is null or v_family_id is null then
    raise exception 'Authentication required';
  end if;
  if p_sender_id = p_recipient_id then
    raise exception '자신에게 이용권을 보낼 수 없어요';
  end if;
  if length(v_message) > 200 then
    raise exception '메시지는 200자까지 보낼 수 있어요';
  end if;
  select name into v_sender_name from public.users
    where id = p_sender_id and family_id = v_family_id and deleted_at is null;
  if not found then raise exception '보내는 가족을 찾을 수 없어요'; end if;
  select name into v_recipient_name from public.users
    where id = p_recipient_id and family_id = v_family_id and deleted_at is null;
  if not found then raise exception '받는 가족을 찾을 수 없어요'; end if;

  select * into v_coupon from public.perfect_day_coupons
    where id = p_coupon_id and family_id = v_family_id
      and owner_id = p_sender_id
    for update;
  if not found then raise exception '보낼 수 있는 이용권을 찾을 수 없어요'; end if;
  if v_coupon.status <> 'available' then
    raise exception '미사용 이용권만 양도하거나 선물할 수 있어요';
  end if;

  update public.perfect_day_coupons
    set owner_id = p_recipient_id, last_transferred_at = now(), updated_at = now()
    where id = v_coupon.id returning * into v_coupon;
  insert into public.family_activities
    (family_id, user_id, type, amount, related_user_name, message)
  values
    (v_family_id, p_sender_id::uuid, 'SYSTEM_MESSAGE', 0, v_recipient_name, 'COUPON_GIFT_SENT:' || v_message),
    (v_family_id, p_recipient_id::uuid, 'SYSTEM_MESSAGE', 0, v_sender_name, 'COUPON_GIFT_RECEIVED:' || v_message);
  return to_jsonb(v_coupon);
end;
$$;
revoke all on function public.transfer_perfect_day_coupon(uuid,text,text,text) from public, anon;
grant execute on function public.transfer_perfect_day_coupon(uuid,text,text,text) to authenticated;

create or replace function public.redeem_perfect_day_coupon(
  p_coupon_id uuid, p_user_id text, p_redeemed_for text, p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_coupon public.perfect_day_coupons%rowtype;
begin
  if auth.uid() is null or v_family_id is null then raise exception 'Authentication required'; end if;
  if p_redeemed_for is null or p_redeemed_for not in ('game', 'media') then
    raise exception 'Choose game or media time';
  end if;
  select * into v_coupon from public.perfect_day_coupons
    where id = p_coupon_id and owner_id = p_user_id and family_id = v_family_id
    for update;
  if not found then raise exception 'Coupon not found'; end if;
  if v_coupon.status <> 'available' then raise exception 'Coupon is no longer available'; end if;
  update public.perfect_day_coupons
    set status = 'redeemed', redeemed_for = p_redeemed_for,
        redeemed_at = now(), updated_at = now()
    where id = p_coupon_id returning * into v_coupon;
  insert into public.family_activities (family_id, user_id, type, amount, message, created_at)
    values (v_family_id, p_user_id::uuid, 'SYSTEM_MESSAGE', 0, 'PERFECT_DAY_COUPON:' || p_redeemed_for, now());
  return to_jsonb(v_coupon);
end;
$$;
revoke all on function public.redeem_perfect_day_coupon(uuid,text,text,timestamptz) from public, anon;
grant execute on function public.redeem_perfect_day_coupon(uuid,text,text,timestamptz) to authenticated;

-- Scope this preference change to the requested family's named members.
update public.users u set theme = 'dark_minimal'
where u.deleted_at is null and u.name in ('윤지우', '장아람')
  and exists (select 1 from public.users parent
    where parent.family_id = u.family_id and parent.name = '윤희식' and parent.deleted_at is null)
  and exists (select 1 from public.users child
    where child.family_id = u.family_id and child.name = '윤준서' and child.deleted_at is null);

notify pgrst, 'reload schema';
