-- Migration 054: Seed role-based starter tasks for new families.
--
-- New families start with four default profiles. The first parent gets
-- dad-style tasks, the second parent gets mom-style tasks, and the two child
-- slots get boy/girl task sets. Existing members with any tasks are left alone.

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
  v_weekend text[] := array['SAT', 'SUN'];
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
    values
      (gen_random_uuid()::text, p_member_id, '🛏️ 아침 이불 개기', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 1, 1, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧘 아침 스트레칭 5분', 'activity', 'EASY', 10, 'daily', v_all_days, 'morning', 1, 2, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🗓️ 오늘 가족 일정 확인', 'calendar-check', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 1, 3, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🍽️ 식사 후 식탁 정리', 'utensils', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 1, 4, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧺 빨래 모아두기', 'washing-machine', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 1, 5, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🗑️ 재활용/분리수거', 'trash-2', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 1, 6, p_family_id),
      (gen_random_uuid()::text, p_member_id, '📚 아이 숙제 10분 봐주기', 'book-open-check', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 1, 7, p_family_id),
      (gen_random_uuid()::text, p_member_id, '💖 가족에게 고마운 말 한마디', 'heart-handshake', 'EASY', 10, 'daily', v_all_days, 'evening', 1, 8, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧹 현관/거실 5분 정리', 'brush-cleaning', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 1, 9, p_family_id),
      (gen_random_uuid()::text, p_member_id, '💪 운동 20분', 'dumbbell', 'MEDIUM', 20, 'weekdays', v_weekdays, null, 1, 10, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧾 이번 주 지출 확인', 'receipt', 'MEDIUM', 20, 'weekend', v_weekend, null, 1, 11, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧑‍🍳 주말 한 끼 같이 준비', 'chef-hat', 'HARD', 30, 'weekend', v_weekend, null, 1, 12, p_family_id);
  elsif v_profile = 'mom' then
    insert into public.tasks (
      id, user_id, title, icon, difficulty, base_points, recurrence,
      days_of_week, time_window, active, sort_order, family_id
    )
    values
      (gen_random_uuid()::text, p_member_id, '🛏️ 아침 이불 정리', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 1, 1, p_family_id),
      (gen_random_uuid()::text, p_member_id, '💧 물 한 컵 마시기', 'glass-water', 'EASY', 10, 'daily', v_all_days, 'morning', 1, 2, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧘 5분 스트레칭', 'activity', 'EASY', 10, 'daily', v_all_days, 'morning', 1, 3, p_family_id),
      (gen_random_uuid()::text, p_member_id, '✅ 오늘 할 일 3개 정하기', 'list-checks', 'EASY', 10, 'weekdays', v_weekdays, 'morning', 1, 4, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🍎 건강한 간식 준비', 'apple', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 1, 5, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🍽️ 식사 후 싱크대 정리', 'utensils', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 1, 6, p_family_id),
      (gen_random_uuid()::text, p_member_id, '👕 빨래 접기', 'shirt', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 1, 7, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧹 세면대 주변 닦기', 'brush-cleaning', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 1, 8, p_family_id),
      (gen_random_uuid()::text, p_member_id, '📖 아이와 책 10분 읽기', 'book-open', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 1, 9, p_family_id),
      (gen_random_uuid()::text, p_member_id, '💖 가족 칭찬 한마디', 'heart-handshake', 'EASY', 10, 'daily', v_all_days, 'evening', 1, 10, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧺 장보기 목록 확인', 'shopping-basket', 'MEDIUM', 20, 'weekend', v_weekend, null, 1, 11, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🌙 잠들기 전 내 시간 10분', 'moon', 'EASY', 10, 'daily', v_all_days, 'evening', 1, 12, p_family_id);
  elsif v_profile = 'girl' then
    insert into public.tasks (
      id, user_id, title, icon, difficulty, base_points, recurrence,
      days_of_week, time_window, active, sort_order, family_id
    )
    values
      (gen_random_uuid()::text, p_member_id, '🛏️ 아침 이불 개기', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 1, 1, p_family_id),
      (gen_random_uuid()::text, p_member_id, '✨ 양치하기', 'sparkles', 'EASY', 10, 'daily', v_all_days, 'morning', 1, 2, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🎒 가방 정리', 'backpack', 'EASY', 10, 'weekdays', v_weekdays, 'evening', 1, 3, p_family_id),
      (gen_random_uuid()::text, p_member_id, '👕 옷 정리하기', 'shirt', 'EASY', 10, 'daily', v_all_days, 'evening', 1, 4, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🍽️ 식사 후 그릇 갖다 놓기', 'utensils', 'EASY', 10, 'daily', v_all_days, 'evening', 1, 5, p_family_id),
      (gen_random_uuid()::text, p_member_id, '📚 숙제 20분 하기', 'book-open', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 1, 6, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🎨 그림/만들기 정리하기', 'palette', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 1, 7, p_family_id),
      (gen_random_uuid()::text, p_member_id, '📦 장난감/인형 제자리', 'package', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 1, 8, p_family_id),
      (gen_random_uuid()::text, p_member_id, '💖 가족 안아주며 칭찬하기', 'heart-handshake', 'HARD', 50, 'daily', v_all_days, null, 1, 9, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧘 마음 진정 5분', 'activity', 'EASY', 10, 'daily', v_all_days, 'evening', 1, 10, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧹 내 방 5분 정리', 'brush-cleaning', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 1, 11, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🌙 잠자리 준비하기', 'moon', 'EASY', 10, 'daily', v_all_days, 'evening', 1, 12, p_family_id);
  else
    insert into public.tasks (
      id, user_id, title, icon, difficulty, base_points, recurrence,
      days_of_week, time_window, active, sort_order, family_id
    )
    values
      (gen_random_uuid()::text, p_member_id, '🛏️ 아침 이불 개기', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 1, 1, p_family_id),
      (gen_random_uuid()::text, p_member_id, '✨ 양치하기', 'sparkles', 'EASY', 10, 'daily', v_all_days, 'morning', 1, 2, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🎒 가방 정리', 'backpack', 'EASY', 10, 'weekdays', v_weekdays, 'evening', 1, 3, p_family_id),
      (gen_random_uuid()::text, p_member_id, '👕 입은 옷 빨래통에 넣기', 'shirt', 'EASY', 10, 'daily', v_all_days, 'evening', 1, 4, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🍽️ 식사 후 그릇 갖다 놓기', 'utensils', 'EASY', 10, 'daily', v_all_days, 'evening', 1, 5, p_family_id),
      (gen_random_uuid()::text, p_member_id, '📚 숙제 20분 하기', 'book-open', 'MEDIUM', 20, 'weekdays', v_weekdays, 'evening', 1, 6, p_family_id),
      (gen_random_uuid()::text, p_member_id, '📖 독서 15분', 'book-open', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 1, 7, p_family_id),
      (gen_random_uuid()::text, p_member_id, '📦 장난감 제자리', 'package', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 1, 8, p_family_id),
      (gen_random_uuid()::text, p_member_id, '💖 가족 안아주며 칭찬하기', 'heart-handshake', 'HARD', 50, 'daily', v_all_days, null, 1, 9, p_family_id),
      (gen_random_uuid()::text, p_member_id, '👣 밖에서 20분 움직이기', 'footprints', 'MEDIUM', 20, 'daily', v_all_days, null, 1, 10, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🧹 내 방 5분 정리', 'brush-cleaning', 'MEDIUM', 15, 'daily', v_all_days, 'evening', 1, 11, p_family_id),
      (gen_random_uuid()::text, p_member_id, '🎮 게임/영상 시간 약속 지키기', 'gamepad-2', 'HARD', 30, 'daily', v_all_days, 'evening', 1, 12, p_family_id);
  end if;
end;
$$;
