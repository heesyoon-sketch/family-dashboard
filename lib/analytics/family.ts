// Family-level analytics: the routine-protection status shown on the
// Growth page. (Weekly family missions were retired on 2026-10-19: they gave
// no reward and duplicated the Growth page.)

import { mondayOf, zonedDayHour, type Slot } from './history';
import { isOptionalTask, type TaskType } from '@/lib/taskType';

export function currentWeekStart(now: Date, timezone: string): string {
  return mondayOf(zonedDayHour(now, timezone).day);
}

// ---------------------------------------------------------------------------
// Routine protection (existing penalty rules, read-only)
// ---------------------------------------------------------------------------

/** Mirrors the server: morning routines must be finished by 12:00 and
 *  evening routines by 22:00, or 50 spendable points are deducted. Vacation
 *  mode and automatic weekend/holiday sale days skip the deduction. */
export const ROUTINE_DEADLINES = { morning: 12, evening: 22 } as const;
export const ROUTINE_PENALTY_POINTS = 50;

export type ProtectionState = 'penalty-off' | 'vacation' | 'sale-day' | 'secured' | 'open' | 'missed';

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
  todayTasksByUser: Record<string, Array<{ id: string; timeWindow?: string; taskType?: TaskType }>>;
  todayCompletionsByWindow: Record<string, { morning: string[]; evening: string[] }>;
  nowHour: number;
  /** Family switch for the routine deadline penalty; defaults to on. */
  penaltyEnabled?: boolean;
  vacation: boolean;
  saleDay: boolean;
  penaltiesToday: number;
}): ProtectionStatus {
  const deadlines: RoutineDeadlineStatus[] = (['morning', 'evening'] as const).map(window => ({
    window,
    hour: ROUTINE_DEADLINES[window],
    closed: params.nowHour >= ROUTINE_DEADLINES[window],
    members: params.members.map(member => {
      // Bonus tasks have no deadline, so they never leave a routine "open".
      const tasks = (params.todayTasksByUser[member.id] ?? []).filter(task => {
        if (isOptionalTask(task)) return false;
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
  if (params.penaltyEnabled === false) state = 'penalty-off';
  else if (params.vacation) state = 'vacation';
  else if (params.saleDay) state = 'sale-day';
  else if (params.penaltiesToday > 0) state = 'missed';
  else if (openMembers > 0) state = 'open';
  else state = 'secured';
  return { state, deadlines, openMembers, missedToday: params.penaltiesToday };
}
