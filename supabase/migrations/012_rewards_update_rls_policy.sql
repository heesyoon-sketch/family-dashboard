-- Ensure authenticated parent admins can update rewards in their own family.
-- This is required for the admin rewards UI direct update:
--   update public.rewards set cost_points = ... where id = ...

alter table public.rewards enable row level security;

grant select, update on table public.rewards to authenticated;

drop policy if exists "rewards_parent_update" on public.rewards;
create policy "rewards_parent_update"
on public.rewards
for update
to authenticated
using (
  family_id = public.get_my_family_id()
  and public.is_my_family_parent()
)
with check (
  family_id = public.get_my_family_id()
  and public.is_my_family_parent()
);

drop policy if exists "rewards_family_select" on public.rewards;
create policy "rewards_family_select"
on public.rewards
for select
to authenticated
using (
  family_id = public.get_my_family_id()
);
