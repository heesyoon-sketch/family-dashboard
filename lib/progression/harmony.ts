// FamBit progression — Family Harmony / Resonance.
//
// Harmony is the cooperative layer. It rewards the family for showing up
// *together* — not in lockstep, but in shared rhythm. It discourages no
// behaviour: an inactive sibling never reduces another's harmony.
//
// Score over the trailing 7 days mixes two ingredients:
//   1. side-by-side days  — days where ≥2 members had any completion (60%)
//   2. participation       — average member completion rate, %-based (40%)
//
// Going %-based for participation keeps it fair across members with
// different numbers of habits: a member who finishes 4 of 4 habits
// contributes 100% to the day, the same as a member who finishes 1 of 1.
// A member who does 1 of 5 contributes 20%, not the same.

const WINDOW_DAYS = 7;

export type HarmonyState = 'quiet' | 'echoing' | 'resonant' | 'radiant';

export interface HarmonyStateMeta {
  state: HarmonyState;
  label: string;
  description: string;
  minScore: number;
  /** Tiny family-wide bonus applied to all members, in percent. */
  bonusPercent: number;
  glow: string;
}

export const HARMONY_STATES: HarmonyStateMeta[] = [
  { state: 'quiet',     label: 'Quiet',     description: 'Each member is finding their own rhythm.',                 minScore: 0,  bonusPercent: 0, glow: '#5b6678' },
  { state: 'echoing',   label: 'Echoing',   description: 'Days are starting to overlap — the family hears itself.', minScore: 35, bonusPercent: 1, glow: '#7adff2' },
  { state: 'resonant',  label: 'Resonant',  description: 'A shared rhythm is forming across most days.',             minScore: 65, bonusPercent: 2, glow: '#a98bff' },
  { state: 'radiant',   label: 'Radiant',   description: 'Side by side, almost every day. The house glows.',         minScore: 88, bonusPercent: 3, glow: '#ffd166' },
];

export interface HarmonyMemberDaily {
  /** Per-day count of tasks completed, index 0 = today, length ≥ 7. */
  done: readonly number[];
  /** Per-day count of tasks scheduled, index 0 = today, length ≥ 7. */
  due: readonly number[];
}

export interface HarmonyInput {
  /** Per-member daily done/due counts. */
  dailyByMember: Record<string, HarmonyMemberDaily>;
  /** Members considered for the harmony score. Pass the whole family
   *  (kids + parents) so cooperation across the whole household counts. */
  memberIds: string[];
}

export interface HarmonyResult {
  score: number;
  state: HarmonyState;
  meta: HarmonyStateMeta;
  /** Number of days in the window where ≥2 members were active. */
  sideBySideDays: number;
  /** Members active in the last 24h. */
  activeTodayMemberIds: string[];
  /** Out of the family, how many are running today. */
  activeTodayCount: number;
  totalMembers: number;
  bonusPercent: number;
}

export function calculateHarmony(input: HarmonyInput): HarmonyResult {
  const totalMembers = Math.max(1, input.memberIds.length);

  let sideBySideDays = 0;
  let participationSum = 0;
  let participationDays = 0;
  let activeTodayCount = 0;
  const activeTodayMemberIds: string[] = [];

  for (let ago = 0; ago < WINDOW_DAYS; ago++) {
    let activeMembers = 0;
    let dayPctSum = 0;
    let dayPctCount = 0;

    for (const id of input.memberIds) {
      const stats = input.dailyByMember[id];
      const due = Math.max(0, stats?.due[ago] ?? 0);
      const done = Math.max(0, stats?.done[ago] ?? 0);
      if (due === 0) continue;
      const pct = Math.min(1, done / due);
      dayPctSum += pct;
      dayPctCount += 1;
      if (done > 0) {
        activeMembers += 1;
        if (ago === 0) activeTodayMemberIds.push(id);
      }
    }

    if (activeMembers >= 2) sideBySideDays += 1;
    if (dayPctCount > 0) {
      participationSum += dayPctSum / dayPctCount;
      participationDays += 1;
    }
    if (ago === 0) activeTodayCount = activeMembers;
  }

  // Score recipe: 60% side-by-side share, 40% participation %.
  const sideByPct = (sideBySideDays / WINDOW_DAYS) * 100;
  const participationPct = participationDays > 0
    ? (participationSum / participationDays) * 100
    : 0;
  const rawScore = sideByPct * 0.6 + participationPct * 0.4;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const meta = harmonyMetaForScore(score);

  return {
    score,
    state: meta.state,
    meta,
    sideBySideDays,
    activeTodayMemberIds,
    activeTodayCount,
    totalMembers,
    bonusPercent: meta.bonusPercent,
  };
}

function harmonyMetaForScore(score: number): HarmonyStateMeta {
  for (let i = HARMONY_STATES.length - 1; i >= 0; i--) {
    if (score >= HARMONY_STATES[i].minScore) return HARMONY_STATES[i];
  }
  return HARMONY_STATES[0];
}

export function emptyHarmony(totalMembers: number): HarmonyResult {
  return {
    score: 0,
    state: 'quiet',
    meta: HARMONY_STATES[0],
    sideBySideDays: 0,
    activeTodayMemberIds: [],
    activeTodayCount: 0,
    totalMembers: Math.max(1, totalMembers),
    bonusPercent: 0,
  };
}
