-- ============================================================
-- EMERGENCY RECOVERY: Restore 윤준서(Junseo) and 윤지우(Jiwoo)
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

do $$
declare
  v_family_id   uuid;
  v_junseo_id   text;
  v_jiwoo_id    text;
  v_junseo_exists boolean;
  v_jiwoo_exists  boolean;
  v_next_order  integer;
begin

  -- ── 1. Find 희식's family (heesyoon@gmail.com) ──────────────
  select f.id into v_family_id
  from public.families f
  join auth.users au on au.id = f.owner_id
  where au.email = 'heesyoon@gmail.com'
  limit 1;

  if v_family_id is null then
    raise exception '희식 계정의 family를 찾을 수 없습니다. 이메일을 확인하세요.';
  end if;

  raise notice 'Family ID: %', v_family_id;

  -- ── 2. Check if they already exist ──────────────────────────
  select exists(
    select 1 from public.users
    where family_id = v_family_id and name = '윤준서'
  ) into v_junseo_exists;

  select exists(
    select 1 from public.users
    where family_id = v_family_id and name = '윤지우'
  ) into v_jiwoo_exists;

  raise notice '윤준서 exists: %, 윤지우 exists: %', v_junseo_exists, v_jiwoo_exists;

  -- ── 3. Get next display_order ────────────────────────────────
  select coalesce(max(display_order), -1) + 1 into v_next_order
  from public.users where family_id = v_family_id;

  -- ── 4. Recreate 윤준서 (Junseo) if missing ──────────────────
  if not v_junseo_exists then
    v_junseo_id := gen_random_uuid()::text;

    insert into public.users (id, name, role, theme, family_id, auth_user_id, avatar_url, login_method, display_order, created_at)
    values (v_junseo_id, '윤준서', 'CHILD', 'robot_neon', v_family_id, null, null, 'device', v_next_order, now());

    -- Level 3 (total_points=1500 puts them at level 3 per level_for_points())
    insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
    values (v_junseo_id, 3, 1500, 0, now());

    -- Copy task structure from another CHILD in the same family, or use defaults
    insert into public.tasks (id, user_id, title, icon, difficulty, base_points, recurrence, days_of_week, active, sort_order, family_id)
    select
      gen_random_uuid()::text,
      v_junseo_id,
      t.title, t.icon, t.difficulty, t.base_points, t.recurrence, t.days_of_week, t.active, t.sort_order, v_family_id
    from public.tasks t
    join public.users u on u.id = t.user_id
    where u.family_id = v_family_id
      and u.role = 'CHILD'
      and u.id != v_junseo_id
    limit 20;

    -- If no other child to copy from, insert defaults
    if not exists (select 1 from public.tasks where user_id = v_junseo_id) then
      insert into public.tasks (id, user_id, title, icon, difficulty, base_points, recurrence, days_of_week, active, sort_order, family_id)
      values
        (gen_random_uuid()::text, v_junseo_id, '양치하기',  'sparkles',  'EASY',   10, 'daily', null, 1, 1, v_family_id),
        (gen_random_uuid()::text, v_junseo_id, '독서 30분', 'book-open', 'MEDIUM', 20, 'daily', null, 1, 2, v_family_id),
        (gen_random_uuid()::text, v_junseo_id, '운동하기',  'dumbbell',  'HARD',   30, 'daily', null, 1, 3, v_family_id);
    end if;

    v_next_order := v_next_order + 1;
    raise notice '윤준서 복구 완료 (id: %)', v_junseo_id;
  else
    raise notice '윤준서는 이미 존재합니다 — 건너뜀';
  end if;

  -- ── 5. Recreate 윤지우 (Jiwoo) if missing ───────────────────
  if not v_jiwoo_exists then
    v_jiwoo_id := gen_random_uuid()::text;

    insert into public.users (id, name, role, theme, family_id, auth_user_id, avatar_url, login_method, display_order, created_at)
    values (v_jiwoo_id, '윤지우', 'CHILD', 'pastel_cute', v_family_id, null, null, 'device', v_next_order, now());

    insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
    values (v_jiwoo_id, 3, 1500, 0, now());

    insert into public.tasks (id, user_id, title, icon, difficulty, base_points, recurrence, days_of_week, active, sort_order, family_id)
    select
      gen_random_uuid()::text,
      v_jiwoo_id,
      t.title, t.icon, t.difficulty, t.base_points, t.recurrence, t.days_of_week, t.active, t.sort_order, v_family_id
    from public.tasks t
    join public.users u on u.id = t.user_id
    where u.family_id = v_family_id
      and u.role = 'CHILD'
      and u.id != v_jiwoo_id
    limit 20;

    if not exists (select 1 from public.tasks where user_id = v_jiwoo_id) then
      insert into public.tasks (id, user_id, title, icon, difficulty, base_points, recurrence, days_of_week, active, sort_order, family_id)
      values
        (gen_random_uuid()::text, v_jiwoo_id, '양치하기',  'sparkles',  'EASY',   10, 'daily', null, 1, 1, v_family_id),
        (gen_random_uuid()::text, v_jiwoo_id, '독서 30분', 'book-open', 'MEDIUM', 20, 'daily', null, 1, 2, v_family_id),
        (gen_random_uuid()::text, v_jiwoo_id, '운동하기',  'dumbbell',  'HARD',   30, 'daily', null, 1, 3, v_family_id);
    end if;

    raise notice '윤지우 복구 완료 (id: %)', v_jiwoo_id;
  else
    raise notice '윤지우는 이미 존재합니다 — 건너뜀';
  end if;

  raise notice '복구 완료!';
end;
$$;

-- Verify result
select id, name, role, theme, display_order, created_at
from public.users u
join public.families f on f.id = u.family_id
join auth.users au on au.id = f.owner_id
where au.email = 'heesyoon@gmail.com'
order by u.display_order, u.created_at;
