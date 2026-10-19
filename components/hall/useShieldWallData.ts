'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { periodContaining, zonedDayHour, type DailySchedule, type ShieldTier, type ShieldType } from '@/lib/shields/engine';
import type { BonusScope } from '@/lib/shields/weekly';

export type ShieldMode = 'off' | 'simulate' | 'live';

/** A weekly award. `evaluation_month` / `equipment_month` hold the Monday of
 *  the earning / equipment week (column names kept from the monthly design). */
export interface WeeklyAwardRow {
  id: string;
  user_id: string;
  evaluation_month: string;
  equipment_month: string;
  shield_type: ShieldType;
  tier: ShieldTier;
  scope: BonusScope;
  bonus_rate_bp: number;
  qualification_metrics: Record<string, unknown>;
  created_at: string;
}

export interface EquipmentRow {
  id: string;
  user_id: string;
  award_id: string;
  slot_number: number;
  equipped_at: string;
}

export interface ShieldWallData {
  timezone: string;
  mode: ShieldMode;
  /** Monday of the current equipment week (family time). */
  week: string;
  awards: WeeklyAwardRow[];
  /** Active equipment of the current week. */
  equipment: EquipmentRow[];
  /** Shield bonus points credited this week, per member. */
  bonusThisWeek: Record<string, number>;
  /** This week's schedule snapshots, for live progress. */
  schedules: DailySchedule[];
  firstSnapshotDay: string | null;
}

/** Reads the family's Shields (RLS: own family only). Awards and equipment
 *  are written only by the weekly server job. */
export function useShieldWallData(familyId: string | null, refreshKey: unknown) {
  const [data, setData] = useState<ShieldWallData | null>(null);
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
      const week = periodContaining('week', zonedDayHour(new Date(), timezone).day).start;

      const [config, awards, equipment, ledger, schedules, first] = await Promise.all([
        db.from('shield_config').select('mode').eq('id', 1).maybeSingle(),
        db.from('shield_monthly_awards').select('id,user_id,evaluation_month,equipment_month,shield_type,tier,scope,bonus_rate_bp,qualification_metrics,created_at').eq('family_id', familyId).order('evaluation_month', { ascending: false }).limit(2000),
        db.from('shield_equipment').select('id,user_id,award_id,slot_number,equipped_at').eq('family_id', familyId).eq('equipment_month', week).is('unequipped_at', null),
        db.from('shield_bonus_ledger').select('user_id,mode,bonus_points').eq('family_id', familyId).eq('equipment_month', week).limit(5000),
        db.from('shield_daily_schedules').select('user_id,day,slots').eq('family_id', familyId).gte('day', week).order('day').limit(500),
        db.from('shield_daily_schedules').select('day').eq('family_id', familyId).order('day').limit(1),
      ]);
      const failed = [config, awards, equipment, ledger, schedules, first].find(r => r.error);
      if (failed?.error) throw new Error(failed.error.message);
      if (!live) return;
      const bonusThisWeek: Record<string, number> = {};
      for (const row of (ledger.data ?? []) as Array<{ user_id: string; mode: string; bonus_points: number }>) {
        if (row.mode === 'live') bonusThisWeek[row.user_id] = (bonusThisWeek[row.user_id] ?? 0) + row.bonus_points;
      }
      setData({
        timezone,
        mode: ((config.data as { mode?: ShieldMode } | null)?.mode) ?? 'off',
        week,
        awards: (awards.data ?? []) as WeeklyAwardRow[],
        equipment: (equipment.data ?? []) as EquipmentRow[],
        bonusThisWeek,
        schedules: (schedules.data ?? []).map(r => ({ userId: r.user_id, day: r.day, slots: Array.isArray(r.slots) ? r.slots : [] })),
        firstSnapshotDay: (first.data?.[0]?.day as string | undefined) ?? null,
      });
      setError(null);
    })().catch(err => { if (live) setError(err instanceof Error ? err.message : 'load failed'); });
    return () => { live = false; };
  }, [familyId, refreshKey, nonce]);

  return { data, error, reload };
}
