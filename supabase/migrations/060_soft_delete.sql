-- Migration 060: Soft-delete on users / tasks / rewards.
--
-- Until now, admin "delete" actions were hard DELETEs. A prior incident
-- (2026-04-26) accidentally hard-deleted two child members and recovery
-- required a hand-written SQL script. This migration replaces hard delete
-- with a deleted_at timestamp so admin actions are reversible. Hard delete
-- is still available via admin_delete_family for full data wipe (Google
-- Play compliance).
--
-- Idempotent — safe to re-run.

-- ── Schema: deleted_at columns ──────────────────────────────────────────────
alter table public.users    add column if not exists deleted_at timestamptz;
alter table public.tasks    add column if not exists deleted_at timestamptz;
alter table public.rewards  add column if not exists deleted_at timestamptz;

create index if not exists idx_users_deleted_at   on public.users   (family_id) where deleted_at is null;
create index if not exists idx_tasks_deleted_at   on public.tasks   (family_id) where deleted_at is null;
create index if not exists idx_rewards_deleted_at on public.rewards (family_id) where deleted_at is null;

-- ── Tasks: soft-delete + restore ────────────────────────────────────────────
create or replace function public.admin_delete_task(p_task_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_updated integer;
begin
  update public.tasks
  set deleted_at = now()
  where id = p_task_id
    and family_id = v_family_id
    and deleted_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Task not found';
  end if;
end;
$$;

create or replace function public.admin_restore_task(p_task_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_updated integer;
begin
  update public.tasks
  set deleted_at = null
  where id = p_task_id
    and family_id = v_family_id
    and deleted_at is not null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Task not found or not deleted';
  end if;
end;
$$;

grant execute on function public.admin_delete_task(text)  to authenticated;
grant execute on function public.admin_restore_task(text) to authenticated;

-- ── Rewards: soft-delete + restore ──────────────────────────────────────────
create or replace function public.admin_delete_reward(p_reward_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_updated integer;
begin
  update public.rewards
  set deleted_at = now()
  where id = p_reward_id::uuid
    and family_id = v_family_id
    and deleted_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Reward not found';
  end if;
end;
$$;

create or replace function public.admin_restore_reward(p_reward_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_updated integer;
begin
  update public.rewards
  set deleted_at = null
  where id = p_reward_id::uuid
    and family_id = v_family_id
    and deleted_at is not null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Reward not found or not deleted';
  end if;
end;
$$;

grant execute on function public.admin_delete_reward(text)  to authenticated;
grant execute on function public.admin_restore_reward(text) to authenticated;

-- ── Users: soft-delete + restore (new) ──────────────────────────────────────
-- The admin UI previously called supabase.from('users').delete() directly,
-- which cascade-removed task_completions and levels. Soft-delete keeps that
-- data for restore, and clients filter deleted_at IS NULL.
create or replace function public.admin_delete_user(p_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_target_role text;
  v_updated integer;
begin
  select role into v_target_role
  from public.users
  where id = p_user_id and family_id = v_family_id;

  if v_target_role is null then
    raise exception 'Member not found';
  end if;

  -- Refuse to delete the last parent — would orphan the family.
  if v_target_role = 'PARENT' then
    if (
      select count(*)
      from public.users
      where family_id = v_family_id
        and role = 'PARENT'
        and deleted_at is null
    ) <= 1 then
      raise exception 'Cannot remove the last parent';
    end if;
  end if;

  update public.users
  set deleted_at = now()
  where id = p_user_id
    and family_id = v_family_id
    and deleted_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Member not found or already deleted';
  end if;
end;
$$;

create or replace function public.admin_restore_user(p_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_updated integer;
begin
  update public.users
  set deleted_at = null
  where id = p_user_id
    and family_id = v_family_id
    and deleted_at is not null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Member not found or not deleted';
  end if;
end;
$$;

grant execute on function public.admin_delete_user(text)  to authenticated;
grant execute on function public.admin_restore_user(text) to authenticated;
