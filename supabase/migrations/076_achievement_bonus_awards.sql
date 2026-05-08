-- Achievement bonus points are awarded once per child/achievement.
-- The app also keeps a local Insignia Wall ledger, but this RPC lets the
-- normal level/spendable balance reflect achievement rewards when deployed.

create table if not exists public.achievement_awards (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  achievement_id text not null,
  points_awarded integer not null default 0,
  awarded_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

alter table public.achievement_awards enable row level security;

drop policy if exists "achievement_awards_family_select" on public.achievement_awards;
create policy "achievement_awards_family_select" on public.achievement_awards
  for select to authenticated
  using (
    user_id in (
      select id from public.users
      where family_id = public.get_my_family_id()
    )
  );

create or replace function public.award_achievement_bonus(
  p_user_id text,
  p_achievement_id text,
  p_points integer,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_award_id uuid;
  v_level public.levels%rowtype;
  v_new_total integer;
  v_new_balance integer;
  v_new_level integer;
begin
  if p_points <= 0 then
    raise exception 'points must be positive';
  end if;

  select family_id into v_family_id
  from public.users
  where id = p_user_id
    and family_id = public.get_my_family_id();

  if v_family_id is null then
    raise exception 'not allowed';
  end if;

  insert into public.achievement_awards (user_id, achievement_id, points_awarded)
  values (p_user_id, p_achievement_id, p_points)
  on conflict (user_id, achievement_id) do nothing
  returning id into v_award_id;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  if v_award_id is not null then
    v_new_total := coalesce(v_level.total_points, 0) + p_points;
    v_new_balance := coalesce(v_level.spendable_balance, 0) + p_points;
    v_new_level := public.level_for_points(v_new_total);

    update public.levels
    set total_points = v_new_total,
        spendable_balance = v_new_balance,
        current_level = v_new_level,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_level;

    insert into public.family_activities (
      id,
      family_id,
      user_id,
      type,
      amount,
      message,
      created_at
    )
    values (
      gen_random_uuid(),
      v_family_id,
      p_user_id,
      'SYSTEM_MESSAGE',
      p_points,
      coalesce(p_message, 'Achievement bonus'),
      now()
    );
  end if;

  return jsonb_build_object(
    'userId', v_level.user_id,
    'currentLevel', v_level.current_level,
    'totalPoints', v_level.total_points,
    'spendableBalance', v_level.spendable_balance,
    'updatedAt', v_level.updated_at
  );
end;
$$;

grant execute on function public.award_achievement_bonus(text, text, integer, text) to authenticated;
