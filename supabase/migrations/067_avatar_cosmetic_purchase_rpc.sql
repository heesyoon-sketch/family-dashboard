-- Migration 067: Atomic avatar cosmetic purchases.
--
-- The avatar studio used to read and update levels directly from the browser.
-- That path can race with realtime balance refreshes and RLS policy changes,
-- producing false "balance changed" failures. Move the balance check, debit,
-- and mailbox log into a SECURITY DEFINER RPC.

create or replace function public.purchase_avatar_cosmetic(
  p_user_id text,
  p_cost int,
  p_cosmetic_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_level public.levels;
  v_safe_cost integer := greatest(1, coalesce(p_cost, 0));
  v_label text := nullif(trim(coalesce(p_cosmetic_label, '')), '');
  v_new_balance integer;
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  if p_user_id !~* v_uuid_pattern then
    raise exception 'Avatar purchase requires a UUID member ID';
  end if;

  if not exists (
    select 1
    from public.users
    where id = p_user_id
      and family_id = v_family_id
      and deleted_at is null
  ) then
    raise exception 'Member not found';
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  if coalesce(v_level.spendable_balance, 0) < v_safe_cost then
    raise exception '포인트가 부족해요';
  end if;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) - v_safe_cost,
      updated_at = now()
  where user_id = p_user_id
  returning spendable_balance into v_new_balance;

  insert into public.family_activities (
    family_id, user_id, type, amount, message, created_at
  )
  values (
    v_family_id,
    p_user_id::uuid,
    'SYSTEM_MESSAGE',
    0,
    '🎨 ' || coalesce(v_label, 'Avatar item') || ' 구매 완료',
    now()
  );

  return jsonb_build_object(
    'userId', p_user_id,
    'cost', v_safe_cost,
    'cosmeticLabel', v_label,
    'spendableBalance', v_new_balance
  );
end;
$$;

grant execute on function public.purchase_avatar_cosmetic(text, int, text) to authenticated;

notify pgrst, 'reload schema';
