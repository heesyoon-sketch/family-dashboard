-- Migration 085: reward purchase processing status.
--
-- Parents already had purchase history and refund controls inside the admin
-- Store section. This adds the missing operational state: pending, processed,
-- or refunded. No memo field is added by design.

alter table public.reward_redemptions
  add column if not exists processed_at timestamptz default null,
  add column if not exists processed_by uuid default null;

create index if not exists idx_reward_redemptions_pending_processing
  on public.reward_redemptions (redeemed_at desc)
  where processed_at is null and refunded_at is null;

create or replace function public.admin_list_reward_redemptions(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_limit integer := least(200, greatest(1, coalesce(p_limit, 50)));
  v_result jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  into v_result
  from (
    select
      rr.id::text as id,
      rr.user_id::text as user_id,
      u.name as user_name,
      rr.reward_id::text as reward_id,
      coalesce(r.title, '(deleted reward)') as reward_title,
      coalesce(r.icon, 'gift') as reward_icon,
      rr.cost_charged,
      rr.redeemed_at,
      rr.processed_at,
      rr.processed_by::text as processed_by,
      processor.name as processed_by_name,
      rr.refunded_at,
      rr.refunded_by::text as refunded_by,
      rr.refund_reason,
      coalesce(rr.is_joint_purchase, false) as is_joint_purchase,
      rr.joint_user1_id::text as joint_user1_id,
      u1.name as joint_user1_name,
      rr.joint_user1_amount,
      rr.joint_user2_id::text as joint_user2_id,
      u2.name as joint_user2_name,
      rr.joint_user2_amount
    from public.reward_redemptions rr
    join public.users u on u.id = rr.user_id::text
    left join public.rewards r on r.id = rr.reward_id
    left join public.users u1 on u1.id = rr.joint_user1_id::text
    left join public.users u2 on u2.id = rr.joint_user2_id::text
    left join public.users processor
      on processor.auth_user_id = rr.processed_by
     and processor.family_id = v_family_id
    where u.family_id = v_family_id
      and coalesce(rr.refund_reason, '') <> 'duplicate_auto_refund'
    order by
      case
        when rr.refunded_at is not null then 2
        when rr.processed_at is not null then 1
        else 0
      end,
      rr.redeemed_at desc
    limit v_limit
  ) x;

  return v_result;
end;
$$;

grant execute on function public.admin_list_reward_redemptions(int) to authenticated;

create or replace function public.admin_mark_reward_redemption_processed(
  p_redemption_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_redemption public.reward_redemptions;
  v_processed_at timestamptz := now();
  v_processor_name text;
begin
  select rr.* into v_redemption
  from public.reward_redemptions rr
  join public.users u on u.id = rr.user_id::text
  where rr.id = p_redemption_id::uuid
    and u.family_id = v_family_id
  for update;

  if not found then
    raise exception 'Redemption not found';
  end if;

  if v_redemption.refunded_at is not null then
    raise exception 'Already refunded';
  end if;

  if v_redemption.processed_at is null then
    update public.reward_redemptions
    set processed_at = v_processed_at,
        processed_by = auth.uid()
    where id = v_redemption.id
    returning * into v_redemption;
  end if;

  select u.name into v_processor_name
  from public.users u
  where u.auth_user_id = v_redemption.processed_by
    and u.family_id = v_family_id
  order by u.display_order nulls last, u.created_at
  limit 1;

  return jsonb_build_object(
    'redemptionId', v_redemption.id::text,
    'processedAt', v_redemption.processed_at,
    'processedBy', v_redemption.processed_by::text,
    'processedByName', v_processor_name
  );
end;
$$;

grant execute on function public.admin_mark_reward_redemption_processed(text) to authenticated;

notify pgrst, 'reload schema';
