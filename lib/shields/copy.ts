// Localized Hall of Shields copy. Explanations use only the metrics stored
// with an award, so a sentence can always be verified against the record.

import type { HabitCategory } from '@/lib/achievements/definitions';
import { josa } from '@/lib/analytics/insights';
import { RULES, type PeriodType, type ShieldTier, type ShieldType } from './engine';
import type { BonusScope } from './equipment';

export type L = { en: string; ko: string };

export const TYPE_COPY: Record<ShieldType, { name: L; theme: L; how: (type: PeriodType) => L }> = {
  consistency: {
    name: { en: 'Consistency Shield', ko: '꾸준함의 쉴드' },
    theme: { en: 'I showed up and followed through.', ko: '나는 꾸준히 해냈어요.' },
    how: t => ({
      en: `Complete your own scheduled habits. Silver ${RULES[t].consistency.silver}% · Gold ${RULES[t].consistency.gold}% · Epic ${RULES[t].consistency.epic}% · Legendary 100%. Needs at least ${RULES[t].minOccurrences} scheduled habits on ${RULES[t].minDays}+ days.`,
      ko: `내 일정의 습관을 완료해요. 실버 ${RULES[t].consistency.silver}% · 골드 ${RULES[t].consistency.gold}% · 에픽 ${RULES[t].consistency.epic}% · 레전더리 100%. 습관이 ${RULES[t].minDays}일 이상, ${RULES[t].minOccurrences}개 이상 있어야 해요.`,
    }),
  },
  growth: {
    name: { en: 'Growth Shield', ko: '성장의 쉴드' },
    theme: { en: 'I’m better than I was.', ko: '나는 지난번보다 성장했어요.' },
    how: t => ({
      en: `Raise your completion rate over the previous ${t} by ${RULES[t].growth.silver}+ points (Silver) up to ${RULES[t].growth.legendary}+ (Legendary). You need at least 60% now (80% for Legendary), and both ${t}s need enough habits.`,
      ko: `지난${t === 'week' ? '주' : '달'}보다 완료율을 ${RULES[t].growth.silver}%p(실버)부터 ${RULES[t].growth.legendary}%p(레전더리) 이상 올려요. 이번 완료율이 60% 이상(레전더리는 80%)이어야 하고, 두 기간 모두 습관이 충분해야 해요.`,
    }),
  },
  comeback: {
    name: { en: 'Comeback Shield', ko: '재도전의 쉴드' },
    theme: { en: 'I came back stronger.', ko: '나는 다시 일어섰어요.' },
    how: t => ({
      en: `After a ${t} below 70%, come back to 70%+ with a jump of 15+ points (Silver) — up to 95%+ and 35+ points (Legendary). Not awarded two ${t}s in a row.`,
      ko: `70% 아래였던 ${t === 'week' ? '주' : '달'} 다음에 70% 이상으로, 15%p 이상(실버) 회복해요. 95% 이상·35%p 이상이면 레전더리예요. 연달아 받을 수는 없어요.`,
    }),
  },
  teamwork: {
    name: { en: 'Teamwork Shield', ko: '협력의 쉴드' },
    theme: { en: 'We made each other stronger.', ko: '우리는 서로를 더 강하게 했어요.' },
    how: t => (t === 'week'
      ? { en: 'Do your part in a family mission that the family completes. (Weekly: Silver.)', ko: '가족이 달성한 가족 미션에서 내 몫을 해내요. (주간은 실버까지)' }
      : { en: 'Do your part in completed family missions this month: 1 Silver · 2 Gold · 3 of 2+ kinds Epic · every mission (4+, 3 kinds) Legendary.', ko: '이번 달 달성한 가족 미션에서 내 몫을 해내요: 1번 실버 · 2번 골드 · 2종류 이상 3번 에픽 · 4번 이상 모두(3종류) 레전더리.' }),
  },
  dedication: {
    name: { en: 'Dedication Shield', ko: '몰입의 쉴드' },
    theme: { en: 'I committed to something meaningful.', ko: '나는 한 가지에 마음을 다했어요.' },
    how: t => ({
      en: `Complete one kind of habit (like learning or exercise): Silver 75% · Gold 85% · Epic 95% · Legendary 100%, with ${RULES[t].dedication.minOccurrences}+ times on ${RULES[t].dedication.minDays}+ days.`,
      ko: `한 분야의 습관(예: 배움, 운동)을 완료해요: 실버 75% · 골드 85% · 에픽 95% · 레전더리 100%. ${RULES[t].dedication.minDays}일 이상, ${RULES[t].dedication.minOccurrences}번 이상 있어야 해요.`,
    }),
  },
};

export const TIER_COPY: Record<ShieldTier, L> = {
  silver: { en: 'Silver', ko: '실버' },
  gold: { en: 'Gold', ko: '골드' },
  epic: { en: 'Epic', ko: '에픽' },
  legendary: { en: 'Legendary', ko: '레전더리' },
};

