// FamBit progression — Momentum.
//
// Momentum replaces the brittle "streak multiplier" system. It is meant to
// feel like an emotional rhythm: it builds gently as the member shows up,
// decays softly when they don't, and never punishes a missed day with a
// catastrophic reset. There is no "you broke your streak" message — only
// "your spark is fading, come back when you can".
//
// Momentum is computed deterministically from the trailing 14 days of
// completion timestamps. Recent activity weighs more than older activity.
// The output is a single 0..100 score binned into five named states.

const WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

export type MomentumState = 'spark' | 'warm' | 'bright' | 'blazing' | 'overflowing';

export interface MomentumStateMeta {
  state: MomentumState;
  label: string;
  description: string;
  /** Inclusive lower bound of the 0..100 score for this state. */
  minScore: number;
  /** Tiny ambient bonus, in percent (basis points / 100). Capped low so the
   *  loop stays about emotional rhythm, not min/max grinding. */
  bonusPercent: number;
  /** Visual intensity of the aura, 0..1. */
  intensity: number;
}

export const MOMENTUM_STATES: MomentumStateMeta[] = [
  { state: 'spark',        label: 'Spark',       description: 'A quiet beginning. Show up and the flame grows.',           minScore: 0,  bonusPercent: 0,  intensity: 0.20 },
  { state: 'warm',         label: 'Warm',        description: 'Rhythm is forming. The flame holds steady.',                 minScore: 30, bonusPercent: 2,  intensity: 0.40 },
  { state: 'bright',       label: 'Bright',      description: 'Lit and lively — most days are touched by progress.',       minScore: 55, bonusPercent: 5,  intensity: 0.62 },
  { state: 'blazing',      label: 'Blazing',     description: 'Strong, warm momentum carrying you forward.',                minScore: 75, bonusPercent: 8,  intensity: 0.82 },
  { state: 'overflowing',  label: 'Overflowing', description: 'Radiant. The whole house feels the rhythm.',                 minScore: 92, bonusPercent: 12, intensity: 1.00 },
];

export interface MomentumResult {
  /** Score 0..100. */
  score: number;
  state: MomentumState;
  meta: MomentumStateMeta;
  /** Days touched in the trailing window. */
  activeDays: number;
  /** Window length used for computation. */
  windowDays: number;
  /** Bonus applied per completion as a percent of base points. */
  bonusPercent: number;
}

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Decay weight for a day `n` ago. Linear — recent days count fully, older
 *  days fade out gently by the end of the window. */
function recencyWeight(daysAgo: number): number {
  if (daysAgo < 0) return 0;
  if (daysAgo >= WINDOW_DAYS) return 0;
  // The most recent 5 days each contribute 1.0; remaining days fade linearly
  // to ~0.3. This produces a forgiving decay: a quiet weekend doesn't crater
  // the score, but a quiet fortnight does drift you back to Spark.
  if (daysAgo < 5) return 1;
  return Math.max(0, 1 - (daysAgo - 4) / (WINDOW_DAYS - 4));
}

export interface MomentumInput {
  /** All completion timestamps in any order. Only those within the trailing
   *  window contribute. */
  completions: Date[];
  /** Optional reference time (defaults to now). */
  now?: Date;
}

export function calculateMomentum(input: MomentumInput): MomentumResult {
  const now = input.now ?? new Date();
  const today = startOfDay(now);

  // Bucket completion COUNT per day in the trailing window.
  const perDay = new Array<number>(WINDOW_DAYS).fill(0);
  for (const completedAt of input.completions) {
    const ms = startOfDay(completedAt);
    const ago = Math.floor((today - ms) / DAY_MS);
    if (ago < 0 || ago >= WINDOW_DAYS) continue;
    perDay[ago] += 1;
  }

  // Score: weighted touched-days. Each day is normalized — having 1 task is
  // ~80% of the way; piling on more gives diminishing returns. This keeps
  // momentum about *consistency*, not *volume*.
  let weighted = 0;
  let weightTotal = 0;
  let activeDays = 0;
  for (let ago = 0; ago < WINDOW_DAYS; ago++) {
    const w = recencyWeight(ago);
    weightTotal += w;
    if (perDay[ago] === 0) continue;
    activeDays += 1;
    const dayContribution = Math.min(1, 0.8 + 0.2 * Math.tanh(perDay[ago] / 3));
    weighted += w * dayContribution;
  }
  const normalized = weightTotal > 0 ? (weighted / weightTotal) * 100 : 0;
  const score = Math.round(Math.min(100, Math.max(0, normalized)));
  const meta = momentumMetaForScore(score);

  return {
    score,
    state: meta.state,
    meta,
    activeDays,
    windowDays: WINDOW_DAYS,
    bonusPercent: meta.bonusPercent,
  };
}

function momentumMetaForScore(score: number): MomentumStateMeta {
  // Walk highest-bound first so a 100 finds 'overflowing'.
  for (let i = MOMENTUM_STATES.length - 1; i >= 0; i--) {
    if (score >= MOMENTUM_STATES[i].minScore) return MOMENTUM_STATES[i];
  }
  return MOMENTUM_STATES[0];
}

/** Empty-state momentum for users with no history. */
export function emptyMomentum(): MomentumResult {
  return {
    score: 0,
    state: 'spark',
    meta: MOMENTUM_STATES[0],
    activeDays: 0,
    windowDays: WINDOW_DAYS,
    bonusPercent: 0,
  };
}
