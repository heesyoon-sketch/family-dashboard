// Shield Wall — server-side monthly finalization.
//
// Runs with the service role (cron route only). For every family it:
//   1. opens this week's Family Mission and finalizes ended mission weeks,
//   2. finds completed months that start on or after the family's first
//      schedule snapshot and have no evaluation yet,
//   3. evaluates them in chronological order; every qualifying Shield type
//      becomes a monthly award, written atomically with the evaluation via
//      finalize_shield_month (idempotent: a repeat run writes nothing),
//   4. equips the best combination for the current month for members who
//      have not chosen a loadout yet (never overrides a manual choice).
//
// Nothing before the first snapshot is ever evaluated, so no historical
// award is fabricated from reconstructed schedules.

import type { SupabaseClient } from '@supabase/supabase-js';
import { evaluateMission, planMissionWeek, type MissionWeekRow } from '@/lib/analytics/family';
import type { AnalyticsCompletion, AnalyticsMember, AnalyticsTask } from '@/lib/analytics/history';
import { legacyRecurrenceToDays, type DayOfWeek } from '@/lib/db';
import { normalizeTimeWindow } from '@/lib/timeWindows';
import {
  EVALUATION_VERSION,
  addDays,
  completedSlotKeys,
  evaluatePeriod,
  nextPeriod,
  periodContaining,
  previousPeriod,
  tallyPeriod,
  zonedDayHour,
  type DailySchedule,
  type MissionWeekResult,
  type PastAward,
  type Period,
  type PeriodType,
  type ShieldCompletion,
  type ShieldTier,
  type ShieldType,
} from './engine';
import { EQUIP_VERSION, autoEquip, monthlyAwards, type BonusScope } from './equipment';

const PAGE = 1000;
const MAX_MONTHS = 6;

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

/** Periods of `type` that start on/after `firstDay` and ended before `today`. */
export function finalizablePeriods(type: PeriodType, firstDay: string, today: string, limit: number): Period[] {
  let p = periodContaining(type, firstDay);
  if (p.start < firstDay) p = nextPeriod(p);
  const out: Period[] = [];
  while (p.end < today) { out.push(p); p = nextPeriod(p); }
  return out.slice(-limit);
}

