// Family-level analytics: cooperative missions, contribution, legacy, and the
// routine-protection status shown on Shield Wall.
//
// Missions are deliberately reward-free: they grant no points, coupons, or
// shields, so there is nothing to farm or double-claim. Each week's mission
// and its rules (participants and their eligible habit slots) are frozen in
// `family_mission_weeks` when the week is first opened, so habit edits made
// later never change an active or finished mission.

import {
  AFTERNOON_START_HOUR,
  addDays,
  diffDays,
  eachDay,
  mondayOf,
  weekdayOf,
  zonedDayHour,
  type AnalyticsCompletion,
  type AnalyticsMember,
  type AnalyticsTask,
  type HabitWindow,
  type MemberHistory,
  type Slot,
} from './history';
import type { Localized } from './insights';
import type { DayOfWeek } from '@/lib/db';

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

export type MissionId = 'all-together' | 'strong-week' | 'comeback-crew' | 'family-harmony';
export const MISSION_ROTATION: MissionId[] = ['all-together', 'strong-week', 'comeback-crew', 'family-harmony'];

/** Thresholds, frozen into each week's rules. */
export const MISSION_RULES = {
  togetherDays: 4,
  strongRate: 0.7,
  comebackPoints: 5,
  comebackMembers: 2,
  harmonyDays: 4,
  /** Previous-week eligible slots a member needs for Comeback Crew. */
  comebackMinEligible: 4,
} as const;

export interface MissionSlotRule {
  taskId: string;
  days: DayOfWeek[];
  window: HabitWindow;
  /** First family day the habit existed (created or first completed), so a
   *  habit is never counted as missed before it existed. */
  since?: string;
}

export interface MissionParticipantRule {
  id: string;
  slots: MissionSlotRule[];
  /** Per-member target where the mission needs one (harmony days). */
  target?: number;
}

export interface MissionRules {
  version: 1;
  participants: MissionParticipantRule[];
  /** Family-level target (together days or improving members). */
  target: number;
  strongRate: number;
  comebackPoints: number;
}

export interface MissionWeekRow {
  family_id: string;
  week_start: string;
  mission_id: MissionId;
  rules: MissionRules;
  status: 'active' | 'completed' | 'missed';
  result: MissionResult | null;
  finalized_at: string | null;
}

export interface MissionParticipantProgress {
  id: string;
  eligible: number;
  completed: number;
  rate: number | null;
  activeDays: number;
  previousRate: number | null;
  /** Did this member meet their part? (null = no part this week, e.g. no
   *  scheduled habits yet or not enough history.) */
  met: boolean | null;
  value: Localized;
}

export interface MissionResult {
  current: number;
  target: number;
  complete: boolean;
  participants: MissionParticipantProgress[];
}

export interface MissionProgress extends MissionResult {
  missionId: MissionId;
  weekStart: string;
  weekEnd: string;
  ended: boolean;
  /** Days left including today. */
  daysLeft: number;
}

/** Monday 1970-01-05 anchors a stable rotation independent of family. */
function weekIndex(weekStart: string): number {
  return Math.floor(diffDays('1970-01-05', weekStart) / 7);
}

function participantSlots(memberId: string, tasks: AnalyticsTask[], firstDoneByTask: Map<string, string>, timezone: string): MissionSlotRule[] {
  return tasks
    .filter(task => task.userId === memberId && task.active && !task.deletedAt && task.daysOfWeek.length > 0)
    .map(task => {
      const created = task.createdAt ? zonedDayHour(new Date(task.createdAt), timezone).day : undefined;
      const firstDone = firstDoneByTask.get(task.id);
      const since = [created, firstDone].filter((d): d is string => Boolean(d)).sort()[0];
      return { taskId: task.id, days: [...task.daysOfWeek], window: task.timeWindow, ...(since ? { since } : {}) };
    });
}

interface SlotTally { eligible: number; completed: number; activeDays: number }

/** Tallies frozen slots over the given days. Today's open windows are left
 *  out until they close, exactly like personal stats. */
