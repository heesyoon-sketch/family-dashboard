'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'ko' | 'en';

export type TranslationKey =
  | 'new_record'
  | 'store'
  | 'admin_mode'
  | 'confirm'
  | 'enter_parent_pin'
  | 'set_family_names'
  | 'reset_all_progress'
  | 'select_user'
  | 'store_management'
  | 'add_new_reward'
  | 'logout'
  | 'back_to_dashboard'
  | 'loading'
  | 'family_ranking'
  | 'heatmap_30'
  | 'today_summary'
  | 'today_completion_rate'
  | 'highest_streak'
  | 'monthly_task_completion'
  | 'weekly_completions'
  | 'week_vs_last'
  | 'no_tasks_today'
  | 'no_rewards'
  | 'redeem'
  | 'ok'
  | 'new_rewards_unlocked'
  | 'level'
  | 'delete'
  | 'add'
  | 'no_tasks'
  | 'task_name_placeholder'
  | 'reward_name_placeholder'
  | 'icon_select'
  | 'icon_change'
  | 'daily'
  | 'weekdays'
  | 'weekend'
  | 'all_day'
  | 'morning'
  | 'evening'
  | 'afternoon'
  | 'parent_role'
  | 'child_role'
  | 'pin_incorrect'
  | 'task_add_failed'
  | 'reward_add_failed'
  | 'reward_added'
  | 'reward_save_failed'
  | 'reset_confirm'
  | 'reset_success'
  | 'reset_description'
  | 'no_comparison_data'
  | 'no_tasks_stat'
  | 'days_ago_30'
  | 'today'
  | 'this_week_avg'
  | 'last_week_avg'
  | 'exchange_complete'
  | 'exchange_fail'
  | 'user_store_suffix'
  | 'user_tasks_suffix'
  | 'best_day'
  | 'improvement'
  | 'try_harder'
  | 'steady'
  | 'icon_group_hygiene'
  | 'icon_group_store'
  | 'icon_group_health'
  | 'icon_group_study'
  | 'icon_group_chores'
  | 'icon_group_other'
  | 'add_task'
  | 'reset_full'
  | 'no_rewards_registered'
  | 'sound_mute'
  | 'sound_unmute'
  | 'weekdays_all'
  | 'weekends_all'
  | 'min_one_day'
  | 'change_admin_pin'
  | 'current_pin'
  | 'new_pin'
  | 'confirm_new_pin'
  | 'pin_must_be_4_digits'
  | 'pin_mismatch'
  | 'pin_changed'
  | 'pin_change_failed'
  | 'change_pin_btn'
  | 'danger_zone'
  | 'danger_zone_description'
  | 'danger_zone_button'
  | 'danger_zone_deleting'
  | 'danger_zone_confirm'
  | 'danger_zone_delete_failed'
  | 'feedback';

