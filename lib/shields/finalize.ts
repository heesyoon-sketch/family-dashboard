// Shields — server-side weekly finalization.
//
// Runs with the service role (cron route only). For every family it:
//   1. opens this week's Family Mission and finalizes ended mission weeks,
//   2. calls finalize_due_shield_weeks, which evaluates every ended week that
//      has no evaluation yet (Morning / Evening / Bonus Shields, computed in
//      Postgres from schedule snapshots) and equips last week's Shields for
//      the current week. It is idempotent: a repeat run writes nothing.
//
// Nothing before the first snapshot is ever evaluated, so no historical
// award is fabricated from reconstructed schedules.

import type { SupabaseClient } from '@supabase/supabase-js';
import { evaluateMission, planMissionWeek, type MissionWeekRow } from '@/lib/analytics/family';
import type { AnalyticsCompletion, AnalyticsMember, AnalyticsTask } from '@/lib/analytics/history';
import { legacyRecurrenceToDays, type DayOfWeek } from '@/lib/db';
import { normalizeTimeWindow } from '@/lib/timeWindows';
import { normalizeTaskType } from '@/lib/taskType';
import { addDays, periodContaining, zonedDayHour } from './engine';

const PAGE = 1000;

async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return all;
  }
}

export interface FamilyRunReport {
  familyId: string;
  timezone?: string;
  skipped?: string;
  missionsOpened: number;
  missionsFinalized: number;
  evaluated: number;
  awarded: number;
  autoEquipped: number;
  errors: string[];
}

function mapTask(row: Record<string, unknown>): AnalyticsTask {
  const days = Array.isArray(row.days_of_week) && row.days_of_week.length ? row.days_of_week as DayOfWeek[] : legacyRecurrenceToDays(String(row.recurrence ?? 'daily'));
  return {
    id: String(row.id), userId: String(row.user_id), title: String(row.title ?? ''), icon: String(row.icon ?? ''),
    daysOfWeek: days, timeWindow: normalizeTimeWindow(row.time_window as string | null), taskType: normalizeTaskType(row.task_type), active: Number(row.active ?? 1) === 1,
    createdAt: (row.created_at as string | null) ?? null, deletedAt: (row.deleted_at as string | null) ?? null, streakCount: Number(row.streak_count ?? 0),
  };
}

async function maintainMissions(db: SupabaseClient, familyId: string, timezone: string, members: AnalyticsMember[], now: Date, report: FamilyRunReport) {
  const today = zonedDayHour(now, timezone).day;
  const weekStart = periodContaining('week', today).start;
  const { data: rows, error } = await db.from('family_mission_weeks').select('family_id,week_start,mission_id,rules,status,result,finalized_at').eq('family_id', familyId);
  if (error) throw new Error(`missions: ${error.message}`);
  const missions = (rows ?? []) as MissionWeekRow[];
  const open = missions.filter(row => row.status === 'active' && row.week_start < weekStart);
  const needsPlan = !missions.some(row => row.week_start === weekStart);
  if (!open.length && !needsPlan) return;

  const memberIds = members.map(m => m.id);
  const since = addDays(open.map(r => r.week_start).sort()[0] ?? weekStart, -14);
  const [taskRows, completionRows] = await Promise.all([
    readAll<Record<string, unknown>>((f, t) => db.from('tasks').select('id,user_id,title,icon,days_of_week,recurrence,time_window,task_type,active,created_at,deleted_at,streak_count').eq('family_id', familyId).order('id').range(f, t)),
    readAll<{ id: string; user_id: string; task_id: string; completed_at: string; partial: boolean | null }>((f, t) => db.from('task_completions').select('id,user_id,task_id,completed_at,partial').in('user_id', memberIds).gte('completed_at', `${since}T00:00:00Z`).order('id').range(f, t)),
  ]);
  const tasks = taskRows.map(mapTask).filter(task => memberIds.includes(task.userId));
  const completions: AnalyticsCompletion[] = completionRows.map(c => ({ id: c.id, userId: c.user_id, taskId: c.task_id, completedAt: c.completed_at, partial: c.partial === true }));

  for (const row of open) {
    const progress = evaluateMission({ missionId: row.mission_id, weekStart: row.week_start, rules: row.rules, tasks, completions, now, timezone });
    const { error: updateError } = await db.from('family_mission_weeks')
      .update({ status: progress.complete ? 'completed' : 'missed', result: { current: progress.current, target: progress.target, complete: progress.complete, participants: progress.participants }, finalized_at: now.toISOString() })
      .eq('family_id', familyId).eq('week_start', row.week_start).eq('status', 'active');
    if (updateError) report.errors.push(`mission ${row.week_start}: ${updateError.message}`);
    else report.missionsFinalized += 1;
  }
  if (needsPlan) {
    const plan = planMissionWeek({ weekStart, members, tasks, completions, now, timezone });
    if (plan) {
      const { error: insertError } = await db.from('family_mission_weeks').upsert(
        { family_id: familyId, week_start: weekStart, mission_id: plan.missionId, rules: plan.rules, status: 'active' },
        { onConflict: 'family_id,week_start', ignoreDuplicates: true },
      );
      if (insertError) report.errors.push(`mission plan: ${insertError.message}`);
      else report.missionsOpened += 1;
    }
  }
}

