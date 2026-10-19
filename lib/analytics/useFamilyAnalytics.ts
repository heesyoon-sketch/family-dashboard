'use client';

// Loads the raw records behind Stats and Shield Wall once per family and
// shares them between both views. Realtime completion/habit changes from any
// device trigger a debounced refresh; a failed refresh keeps the last good
// data on screen and reports the error separately.

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { useFamilyStore } from '@/lib/store';
import { legacyRecurrenceToDays, type DayOfWeek } from '@/lib/db';
import { normalizeTimeWindow } from '@/lib/timeWindows';
import { normalizeTaskType } from '@/lib/taskType';
import type { AnalyticsCompletion, AnalyticsMember, AnalyticsTask } from './history';
import { currentWeekStart, evaluateMission, planMissionWeek, type MissionWeekRow } from './family';

export interface PenaltyRecord {
  id: string;
  userId: string;
  kind: 'morning' | 'evening';
  date: string;
  pointsDeducted: number;
}

export interface FamilyMemory {
  id: string;
  family_id: string;
  author_id: string;
  memory_date: string;
  body: string;
  created_at: string;
}

export interface FamilyRecords {
  familyId: string;
  memberKey: string;
  loadedAt: Date;
  tasks: AnalyticsTask[];
  completions: AnalyticsCompletion[];
  missions: MissionWeekRow[];
  penalties: PenaltyRecord[];
  memories: FamilyMemory[];
  memoriesError: boolean;
  missionsError: boolean;
}

interface CacheEntry {
  records: FamilyRecords | null;
  error: string | null;
  loading: boolean;
  inflight: Promise<void> | null;
}

const PAGE = 1000;
const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return all;
  }
}

export function mapTask(row: Record<string, unknown>): AnalyticsTask {
  const days = Array.isArray(row.days_of_week) && row.days_of_week.length > 0
    ? row.days_of_week as DayOfWeek[]
    : legacyRecurrenceToDays(String(row.recurrence ?? 'daily'));
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title ?? ''),
    icon: String(row.icon ?? ''),
    daysOfWeek: days,
    timeWindow: normalizeTimeWindow(row.time_window as string | null),
    taskType: normalizeTaskType(row.task_type),
    active: Number(row.active ?? 1) === 1,
    createdAt: (row.created_at as string | null) ?? null,
    deletedAt: (row.deleted_at as string | null) ?? null,
    streakCount: Number(row.streak_count ?? 0),
  };
}

async function fetchRecords(familyId: string, memberIds: string[]): Promise<FamilyRecords> {
  const db = createBrowserSupabase();
  const since = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 10);
  const ids = memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000'];
  const [tasks, completions, missions, morning, evening, memories] = await Promise.all([
    readAll<Record<string, unknown>>((from, to) => db.from('tasks').select('id,user_id,title,icon,days_of_week,recurrence,time_window,task_type,active,created_at,deleted_at,streak_count').eq('family_id', familyId).order('id').range(from, to)),
    readAll<{ id: string; user_id: string; task_id: string; completed_at: string; partial: boolean | null }>((from, to) => db.from('task_completions').select('id,user_id,task_id,completed_at,partial').in('user_id', ids).order('id').range(from, to)),
    db.from('family_mission_weeks').select('family_id,week_start,mission_id,rules,status,result,finalized_at').eq('family_id', familyId).order('week_start', { ascending: false }).limit(260),
    db.from('morning_routine_penalties').select('id,user_id,penalty_date,points_deducted').eq('family_id', familyId).gte('penalty_date', since),
    db.from('evening_routine_penalties').select('id,user_id,penalty_date,points_deducted').eq('family_id', familyId).gte('penalty_date', since),
    db.from('growth_memories').select('id,family_id,author_id,memory_date,body,created_at').eq('family_id', familyId).order('memory_date', { ascending: false }).limit(200),
  ]);
  const memberSet = new Set(memberIds);
  const penalties: PenaltyRecord[] = [
    ...((morning.data ?? []) as Array<{ id: string; user_id: string; penalty_date: string; points_deducted: number }>).map(r => ({ id: r.id, userId: r.user_id, kind: 'morning' as const, date: r.penalty_date, pointsDeducted: r.points_deducted })),
    ...((evening.data ?? []) as Array<{ id: string; user_id: string; penalty_date: string; points_deducted: number }>).map(r => ({ id: r.id, userId: r.user_id, kind: 'evening' as const, date: r.penalty_date, pointsDeducted: r.points_deducted })),
  ].filter(p => memberSet.has(p.userId)).sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
  return {
    familyId,
    memberKey: memberIds.join(','),
    loadedAt: new Date(),
    tasks: tasks.map(mapTask).filter(task => memberSet.has(task.userId)),
    completions: completions
      .filter(c => memberSet.has(c.user_id))
      .map(c => ({ id: c.id, userId: c.user_id, taskId: c.task_id, completedAt: c.completed_at, partial: c.partial === true })),
    missions: (missions.data ?? []) as MissionWeekRow[],
    missionsError: Boolean(missions.error),
    penalties,
    memories: (memories.data ?? []) as FamilyMemory[],
    memoriesError: Boolean(memories.error),
  };
}

/** A clock that ticks once a minute, so day rollover and routine deadlines
 *  update on an always-on tablet without polling the database. */
