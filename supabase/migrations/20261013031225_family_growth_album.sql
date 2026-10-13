-- Optional family memories. Existing completion and shield records stay intact.
create table public.growth_memories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  memory_date date not null default current_date,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index growth_memories_family_date_idx on public.growth_memories(family_id, memory_date desc, id);
alter table public.growth_memories enable row level security;
grant select, insert, delete on public.growth_memories to authenticated;
create policy growth_memories_read on public.growth_memories for select to authenticated
  using (public.is_family_member(family_id));
create policy growth_memories_add on public.growth_memories for insert to authenticated
  with check (public.is_family_member(family_id) and author_id = (select auth.uid()));
create policy growth_memories_remove on public.growth_memories for delete to authenticated
  using (public.is_family_member(family_id) and author_id = (select auth.uid()));
notify pgrst, 'reload schema';
