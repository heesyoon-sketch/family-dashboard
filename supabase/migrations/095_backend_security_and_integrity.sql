-- Migration 095: least-privilege RPC access, idempotent point transfers,
-- atomic setup/reordering, legacy cleanup, and missing hot-path indexes.

-- PostgreSQL grants function execution to PUBLIC by default. In Supabase that
-- also makes SECURITY DEFINER functions callable by the anon role. Remove that
-- broad default first; existing explicit authenticated grants remain intact.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- These functions are trigger/maintenance/internal helpers, not public APIs.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'link_auth_user_to_profile',
        'prune_old_task_activities',
        'ensure_default_tasks_for_family',
        'ensure_default_tasks_for_member',
        'ensure_default_tasks_for_new_member',
        'rls_auto_enable',
        'log_point_transaction_activity',
        'log_reward_redemption_activity',
        'log_task_completion_activity',
        'delete_task_completion_activity',
        'guard_achievement_state_replacement',
        'guard_achievement_audit_event',
        'touch_achievement_states_updated_at'
      ])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_function);
  end loop;
end;
$$;

-- A transfer request is a permanent idempotency receipt.
alter table public.point_transactions
  add column if not exists request_id uuid;

update public.point_transactions
set request_id = gen_random_uuid()
where request_id is null;

alter table public.point_transactions
  alter column request_id set default gen_random_uuid(),
  alter column request_id set not null;

create unique index if not exists point_transactions_request_id_key
  on public.point_transactions (request_id);

drop function if exists public.transfer_points_with_message(text, text, integer, text);

create function public.transfer_points_with_message(
  p_sender_id text,
  p_receiver_id text,
  p_amount integer,
  p_message text default null,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_sender public.levels%rowtype;
  v_receiver public.levels%rowtype;
  v_existing public.point_transactions%rowtype;
  v_inserted_id uuid;
  v_sender_balance integer;
  v_receiver_balance integer;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_request_id is null then
    raise exception 'Transfer request ID is required';
  end if;
  if p_sender_id !~* v_uuid_pattern or p_receiver_id !~* v_uuid_pattern then
    raise exception 'Point gifting requires UUID member IDs';
  end if;
  if p_sender_id = p_receiver_id then
    raise exception 'Cannot gift points to the same user';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Gift amount must be positive';
  end if;

  -- Parents may operate the shared family kiosk. Non-parent accounts may only
  -- spend from the profile linked to their own auth identity.
  if not exists (
    select 1
    from public.users u
    where u.id = p_sender_id
      and u.family_id = v_family_id
      and u.deleted_at is null
      and (u.auth_user_id = auth.uid() or public.is_my_family_parent())
  ) then
    raise exception 'Not allowed to send points from this member';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = p_receiver_id
      and u.family_id = v_family_id
      and u.deleted_at is null
  ) then
    raise exception 'Receiver not found';
  end if;

  -- Insert the receipt before changing balances. A concurrent retry blocks on
  -- the unique key, then returns the already-committed result without paying.
  insert into public.point_transactions (
    family_id, sender_id, receiver_id, amount, message, request_id, created_at
  ) values (
    v_family_id, p_sender_id::uuid, p_receiver_id::uuid,
    p_amount, v_message, p_request_id, now()
  )
  on conflict (request_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_existing
    from public.point_transactions
    where request_id = p_request_id;

    if v_existing.family_id <> v_family_id
      or v_existing.sender_id <> p_sender_id::uuid
      or v_existing.receiver_id <> p_receiver_id::uuid
      or v_existing.amount <> p_amount
      or v_existing.message is distinct from v_message
    then
      raise exception 'Transfer request ID was reused with different data';
    end if;

    select * into v_sender from public.levels where user_id = p_sender_id;
    select * into v_receiver from public.levels where user_id = p_receiver_id;
    return jsonb_build_object(
      'duplicate', true,
      'senderId', p_sender_id,
      'receiverId', p_receiver_id,
      'amount', p_amount,
      'message', v_message,
      'senderBalance', coalesce(v_sender.spendable_balance, 0),
      'receiverBalance', coalesce(v_receiver.spendable_balance, 0)
    );
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values
    (p_sender_id, 1, 0, 0, now()),
    (p_receiver_id, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  -- Acquire both rows in canonical order to prevent A->B / B->A deadlocks.
  perform 1
  from public.levels
  where user_id in (p_sender_id, p_receiver_id)
  order by user_id
  for update;

  select * into v_sender from public.levels where user_id = p_sender_id;
  select * into v_receiver from public.levels where user_id = p_receiver_id;

  if coalesce(v_sender.spendable_balance, 0) < p_amount then
    raise exception '잔액이 부족합니다';
  end if;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) - p_amount,
      updated_at = now()
  where user_id = p_sender_id
  returning spendable_balance into v_sender_balance;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) + p_amount,
      updated_at = now()
  where user_id = p_receiver_id
  returning spendable_balance into v_receiver_balance;

  return jsonb_build_object(
    'duplicate', false,
    'senderId', p_sender_id,
    'receiverId', p_receiver_id,
    'amount', p_amount,
    'message', v_message,
    'senderBalance', v_sender_balance,
    'receiverBalance', v_receiver_balance
  );
