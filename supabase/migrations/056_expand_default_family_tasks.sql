-- Migration 056: Expand starter tasks for newly-created families.
--
-- The app only has morning/evening dashboard windows today, so "afternoon"
-- routines are seeded into the evening window where after-school tasks appear.

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
      ('💊 아침에 영양제 먹기', 'pill', 'EASY', 10, 'daily', v_all_days, 'morning', 1),
      ('🙏 말씀읽고 기도하기', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 2),
      ('💪 운동하기', 'dumbbell', 'MEDIUM', 20, 'daily', v_all_days, 'morning', 3),
      ('💧 물 한 컵 마시기', 'glass-water', 'EASY', 10, 'daily', v_all_days, 'morning', 4),
      ('🛏️ 아침 이불 개기', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 5),
      ('🧘 아침 스트레칭 5분', 'person-standing', 'EASY', 10, 'daily', v_all_days, 'morning', 6),
      ('🗓️ 오늘 가족 일정 확인', 'calendar-check', 'EASY', 10, 'daily', v_all_days, 'morning', 7),
      ('✅ 오늘 할 일 3개 정하기', 'list-checks', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 8),
      ('💬 가족에게 좋은 아침 인사하기', 'message-circle', 'EASY', 10, 'daily', v_all_days, 'morning', 9),
      ('🗑️ 쓰레기/분리수거 날짜 확인', 'trash-2', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 10),
      ('🍽️ 아침 식사 뒷정리 돕기', 'utensils', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 11),
      ('🏠 출근/외출 전 현관 정리', 'house', 'EASY', 10, 'daily', v_all_days, 'morning', 12),
      ('🍽️ 식사 후 식탁 정리', 'utensils', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 13),
      ('📚 아이 숙제 10분 봐주기', 'notebook-pen', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 14),
      ('💬 가족 대화 10분', 'message-circle', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 15),
      ('🗓️ 내일 일정/준비물 확인', 'calendar-check', 'EASY', 10, 'daily', v_all_days, 'evening', 16),
      ('🧑‍🍳 주방 마무리 돕기', 'chef-hat', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 17),
      ('🧺 빨래 모아두기', 'washing-machine', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 18),
      ('🗑️ 재활용/분리수거', 'trash-2', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 19),
      ('🧾 가계부/지출 확인', 'receipt', 'MEDIUM', 20, 'daily', v_all_days, 'evening', 20),
      ('🧹 현관/거실 5분 정리', 'spray-can', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 21),
      ('💖 가족 안아주며 칭찬하기', 'heart-handshake', 'HARD', 50, 'daily', v_all_days, 'evening', 22),
      ('🙏 잠들기 전 감사기도', 'book-open', 'EASY', 10, 'daily', v_all_days, 'evening', 23),
      ('🌙 잠들기 전 휴대폰 내려놓기', 'moon', 'EASY', 10, 'daily', v_all_days, 'evening', 24)
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
      ('💊 아침에 영양제 먹기', 'pill', 'EASY', 10, 'daily', v_all_days, 'morning', 1),
      ('🙏 말씀읽고 기도하기', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 2),
      ('💪 운동하기', 'dumbbell', 'MEDIUM', 20, 'daily', v_all_days, 'morning', 3),
      ('💧 물 한 컵 마시기', 'glass-water', 'EASY', 10, 'daily', v_all_days, 'morning', 4),
      ('🛏️ 아침 이불 정리', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 5),
      ('🧘 5분 스트레칭', 'person-standing', 'EASY', 10, 'daily', v_all_days, 'morning', 6),
      ('✅ 오늘 할 일 3개 정하기', 'list-checks', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 7),
      ('🍎 오늘 식단/간식 확인', 'apple', 'EASY', 10, 'daily', v_all_days, 'morning', 8),
      ('🗓️ 오늘 가족 일정 확인', 'calendar-check', 'EASY', 10, 'daily', v_all_days, 'morning', 9),
      ('🎒 아이 등교/등원 준비 체크', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'morning', 10),
      ('🧺 세탁물 한 번 정리', 'washing-machine', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 11),
      ('💬 가족에게 좋은 아침 인사하기', 'message-circle', 'EASY', 10, 'daily', v_all_days, 'morning', 12),
      ('🍽️ 식사 후 싱크대 정리', 'utensils-crossed', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 13),
      ('📖 아이와 책 10분 읽기', 'book-open', 'MEDIUM', 20, 'daily', v_all_days, 'evening', 14),
      ('📚 아이 숙제/알림장 확인', 'notebook-pen', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 15),
      ('👕 내일 입을 옷/가방 확인', 'shirt', 'EASY', 10, 'weekdays', v_weekdays, 'evening', 16),
      ('🧺 장보기 목록 확인', 'shopping-basket', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 17),
      ('👕 빨래 접기', 'shirt', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 18),
      ('🧹 세면대 주변 닦기', 'spray-can', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 19),
      ('💖 가족 칭찬 한마디', 'heart-handshake', 'EASY', 10, 'daily', v_all_days, 'evening', 20),
      ('🧾 가계부/지출 확인', 'receipt', 'MEDIUM', 20, 'daily', v_all_days, 'evening', 21),
      ('🧑‍🍳 내일 식사 준비 체크', 'chef-hat', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 22),
      ('🙏 잠들기 전 감사기도', 'book-open', 'EASY', 10, 'daily', v_all_days, 'evening', 23),
      ('🌙 잠들기 전 내 시간 10분', 'moon', 'EASY', 10, 'daily', v_all_days, 'evening', 24)
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
      ('🛏️ 아침 이불 개기', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 1),
      ('💧 일어나서 물 한 컵 마시기', 'glass-water', 'EASY', 10, 'daily', v_all_days, 'morning', 2),
      ('🙏 말씀읽고 기도하기', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 3),
      ('✨ 양치하기', 'sparkles', 'EASY', 10, 'daily', v_all_days, 'morning', 4),
      ('💦 세수하고 로션 바르기', 'droplets', 'EASY', 10, 'daily', v_all_days, 'morning', 5),
      ('👕 옷 입고 잠옷 정리하기', 'shirt', 'EASY', 10, 'daily', v_all_days, 'morning', 6),
      ('🍽️ 아침밥 감사히 먹기', 'utensils', 'EASY', 10, 'daily', v_all_days, 'morning', 7),
      ('🎒 학교 가방 챙기기', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'morning', 8),
      ('📚 숙제/준비물 마지막 확인', 'notebook-pen', 'MEDIUM', 15, 'weekdays', v_weekdays, 'morning', 9),
      ('📖 오늘 읽을 책 챙기기', 'book-open', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 10),
      ('💬 부모님께 좋은 아침 인사하기', 'message-circle', 'EASY', 10, 'daily', v_all_days, 'morning', 11),
      ('👟 등교 전 신발/외투 정리하기', 'footprints', 'EASY', 10, 'daily', v_all_days, 'morning', 12),
      ('🧼 주중 하교 루틴 (손 씻기 + 가방 정리)', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 13),
      ('📚 숙제 20분 하기', 'notebook-pen', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 14),
      ('🧮 문제집 풀기', 'calculator', 'MEDIUM', 20, 'daily', v_all_days, 'evening', 15),
      ('📖 독서하기', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 16),
      ('✍️ 일기쓰기', 'pen-line', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 17),
      ('🙏 말씀읽고 기도하기', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 18),
      ('🎒 내일 학교 미리 준비하기 (입을 옷, 숙제, 준비물)', 'backpack', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 19),
      ('🍽️ 식사 후 그릇 갖다 놓기', 'utensils', 'EASY', 10, 'daily', v_all_days, 'evening', 20),
      ('🧹 내 방/책상 5분 정리', 'spray-can', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 21),
      ('📦 장난감/소지품 제자리', 'package', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 22),
      ('💖 가족 안아주며 칭찬하기', 'heart-handshake', 'HARD', 50, 'daily', v_all_days, 'evening', 23),
      ('🌙 잠자리 준비하기', 'moon', 'EASY', 10, 'daily', v_all_days, 'evening', 24)
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
      ('🛏️ 아침 이불 개기', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 1),
      ('💧 일어나서 물 한 컵 마시기', 'glass-water', 'EASY', 10, 'daily', v_all_days, 'morning', 2),
      ('🙏 말씀읽고 기도하기', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'morning', 3),
      ('✨ 양치하기', 'sparkles', 'EASY', 10, 'daily', v_all_days, 'morning', 4),
      ('💦 세수하고 로션 바르기', 'droplets', 'EASY', 10, 'daily', v_all_days, 'morning', 5),
      ('👕 옷 입고 잠옷 정리하기', 'shirt', 'EASY', 10, 'daily', v_all_days, 'morning', 6),
      ('🍽️ 아침밥 감사히 먹기', 'utensils', 'EASY', 10, 'daily', v_all_days, 'morning', 7),
      ('🎒 학교 가방 챙기기', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'morning', 8),
      ('📚 숙제/준비물 마지막 확인', 'notebook-pen', 'MEDIUM', 15, 'weekdays', v_weekdays, 'morning', 9),
      ('📖 오늘 읽을 책 챙기기', 'book-open', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 10),
      ('💬 부모님께 좋은 아침 인사하기', 'message-circle', 'EASY', 10, 'daily', v_all_days, 'morning', 11),
      ('👟 등교 전 신발/외투 정리하기', 'footprints', 'EASY', 10, 'daily', v_all_days, 'morning', 12),
      ('🧼 주중 하교 루틴 (손 씻기 + 가방 정리)', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 13),
      ('📚 숙제 20분 하기', 'notebook-pen', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 14),
      ('🧮 문제집 풀기', 'calculator', 'MEDIUM', 20, 'daily', v_all_days, 'evening', 15),
      ('📖 독서하기', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 16),
      ('✍️ 일기쓰기', 'pen-line', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 17),
      ('🙏 말씀읽고 기도하기', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 18),
      ('🎒 내일 학교 미리 준비하기 (입을 옷, 숙제, 준비물)', 'backpack', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 19),
      ('🍽️ 식사 후 그릇 갖다 놓기', 'utensils', 'EASY', 10, 'daily', v_all_days, 'evening', 20),
      ('🧹 내 방/책상 5분 정리', 'spray-can', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 21),
      ('📦 장난감/소지품 제자리', 'package', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 22),
      ('💖 가족 안아주며 칭찬하기', 'heart-handshake', 'HARD', 50, 'daily', v_all_days, 'evening', 23),
      ('🌙 잠자리 준비하기', 'moon', 'EASY', 10, 'daily', v_all_days, 'evening', 24)
    ) as task(title, icon, difficulty, base_points, recurrence, days_of_week, time_window, sort_order);
  end if;
end;
$$;
