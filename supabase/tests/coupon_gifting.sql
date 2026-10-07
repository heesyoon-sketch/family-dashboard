-- Runs with temporary coupons and mailbox records; leaves no changes behind.
begin;
do $$
declare
  v_member public.users%rowtype;
  v_recipient text;
  v_foreign public.users%rowtype;
  v_coupon uuid;
  v_foreign_coupon uuid;
begin
  select * into v_member from public.users
    where auth_user_id is not null and deleted_at is null
      and exists (select 1 from public.users other
        where other.family_id = users.family_id and other.id <> users.id and other.deleted_at is null)
    order by created_at limit 1;
  select id into v_recipient from public.users
    where family_id = v_member.family_id and id <> v_member.id and deleted_at is null limit 1;
  select * into v_foreign from public.users
    where family_id <> v_member.family_id and deleted_at is null limit 1;
  if v_member.id is null or v_recipient is null or v_foreign.id is null then
    raise exception 'Test needs two families and two members in the first family';
  end if;
  insert into public.perfect_day_coupons
    (family_id,user_id,day_started_at,earned_for_day,quest_day,chain_length,reward_slot)
    values (v_member.family_id,v_member.id,'2099-01-01T12:00:00Z','2099-01-01',3,3,1)
    returning id into v_coupon;
  -- Both people already earned a pass on the same date. Receiving a gift must
  -- not collide with either member's earning uniqueness constraints.
  insert into public.perfect_day_coupons
    (family_id,user_id,day_started_at,earned_for_day,quest_day,chain_length,reward_slot)
    values (v_member.family_id,v_recipient,'2099-01-01T12:00:00Z','2099-01-01',3,3,1);
  insert into public.perfect_day_coupons
    (family_id,user_id,day_started_at,earned_for_day,quest_day,chain_length,reward_slot)
    values (v_foreign.family_id,v_foreign.id,'2099-01-01T12:00:00Z','2099-01-01',3,3,1)
    returning id into v_foreign_coupon;
  perform set_config('coupon_test.sender',v_member.id,true);
  perform set_config('coupon_test.recipient',v_recipient,true);
  perform set_config('coupon_test.foreign',v_foreign.id,true);
  perform set_config('coupon_test.coupon',v_coupon::text,true);
  perform set_config('coupon_test.foreign_coupon',v_foreign_coupon::text,true);
  perform set_config('request.jwt.claim.sub',v_member.auth_user_id::text,true);
end;
$$;
set local role authenticated;
do $$
declare
  v_sender text := current_setting('coupon_test.sender');
  v_recipient text := current_setting('coupon_test.recipient');
  v_foreign text := current_setting('coupon_test.foreign');
  v_coupon uuid := current_setting('coupon_test.coupon')::uuid;
  v_result jsonb;
  v_blocked boolean;
  v_mailbox_before integer;
begin
  select count(*) into v_mailbox_before from public.family_activities
    where user_id in (v_sender::uuid,v_recipient::uuid)
      and message in ('COUPON_GIFT_SENT:test gift','COUPON_GIFT_RECEIVED:test gift');
  if exists (select 1 from public.perfect_day_coupons
      where id = current_setting('coupon_test.foreign_coupon')::uuid) then
    raise exception 'RLS exposed another family coupon';
  end if;
  if has_function_privilege('anon','public.transfer_perfect_day_coupon(uuid,text,text,text)','execute') then
    raise exception 'Anonymous users can transfer coupons';
  end if;
  v_blocked := false;
  begin perform public.transfer_perfect_day_coupon(v_coupon,v_sender,v_sender,'');
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Self gift succeeded'; end if;
  v_blocked := false;
  begin perform public.transfer_perfect_day_coupon(v_coupon,v_sender,v_foreign,'');
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Cross-family gift succeeded'; end if;
  v_blocked := false;
  begin perform public.transfer_perfect_day_coupon(v_coupon,v_sender,v_recipient,repeat('x',201));
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Oversized message succeeded'; end if;

  v_result := public.transfer_perfect_day_coupon(v_coupon,v_sender,v_recipient,'test gift');
  if v_result->>'owner_id' <> v_recipient or v_result->>'user_id' <> v_sender
      or v_result->>'status' <> 'available' then
    raise exception 'Gift changed the earning record or failed to transfer ownership';
  end if;
  if (select count(*) from public.family_activities
      where user_id in (v_sender::uuid,v_recipient::uuid)
        and message in ('COUPON_GIFT_SENT:test gift','COUPON_GIFT_RECEIVED:test gift')) <> v_mailbox_before + 2 then
    raise exception 'Gift mailbox records missing';
  end if;
  v_blocked := false;
  begin perform public.transfer_perfect_day_coupon(v_coupon,v_sender,v_recipient,'test gift');
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Duplicate transfer succeeded'; end if;
  v_blocked := false;
  begin perform public.redeem_perfect_day_coupon(v_coupon,v_sender,'game',now());
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Former owner redeemed gifted coupon'; end if;
  v_blocked := false;
  begin update public.perfect_day_coupons set owner_id = v_sender where id = v_coupon;
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'Direct ownership update allowed'; end if;
  perform public.transfer_perfect_day_coupon(v_coupon,v_recipient,v_sender,'pass back');
  perform public.transfer_perfect_day_coupon(v_coupon,v_sender,v_recipient,'');
  v_result := public.redeem_perfect_day_coupon(v_coupon,v_recipient,'media',now());
  if v_result->>'status' <> 'redeemed' or v_result->>'redeemed_for' <> 'media' then
    raise exception 'Recipient could not redeem the pass';
  end if;
  v_blocked := false;
  begin perform public.transfer_perfect_day_coupon(v_coupon,v_recipient,v_sender,'');
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Used coupon was transferred'; end if;
end;
$$;
reset role;
do $$
declare
  v_coupon uuid := current_setting('coupon_test.coupon')::uuid;
  v_blocked boolean := false;
begin
  -- A gifted reward cannot be taken away by undoing its earning routines.
  update public.perfect_day_coupons set status='available',redeemed_for=null,redeemed_at=null where id=v_coupon;
  begin update public.perfect_day_coupons set status='revoked' where id=v_coupon;
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Gifted coupon was revoked'; end if;
end;
$$;
select 'Coupon gifting, ownership, mailbox, redemption, and family isolation passed' as result;
rollback;