export function useMinuteClock(): Date {
  const minute = useSyncExternalStore(
    useCallback((listener: () => void) => { const id = setInterval(listener, 15_000); return () => clearInterval(id); }, []),
    () => Math.floor(Date.now() / 60_000),
    () => 0,
  );
  return useMemo(() => new Date(minute * 60_000), [minute]);
}

/** Opens this week's mission once (first device wins) and finalizes any
 *  ended week still marked active. Missions grant no rewards, so a
 *  concurrent finalize from two devices is harmless; the row policy only
 *  allows the first one through. */
async function syncMissions(records: FamilyRecords, members: AnalyticsMember[], timezone: string): Promise<boolean> {
  if (records.missionsError) return false;
  const db = createBrowserSupabase();
  const now = new Date();
  const weekStart = currentWeekStart(now, timezone);
  let changed = false;
  if (!records.missions.some(row => row.week_start === weekStart)) {
    const plan = planMissionWeek({ weekStart, members, tasks: records.tasks, completions: records.completions, now, timezone });
    if (plan) {
      const { error } = await db.from('family_mission_weeks').upsert(
        { family_id: records.familyId, week_start: weekStart, mission_id: plan.missionId, rules: plan.rules, status: 'active' },
        { onConflict: 'family_id,week_start', ignoreDuplicates: true },
      );
      if (!error) changed = true;
    }
  }
  for (const row of records.missions) {
    if (row.status !== 'active' || row.week_start >= weekStart) continue;
    const progress = evaluateMission({ missionId: row.mission_id, weekStart: row.week_start, rules: row.rules, tasks: records.tasks, completions: records.completions, now, timezone });
    const { error } = await db.from('family_mission_weeks')
      .update({ status: progress.complete ? 'completed' : 'missed', result: { current: progress.current, target: progress.target, complete: progress.complete, participants: progress.participants }, finalized_at: now.toISOString() })
      .eq('family_id', row.family_id).eq('week_start', row.week_start).eq('status', 'active');
    if (!error) changed = true;
  }
  return changed;
}

function load(familyId: string, members: AnalyticsMember[], timezone: string): Promise<void> {
  const entry = cache.get(familyId) ?? { records: null, error: null, loading: false, inflight: null };
  if (entry.inflight) return entry.inflight;
  entry.loading = true;
  cache.set(familyId, entry);
  emit();
  const run = (async () => {
    try {
      let records = await fetchRecords(familyId, members.map(m => m.id));
      if (await syncMissions(records, members, timezone).catch(() => false)) {
        const { data, error } = await createBrowserSupabase().from('family_mission_weeks').select('family_id,week_start,mission_id,rules,status,result,finalized_at').eq('family_id', familyId).order('week_start', { ascending: false }).limit(260);
        if (!error) records = { ...records, missions: (data ?? []) as MissionWeekRow[] };
      }
      cache.set(familyId, { records, error: null, loading: false, inflight: null });
    } catch (err) {
      cache.set(familyId, { records: entry.records, error: err instanceof Error ? err.message : 'load failed', loading: false, inflight: null });
    }
    emit();
  })();
  entry.inflight = run;
  return run;
}

export interface FamilyAnalyticsState {
  familyId: string | null;
  members: AnalyticsMember[];
  timezone: string;
  records: FamilyRecords | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useFamilyAnalytics(): FamilyAnalyticsState {
  const familyId = useFamilyStore(s => s.familyId);
  const users = useFamilyStore(s => s.users);
  const timezone = useFamilyStore(s => s.automaticSaleConfig.timezone) || 'Asia/Seoul';
  const memberKey = users.map(u => `${u.id}:${u.name}:${u.role}`).join('|');
  // Rebuilt only when the member list itself changes.
  const members = useMemo<AnalyticsMember[]>(
    () => users.map(u => ({ id: u.id, name: u.name, role: u.role, createdAt: new Date(u.createdAt).toISOString() })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memberKey],
  );

  const entry = useSyncExternalStore(
    useCallback((listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, []),
    () => (familyId ? cache.get(familyId) : undefined),
    () => undefined,
  );

  const refresh = useCallback(() => {
    if (familyId && members.length) void load(familyId, members, timezone);
  }, [familyId, members, timezone]);

  useEffect(() => {
    if (!familyId || !members.length) return;
    const current = cache.get(familyId);
    const stale = !current?.records
      || Date.now() - current.records.loadedAt.getTime() > 60_000
      || current.records.memberKey !== members.map(m => m.id).join(',');
    if (stale) void load(familyId, members, timezone);
  }, [familyId, members, timezone]);

  useEffect(() => {
    if (!familyId || !members.length) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void load(familyId, members, timezone), 800); };
    const onVisible = () => { if (!document.hidden) schedule(); };
    const db = createBrowserSupabase();
    const channel = db.channel(`family-analytics:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `family_id=eq.${familyId}` }, schedule)
      .subscribe();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', schedule);
      void db.removeChannel(channel);
    };
  }, [familyId, members, timezone]);

  const records = entry?.records && entry.records.familyId === familyId ? entry.records : null;
  return { familyId, members, timezone, records, loading: entry?.loading ?? true, error: entry?.error ?? null, refresh };
}
