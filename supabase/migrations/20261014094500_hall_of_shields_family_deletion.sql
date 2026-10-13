-- Awards and evaluations are permanent against direct edits, but must not
-- block "delete family data" (admin_delete_current_family_data), which
-- removes users and the family and cascades here. A cascade runs inside the
-- foreign-key trigger, so pg_trigger_depth() > 1; a direct DELETE is depth 1.
create or replace function public.shield_awards_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    raise exception 'Shield awards are permanent records';
  end if;
  if coalesce(current_setting('fambit.shield_correction', true), '') <> 'on' then
    raise exception 'Shield awards are immutable; use correct_shield_award';
  end if;
  if new.id <> old.id or new.user_id <> old.user_id or new.family_id <> old.family_id
     or new.period_type <> old.period_type or new.period_start <> old.period_start then
    raise exception 'Award identity cannot change';
  end if;
  return new;
end;
$$;

create or replace function public.shield_evaluations_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'Shield evaluations are write-once audit records';
end;
$$;

-- Cascades may reach evaluations before awards; let them go together.
alter table public.shield_awards drop constraint if exists shield_awards_evaluation_id_fkey;
alter table public.shield_awards
  add constraint shield_awards_evaluation_id_fkey foreign key (evaluation_id)
  references public.shield_evaluations(id) on delete cascade;
