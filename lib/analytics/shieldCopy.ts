// Korean/English copy and thematic grouping for the existing shield catalog.
// Eligibility rules stay in lib/achievements — this file only translates.

import type { AchievementCategory, AchievementDefinition, HabitCategory } from '@/lib/achievements/definitions';
import type { Localized } from './insights';

export type ShieldTheme = 'milestones' | 'consistency' | 'dedication' | 'comeback' | 'growth' | 'together';
export const SHIELD_THEMES: ShieldTheme[] = ['milestones', 'consistency', 'dedication', 'comeback', 'growth', 'together'];

export const THEME_COPY: Record<ShieldTheme, Localized> = {
  milestones: { en: 'Milestones', ko: '이정표' },
  consistency: { en: 'Consistency', ko: '꾸준함' },
  dedication: { en: 'Dedication', ko: '정성' },
  comeback: { en: 'Comeback', ko: '다시 시작' },
  growth: { en: 'Growth', ko: '성장' },
  together: { en: 'Together', ko: '함께' },
};

const COMEBACK_IDS = new Set(['surprise-comeback', 'weekly-comeback', 'monthly-comeback-3', 'team-comeback']);
const GROWTH_IDS = new Set(['weekly-beat-last', 'monthly-improve', 'monthly-best']);

const THEME_BY_CATEGORY: Record<AchievementCategory, ShieldTheme> = {
  'First Steps': 'milestones',
  'Momentum Trail': 'milestones',
  'Year Journey': 'milestones',
  'Perfect Days': 'consistency',
  'Morning Routine': 'consistency',
  'Evening Routine': 'consistency',
  'School Routine': 'consistency',
  'Health & Hygiene': 'consistency',
  'Weekly Quests': 'growth',
  'Monthly Quests': 'growth',
  'Learning & Reading': 'dedication',
  'Faith & Reflection': 'dedication',
  'Responsibility & Cleanup': 'dedication',
  'Exercise': 'dedication',
  'Combo Shields': 'dedication',
  'Secret Shields': 'dedication',
  'Team Shields': 'together',
};

export function shieldTheme(def: Pick<AchievementDefinition, 'achievementId' | 'category'>): ShieldTheme {
  if (COMEBACK_IDS.has(def.achievementId)) return 'comeback';
  if (GROWTH_IDS.has(def.achievementId)) return 'growth';
  return THEME_BY_CATEGORY[def.category] ?? 'dedication';
}

const KO_TITLES: Record<string, string> = {
  'first-spark': '첫 불꽃', 'little-win': '작은 승리', 'getting-started': '출발!', 'i-tried-today': '오늘도 해냈어',
  'momentum-spark-5': '모멘텀 불꽃', 'momentum-start-15': '힘찬 출발', 'momentum-maker-30': '모멘텀 메이커', 'momentum-hero-50': '50승 히어로',
  'momentum-power-75': '파워 팩', 'momentum-century-100': '세 자리 스타', 'momentum-drive-150': '전설의 질주', 'momentum-goal-225': '목표 달성가',
  'momentum-mythic-325': '신화의 모멘텀', 'momentum-trailblazer-450': '개척자', 'momentum-champion-600': '모멘텀 챔피언', 'momentum-pilot-800': '포인트 파일럿',
  'momentum-crown-1000': '천 번의 왕관',
  'full-house': '풀 하우스', 'morning-hero-perfect': '아침 히어로', 'evening-finisher-perfect': '저녁 마무리 장인', 'clean-sweep': '완벽 정리',
  'weekend-win': '주말 승리', 'perfect-pair': '완벽한 짝꿍', 'perfect-week': '완벽한 한 주', 'bright-sweep': '빛나는 완주', 'rare-perfect-run': '희귀한 완벽 질주',
  'perfect-season-spark': '완벽한 계절',
  'balanced-day': '균형 잡힌 하루', 'mind-and-body': '마음과 몸', 'ready-and-clean': '준비 완료, 깔끔 완료', 'calm-finish': '차분한 마무리', 'big-three': '빅 쓰리',
  'team-spark': '팀 불꽃', 'sibling-power': '남매 파워', 'team-comeback': '팀 컴백', 'family-rhythm': '가족의 리듬', 'double-level-up': '더블 레벨 업',
  'early-bird': '일찍 일어난 새', 'quiet-champion': '조용한 챔피언', 'surprise-comeback': '깜짝 컴백', 'hidden-helper': '숨은 도우미', 'rainbow-day': '무지개 하루',
  'weekly-five-days': '닷새의 한 주', 'weekly-reading-3': '책 읽는 한 주', 'weekly-exercise-2': '에너지 한 주', 'weekly-beat-last': '지난주 넘어서기',
  'weekly-total-20': '스무 번의 한 주', 'weekly-comeback': '이번 주 컴백', 'weekly-three-cats': '세 분야의 하루', 'weekly-team-three': '함께한 사흘',
  'monthly-days-20': '열이틀의 한 달', 'monthly-total-80': '여든 번의 한 달', 'monthly-improve': '더 나은 한 달', 'monthly-learning-20': '배움의 한 달',
  'monthly-health-20': '건강한 한 달', 'monthly-responsibility-15': '도움의 한 달', 'monthly-comeback-3': '다시 서는 한 달', 'monthly-best': '최고의 한 달',
  'monthly-every-week': '매주 반짝',
};