export const CATEGORY_COPY: Record<HabitCategory, L> = {
  health: { en: 'Health', ko: '건강' },
  learning: { en: 'Learning', ko: '배움' },
  faith: { en: 'Faith', ko: '신앙' },
  responsibility: { en: 'Responsibility', ko: '책임' },
  exercise: { en: 'Exercise', ko: '운동' },
  school: { en: 'School', ko: '등교 준비' },
  morning: { en: 'Morning Routine', ko: '아침 루틴' },
  evening: { en: 'Evening Routine', ko: '저녁 루틴' },
};

/** "Epic Learning Shield" / "에픽 배움 몰입의 쉴드". */
export function shieldName(type: ShieldType, tier: ShieldTier, category: string | null): L {
  if (type === 'dedication' && category && category in CATEGORY_COPY) {
    const c = CATEGORY_COPY[category as HabitCategory];
    return { en: `${TIER_COPY[tier].en} ${c.en} Shield`, ko: `${TIER_COPY[tier].ko} ${c.ko} 몰입의 쉴드` };
  }
  return { en: `${TIER_COPY[tier].en} ${TYPE_COPY[type].name.en}`, ko: `${TIER_COPY[tier].ko} ${TYPE_COPY[type].name.ko}` };
}

type Metrics = Record<string, unknown>;
const num = (m: Metrics, k: string) => (typeof m[k] === 'number' ? (m[k] as number) : null);
const pct = (v: number | null) => (v === null ? '—' : `${Number.isInteger(v) ? v : v.toFixed(1)}%`);

/** Why it was earned, from stored metrics only. Returns null when the
 *  needed numbers aren't there (never guesses). */
export function explainAward(type: ShieldType, metrics: Metrics, name: string, periodLabel: L): L | null {
  const c = num(metrics, 'currentCompleted'); const e = num(metrics, 'currentEligible');
  const rate = num(metrics, 'currentRate'); const prev = num(metrics, 'previousRate');
  const gain = num(metrics, 'gainPoints'); const base = num(metrics, 'baselineRate');
  switch (type) {
    case 'consistency':
      if (c === null || e === null) return null;
      return { en: `${name} completed ${c} of ${e} scheduled habits (${pct(rate)}) during ${periodLabel.en}.`, ko: `${josa(name, '은', '는')} ${periodLabel.ko} 동안 예정된 습관 ${e}개 중 ${c}개(${pct(rate)})를 완료했어요.` };
    case 'growth':
      if (rate === null || base === null || gain === null) return null;
      return { en: `${name} rose from ${pct(base)} to ${pct(rate)} (+${gain} points) during ${periodLabel.en}.`, ko: `${josa(name, '은', '는')} ${periodLabel.ko}에 완료율을 ${pct(base)}에서 ${pct(rate)}로 올렸어요 (+${gain}%p).` };
    case 'comeback':
      if (rate === null || prev === null || gain === null) return null;
      return { en: `After ${pct(prev)} the period before, ${name} came back to ${pct(rate)} (+${gain} points) during ${periodLabel.en}.`, ko: `직전 기간 ${pct(prev)}였던 ${josa(name, '이', '가')} ${periodLabel.ko}에 ${pct(rate)}로 다시 일어섰어요 (+${gain}%p).` };
    case 'dedication': {
      const cc = num(metrics, 'categoryCompleted'); const ce = num(metrics, 'categoryEligible'); const cr = num(metrics, 'categoryRate'); const cd = num(metrics, 'categoryDays');
      const cat = typeof metrics.category === 'string' && metrics.category in CATEGORY_COPY ? CATEGORY_COPY[metrics.category as HabitCategory] : null;
      if (cc === null || ce === null || !cat) return null;
      return { en: `${name} completed ${cc} of ${ce} ${cat.en.toLowerCase()} habits (${pct(cr)}) on ${cd ?? '—'} days during ${periodLabel.en}.`, ko: `${josa(name, '은', '는')} ${periodLabel.ko} 동안 ${cat.ko} 습관 ${ce}개 중 ${cc}개(${pct(cr)})를 ${cd ?? '—'}일에 걸쳐 완료했어요.` };
    }
    case 'teamwork': {
      const n = num(metrics, 'contributedMissions');
      if (n === null) return null;
      return { en: `${name} did their part in ${n} completed family mission${n === 1 ? '' : 's'} during ${periodLabel.en}.`, ko: `${josa(name, '은', '는')} ${periodLabel.ko} 동안 달성한 가족 미션 ${n}개에서 자기 몫을 해냈어요.` };
    }
  }
}

/** What an equipped Shield boosts. */
export function scopeLabel(scope: BonusScope): L {
  if (scope.kind === 'all') return { en: 'All habits', ko: '모든 습관' };
  if (scope.kind === 'mission') return { en: 'Family Mission habits', ko: '가족 미션 습관' };
  const names = scope.categories.filter(c => c in CATEGORY_COPY).map(c => CATEGORY_COPY[c]);
  return { en: `${names.map(n => n.en).join(', ')} habits`, ko: `${names.map(n => n.ko).join('·')} 습관` };
}