end;
$$;

revoke all on function public.transfer_points_with_message(text, text, integer, text, uuid) from public, anon;
grant execute on function public.transfer_points_with_message(text, text, integer, text, uuid) to authenticated;

-- Family creation is one database transaction instead of prepare/insert/seed
-- network calls with best-effort client cleanup.
create or replace function public.create_family_atomic(
  p_name text,
  p_admin_name text,
  p_admin_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
  v_family_id uuid := gen_random_uuid();
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;
  if v_name is null then
    raise exception 'Family name is required';
  end if;

  perform public.prepare_create_family();
  insert into public.families (id, name, owner_id)
  values (v_family_id, v_name, v_auth_id);
  perform public.seed_default_family_data(v_family_id, p_admin_name, p_admin_avatar_url);
  return v_family_id;
end;
$$;

revoke all on function public.create_family_atomic(text, text, text) from public, anon;
grant execute on function public.create_family_atomic(text, text, text) to authenticated;

-- Swap two task positions under one lock/transaction.
create or replace function public.admin_swap_task_order(
  p_first_task_id text,
  p_second_task_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_first_order integer;
  v_second_order integer;
begin
  if p_first_task_id = p_second_task_id then return; end if;

  perform 1
  from public.tasks
  where id in (p_first_task_id, p_second_task_id)
    and family_id = v_family_id
    and deleted_at is null
  order by id
  for update;

  select sort_order into v_first_order
  from public.tasks
  where id = p_first_task_id and family_id = v_family_id and deleted_at is null;
  select sort_order into v_second_order
  from public.tasks
  where id = p_second_task_id and family_id = v_family_id and deleted_at is null;

  if v_first_order is null or v_second_order is null then
    raise exception 'Task not found';
  end if;

  update public.tasks
  set sort_order = case id
    when p_first_task_id then v_second_order
    when p_second_task_id then v_first_order
  end
  where id in (p_first_task_id, p_second_task_id)
    and family_id = v_family_id;
end;
$$;

revoke all on function public.admin_swap_task_order(text, text) from public, anon;
grant execute on function public.admin_swap_task_order(text, text) to authenticated;

-- Remove the obsolete pre-time-window undo API so stale callers cannot choose
-- a broad arbitrary day range.
drop function if exists public.process_task_undo_atomic(text, text, timestamptz, timestamptz);

-- Index foreign-key and hot query columns that PostgreSQL does not add
-- automatically. Tables are currently small; these keep growth predictable.
create index if not exists streaks_user_task_last_idx
  on public.streaks (user_id, task_id, last_completed_at desc);
create index if not exists task_completions_task_id_idx
  on public.task_completions (task_id);
create index if not exists tasks_user_id_idx
  on public.tasks (user_id);
create index if not exists family_activities_family_created_idx
  on public.family_activities (family_id, created_at desc);
create index if not exists reward_redemptions_user_id_idx
  on public.reward_redemptions (user_id);
create index if not exists reward_redemptions_reward_id_idx
  on public.reward_redemptions (reward_id);
create index if not exists point_transactions_family_created_idx
  on public.point_transactions (family_id, created_at desc);
create index if not exists point_transactions_sender_created_idx
  on public.point_transactions (sender_id, created_at desc);
create index if not exists point_transactions_receiver_created_idx
  on public.point_transactions (receiver_id, created_at desc);

notify pgrst, 'reload schema';
