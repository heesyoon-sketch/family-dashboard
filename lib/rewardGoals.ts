export const REWARD_GOAL_KEY_PREFIX = 'reward_goal:';

export interface RewardGoalSettingRow {
  key: string;
  value: unknown;
}

export function parseRewardGoalId(value: unknown): string | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') return null;
    const rewardId = (parsed as { rewardId?: unknown }).rewardId;
    return typeof rewardId === 'string' && rewardId.length > 0 ? rewardId : null;
  } catch {
    return null;
  }
}

export function parseRewardGoals(
  rows: readonly RewardGoalSettingRow[],
  validUserIds: ReadonlySet<string>,
  validRewardIds: ReadonlySet<string>,
): Record<string, string> {
  const goals: Record<string, string> = {};
  for (const row of rows) {
    if (!row.key.startsWith(REWARD_GOAL_KEY_PREFIX)) continue;
    const userId = row.key.slice(REWARD_GOAL_KEY_PREFIX.length);
    const rewardId = parseRewardGoalId(row.value);
    if (!validUserIds.has(userId) || !rewardId || !validRewardIds.has(rewardId)) continue;
    goals[userId] = rewardId;
  }
  return goals;
}

export function rewardGoalProgress(balance: number, cost: number): {
  remaining: number;
  percent: number;
  reached: boolean;
} {
  const safeBalance = Math.max(0, Math.round(balance) || 0);
  const safeCost = Math.max(0, Math.round(cost) || 0);
  if (safeCost === 0) return { remaining: 0, percent: 100, reached: true };
  const remaining = Math.max(0, safeCost - safeBalance);
  return {
    remaining,
    percent: Math.min(100, Math.round((safeBalance / safeCost) * 100)),
    reached: remaining === 0,
  };
}