const KO_HABIT_GROUP_NAMES: Record<string, string> = {
  'Reading Rookie': '독서 새싹', 'Book Explorer': '책 탐험가', 'Reading Legend': '독서 전설',
  'Move Maker': '움직임 메이커', 'Strong Body': '튼튼한 몸', 'Energy Champion': '에너지 챔피언',
  'Clean Start': '상쾌한 시작', 'Hygiene Hero': '위생 히어로', 'Toothbrush Master': '양치 마스터',
  'Morning Starter': '아침 스타터', 'Morning Hero': '아침 히어로', 'Sunrise Builder': '해돋이 빌더',
  'Evening Starter': '저녁 스타터', 'Evening Finisher': '저녁 마무리 장인', 'Night Rhythm': '밤의 리듬',
  'Cleanup Captain': '정리 대장', 'Room Rescue': '방 구조대', 'Home Helper': '집안 도우미',
  'School Ready': '등교 준비 완료', 'Backpack Boss': '가방 대장', 'Routine Pro': '루틴 프로',
  'Quiet Heart': '고요한 마음', 'Faithful Light': '신실한 빛', 'Reflection Guide': '묵상 안내자',
  'Diary Starter': '일기 새싹', 'Page Builder': '페이지 빌더', 'Writing Wizard': '글쓰기 마법사',
};

const KO_CATEGORY: Record<HabitCategory, string> = {
  health: '건강·위생', learning: '배움·독서', faith: '신앙·묵상', responsibility: '책임·정리',
  exercise: '운동', school: '등교 준비', morning: '아침 루틴', evening: '저녁 루틴',
};

const KO_DESCRIPTIONS: Record<string, (v: number) => string> = {
  'full-house': v => `해야 할 습관을 모두 완료한 날 ${v}일`,
  'morning-hero-perfect': v => `아침 습관을 모두 완료한 날 ${v}일`,
  'evening-finisher-perfect': v => `저녁 습관을 모두 완료한 날 ${v}일`,
  'clean-sweep': v => `한 분야의 습관을 모두 완료한 날 ${v}일`,
  'weekend-win': v => `주말 습관을 모두 완료한 주말 ${v}일`,
  'early-bird': v => `여러 분야를 함께 실천한 날 ${v}일`,
  'quiet-champion': v => `여러 분야를 함께 실천한 날 ${v}일`,
  'hidden-helper': v => `한 주에 습관 ${v}개 완료하기`,
  'weekly-five-days': v => `이번 주 ${v}일 동안 습관 하나 이상 완료하기`,
  'weekly-reading-3': v => `이번 주 독서 ${v}번`,
  'weekly-exercise-2': v => `이번 주 운동 ${v}번`,
  'weekly-beat-last': () => '지난주보다 더 많이 완료하기',
  'weekly-total-20': v => `이번 주 습관 ${v}개 완료하기`,
  'weekly-comeback': () => '쉬었다가 한 번 다시 시작하기',
  'weekly-three-cats': () => '하루에 세 분야 습관 완료하기',
  'weekly-team-three': v => `이번 주 두 아이가 같은 날 함께 실천한 날 ${v}일`,
  'monthly-days-20': v => `이번 달 서로 다른 ${v}일 동안 실천하기`,
  'monthly-total-80': v => `이번 달 습관 ${v}개 완료하기`,
  'monthly-improve': () => '이전 달보다 더 많이 완료하기',
  'monthly-learning-20': v => `이번 달 배움 습관 ${v}개`,
  'monthly-health-20': v => `이번 달 건강 습관 ${v}개`,
  'monthly-responsibility-15': v => `이번 달 책임·정리 습관 ${v}개`,
  'monthly-comeback-3': v => `쉬었다가 다시 시작하기 ${v}번`,
  'monthly-best': v => `이번 달 루틴 ${v}개 완료하기`,
  'monthly-every-week': v => `이번 달 ${v}일 이상 활동하기`,
};

export function shieldTitle(def: AchievementDefinition): Localized {
  return { en: def.title, ko: KO_TITLES[def.achievementId] ?? KO_HABIT_GROUP_NAMES[def.title] ?? (def.category === 'Year Journey' ? (def.requirementValue === 365 ? '365일의 전설' : `${def.requirementValue}일 빌더`) : def.title) };
}

export function shieldDescription(def: AchievementDefinition): Localized {
  const v = def.requirementValue;
  const special = KO_DESCRIPTIONS[def.achievementId];
  let ko: string;
  if (special) ko = special(v);
  else switch (def.requirementType) {
    case 'totalCompletions': ko = def.category === 'Momentum Trail' ? `루틴을 누적 ${v}번 완료하기` : `습관을 누적 ${v}번 완료하기`; break;
    case 'activeDays': ko = `서로 다른 ${v}일 동안 습관 하나 이상 완료하기`; break;
    case 'categoryActiveDays': ko = `${def.requirementCategory ? KO_CATEGORY[def.requirementCategory] : '이 분야'} 습관을 ${v}일 동안 실천하기`; break;
    case 'perfectDays': ko = `모든 습관을 완료한 날 ${v}일`; break;
    case 'comboDays': ko = def.comboCategories?.length
      ? `${def.comboCategories.map(c => KO_CATEGORY[c]).join(', ')}을(를) 같은 날 완료${v > 1 ? `한 날 ${v}일` : '하기'}`
      : `여러 분야를 함께 실천한 날 ${v}일`; break;
    case 'teamSameDay': ko = `두 아이가 같은 날 습관을 완료한 날 ${v}일`; break;
    case 'comebackCount': ko = `쉬었다가 다시 시작하기 ${v}번`; break;
    default: ko = def.description;
  }
  return { en: def.description, ko };
}

export const RARITY_COPY: Record<string, Localized> = {
  common: { en: 'Common', ko: '일반' },
  rare: { en: 'Rare', ko: '레어' },
  epic: { en: 'Epic', ko: '에픽' },
  legendary: { en: 'Legendary', ko: '전설' },
  mythic: { en: 'Mythic', ko: '신화' },
};
