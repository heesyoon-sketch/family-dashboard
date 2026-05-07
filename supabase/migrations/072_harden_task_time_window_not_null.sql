-- Migration 072: Prevent all-day task windows from reappearing.
--
-- Migration 071 folded existing all-day/afternoon tasks into the combined
-- afternoon-evening window. This follow-up hardens writes so future admin RPCs
-- and inserts cannot create NULL or legacy afternoon windows again.

update public.tasks
set time_window = 'evening'
where time_window is null
   or time_window not in ('morning', 'evening');

alter table public.tasks
  alter column time_window set default 'evening',
  alter column time_window set not null;

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
      base_points = coalesce((p_patch->>'base_points')::int, base_points),
      active = coalesce((p_patch->>'active')::int, active),
      sort_order = coalesce((p_patch->>'sort_order')::int, sort_order),
      time_window = case
        when p_patch ? 'time_window' then
          case when p_patch->>'time_window' = 'morning' then 'morning' else 'evening' end
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

grant execute on function public.admin_update_task(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
