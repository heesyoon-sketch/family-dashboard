'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { addDays, periodContaining, previousPeriod, zonedDayHour, type DailySchedule, type PeriodType, type ShieldTier, type ShieldType } from '@/lib/shields/engine';

export interface AwardRow {
  id: string;
  user_id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  shield_type: ShieldType;
  tier: ShieldTier;
  category: string | null;
  qualification_metrics: Record<string, unknown>;
  awarded_at: string;
}

export interface EvaluationRow {
  user_id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  evaluation_status: 'awarded' | 'no_award' | 'insufficient_data';
  evaluated_at: string;
}

export interface HallData {
  timezone: string;
  awards: AwardRow[];
  evaluations: EvaluationRow[];
  schedules: DailySchedule[];
  firstSnapshotDay: string | null;
}

/** Reads the family's Shield records (RLS: own family only). Writes never
 *  happen in the browser — awards come from the server-side evaluator. */
export function useHallData(familyId: string | null, refreshKey: unknown) {
  const [data, setData] = useState<HallData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!familyId) return;
    let live = true;
    (async () => {
      const db = createBrowserSupabase();
      const { data: tz, error: tzError } = await db.rpc('shield_family_timezone', { p_family_id: familyId });
      if (tzError) throw new Error(tzError.message);
      const timezone = String(tz);
      const today = zonedDayHour(new Date(), timezone).day;
      // Enough snapshots for live comparisons: two periods back of each type.
      const since = [
        previousPeriod(previousPeriod(periodContaining('week', today))).start,
        previousPeriod(previousPeriod(periodContaining('month', today))).start,
      ].sort()[0];
      const [awards, evaluations, schedules, first] = await Promise.all([
        db.from('shield_awards').select('id,user_id,period_type,period_start,period_end,shield_type,tier,category,qualification_metrics,awarded_at').eq('family_id', familyId).order('period_end', { ascending: false }).limit(1000),
        db.from('shield_evaluations').select('user_id,period_type,period_start,period_end,evaluation_status,evaluated_at').eq('family_id', familyId).gte('period_start', addDays(since, -62)).limit(2000),
        db.from('shield_daily_schedules').select('user_id,day,slots').eq('family_id', familyId).gte('day', since).order('day').limit(5000),
        db.from('shield_daily_schedules').select('day').eq('family_id', familyId).order('day').limit(1),
      ]);
      const failed = [awards, evaluations, schedules, first].find(r => r.error);
      if (failed?.error) throw new Error(failed.error.message);
      if (!live) return;
      setData({
        timezone,
        awards: (awards.data ?? []) as AwardRow[],
        evaluations: (evaluations.data ?? []) as EvaluationRow[],
        schedules: (schedules.data ?? []).map(r => ({ userId: r.user_id, day: r.day, slots: Array.isArray(r.slots) ? r.slots : [] })),
        firstSnapshotDay: (first.data?.[0]?.day as string | undefined) ?? null,
      });
      setError(null);
    })().catch(err => { if (live) setError(err instanceof Error ? err.message : 'load failed'); });
    return () => { live = false; };
  }, [familyId, refreshKey, nonce]);

  return { data, error, reload };
}