const DICT: Record<Lang, Record<TranslationKey, string>> = {
  ko: {
    new_record: '신기록!',
    store: '상점',
    admin_mode: '관리자 모드',
    confirm: '확인',
    enter_parent_pin: '부모 PIN을 입력하세요',
    set_family_names: '가족 구성원 이름 설정',
    reset_all_progress: '전체 진행 리셋',
    select_user: '사용자 선택',
    store_management: '상점 관리',
    add_new_reward: '새 리워드 추가',
    logout: '로그아웃',
    back_to_dashboard: '대시보드로',
    loading: '불러오는 중…',
    family_ranking: '이번 주 가족 랭킹',
    heatmap_30: '최근 30일 히트맵',
    today_summary: '오늘 요약',
    today_completion_rate: '오늘 완료율',
    highest_streak: '최고 연속',
    monthly_task_completion: '이번 달 task 달성률',
    weekly_completions: '이번 주 완료 수',
    week_vs_last: '이번 주 vs 지난 주',
    no_tasks_today: '오늘 할 일이 없어요',
    no_rewards: '등록된 리워드가 없습니다',
    redeem: '교환',
    ok: '좋아!',
    new_rewards_unlocked: '새로운 보상이 해금되었어요',
    level: '레벨',
    delete: '삭제',
    add: '추가',
    no_tasks: '태스크 없음',
    task_name_placeholder: '태스크 이름',
    reward_name_placeholder: '리워드 이름',
    icon_select: '아이콘 선택',
    icon_change: '아이콘 변경',
    daily: '매일',
    weekdays: '주중만',
    weekend: '주말만',
    all_day: '종일',
    morning: '아침',
    evening: '저녁',
    afternoon: '오후',
    parent_role: '부모',
    child_role: '자녀',
    pin_incorrect: 'PIN이 올바르지 않습니다',
    task_add_failed: '태스크 추가 실패',
    reward_add_failed: '리워드 추가 실패',
    reward_added: '리워드 추가 완료',
    reward_save_failed: '리워드 저장 실패',
    reset_confirm: '모든 진행 기록을 초기화할까요? 되돌릴 수 없습니다.',
    reset_success: '초기화 완료! 대시보드로 이동합니다.',
    reset_description: '포인트·레벨·완료 기록·스트릭을 모두 초기화합니다.',
    no_comparison_data: '아직 비교 데이터가 없어요',
    no_tasks_stat: 'task 없음',
    days_ago_30: '30일 전',
    today: '오늘',
    this_week_avg: '이번 주 평균',
    last_week_avg: '지난 주 평균',
    exchange_complete: '교환 완료!',
    exchange_fail: '교환 실패',
    user_store_suffix: '의 상점',
    user_tasks_suffix: '의 태스크',
    best_day: '역대 최고!',
    improvement: '향상',
    try_harder: '분발해봐요',
    steady: '유지',
    icon_group_hygiene: '생활/위생',
    icon_group_store: '상점/보상',
    icon_group_health: '건강',
    icon_group_study: '학습',
    icon_group_chores: '가정',
    icon_group_other: '기타',
    add_task: '새 태스크 추가',
    reset_full: '전체 리셋',
    no_rewards_registered: '등록된 리워드 없음',
    sound_mute: '소리 끄기',
    sound_unmute: '소리 켜기',
    weekdays_all: '평일 전체',
    weekends_all: '주말 전체',
    min_one_day: '최소 하루 이상 선택해야 합니다',
    change_admin_pin: '관리자 PIN 변경',
    current_pin: '현재 PIN',
    new_pin: '새 PIN',
    confirm_new_pin: '새 PIN 확인',
    pin_must_be_4_digits: 'PIN은 4자리 숫자여야 합니다',
    pin_mismatch: '새 PIN이 일치하지 않습니다',
    pin_changed: 'PIN이 변경되었습니다',
    pin_change_failed: 'PIN 변경에 실패했습니다',
    change_pin_btn: 'PIN 변경',
    danger_zone: '위험 구역',
    danger_zone_description: '가족 구성원, 습관, 보상, 설정 및 진행 기록을 포함한 모든 데이터를 영구적으로 삭제합니다. 이 작업은 Google Play 데이터 삭제 요청 정책을 준수하며, 되돌릴 수 없습니다.',
    danger_zone_button: '가족 데이터 영구 삭제',
    danger_zone_deleting: '삭제 중…',
    danger_zone_confirm: '이 작업은 되돌릴 수 없습니다. 모든 가족 구성원, 습관, 보상 데이터가 영구적으로 삭제됩니다. 정말 삭제하시겠습니까?',
    danger_zone_delete_failed: '가족 데이터 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.',
    feedback: '의견',
  },
  en: {
    new_record: 'New Record!',
    store: 'Store',
    admin_mode: 'Admin Mode',
    confirm: 'Confirm',
    enter_parent_pin: 'Enter Parent PIN',
    set_family_names: 'Set Family Member Names',
    reset_all_progress: 'Reset All Progress',
    select_user: 'Select User',
    store_management: 'Store Management',
    add_new_reward: 'Add New Reward',
    logout: 'Logout',
    back_to_dashboard: 'Back to Dashboard',
    loading: 'Loading...',
    family_ranking: "This Week's Family Ranking",
    heatmap_30: 'Last 30 Days Heatmap',
    today_summary: "Today's Summary",
    today_completion_rate: "Today's Completion Rate",
    highest_streak: 'Highest Streak',
    monthly_task_completion: "This Month's Task Completion",
    weekly_completions: 'Completions This Week',
    week_vs_last: 'This Week vs Last Week',
    no_tasks_today: 'No tasks today',
    no_rewards: 'No rewards registered',
    redeem: 'Redeem',
    ok: 'OK!',
    new_rewards_unlocked: 'New rewards unlocked!',
    level: 'Level',
    delete: 'Delete',
    add: 'Add',
    no_tasks: 'No tasks',
    task_name_placeholder: 'Task name',
    reward_name_placeholder: 'Reward name',
    icon_select: 'Select Icon',
    icon_change: 'Change Icon',
    daily: 'Daily',
    weekdays: 'Weekdays only',
    weekend: 'Weekends only',
    all_day: 'All day',
    morning: 'Morning',
    evening: 'Evening',
    afternoon: 'Afternoon',
    parent_role: 'Parent',
    child_role: 'Child',
    pin_incorrect: 'Incorrect PIN',
    task_add_failed: 'Failed to add task',
    reward_add_failed: 'Failed to add reward',
    reward_added: 'Reward added',
    reward_save_failed: 'Failed to save reward',
    reset_confirm: 'Reset all progress? This cannot be undone.',
    reset_success: 'Reset complete! Returning to dashboard.',
    reset_description: 'Resets all points, levels, completion records, and streaks.',
    no_comparison_data: 'Not enough data to compare yet',
    no_tasks_stat: 'No tasks',
    days_ago_30: '30 days ago',
    today: 'Today',
    this_week_avg: 'This Week Avg',
    last_week_avg: 'Last Week Avg',
    exchange_complete: 'redeemed!',
    exchange_fail: 'Redemption failed',
    user_store_suffix: "'s Store",
    user_tasks_suffix: "'s Tasks",
    best_day: 'All-time Best!',
    improvement: 'improvement',
    try_harder: 'keep it up',
    steady: 'steady',
    icon_group_hygiene: 'Hygiene / Life',
    icon_group_store: 'Store / Rewards',
    icon_group_health: 'Health',
    icon_group_study: 'Study',
    icon_group_chores: 'Chores',
    icon_group_other: 'Other',
    add_task: 'Add New Task',
    reset_full: 'Full Reset',
    no_rewards_registered: 'No rewards added yet',
    sound_mute: 'Mute',
    sound_unmute: 'Unmute',
    weekdays_all: 'All Weekdays',
    weekends_all: 'All Weekends',
    min_one_day: 'Please select at least one day',
    change_admin_pin: 'Change Admin PIN',
    current_pin: 'Current PIN',
    new_pin: 'New PIN',
    confirm_new_pin: 'Confirm New PIN',
    pin_must_be_4_digits: 'PIN must be exactly 4 digits',
    pin_mismatch: 'New PINs do not match',
    pin_changed: 'PIN changed successfully',
    pin_change_failed: 'Failed to change PIN',
    change_pin_btn: 'Change PIN',
    danger_zone: 'Danger Zone',
    danger_zone_description: 'Permanently delete all family data, including members, tasks, rewards, and logs. This satisfies Google Play\'s data deletion requirement and cannot be undone.',
    danger_zone_button: 'Delete All Data',
    danger_zone_deleting: 'Deleting…',
    danger_zone_confirm: 'This cannot be undone. All family members, habits, and reward data will be permanently deleted. Are you sure?',
    danger_zone_delete_failed: 'Failed to delete family data. Please try again.',
    feedback: 'Feedback',
  },
};

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LangContextType>({
  lang: 'ko',
  setLang: () => {},
  t: (key) => DICT.ko[key],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'ko';
    const stored = localStorage.getItem('app_lang');
    return stored === 'en' || stored === 'ko' ? stored : 'ko';
  });

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
    document.documentElement.lang = lang === 'en' ? 'en' : 'ko';
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);
  const t = (key: TranslationKey): string => DICT[lang][key] ?? DICT.ko[key];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