function mapTask(row: Record<string, unknown>): AnalyticsTask {
  const days = Array.isArray(row.days_of_week) && row.days_of_week.length ? row.days_of_week as DayOfWeek[] : legacyRecurrenceToDays(String(row.recurrence ?? 'daily'));
  return {
    id: String(row.id), userId: String(row.user_id), title: String(row.title ?? ''), icon: String(row.icon ?? ''),
    daysOfWeek: days, timeWindow: normalizeTimeWindow(row.time_window as string | null), active: Number(row.active ?? 1) === 1,
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
    readAll<Record<string, unknown>>((f, t) => db.from('tasks').select('id,user_id,title,icon,days_of_week,recurrence,time_window,active,created_at,deleted_at,streak_count').eq('family_id', familyId).order('id').range(f, t)),
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
  const today = zonedDayHour(now, timezone).day;

  const { data: userRows, error: usersError } = await db.from('users').select('id,name,role,created_at').eq('family_id', familyId).is('deleted_at', null);
  if (usersError) throw new Error(`users: ${usersError.message}`);
  const members: AnalyticsMember[] = (userRows ?? []).map(u => ({ id: u.id, name: u.name, role: u.role, createdAt: u.created_at }));
  if (!members.length) { report.skipped = 'no_members'; return report; }

  try { await maintainMissions(db, familyId, timezone, members, now, report); }
  catch (err) { report.errors.push(err instanceof Error ? err.message : String(err)); }

  try { await evaluateMonths(db, familyId, timezone, today, members, report); }
  catch (err) { report.errors.push(err instanceof Error ? err.message : String(err)); }

  try { await equipDefaults(db, familyId, today, members, report); }
  catch (err) { report.errors.push(`auto-equip: ${err instanceof Error ? err.message : String(err)}`); }
  return report;
}

async function evaluateMonths(db: SupabaseClient, familyId: string, timezone: string, today: string, members: AnalyticsMember[], report: FamilyRunReport) {
  const { data: first, error: firstError } = await db.from('shield_daily_schedules').select('day').eq('family_id', familyId).order('day').limit(1);
  if (firstError) throw new Error(`snapshots: ${firstError.message}`);
  const firstDay = first?.[0]?.day as string | undefined;
  if (!firstDay) { report.skipped = 'no_snapshots_yet'; return; }

  const periods = finalizablePeriods('month', firstDay, today, MAX_MONTHS);
  if (!periods.length) { report.skipped = 'no_completed_month_yet'; return; }

  const { data: evaluated, error: evalError } = await db.from('shield_evaluations').select('user_id,period_type,period_start').eq('family_id', familyId).eq('period_type', 'month');
  if (evalError) throw new Error(`evaluations: ${evalError.message}`);
  const done = new Set((evaluated ?? []).map(e => `${e.user_id}|${e.period_start}`));
  const pending = members.flatMap(m => periods.filter(p => !done.has(`${m.id}|${p.start}`)).map(p => ({ member: m, period: p })));
  if (!pending.length) return;

  const earliest = pending.map(x => previousPeriod(previousPeriod(x.period)).start).sort()[0];
  const latest = pending.map(x => x.period.end).sort().at(-1)!;
  const memberIds = members.map(m => m.id);
  const [scheduleRows, completionRows, awardRows, missionRows] = await Promise.all([
    readAll<{ user_id: string; day: string; slots: DailySchedule['slots'] }>((f, t) => db.from('shield_daily_schedules').select('user_id,day,slots').eq('family_id', familyId).gte('day', earliest).lte('day', latest).order('day').order('user_id').range(f, t)),
    readAll<{ id: string; user_id: string; task_id: string; completed_at: string }>((f, t) => db.from('task_completions').select('id,user_id,task_id,completed_at').in('user_id', memberIds).gte('completed_at', `${addDays(earliest, -1)}T00:00:00Z`).lt('completed_at', `${addDays(latest, 2)}T00:00:00Z`).order('id').range(f, t)),
    db.from('shield_monthly_awards').select('user_id,evaluation_month,shield_type').eq('family_id', familyId),
    db.from('family_mission_weeks').select('week_start,mission_id,status,result').eq('family_id', familyId),
  ]);
  if (awardRows.error) throw new Error(`awards: ${awardRows.error.message}`);
  if (missionRows.error) throw new Error(`missions: ${missionRows.error.message}`);

  const schedules: DailySchedule[] = scheduleRows.map(r => ({ userId: r.user_id, day: r.day, slots: Array.isArray(r.slots) ? r.slots : [] }));
  const completions: ShieldCompletion[] = completionRows.map(c => ({ id: c.id, userId: c.user_id, taskId: c.task_id, completedAt: c.completed_at }));
  const pastAwards = new Map<string, PastAward[]>();
  const remember = (userId: string, periodStart: string, shieldType: ShieldType) =>
    pastAwards.set(userId, [...(pastAwards.get(userId) ?? []), { periodType: 'month', periodStart, shieldType }]);
  for (const a of awardRows.data ?? []) remember(a.user_id, a.evaluation_month, a.shield_type as ShieldType);
  const missions: MissionWeekResult[] = (missionRows.data ?? []).map(r => ({
    weekStart: r.week_start,
    missionId: r.mission_id,
    status: r.status,
    metMemberIds: ((r.result as { participants?: Array<{ id: string; met: boolean | null }> } | null)?.participants ?? []).filter(p => p.met === true).map(p => p.id),
  }));
  const doneByUser = new Map(memberIds.map(id => [id, completedSlotKeys(id, completions, schedules, timezone)]));

  // Chronological, so earlier awards are visible to later cooldown checks.
  pending.sort((a, b) => a.period.end.localeCompare(b.period.end));
  for (const { member, period } of pending) {
    const userDone = doneByUser.get(member.id)!;
    const prev = previousPeriod(period);
    const current = tallyPeriod(member.id, period, schedules, userDone);
    const previous = tallyPeriod(member.id, prev, schedules, userDone);
    const evaluation = evaluatePeriod({
      userId: member.id,
      period,
      current,
      previous,
      beforePrevious: tallyPeriod(member.id, previousPeriod(prev), schedules, userDone),
      missions,
      pastAwards: pastAwards.get(member.id) ?? [],
    });
    // Frozen explanation: numbers come from the snapshot-based tally.
    const awards = monthlyAwards(evaluation.candidates, current, previous, { timezone, memberName: member.name });
    const payload = {
      family_id: familyId,
      user_id: member.id,
      evaluation_month: period.start,
      candidate_results: evaluation.candidates,
      evaluation_status: evaluation.status,
      eligibility_summary: { ...evaluation.eligibility, timezone },
      evaluation_version: EVALUATION_VERSION,
      config_version: EQUIP_VERSION,
      awards,
    };
    const { data, error } = await db.rpc('finalize_shield_month', { p_payload: payload });
    if (error) { report.errors.push(`${member.id} ${period.start}: ${error.message}`); continue; }
    if ((data as { created?: boolean } | null)?.created) {
      report.evaluated += 1;
      report.awarded += awards.length;
      for (const a of awards) remember(member.id, period.start, a.shield_type);
    }
  }
}

interface MonthlyAwardRow { id: string; user_id: string; shield_type: ShieldType; tier: ShieldTier; scope: BonusScope; bonus_rate_bp: number; equipment_month: string }

/** Default loadout for this month, only for members who never set one. */
async function equipDefaults(db: SupabaseClient, familyId: string, today: string, members: AnalyticsMember[], report: FamilyRunReport) {
  const month = periodContaining('month', today).start;
  const [awards, equipment] = await Promise.all([
    db.from('shield_monthly_awards').select('id,user_id,shield_type,tier,scope,bonus_rate_bp,equipment_month').eq('family_id', familyId).eq('equipment_month', month),
    db.from('shield_equipment').select('user_id').eq('family_id', familyId).eq('equipment_month', month),
  ]);
  if (awards.error) throw new Error(awards.error.message);
  if (equipment.error) throw new Error(equipment.error.message);
  const touched = new Set((equipment.data ?? []).map(e => e.user_id));
  for (const m of members) {
    if (touched.has(m.id)) continue;
    const mine = ((awards.data ?? []) as MonthlyAwardRow[]).filter(a => a.user_id === m.id)
      .map(a => ({ id: a.id, shieldType: a.shield_type, tier: a.tier, scope: a.scope, bonusRateBp: a.bonus_rate_bp, equipmentMonth: a.equipment_month }));
    const ids = autoEquip(mine, month);
    if (!ids.length) continue;
    const { data, error } = await db.rpc('shield_auto_equip', { p_user_id: m.id, p_award_ids: ids });
    if (error) report.errors.push(`auto-equip ${m.id}: ${error.message}`);
    else if (data === true) report.autoEquipped += 1;
  }
}

export async function runShieldFinalization(db: SupabaseClient, now = new Date()): Promise<FamilyRunReport[]> {
  const { data: families, error } = await db.from('families').select('id');
  if (error) throw new Error(`families: ${error.message}`);
  // Tidy last month's open equipment rows. Bonuses never depend on this:
  // the database only applies Shields whose equipment month is the current one.
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
