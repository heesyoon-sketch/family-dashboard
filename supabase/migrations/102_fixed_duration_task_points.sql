-- Migration 102: Replace arbitrary task prices with four duration-based tiers.
-- Historical completion awards remain unchanged; only future completions use
-- the normalized 10 / 15 / 30 / 50 point schedule.

create or replace function public.normalize_task_base_points(p_points integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_points, 10) <= 10 then 10
    when p_points <= 15 then 15
    when p_points <= 30 then 30
    else 50
  end;
$$;

update public.tasks
set base_points = public.normalize_task_base_points(base_points)
where base_points not in (10, 15, 30, 50);

alter table public.tasks
  drop constraint if exists tasks_base_points_duration_tier_check;

alter table public.tasks
  add constraint tasks_base_points_duration_tier_check
  check (base_points in (10, 15, 30, 50));

create or replace function public.admin_insert_task(
  p_user_id text,
  p_title text,
  p_icon text,
  p_difficulty text,
  p_base_points int,
  p_recurrence text,
  p_days_of_week text[],
  p_active int,
  p_sort_order int
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_task public.tasks;
begin
  if not exists (select 1 from public.users where id = p_user_id and family_id = v_family_id) then
    raise exception 'User is not in your family';
  end if;

  insert into public.tasks (
    id, user_id, title, icon, difficulty, base_points, recurrence,
    days_of_week, active, sort_order, family_id
  )
  values (
    gen_random_uuid()::text, p_user_id, trim(p_title), p_icon, p_difficulty,
    public.normalize_task_base_points(p_base_points), p_recurrence,
    p_days_of_week, p_active, p_sort_order, v_family_id
  )
  returning * into v_task;

  return v_task;
end;
$$;

create or replace function public.admin_update_task(p_task_id text, p_patch jsonb)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_task public.tasks;
begin
  update public.tasks
  set title = coalesce(p_patch->>'title', title),
      icon = coalesce(p_patch->>'icon', icon),
      base_points = case
        when p_patch ? 'base_points'
          then public.normalize_task_base_points((p_patch->>'base_points')::int)
        else base_points
      end,
      active = coalesce((p_patch->>'active')::int, active),
      sort_order = coalesce((p_patch->>'sort_order')::int, sort_order),
      time_window = case
        when p_patch ? 'time_window' then
          case
            when p_patch->>'time_window' in ('morning', 'evening', 'both') then p_patch->>'time_window'
            else 'evening'
          end
        else time_window
      end,
      days_of_week = case
        when p_patch ? 'days_of_week' then array(select jsonb_array_elements_text(p_patch->'days_of_week'))
        else days_of_week
      end
  where id = p_task_id
    and family_id = v_family_id
  returning * into v_task;

  return v_task;
end;
$$;

revoke all on function public.normalize_task_base_points(integer) from public, anon, authenticated;
grant execute on function public.admin_insert_task(text, text, text, text, int, text, text[], int, int) to authenticated;
grant execute on function public.admin_update_task(text, jsonb) to authenticated;
