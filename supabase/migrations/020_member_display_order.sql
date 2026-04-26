-- Stable ordering for family members in dashboard and admin views.

alter table public.users
  add column if not exists display_order integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by family_id
      order by created_at asc, id asc
    ) - 1 as next_display_order
  from public.users
)
update public.users u
set display_order = ranked.next_display_order
from ranked
where u.id = ranked.id
  and u.display_order is null;

create index if not exists users_family_display_order_idx
  on public.users (family_id, display_order, created_at);

create or replace function public.set_user_display_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.display_order is null then
    select coalesce(max(display_order), -1) + 1
    into new.display_order
    from public.users
    where family_id = new.family_id;
  end if;

  return new;
end;
$$;

drop trigger if exists set_user_display_order_before_insert on public.users;
create trigger set_user_display_order_before_insert
before insert on public.users
for each row
execute function public.set_user_display_order();
