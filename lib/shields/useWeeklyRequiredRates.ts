'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { useFamilyStore } from '@/lib/store';
import { periodContaining, zonedDayHour, type DailySchedule, type ShieldCompletion } from './engine';
import { weeklyRequiredRate, type RequiredRate } from './requiredRate';

type Rates = Record<string, RequiredRate>;

// Every member panel asks for the same family data; one in-flight load per
// refresh key serves them all.
let cached: { key: string; promise: Promise<Rates> } | null = null;

async function loadRates(familyId: string, userIds: string[]): Promise<Rates> {
  const db = createBrowserSupabase();
  const { data: tz, error: tzError } = await db.rpc('shield_family_timezone', { p_family_id: familyId });
  if (tzError) throw new Error(tzError.message);
  const timezone = String(tz);
  const now = new Date();
  const week = periodContaining('week', zonedDayHour(now, timezone).day).start;
  // A day of slack covers completions near midnight in other timezones.
  const since = new Date(`${week}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 1);

  const [schedules, completions] = await Promise.all([
    db.from('shield_daily_schedules').select('user_id,day,slots').eq('family_id', familyId).gte('day', week).order('day').limit(500),
    db.from('task_completions').select('id,user_id,task_id,completed_at').in('user_id', userIds).gte('completed_at', since.toISOString()).limit(10000),
  ]);
  if (schedules.error) throw new Error(schedules.error.message);
  if (completions.error) throw new Error(completions.error.message);

  const daily: DailySchedule[] = (schedules.data ?? []).map(r => ({ userId: r.user_id, day: r.day, slots: Array.isArray(r.slots) ? r.slots : [] }));
  const done: ShieldCompletion[] = (completions.data ?? []).map(c => ({ id: c.id, userId: c.user_id, taskId: c.task_id, completedAt: c.completed_at }));
  return Object.fromEntries(userIds.map(userId => [userId, weeklyRequiredRate({ userId, schedules: daily, completions: done, timezone, now })]));
}

/** This week's required-routine rate per member, refreshed with the dashboard. */
export function useWeeklyRequiredRates(): Rates | null {
  const familyId = useFamilyStore(s => s.familyId);
  const userIds = useFamilyStore(s => s.users.map(u => u.id).join(','));
  const lastHydrateAt = useFamilyStore(s => s.lastHydrateAt);
  // Completing or undoing a task changes today's tally without a full hydrate.
  const todayDone = useFamilyStore(s => Object.values(s.todayCompletionsByWindow).reduce((n, w) => n + w.morning.length + w.evening.length, 0));
  const [rates, setRates] = useState<Rates | null>(null);

  useEffect(() => {
    if (!familyId || !userIds) return;
    const key = `${familyId}|${userIds}|${lastHydrateAt}|${todayDone}`;
    if (!cached || cached.key !== key) cached = { key, promise: loadRates(familyId, userIds.split(',')) };
    let live = true;
    cached.promise
      .then(next => { if (live) setRates(next); })
      .catch(error => console.warn('[weekly rate] load failed', error));
    return () => { live = false; };
  }, [familyId, userIds, lastHydrateAt, todayDone]);

  return rates;
}
