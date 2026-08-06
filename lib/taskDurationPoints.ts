export type TaskDurationTier = 'micro' | 'short' | 'medium' | 'long';

export interface TaskDurationOption {
  tier: TaskDurationTier;
  points: 10 | 15 | 30 | 50;
  label: { en: string; ko: string };
}

export const TASK_DURATION_OPTIONS: readonly TaskDurationOption[] = [
  { tier: 'micro', points: 10, label: { en: '5 min or less', ko: '5분 이하' } },
  { tier: 'short', points: 15, label: { en: '6-10 min', ko: '6~10분' } },
  { tier: 'medium', points: 30, label: { en: '11-20 min', ko: '11~20분' } },
  { tier: 'long', points: 50, label: { en: '21+ min', ko: '21분 이상' } },
] as const;

/** Converts legacy or untrusted point values into the fixed duration economy. */
export function normalizeTaskPoints(value: number): TaskDurationOption['points'] {
  const points = Number.isFinite(value) ? Math.round(value) : 10;
  if (points <= 10) return 10;
  if (points <= 15) return 15;
  if (points <= 30) return 30;
  return 50;
}

export function taskDurationOptionForPoints(value: number): TaskDurationOption {
  const points = normalizeTaskPoints(value);
  return TASK_DURATION_OPTIONS.find(option => option.points === points) ?? TASK_DURATION_OPTIONS[0];
}