function tallyFrozen(
  participant: MissionParticipantRule,
  days: string[],
  completedKeys: Set<string>,
  activeDays: Set<string>,
  today: string,
  nowHour: number,
): SlotTally {
  let eligible = 0;
  let completed = 0;
  let active = 0;
  for (const day of days) {
    if (day > today) continue;
    if (activeDays.has(`${participant.id}|${day}`)) active += 1;
    for (const rule of participant.slots) {
      if (!rule.days.includes(weekdayOf(day)) || (rule.since && day < rule.since)) continue;
      const slots: Slot[] = rule.window === 'both' ? ['morning', 'evening'] : [rule.window];
      for (const slot of slots) {
        const done = completedKeys.has(`${rule.taskId}|${day}|${slot}`);
        if (day === today && !done && (slot === 'evening' || nowHour < AFTERNOON_START_HOUR)) continue;
        eligible += 1;
        if (done) completed += 1;
      }
    }
  }
  return { eligible, completed, activeDays: active };
}

interface CompletionIndex {
  completedKeys: Set<string>;
  activeDays: Set<string>;
  firstDoneByTask: Map<string, string>;
}

function indexCompletions(completions: AnalyticsCompletion[], tasks: AnalyticsTask[], timezone: string, now: Date): CompletionIndex {
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const completedKeys = new Set<string>();
  const activeDays = new Set<string>();
  const firstDoneByTask = new Map<string, string>();
  for (const c of completions) {
    const at = Date.parse(c.completedAt);
    if (!Number.isFinite(at) || at > now.getTime()) continue;
    const { day, hour } = zonedDayHour(new Date(at), timezone);
    activeDays.add(`${c.userId}|${day}`);
    const task = taskById.get(c.taskId);
    const window = task?.timeWindow ?? 'evening';
    const slot: Slot = window === 'both' ? (hour < AFTERNOON_START_HOUR ? 'morning' : 'evening') : window;
    completedKeys.add(`${c.taskId}|${day}|${slot}`);
    const first = firstDoneByTask.get(c.taskId);
    if (!first || day < first) firstDoneByTask.set(c.taskId, day);
  }
  return { completedKeys, activeDays, firstDoneByTask };
}

function scheduledWeekdays(participant: MissionParticipantRule): Set<DayOfWeek> {
  return new Set(participant.slots.flatMap(slot => slot.days));
}

/** Builds the rules for a new week from today's habits. Returns null when a
 *  cooperative mission isn't meaningful (fewer than two members with habits). */
export function planMissionWeek(params: {
  weekStart: string;
  members: AnalyticsMember[];
  tasks: AnalyticsTask[];
  completions: AnalyticsCompletion[];
  now: Date;
  timezone: string;
}): { missionId: MissionId; rules: MissionRules } | null {
  const index = indexCompletions(params.completions, params.tasks, params.timezone, params.now);
  const participants: MissionParticipantRule[] = params.members
    .map(member => ({ id: member.id, slots: participantSlots(member.id, params.tasks, index.firstDoneByTask, params.timezone) }))
    .filter(p => p.slots.length > 0);
  if (participants.length < 2) return null;

  const today = zonedDayHour(params.now, params.timezone).day;
  const previousDays = eachDay(addDays(params.weekStart, -7), addDays(params.weekStart, -1));
  const withHistory = participants.filter(p => tallyFrozen(p, previousDays, index.completedKeys, index.activeDays, today, 23).eligible >= MISSION_RULES.comebackMinEligible).length;

  const weekDays = eachDay(params.weekStart, addDays(params.weekStart, 6));
  const sharedDays = weekDays.filter(day => participants.filter(p => scheduledWeekdays(p).has(weekdayOf(day))).length >= 2).length;

  const rotation = weekIndex(params.weekStart);
  for (let i = 0; i < MISSION_ROTATION.length; i++) {
    const missionId = MISSION_ROTATION[(rotation + i) % MISSION_ROTATION.length];
    if (missionId === 'comeback-crew' && withHistory < MISSION_RULES.comebackMembers) continue;
    if (missionId === 'all-together' && sharedDays === 0) continue;
    const rules: MissionRules = {
      version: 1,
      participants: participants.map(p => missionId === 'family-harmony'
        ? { ...p, target: Math.min(MISSION_RULES.harmonyDays, scheduledWeekdays(p).size) }
        : p),
      target: missionId === 'all-together'
        ? Math.min(MISSION_RULES.togetherDays, sharedDays)
        : missionId === 'comeback-crew'
          ? MISSION_RULES.comebackMembers
          : participants.length,
      strongRate: MISSION_RULES.strongRate,
      comebackPoints: MISSION_RULES.comebackPoints,
    };
    return { missionId, rules };
  }
  return null;
}

