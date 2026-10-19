// Localized Shield copy. Explanations use only the metrics stored with an
// award, so a sentence can always be verified against the record.

import { josa } from '@/lib/analytics/insights';
import type { ShieldTier, ShieldType } from './engine';
import { WEEKLY_RULES, type BonusScope } from './weekly';

export type L = { en: string; ko: string };

const W = WEEKLY_RULES.window;
const B = WEEKLY_RULES.bonus;

export const TYPE_COPY: Record<ShieldType, { name: L; theme: L; how: L }> = {
  morning: {
    name: { en: 'Morning Shield', ko: '아침 쉴드' },
    theme: { en: 'I start my day strong.', ko: '나는 하루를 힘차게 시작해요.' },
    how: {
      en: `Finish your required morning routine. Bronze ${W.bronze}% (no bonus) · Silver ${W.silver}% · Gold ${W.gold}% · Epic ${W.epic}% · Legendary 100%. Boosts next week’s morning routine.`,
      ko: `필수 아침 루틴을 해내요. 브론즈 ${W.bronze}%(보너스 없음) · 실버 ${W.silver}% · 골드 ${W.gold}% · 에픽 ${W.epic}% · 레전더리 100%. 다음 주 아침 루틴 포인트가 올라가요.`,
    },
  },
  evening: {
    name: { en: 'Evening Shield', ko: '저녁 쉴드' },
    theme: { en: 'I finish my day well.', ko: '나는 하루를 잘 마무리해요.' },
    how: {
      en: `Finish your required afternoon/evening routine. Bronze ${W.bronze}% (no bonus) · Silver ${W.silver}% · Gold ${W.gold}% · Epic ${W.epic}% · Legendary 100%. Boosts next week’s evening routine.`,
      ko: `필수 오후·저녁 루틴을 해내요. 브론즈 ${W.bronze}%(보너스 없음) · 실버 ${W.silver}% · 골드 ${W.gold}% · 에픽 ${W.epic}% · 레전더리 100%. 다음 주 저녁 루틴 포인트가 올라가요.`,
    },
  },
  bonus: {
    name: { en: 'Bonus Shield', ko: '보너스 쉴드' },
    theme: { en: 'I do a little extra.', ko: '나는 조금 더 해내요.' },
    how: {
      en: `Do at least one bonus task on ${B.bronze}+ day (Bronze, no bonus), ${B.silver} days (Silver), ${B.gold} (Gold), ${B.epic} (Epic) or all ${B.legendary} (Legendary) — Silver and up need at least ${B.minRequiredRate}% of your required routine done. Boosts next week’s bonus tasks.`,
      ko: `보너스 과제를 ${B.bronze}일 이상(브론즈, 보너스 없음) · ${B.silver}일(실버) · ${B.gold}일(골드) · ${B.epic}일(에픽) · ${B.legendary}일 모두(레전더리) 해요. 실버부터는 필수 루틴을 ${B.minRequiredRate}% 이상 해야 해요. 다음 주 보너스 과제 포인트가 올라가요.`,
    },
  },
};

export const TIER_COPY: Record<ShieldTier, L> = {
  bronze: { en: 'Bronze', ko: '브론즈' },
  silver: { en: 'Silver', ko: '실버' },
  gold: { en: 'Gold', ko: '골드' },
  epic: { en: 'Epic', ko: '에픽' },
  legendary: { en: 'Legendary', ko: '레전더리' },
};

/** "Gold Morning Shield" / "골드 아침 쉴드". */
export function shieldName(type: ShieldType, tier: ShieldTier): L {
  return { en: `${TIER_COPY[tier].en} ${TYPE_COPY[type].name.en}`, ko: `${TIER_COPY[tier].ko} ${TYPE_COPY[type].name.ko}` };
}

type Metrics = Record<string, unknown>;
const num = (m: Metrics, k: string) => (typeof m[k] === 'number' ? (m[k] as number) : null);
const pct = (v: number | null) => (v === null ? '—' : `${Number.isInteger(v) ? v : v.toFixed(1)}%`);

/** Why it was earned, from stored metrics only; null when they're missing. */
export function explainAward(type: ShieldType, metrics: Metrics, name: string, periodLabel: L): L | null {
  if (type === 'bonus') {
    const d = num(metrics, 'bonusDays');
    if (d === null) return null;
    return {
      en: `${name} did bonus tasks on ${d} days during ${periodLabel.en}, with ${pct(num(metrics, 'requiredRate'))} of the required routine done.`,
      ko: `${josa(name, '은', '는')} ${periodLabel.ko} 동안 ${d}일 보너스 과제를 했고, 필수 루틴은 ${pct(num(metrics, 'requiredRate'))} 해냈어요.`,
    };
  }
  const c = num(metrics, 'completed'); const e = num(metrics, 'eligible');
  if (c === null || e === null) return null;
  const routine = type === 'morning' ? { en: 'morning', ko: '아침' } : { en: 'evening', ko: '저녁' };
  return {
    en: `${name} completed ${c} of ${e} required ${routine.en} routines (${pct(num(metrics, 'rate'))}) during ${periodLabel.en}.`,
    ko: `${josa(name, '은', '는')} ${periodLabel.ko} 동안 필수 ${routine.ko} 루틴 ${e}개 중 ${c}개(${pct(num(metrics, 'rate'))})를 해냈어요.`,
  };
}

/** What an equipped Shield boosts. */
export function scopeLabel(scope: BonusScope): L {
  if (scope.kind === 'bonus') return { en: 'Bonus tasks', ko: '보너스 과제' };
  return scope.window === 'morning'
    ? { en: 'Morning routine', ko: '아침 루틴' }
    : { en: 'Evening routine', ko: '저녁 루틴' };
}
