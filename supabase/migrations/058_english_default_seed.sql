-- Migration 058: Translate starter habits, store rewards, and welcome
-- messages to English. New families default to English; users who want
-- Korean can switch via Settings.

create or replace function public.ensure_default_tasks_for_member(
  p_member_id text,
  p_family_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.users;
  v_profile text;
  v_all_days text[] := array['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  v_weekdays text[] := array['MON', 'TUE', 'WED', 'THU', 'FRI'];
begin
  select * into v_member
  from public.users
  where id = p_member_id
    and family_id = p_family_id;

  if v_member.id is null then
    return;
  end if;

  if exists (
    select 1
    from public.tasks
    where user_id = p_member_id
      and family_id = p_family_id
  ) then
    return;
  end if;

  v_profile := case
    when v_member.role = 'PARENT'
      and (
        coalesce(v_member.display_order, 0) = 1
        or v_member.theme = 'warm_minimal'
        or lower(v_member.name) in ('mom', 'mother')
        or v_member.name in ('엄마', '어머니')
      )
      then 'mom'
    when v_member.role = 'PARENT'
      then 'dad'
    when v_member.role = 'CHILD'
      and (
        coalesce(v_member.display_order, 0) = 3
        or v_member.theme = 'pastel_cute'
        or lower(v_member.name) in ('girl', 'daughter', 'child 2')
        or v_member.name in ('여자 아이', '딸', '아이2', '여아')
      )
      then 'girl'
    else 'boy'
  end;

  if v_profile = 'dad' then
    insert into public.tasks (
      id, user_id, title, icon, difficulty, base_points, recurrence,
      days_of_week, time_window, active, sort_order, family_id
    )
    select
      gen_random_uuid()::text, p_member_id, task.title, task.icon, task.difficulty,
      task.base_points, task.recurrence, task.days_of_week, task.time_window,
      1, task.sort_order, p_family_id
    from (values
      ('💊 Take morning vitamins', 'pill', 'EASY', 10, 'daily', v_all_days, 'morning', 1),
      ('🙏 Read scripture and pray', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 2),
      ('💪 Workout', 'dumbbell', 'MEDIUM', 20, 'daily', v_all_days, 'morning', 3),
      ('💧 Drink a glass of water', 'glass-water', 'EASY', 10, 'daily', v_all_days, 'morning', 4),
      ('🛏️ Make the bed', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 5),
      ('🧘 5-minute morning stretch', 'person-standing', 'EASY', 10, 'daily', v_all_days, 'morning', 6),
      ('🗓️ Check today''s family schedule', 'calendar-check', 'EASY', 10, 'daily', v_all_days, 'morning', 7),
      ('✅ Pick today''s top 3 to-dos', 'list-checks', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 8),
      ('💬 Greet the family good morning', 'message-circle', 'EASY', 10, 'daily', v_all_days, 'morning', 9),
      ('🗑️ Check trash / recycling day', 'trash-2', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 10),
      ('🍽️ Help clean up after breakfast', 'utensils', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 11),
      ('🏠 Tidy the entryway before heading out', 'house', 'EASY', 10, 'daily', v_all_days, 'morning', 12),
      ('🍽️ Clear the dinner table', 'utensils', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 13),
      ('📚 Help with homework for 10 min', 'notebook-pen', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 14),
      ('💬 10 min of family conversation', 'message-circle', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 15),
      ('🗓️ Review tomorrow''s schedule', 'calendar-check', 'EASY', 10, 'daily', v_all_days, 'evening', 16),
      ('🧑‍🍳 Help wrap up the kitchen', 'chef-hat', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 17),
      ('🧺 Gather the laundry', 'washing-machine', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 18),
      ('🗑️ Take out recycling', 'trash-2', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 19),
      ('🧾 Review budget / spending', 'receipt', 'MEDIUM', 20, 'daily', v_all_days, 'evening', 20),
      ('🧹 5-minute living room tidy-up', 'spray-can', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 21),
      ('💖 Hug the family and give a compliment', 'heart-handshake', 'HARD', 50, 'daily', v_all_days, 'evening', 22),
      ('🙏 Bedtime gratitude prayer', 'book-open', 'EASY', 10, 'daily', v_all_days, 'evening', 23),
      ('🌙 Phone down before bed', 'moon', 'EASY', 10, 'daily', v_all_days, 'evening', 24)
    ) as task(title, icon, difficulty, base_points, recurrence, days_of_week, time_window, sort_order);
  elsif v_profile = 'mom' then
    insert into public.tasks (
      id, user_id, title, icon, difficulty, base_points, recurrence,
      days_of_week, time_window, active, sort_order, family_id
    )
    select
      gen_random_uuid()::text, p_member_id, task.title, task.icon, task.difficulty,
      task.base_points, task.recurrence, task.days_of_week, task.time_window,
      1, task.sort_order, p_family_id
    from (values
      ('💊 Take morning vitamins', 'pill', 'EASY', 10, 'daily', v_all_days, 'morning', 1),
      ('🙏 Read scripture and pray', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 2),
      ('💪 Workout', 'dumbbell', 'MEDIUM', 20, 'daily', v_all_days, 'morning', 3),
      ('💧 Drink a glass of water', 'glass-water', 'EASY', 10, 'daily', v_all_days, 'morning', 4),
      ('🛏️ Make the bed', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 5),
      ('🧘 5-minute stretch', 'person-standing', 'EASY', 10, 'daily', v_all_days, 'morning', 6),
      ('✅ Pick today''s top 3 to-dos', 'list-checks', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 7),
      ('🍎 Plan today''s meals & snacks', 'apple', 'EASY', 10, 'daily', v_all_days, 'morning', 8),
      ('🗓️ Check today''s family schedule', 'calendar-check', 'EASY', 10, 'daily', v_all_days, 'morning', 9),
      ('🎒 Check school / daycare prep', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'morning', 10),
      ('🧺 Quick laundry sort', 'washing-machine', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 11),
      ('💬 Greet the family good morning', 'message-circle', 'EASY', 10, 'daily', v_all_days, 'morning', 12),
      ('🍽️ Tidy the sink after meals', 'utensils-crossed', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 13),
      ('📖 Read with the kids for 10 min', 'book-open', 'MEDIUM', 20, 'daily', v_all_days, 'evening', 14),
      ('📚 Check homework / school notes', 'notebook-pen', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 15),
      ('👕 Lay out tomorrow''s outfit & bag', 'shirt', 'EASY', 10, 'weekdays', v_weekdays, 'evening', 16),
      ('🧺 Review the grocery list', 'shopping-basket', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 17),
      ('👕 Fold the laundry', 'shirt', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 18),
      ('🧹 Wipe down the bathroom sink', 'spray-can', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 19),
      ('💖 Give the family a compliment', 'heart-handshake', 'EASY', 10, 'daily', v_all_days, 'evening', 20),
      ('🧾 Review budget / spending', 'receipt', 'MEDIUM', 20, 'daily', v_all_days, 'evening', 21),
      ('🧑‍🍳 Plan tomorrow''s meals', 'chef-hat', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 22),
      ('🙏 Bedtime gratitude prayer', 'book-open', 'EASY', 10, 'daily', v_all_days, 'evening', 23),
      ('🌙 10 min of me-time before bed', 'moon', 'EASY', 10, 'daily', v_all_days, 'evening', 24)
    ) as task(title, icon, difficulty, base_points, recurrence, days_of_week, time_window, sort_order);
  elsif v_profile = 'girl' then
    insert into public.tasks (
      id, user_id, title, icon, difficulty, base_points, recurrence,
      days_of_week, time_window, active, sort_order, family_id
    )
    select
      gen_random_uuid()::text, p_member_id, task.title, task.icon, task.difficulty,
      task.base_points, task.recurrence, task.days_of_week, task.time_window,
      1, task.sort_order, p_family_id
    from (values
      ('🛏️ Make my bed', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 1),
      ('💧 Drink a glass of water after waking up', 'glass-water', 'EASY', 10, 'daily', v_all_days, 'morning', 2),
      ('🙏 Read scripture and pray', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 3),
      ('✨ Brush my teeth', 'sparkles', 'EASY', 10, 'daily', v_all_days, 'morning', 4),
      ('💦 Wash my face and put on lotion', 'droplets', 'EASY', 10, 'daily', v_all_days, 'morning', 5),
      ('👕 Get dressed and tidy my pajamas', 'shirt', 'EASY', 10, 'daily', v_all_days, 'morning', 6),
      ('🍽️ Eat breakfast with thanks', 'utensils', 'EASY', 10, 'daily', v_all_days, 'morning', 7),
      ('🎒 Pack my school bag', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'morning', 8),
      ('📚 Last check on homework & supplies', 'notebook-pen', 'MEDIUM', 15, 'weekdays', v_weekdays, 'morning', 9),
      ('📖 Grab today''s reading book', 'book-open', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 10),
      ('💬 Say good morning to my parents', 'message-circle', 'EASY', 10, 'daily', v_all_days, 'morning', 11),
      ('👟 Tidy shoes / coat before heading out', 'footprints', 'EASY', 10, 'daily', v_all_days, 'morning', 12),
      ('🧼 After-school routine (wash hands + unpack)', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 13),
      ('📚 20 min of homework', 'notebook-pen', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 14),
      ('🧮 Workbook practice', 'calculator', 'MEDIUM', 20, 'daily', v_all_days, 'evening', 15),
      ('📖 Read for fun', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 16),
      ('✍️ Write in my journal', 'pen-line', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 17),
      ('🙏 Read scripture and pray', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 18),
      ('🎒 Prep tomorrow''s school stuff (clothes, homework, supplies)', 'backpack', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 19),
      ('🍽️ Bring my dishes to the sink', 'utensils', 'EASY', 10, 'daily', v_all_days, 'evening', 20),
      ('🧹 5-minute room / desk tidy-up', 'spray-can', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 21),
      ('📦 Put toys / belongings away', 'package', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 22),
      ('💖 Hug my family and give a compliment', 'heart-handshake', 'HARD', 50, 'daily', v_all_days, 'evening', 23),
      ('🌙 Get ready for bed', 'moon', 'EASY', 10, 'daily', v_all_days, 'evening', 24)
    ) as task(title, icon, difficulty, base_points, recurrence, days_of_week, time_window, sort_order);
  else
    insert into public.tasks (
      id, user_id, title, icon, difficulty, base_points, recurrence,
      days_of_week, time_window, active, sort_order, family_id
    )
    select
      gen_random_uuid()::text, p_member_id, task.title, task.icon, task.difficulty,
      task.base_points, task.recurrence, task.days_of_week, task.time_window,
      1, task.sort_order, p_family_id
    from (values
      ('🛏️ Make my bed', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 1),
      ('💧 Drink a glass of water after waking up', 'glass-water', 'EASY', 10, 'daily', v_all_days, 'morning', 2),
      ('🙏 Read scripture and pray', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 3),
      ('✨ Brush my teeth', 'sparkles', 'EASY', 10, 'daily', v_all_days, 'morning', 4),
      ('💦 Wash my face and put on lotion', 'droplets', 'EASY', 10, 'daily', v_all_days, 'morning', 5),
      ('👕 Get dressed and tidy my pajamas', 'shirt', 'EASY', 10, 'daily', v_all_days, 'morning', 6),
      ('🍽️ Eat breakfast with thanks', 'utensils', 'EASY', 10, 'daily', v_all_days, 'morning', 7),
      ('🎒 Pack my school bag', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'morning', 8),
      ('📚 Last check on homework & supplies', 'notebook-pen', 'MEDIUM', 15, 'weekdays', v_weekdays, 'morning', 9),
      ('📖 Grab today''s reading book', 'book-open', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 10),
      ('💬 Say good morning to my parents', 'message-circle', 'EASY', 10, 'daily', v_all_days, 'morning', 11),
      ('👟 Tidy shoes / coat before heading out', 'footprints', 'EASY', 10, 'daily', v_all_days, 'morning', 12),
      ('🧼 After-school routine (wash hands + unpack)', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 13),
      ('📚 20 min of homework', 'notebook-pen', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 14),
      ('🧮 Workbook practice', 'calculator', 'MEDIUM', 20, 'daily', v_all_days, 'evening', 15),
      ('📖 Read for fun', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 16),
      ('✍️ Write in my journal', 'pen-line', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 17),
      ('🙏 Read scripture and pray', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 18),
      ('🎒 Prep tomorrow''s school stuff (clothes, homework, supplies)', 'backpack', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 19),
      ('🍽️ Bring my dishes to the sink', 'utensils', 'EASY', 10, 'daily', v_all_days, 'evening', 20),
      ('🧹 5-minute room / desk tidy-up', 'spray-can', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 21),
      ('📦 Put toys / belongings away', 'package', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 22),
      ('💖 Hug my family and give a compliment', 'heart-handshake', 'HARD', 50, 'daily', v_all_days, 'evening', 23),
      ('🌙 Get ready for bed', 'moon', 'EASY', 10, 'daily', v_all_days, 'evening', 24)
    ) as task(title, icon, difficulty, base_points, recurrence, days_of_week, time_window, sort_order);
  end if;
end;
$$;

create or replace function public.seed_default_family_data(
  p_family_id         uuid default null,
  p_admin_name        text default null,
  p_admin_avatar_url  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id       uuid := auth.uid();
  v_auth_email    text;
  v_family_id     uuid := p_family_id;
  v_user_count    integer;
  v_reward_count  integer;
  v_admin_name    text := nullif(trim(coalesce(p_admin_name, '')), '');
  v_admin_avatar  text := nullif(trim(coalesce(p_admin_avatar_url, '')), '');
  v_welcome_msg   text := '🎉 Welcome to your FamBit family dashboard!';
  v_gift_msg      text := 'Welcome, kiddo — here''s your first little gift 🎁';
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into v_auth_email
  from auth.users
  where id = v_auth_id;

  if v_family_id is null then
    select id into v_family_id
    from public.families
    where owner_id = v_auth_id
    order by created_at desc
    limit 1;
  end if;

  if v_family_id is null then
    raise exception 'No family found. Pass p_family_id from setup_family() result.';
  end if;

  if not exists (
    select 1
    from public.families
    where id = v_family_id
      and owner_id = v_auth_id
  ) then
    raise exception 'Caller is not the owner of family %', v_family_id;
  end if;

  select count(*) into v_user_count
  from public.users
  where family_id = v_family_id;

  if v_user_count = 0 then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email,
      login_method, display_order, created_at
    ) values
      (gen_random_uuid()::text, coalesce(v_admin_name, 'Dad'), 'PARENT', 'dark_minimal',
       v_family_id, v_auth_id, v_admin_avatar, v_auth_email, 'google', 0, now()),
      (gen_random_uuid()::text, 'Mom',     'PARENT', 'warm_minimal',
       v_family_id, null, null, null, 'device', 1, now()),
      (gen_random_uuid()::text, 'Child 1', 'CHILD',  'robot_neon',
       v_family_id, null, null, null, 'device', 2, now()),
      (gen_random_uuid()::text, 'Child 2', 'CHILD',  'pastel_cute',
       v_family_id, null, null, null, 'device', 3, now());
  elsif not exists (
    select 1
    from public.users
    where family_id = v_family_id
      and auth_user_id = v_auth_id
  ) then
    update public.users
    set auth_user_id = v_auth_id,
        role         = 'PARENT',
        email        = coalesce(email, v_auth_email),
        avatar_url   = coalesce(v_admin_avatar, avatar_url),
        login_method = 'google'
    where id = (
      select id
      from public.users
      where family_id = v_family_id
      order by case when role = 'PARENT' then 0 else 1 end, display_order, created_at asc
      limit 1
    );
  else
    update public.users
    set role         = 'PARENT',
        email        = coalesce(email, v_auth_email),
        avatar_url   = coalesce(v_admin_avatar, avatar_url),
        login_method = 'google'
    where family_id = v_family_id
      and auth_user_id = v_auth_id;
  end if;

  if not exists (
    select 1 from public.users
    where family_id = v_family_id
      and (name = 'Mom' or (role = 'PARENT' and display_order = 1))
  ) then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email,
      login_method, display_order, created_at
    ) values (
      gen_random_uuid()::text, 'Mom', 'PARENT', 'warm_minimal',
      v_family_id, null, null, null, 'device', 1, now()
    );
  end if;

  if not exists (
    select 1 from public.users
    where family_id = v_family_id
      and (name = 'Child 1' or (role = 'CHILD' and display_order = 2))
  ) then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email,
      login_method, display_order, created_at
    ) values (
      gen_random_uuid()::text, 'Child 1', 'CHILD', 'robot_neon',
      v_family_id, null, null, null, 'device', 2, now()
    );
  end if;

  if not exists (
    select 1 from public.users
    where family_id = v_family_id
      and (name = 'Child 2' or (role = 'CHILD' and display_order = 3))
  ) then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email,
      login_method, display_order, created_at
    ) values (
      gen_random_uuid()::text, 'Child 2', 'CHILD', 'pastel_cute',
      v_family_id, null, null, null, 'device', 3, now()
    );
  end if;

  perform public.ensure_default_tasks_for_family(v_family_id);

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  select u.id, 1, 100, 100, now()
  from public.users u
  where u.family_id = v_family_id
  on conflict (user_id) do nothing;

  select count(*) into v_reward_count
  from public.rewards
  where family_id = v_family_id;

  if v_reward_count = 0 then
    insert into public.rewards (
      id, title, icon, cost_points, family_id,
      sale_enabled, sale_percentage, sale_price, sale_name
    )
    values
      (gen_random_uuid(), '🍬 Pick today''s little snack', 'candy', 80, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🥤 Pick a favorite drink', 'cup-soda', 120, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🍪 One cookie or dessert', 'cookie', 180, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '📖 One extra bedtime book', 'book-open', 220, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎵 Play 3 favorite songs', 'music', 250, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎮 20 min of screen time / games', 'gamepad-2', 300, v_family_id, true, 17, 250, 'Welcome week sale'),
      (gen_random_uuid(), '🍿 Family movie snack pick', 'popcorn', 400, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🧩 20 min of board games / puzzles', 'puzzle', 450, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎨 30 min of crafts / drawing', 'palette', 500, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🚲 30 min of bike / playground time', 'bike', 650, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🍦 Ice cream / café date', 'ice-cream', 800, v_family_id, true, 19, 650, 'Special this week'),
      (gen_random_uuid(), '🍕 Suggest tonight''s dinner', 'pizza', 1000, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎬 Pick the family movie night', 'clapperboard', 1200, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🛍️ Small stationery / sticker buy', 'shopping-bag', 1500, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🧁 Bake a dessert together', 'cake-slice', 1800, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '📚 Pick out a new book', 'book-open', 2400, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🗺️ Suggest a weekend day trip', 'map', 3000, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎁 Small toy / collectible buy', 'gift', 3800, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '👑 YESaturday (yes-day for the whole day)', 'crown', 5000, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎟️ Pick a special family event', 'ticket', 6500, v_family_id, false, 0, null, null);
  end if;

  insert into public.family_activities (
    family_id, user_id, type, amount, message, created_at
  )
  select
    v_family_id,
    u.id::uuid,
    'SYSTEM_MESSAGE',
    100,
    v_welcome_msg,
    now()
  from public.users u
  where u.family_id = v_family_id
    and u.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and not exists (
      select 1
      from public.family_activities a
      where a.family_id = v_family_id
        and a.user_id = u.id::uuid
        and a.type = 'SYSTEM_MESSAGE'
        and a.message = v_welcome_msg
    );

  insert into public.family_activities (
    family_id, user_id, type, amount, related_user_name, message, created_at
  )
  select
    v_family_id,
    child_one.id::uuid,
    'GIFT_RECEIVED',
    10,
    mom.name,
    v_gift_msg,
    now() + interval '1 second'
  from public.users mom
  join public.users child_one on child_one.family_id = v_family_id
  where mom.family_id = v_family_id
    and mom.name = 'Mom'
    and child_one.name = 'Child 1'
    and mom.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and child_one.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and not exists (
      select 1
      from public.family_activities a
      where a.family_id = v_family_id
        and a.user_id = child_one.id::uuid
        and a.type = 'GIFT_RECEIVED'
        and a.message = v_gift_msg
    )
  limit 1;

  insert into public.family_activities (
    family_id, user_id, type, amount, related_user_name, message, created_at
  )
  select
    v_family_id,
    mom.id::uuid,
    'GIFT_SENT',
    10,
    child_one.name,
    v_gift_msg,
    now() + interval '1 second'
  from public.users mom
  join public.users child_one on child_one.family_id = v_family_id
  where mom.family_id = v_family_id
    and mom.name = 'Mom'
    and child_one.name = 'Child 1'
    and mom.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and child_one.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and not exists (
      select 1
      from public.family_activities a
      where a.family_id = v_family_id
        and a.user_id = mom.id::uuid
        and a.type = 'GIFT_SENT'
        and a.message = v_gift_msg
    )
  limit 1;
end;
$$;

grant execute on function public.seed_default_family_data(uuid, text, text) to authenticated;