export function evaluateMission(params: {
  missionId: MissionId;
  weekStart: string;
  rules: MissionRules;
  tasks: AnalyticsTask[];
  completions: AnalyticsCompletion[];
  now: Date;
  timezone: string;
}): MissionProgress {
  const { missionId, weekStart, rules } = params;
  const { day: today, hour } = zonedDayHour(params.now, params.timezone);
  const weekEnd = addDays(weekStart, 6);
  const ended = today > weekEnd;
  const nowHour = ended ? 23 : hour;
  const index = indexCompletions(params.completions, params.tasks, params.timezone, params.now);
  const weekDays = eachDay(weekStart, weekEnd);
  const prevDays = eachDay(addDays(weekStart, -7), addDays(weekStart, -1));

  const participants: MissionParticipantProgress[] = rules.participants.map(p => {
    const week = tallyFrozen(p, weekDays, index.completedKeys, index.activeDays, today, nowHour);
    const rate = week.eligible > 0 ? week.completed / week.eligible : null;
    const prev = missionId === 'comeback-crew' ? tallyFrozen(p, prevDays, index.completedKeys, index.activeDays, today, 23) : null;
    const previousRate = prev && prev.eligible >= MISSION_RULES.comebackMinEligible ? prev.completed / prev.eligible : null;
    let met: boolean | null = null;
    let value: Localized;
    switch (missionId) {
      case 'strong-week':
        met = rate === null ? null : rate >= rules.strongRate;
        value = rate === null
          ? { en: 'No habits due yet', ko: '아직 해야 할 습관 없음' }
          : { en: `${Math.round(rate * 100)}% of ${Math.round(rules.strongRate * 100)}%`, ko: `${Math.round(rate * 100)}% / 목표 ${Math.round(rules.strongRate * 100)}%` };
        break;
      case 'comeback-crew': {
        const change = rate !== null && previousRate !== null ? Math.round(rate * 100) - Math.round(previousRate * 100) : null;
        met = change === null ? null : change >= rules.comebackPoints;
        value = change === null
          ? { en: 'Not enough data yet', ko: '비교할 기록이 아직 부족해요' }
          : { en: `${change > 0 ? '+' : ''}${change} pts vs last week`, ko: `지난주보다 ${change > 0 ? '+' : ''}${change}%p` };
        break;
      }
      case 'family-harmony': {
        const target = p.target ?? MISSION_RULES.harmonyDays;
        met = week.activeDays >= target;
        value = { en: `${Math.min(week.activeDays, target)} of ${target} active days`, ko: `활동한 날 ${Math.min(week.activeDays, target)}/${target}일` };
        break;
      }
      default: {
        value = { en: `Active ${week.activeDays} day${week.activeDays === 1 ? '' : 's'} this week`, ko: `이번 주 ${week.activeDays}일 참여` };
        met = week.activeDays > 0;
      }
    }
    return { id: p.id, eligible: week.eligible, completed: week.completed, rate, activeDays: week.activeDays, previousRate, met, value };
  });

  // All Together counts days; every other mission counts members.
  const current = missionId === 'all-together'
    ? weekDays.filter(day => {
      if (day > today) return false;
      const scheduled = rules.participants.filter(p => scheduledWeekdays(p).has(weekdayOf(day)));
      return scheduled.length >= 2 && scheduled.every(p => index.activeDays.has(`${p.id}|${day}`));
    }).length
    : participants.filter(p => p.met === true).length;
  // Strong Week is judged on the whole week, so it can only complete once
  // the week ends; the others are monotonic and can complete early.
  const target = missionId === 'strong-week' ? participants.filter(p => p.met !== null).length || rules.target : rules.target;
  const complete = missionId === 'strong-week' ? ended && target > 0 && current >= target : current >= target;
  return {
    missionId,
    weekStart,
    weekEnd,
    ended,
    daysLeft: ended ? 0 : diffDays(today, weekEnd) + 1,
    current: Math.min(current, target),
    target,
    complete,
    participants,
  };
}

