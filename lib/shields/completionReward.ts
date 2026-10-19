import type { ShieldTier } from './engine';
import { TIERS } from './engine';
import { TIER_COPY } from './copy';

export interface ShieldCredit { points: number; tier: ShieldTier | null }

/** The RPC reports base points and a separate, already committed Shield credit. */
export function completionReward(raw: {
  pointsAwarded: number;
  shieldBonus?: { bonusPoints?: number; tier?: string | null } | null;
}) {
  const points = Math.max(0, Number(raw.shieldBonus?.bonusPoints) || 0);
  const tier = TIERS.find(t => t === raw.shieldBonus?.tier) ?? null;
  return {
    basePoints: raw.pointsAwarded,
    pointsAwarded: raw.pointsAwarded + points,
    shieldBonus: points > 0 ? { points, tier } : null,
  };
}

export function shieldCreditMessage(basePoints: number, credit: ShieldCredit, lang: 'en' | 'ko'): string {
  const tier = credit.tier ? TIER_COPY[credit.tier][lang] : '';
  const shield = lang === 'en' ? `${tier ? `${tier} ` : ''}Shield` : `${tier ? `${tier} ` : ''}쉴드`;
  return lang === 'en'
    ? `${basePoints}pt + ${shield} bonus ${credit.points}pt`
    : `${basePoints}포인트 + ${shield} 추가 포인트 ${credit.points}pt`;
}
