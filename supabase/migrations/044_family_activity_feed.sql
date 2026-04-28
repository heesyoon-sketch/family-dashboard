-- Migration 044: Family activity feed for points, gifts, and rewards.

create table if not exists public.family_activities (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete cascade,
  user_id           uuid not null,
  type              text not null check (type in ('GIFT_RECEIVED', 'GIFT_SENT', 'REWARD_PURCHASED', 'TASK_COMPLETED')),
  amount            integer not null default 0,
  related_user_name text default null,
  message           text default null,
  created_at        timestamptz not null default now()
);

create index if not exists family_activities_family_user_created_idx
  on public.family_activities (family_id, user_id, created_at desc);

alter table public.family_activities enable row level security;

drop policy if exists "family_activities_family_select" on public.family_activities;
create policy "family_activities_family_select" on public.family_activities
  for select to authenticated
  using (family_id = public.get_my_family_id());

create or replace function public.log_task_completion_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_task_title text;
begin
  select u.family_id, t.title
  into v_family_id, v_task_title
  from public.users u
  join public.tasks t on t.id = new.task_id
  where u.id = new.user_id;

  if v_family_id is not null and coalesce(new.points_awarded, 0) > 0 then
    insert into public.family_activities (
      family_id, user_id, type, amount, message, created_at
    )
    values (
      v_family_id,
      new.user_id::uuid,
      'TASK_COMPLETED',
      coalesce(new.points_awarded, 0),
      coalesce(v_task_title, 'Task'),
      coalesce(new.completed_at, now())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_task_completion_activity on public.task_completions;
create trigger trg_log_task_completion_activity
after insert on public.task_completions
for each row
execute function public.log_task_completion_activity();

create or replace function public.log_reward_redemption_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_reward_title text;
begin
  select u.family_id, coalesce(r.title, '(deleted reward)')
  into v_family_id, v_reward_title
  from public.users u
  left join public.rewards r on r.id = new.reward_id
  where u.id = new.user_id::text;

  if v_family_id is null then
    return new;
  end if;

  if coalesce(new.is_joint_purchase, false) then
    if new.joint_user1_id is not null and coalesce(new.joint_user1_amount, 0) > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, message, created_at
      )
      values (
        v_family_id,
        new.joint_user1_id,
        'REWARD_PURCHASED',
        coalesce(new.joint_user1_amount, 0),
        v_reward_title,
        coalesce(new.redeemed_at, now())
      );
    end if;

    if new.joint_user2_id is not null and coalesce(new.joint_user2_amount, 0) > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, message, created_at
      )
      values (
        v_family_id,
        new.joint_user2_id,
        'REWARD_PURCHASED',
        coalesce(new.joint_user2_amount, 0),
        v_reward_title,
        coalesce(new.redeemed_at, now())
      );
    end if;
  else
    insert into public.family_activities (
      family_id, user_id, type, amount, message, created_at
    )
    values (
      v_family_id,
      new.user_id,
      'REWARD_PURCHASED',
      coalesce(new.cost_charged, 0),
      v_reward_title,
      coalesce(new.redeemed_at, now())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_reward_redemption_activity on public.reward_redemptions;
create trigger trg_log_reward_redemption_activity
after insert on public.reward_redemptions
for each row
execute function public.log_reward_redemption_activity();

create or replace function public.log_point_transaction_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
  v_receiver_name text;
begin
  select name into v_sender_name
  from public.users
  where id = new.sender_id::text;

  select name into v_receiver_name
  from public.users
  where id = new.receiver_id::text;

  insert into public.family_activities (
    family_id, user_id, type, amount, related_user_name, message, created_at
  )
  values (
    new.family_id,
    new.sender_id,
    'GIFT_SENT',
    coalesce(new.amount, 0),
    v_receiver_name,
    new.message,
    coalesce(new.created_at, now())
  );

  insert into public.family_activities (
    family_id, user_id, type, amount, related_user_name, message, created_at
  )
  values (
    new.family_id,
    new.receiver_id,
    'GIFT_RECEIVED',
    coalesce(new.amount, 0),
    v_sender_name,
    new.message,
    coalesce(new.created_at, now())
  );

  return new;
end;
$$;

drop trigger if exists trg_log_point_transaction_activity on public.point_transactions;
create trigger trg_log_point_transaction_activity
after insert on public.point_transactions
for each row
execute function public.log_point_transaction_activity();
