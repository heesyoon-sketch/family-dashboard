// FamBit progression — Momentum.
//
// Momentum replaces the brittle "streak multiplier" system. It is meant to
// feel like an emotional rhythm: it builds gently as the member shows up,
// decays softly when they don't, and never punishes a missed day with a
// catastrophic reset. There is no "you broke your streak" message — only
// "your spark is fading, come back when you can".
//
// The score is the recency-weighted average of *daily completion rate*
// (done / due) over the trailing 14 days. Going %-based instead of
// counting raw completions keeps it fair across members: a kid with two
// habits doing both is at 100% just like a kid with eight habits doing
// all eight. Days with no habits scheduled don't pull the score down.

const WINDOW_DAYS = 14;

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
  { state: 'spark',        label: 'Spark',       description: 'A quiet beginning. Show up and the flame grows.',           minScore: 0,  bonusPercent: 0, intensity: 0.20 },
  { state: 'warm',         label: 'Warm',        description: 'Rhythm is forming. The flame holds steady.',                 minScore: 30, bonusPercent: 1, intensity: 0.40 },
  { state: 'bright',       label: 'Bright',      description: 'Lit and lively — most days are touched by progress.',       minScore: 55, bonusPercent: 2, intensity: 0.62 },
  { state: 'blazing',      label: 'Blazing',     description: 'Strong, warm momentum carrying you forward.',                minScore: 75, bonusPercent: 4, intensity: 0.82 },
  { state: 'overflowing',  label: 'Overflowing', description: 'Radiant. The whole house feels the rhythm.',                 minScore: 92, bonusPercent: 6, intensity: 1.00 },
];

export interface MomentumResult {
  /** Score 0..100. */
  score: number;
  state: MomentumState;
  meta: MomentumStateMeta;
  /** Days touched in the trailing window (≥1 completion). */
  activeDays: number;
  /** Window length used for computation. */
  windowDays: number;
  /** Bonus applied per completion as a percent of base points. */
  bonusPercent: number;
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
  /** Per-day count of tasks completed, index 0 = today, length ≥ 14. */
  dailyDone: readonly number[];
  /** Per-day count of tasks scheduled, index 0 = today, length ≥ 14.
   *  Days where due === 0 are excluded from the score (no nothing to do
   *  shouldn't pull a member down). */
  dailyDue: readonly number[];
}

export function calculateMomentum(input: MomentumInput): MomentumResult {
  let weighted = 0;
  let weightTotal = 0;
  let activeDays = 0;

  for (let ago = 0; ago < WINDOW_DAYS; ago++) {
    const due = Math.max(0, input.dailyDue[ago] ?? 0);
    if (due === 0) continue;
    const done = Math.max(0, input.dailyDone[ago] ?? 0);
    const dayPct = Math.min(1, done / due);
    const w = recencyWeight(ago);
    weightTotal += w;
    weighted += w * dayPct;
    if (done > 0) activeDays += 1;
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
