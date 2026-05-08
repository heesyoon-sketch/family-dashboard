// FamBit progression — Family Harmony / Resonance.
//
// Harmony is the cooperative layer. It rewards the family for showing up
// *together* — not in lockstep, but in shared rhythm. It discourages no
// behaviour: an inactive sibling never reduces another's harmony.
//
// Score is derived from the trailing 7 days of completions across all
// members. We measure:
//   1. side-by-side days  — days where ≥2 members completed at least one habit
//   2. participation       — share of members who touched a habit today
//   3. catch-up moments    — a member coming back after a quiet day while a
//                            sibling was already active

const WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

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

export interface HarmonyInput {
  /** Completion timestamps grouped by member id. */
  completionsByMember: Record<string, Date[]>;
  /** Members considered for the harmony score. Pass the whole family
   *  (kids + parents) so cooperation across the whole household counts. */
  memberIds: string[];
  now?: Date;
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

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function calculateHarmony(input: HarmonyInput): HarmonyResult {
  const now = input.now ?? new Date();
  const today = startOfDay(now);
  const totalMembers = Math.max(1, input.memberIds.length);

  // For each day in the window, which members were active.
  const perDay: Set<string>[] = Array.from({ length: WINDOW_DAYS }, () => new Set<string>());
  for (const memberId of input.memberIds) {
    const dates = input.completionsByMember[memberId] ?? [];
    for (const date of dates) {
      const ms = startOfDay(date);
      const ago = Math.floor((today - ms) / DAY_MS);
      if (ago < 0 || ago >= WINDOW_DAYS) continue;
      perDay[ago].add(memberId);
    }
  }

  let sideBySideDays = 0;
  let participationSum = 0;
  for (const dayMembers of perDay) {
    if (dayMembers.size >= 2) sideBySideDays += 1;
    participationSum += dayMembers.size / totalMembers;
  }

  // Score recipe: 60% from side-by-side share, 40% from average participation.
  const sideByPct = (sideBySideDays / WINDOW_DAYS) * 100;
  const participationPct = (participationSum / WINDOW_DAYS) * 100;
  const rawScore = sideByPct * 0.6 + participationPct * 0.4;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const meta = harmonyMetaForScore(score);

  return {
    score,
    state: meta.state,
    meta,
    sideBySideDays,
    activeTodayMemberIds: Array.from(perDay[0]),
    activeTodayCount: perDay[0].size,
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