export async function finalizeFamily(db: SupabaseClient, familyId: string, now: Date): Promise<FamilyRunReport> {
  const report: FamilyRunReport = { familyId, missionsOpened: 0, missionsFinalized: 0, evaluated: 0, awarded: 0, autoEquipped: 0, errors: [] };
  const { data: tz, error: tzError } = await db.rpc('shield_family_timezone', { p_family_id: familyId });
  if (tzError) throw new Error(`timezone: ${tzError.message}`);
  const timezone = String(tz);
  report.timezone = timezone;

  const { data: userRows, error: usersError } = await db.from('users').select('id,name,role,created_at').eq('family_id', familyId).is('deleted_at', null);
  if (usersError) throw new Error(`users: ${usersError.message}`);
  const members: AnalyticsMember[] = (userRows ?? []).map(u => ({ id: u.id, name: u.name, role: u.role, createdAt: u.created_at }));
  if (!members.length) { report.skipped = 'no_members'; return report; }

  try { await maintainMissions(db, familyId, timezone, members, now, report); }
  catch (err) { report.errors.push(err instanceof Error ? err.message : String(err)); }

  try {
    const { data, error } = await db.rpc('finalize_due_shield_weeks', { p_family_id: familyId });
    if (error) throw new Error(error.message);
    for (const week of (data as { weeks?: Array<{ evaluated: number; awarded: number; equipped: number }> } | null)?.weeks ?? []) {
      report.evaluated += week.evaluated;
      report.awarded += week.awarded;
      report.autoEquipped += week.equipped;
    }
  } catch (err) { report.errors.push(`weekly shields: ${err instanceof Error ? err.message : String(err)}`); }
  return report;
}

export async function runShieldFinalization(db: SupabaseClient, now = new Date()): Promise<FamilyRunReport[]> {
  const { data: families, error } = await db.from('families').select('id');
  if (error) throw new Error(`families: ${error.message}`);
  // Tidy last week's open equipment rows. Bonuses never depend on this:
  // the database only applies Shields whose equipment week is the current one.
  const closed = await db.rpc('close_expired_shield_equipment');
  if (closed.error) console.error('[shields cron] close expired equipment failed', closed.error.message);
  const reports: FamilyRunReport[] = [];
  for (const family of families ?? []) {
    try {
      reports.push(await finalizeFamily(db, family.id, now));
    } catch (err) {
      reports.push({ familyId: family.id, missionsOpened: 0, missionsFinalized: 0, evaluated: 0, awarded: 0, autoEquipped: 0, errors: [err instanceof Error ? err.message : String(err)] });
    }
  }
  return reports;
}
