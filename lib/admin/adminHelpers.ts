import type { DayOfWeek, Difficulty, Reward, Task } from '@/lib/db';
import { legacyRecurrenceToDays } from '@/lib/db';
import { normalizeTimeWindow } from '@/lib/timeWindows';
import type { Lang } from '@/contexts/LanguageContext';

export const DAY_LABELS = {
  ko: { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' },
  en: { MON: 'M', TUE: 'T', WED: 'W', THU: 'T', FRI: 'F', SAT: 'S', SUN: 'S' },
} as const satisfies Record<'ko' | 'en', Record<DayOfWeek, string>>;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'not_found';

export interface RewardRedemption {
  id: string;
  user_id: string;
  user_name: string;
  reward_id: string;
  reward_title: string;
  reward_icon: string;
  cost_charged: number;
  redeemed_at: string;
  processed_at?: string | null;
  processed_by?: string | null;
  processed_by_name?: string | null;
  refunded_at?: string | null;
  refunded_by?: string | null;
  refund_reason?: string | null;
  is_joint_purchase: boolean;
  joint_user1_id?: string | null;
  joint_user1_name?: string | null;
  joint_user1_amount: number;
  joint_user2_id?: string | null;
  joint_user2_name?: string | null;
  joint_user2_amount: number;
  /** True when this row is a cash trade (096) rather than a reward redemption. */
  is_cash_trade?: boolean;
}

export function normaliseSalePercentage(value: unknown): number {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function mapReward(row: Record<string, unknown>): Reward {
  const saleName = typeof row.sale_name === 'string' && row.sale_name.trim()
    ? row.sale_name.trim()
    : undefined;
  const salePrice = Number(row.sale_price);
  return {
    id: row.id as string,
    title: (row.title ?? row.name ?? '') as string,
    cost_points: Number(row.cost_points ?? 0),
    icon: (row.icon ?? 'gift') as string,
    sale_enabled: Boolean(row.sale_enabled),
    sale_percentage: normaliseSalePercentage(row.sale_percentage),
    sale_price: row.sale_price == null || !Number.isFinite(salePrice) ? undefined : Math.max(0, Math.round(salePrice)),
    sale_name: saleName,
    is_hidden: Boolean(row.is_hidden),
    is_sold_out: Boolean(row.is_sold_out),
  };
}

export function mapRewardRedemption(row: Record<string, unknown>): RewardRedemption {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    user_name: (row.user_name ?? '') as string,
    reward_id: row.reward_id as string,
    reward_title: (row.reward_title ?? '') as string,
    reward_icon: (row.reward_icon ?? 'gift') as string,
    cost_charged: Number(row.cost_charged ?? 0),
    redeemed_at: row.redeemed_at as string,
    processed_at: (row.processed_at as string | null) ?? null,
    processed_by: (row.processed_by as string | null) ?? null,
    processed_by_name: (row.processed_by_name as string | null) ?? null,
    refunded_at: (row.refunded_at as string | null) ?? null,
    refunded_by: (row.refunded_by as string | null) ?? null,
    refund_reason: (row.refund_reason as string | null) ?? null,
    is_joint_purchase: Boolean(row.is_joint_purchase),
    joint_user1_id: (row.joint_user1_id as string | null) ?? null,
    joint_user1_name: (row.joint_user1_name as string | null) ?? null,
    joint_user1_amount: Number(row.joint_user1_amount ?? 0),
    joint_user2_id: (row.joint_user2_id as string | null) ?? null,
    joint_user2_name: (row.joint_user2_name as string | null) ?? null,
    joint_user2_amount: Number(row.joint_user2_amount ?? 0),
    is_cash_trade: Boolean(row.is_cash_trade),
  };
}

export type RewardRedemptionStatus = 'pending' | 'processed' | 'refunded';

export function rewardRedemptionStatus(redemption: RewardRedemption): RewardRedemptionStatus {
  if (redemption.refunded_at) return 'refunded';
  if (redemption.processed_at) return 'processed';
  return 'pending';
}

export function buildRefundPrompt(redemption: RewardRedemption, lang: Lang): string {
  if (redemption.is_joint_purchase) {
    const u1 = redemption.joint_user1_name ?? '?';
    const u2 = redemption.joint_user2_name ?? '?';
    const a1 = redemption.joint_user1_amount;
    const a2 = redemption.joint_user2_amount;
    if (lang === 'en') {
      return [
        `Refund the shared purchase of "${redemption.reward_title}"?`,
        '',
        `${u1} will be refunded ${a1}pt.`,
        `${u2} will be refunded ${a2}pt.`,
      ].join('\n');
    }
    return [
      `"${redemption.reward_title}" 같이 결제 구매를 환불할까요?`,
      '',
      `${u1}님에게 ${a1}pt가 다시 지급됩니다.`,
      `${u2}님에게 ${a2}pt가 다시 지급됩니다.`,
    ].join('\n');
  }
  if (lang === 'en') {
    return `Refund ${redemption.user_name}'s "${redemption.reward_title}" purchase?\n\n${redemption.cost_charged}pt will be returned.`;
  }
  return `${redemption.user_name}의 "${redemption.reward_title}" 구매를 환불할까요?\n\n${redemption.cost_charged}pt가 다시 지급됩니다.`;
}

export function formatShortDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function withAvatarCache(url: string | undefined, version: number): string | undefined {
  if (!url) return undefined;
  return `${url}${url.includes('?') ? '&' : '?'}v=${version}`;
}

export function mapTask(r: Record<string, unknown>): Task {
  const rawDays = r.days_of_week as DayOfWeek[] | null | undefined;
  return {
    id: r.id as string,
    userId: r.user_id as string,
    code: (r.code as string | null) ?? undefined,
    title: r.title as string,
    icon: r.icon as string,
    difficulty: r.difficulty as Difficulty,
    basePoints: r.base_points as number,
    recurrence: r.recurrence as string,
    daysOfWeek: (rawDays && rawDays.length > 0) ? rawDays : legacyRecurrenceToDays(r.recurrence as string),
    timeWindow: normalizeTimeWindow(r.time_window as string | null | undefined),
    active: r.active as number,
    sortOrder: r.sort_order as number,
    streakCount: (r.streak_count as number | null) ?? 0,
    lastCompletedAt: r.last_completed_at ? new Date(r.last_completed_at as string) : null,
  };
}
