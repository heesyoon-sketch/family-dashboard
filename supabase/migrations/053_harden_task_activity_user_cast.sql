-- Migration 053: Do not let task activity logging break task completion.
--
-- public.users.id and task_completions.user_id are text, while
-- family_activities.user_id is uuid. Current seeded members use UUID-shaped
-- text ids, but older/manual rows can be non-UUID. Activity logging should not
-- abort task completion or undo for those rows.

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

  if v_family_id is not null
     and coalesce(new.points_awarded, 0) > 0
     and new.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
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

create or replace function public.delete_task_completion_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    delete from public.family_activities
    where user_id  = old.user_id::uuid
      and type     = 'TASK_COMPLETED'
      and created_at = old.completed_at
      and amount   = coalesce(old.points_awarded, 0);
  end if;

  return old;
end;
$$;