export function currentWeekStart(now: Date, timezone: string): string {
  return mondayOf(zonedDayHour(now, timezone).day);
}

export const MISSION_COPY: Record<MissionId, { title: Localized; goal: (target: number, strongRate: number) => Localized }> = {
  'all-together': {
    title: { en: 'All Together', ko: '다 함께' },
    goal: target => ({
      en: `On ${target} days this week, everyone with habits that day completes at least one.`,
      ko: `이번 주 ${target}일 동안, 그날 습관이 있는 가족 모두가 하나 이상 완료해요.`,
    }),
  },
  'strong-week': {
    title: { en: 'Strong Week', ko: '든든한 한 주' },
    goal: (_target, strongRate) => ({
      en: `Every member completes at least ${Math.round(strongRate * 100)}% of their own scheduled habits this week.`,
      ko: `가족 모두가 각자 해야 할 습관의 ${Math.round(strongRate * 100)}% 이상을 완료해요.`,
    }),
  },
  'comeback-crew': {
    title: { en: 'Comeback Crew', ko: '다시 힘내기' },
    goal: target => ({
      en: `At least ${target} members raise their completion rate by 5+ percentage points over last week.`,
      ko: `${target}명 이상이 지난주보다 완료율을 5%p 이상 올려요.`,
    }),
  },
  'family-harmony': {
    title: { en: 'Family Harmony', ko: '함께하는 리듬' },
    goal: () => ({
      en: 'Every member is active on 4 days this week (or every day they have habits, if fewer).',
      ko: '가족 모두가 이번 주 4일 이상 활동해요 (습관이 있는 날이 더 적으면 그날 모두).',
    }),
  },
};

// ---------------------------------------------------------------------------
// Family legacy — milestones derived only from completion records
// ---------------------------------------------------------------------------

export type LegacyKind = 'first-together' | 'together-days' | 'family-total' | 'family-comeback' | 'mission' | 'team-shield';

export interface LegacyEvent {
  id: string;
  day: string;
  kind: LegacyKind;
  text: Localized;
  detail?: Localized;
}

export const TOGETHER_MILESTONES = [7, 30, 100, 200, 365];
export const FAMILY_TOTAL_MILESTONES = [100, 500, 1000, 2500, 5000, 10000];

/** "Together day": every member who has habit history was active. Uses only
 *  completion records, so schedule edits cannot rewrite it. */
export function familyLegacy(histories: MemberHistory[], missionRows: MissionWeekRow[]): LegacyEvent[] {
  const events: LegacyEvent[] = [];
  const withHistory = histories.filter(h => h.completedSlots.length > 0);
  if (withHistory.length === 0) return events;

  const activeByDay = new Map<string, Set<string>>();
  const allSlots: Array<{ day: string; at: string }> = [];
  for (const history of withHistory) {
    for (const slot of history.completedSlots) {
      const set = activeByDay.get(slot.day) ?? new Set<string>();
      set.add(history.memberId);
      activeByDay.set(slot.day, set);
      allSlots.push({ day: slot.day, at: slot.at });
    }
  }
  allSlots.sort((a, b) => a.at.localeCompare(b.at));

  if (withHistory.length >= 2) {
    const togetherDays = [...activeByDay.entries()]
      .filter(([day, set]) => withHistory.every(h => set.has(h.memberId) || (h.firstDay !== null && day < h.firstDay)) && set.size >= 2)
      .map(([day]) => day)
      .sort();
    if (togetherDays[0]) events.push({ id: 'first-together', day: togetherDays[0], kind: 'first-together', text: { en: 'First day everyone showed up', ko: '가족 모두가 함께한 첫날' } });
    for (const n of TOGETHER_MILESTONES) {
      if (togetherDays[n - 1]) events.push({ id: `together-${n}`, day: togetherDays[n - 1], kind: 'together-days', text: { en: `${n} days with everyone active`, ko: `모두가 함께한 날 ${n}일` } });
    }
  }

  for (const n of FAMILY_TOTAL_MILESTONES) {
    const slot = allSlots[n - 1];
    if (slot) events.push({ id: `family-total-${n}`, day: slot.day, kind: 'family-total', text: { en: `${n.toLocaleString('en')} habits completed as a family`, ko: `가족 누적 ${n.toLocaleString('ko')}번 완료` } });
  }

  // A family comeback: activity again after 3+ days with no completions.
  const activeDays = [...activeByDay.keys()].sort();
  for (let i = 1; i < activeDays.length; i++) {
    const gap = diffDays(activeDays[i - 1], activeDays[i]) - 1;
    if (gap >= 3) events.push({ id: `family-comeback-${activeDays[i]}`, day: activeDays[i], kind: 'family-comeback', text: { en: 'The family started again together', ko: '가족이 다시 함께 시작한 날' }, detail: { en: `After a ${gap}-day pause`, ko: `${gap}일 쉬고 다시` } });
  }

  for (const row of missionRows) {
    if (row.status !== 'completed') continue;
    const title = MISSION_COPY[row.mission_id]?.title;
    if (title) events.push({ id: `mission-${row.week_start}`, day: addDays(row.week_start, 6), kind: 'mission', text: { en: `Mission complete: ${title.en}`, ko: `미션 달성: ${title.ko}` } });
  }

  return events.sort((a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Routine protection (existing penalty rules, read-only)
// ---------------------------------------------------------------------------

/** Mirrors the server: morning routines must be finished by 12:00 and
 *  evening routines by 22:00, or 50 spendable points are deducted. Vacation
 *  mode and automatic weekend/holiday sale days skip the deduction. */
export const ROUTINE_DEADLINES = { morning: 12, evening: 22 } as const;
export const ROUTINE_PENALTY_POINTS = 50;

export type ProtectionState = 'vacation' | 'sale-day' | 'secured' | 'open' | 'missed';

export interface RoutineMemberStatus {
  id: string;
  due: number;
  done: number;
}

export interface RoutineDeadlineStatus {
  window: Slot;
  hour: number;
  closed: boolean;
  members: RoutineMemberStatus[];
}

export interface ProtectionStatus {
  state: ProtectionState;
  deadlines: RoutineDeadlineStatus[];
  /** Members with an unfinished routine whose deadline is still ahead. */
  openMembers: number;
  missedToday: number;
}

export function protectionStatus(params: {
  members: Array<{ id: string }>;
  /** Today's scheduled, active habits per member (store.tasksByUser). */
  todayTasksByUser: Record<string, Array<{ id: string; timeWindow?: string }>>;
  todayCompletionsByWindow: Record<string, { morning: string[]; evening: string[] }>;
  nowHour: number;
  vacation: boolean;
  saleDay: boolean;
  penaltiesToday: number;
}): ProtectionStatus {
  const deadlines: RoutineDeadlineStatus[] = (['morning', 'evening'] as const).map(window => ({
    window,
    hour: ROUTINE_DEADLINES[window],
    closed: params.nowHour >= ROUTINE_DEADLINES[window],
    members: params.members.map(member => {
      const tasks = (params.todayTasksByUser[member.id] ?? []).filter(task => {
        const w = task.timeWindow === 'morning' || task.timeWindow === 'both' ? task.timeWindow : 'evening';
        return w === 'both' || w === window;
      });
      const doneIds = new Set(params.todayCompletionsByWindow[member.id]?.[window] ?? []);
      return { id: member.id, due: tasks.length, done: tasks.filter(task => doneIds.has(task.id)).length };
    }).filter(m => m.due > 0),
  }));
  const openMembers = new Set(
    deadlines.filter(d => !d.closed).flatMap(d => d.members.filter(m => m.done < m.due).map(m => m.id)),
  ).size;
  let state: ProtectionState;
  if (params.vacation) state = 'vacation';
  else if (params.saleDay) state = 'sale-day';
  else if (params.penaltiesToday > 0) state = 'missed';
  else if (openMembers > 0) state = 'open';
  else state = 'secured';
  return { state, deadlines, openMembers, missedToday: params.penaltiesToday };
}
