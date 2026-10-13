'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { addDays, periodContaining, previousPeriod, zonedDayHour, type DailySchedule, type ShieldTier, type ShieldType } from '@/lib/shields/engine';
import type { BonusScope, EquippableAward } from '@/lib/shields/equipment';

export type ShieldMode = 'off' | 'simulate' | 'live';

export interface MonthlyAwardRow {
  id: string;
  user_id: string;
  evaluation_month: string;
  equipment_month: string;
  shield_type: ShieldType;
  tier: ShieldTier;
  category: string | null;
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

export interface LedgerRow {
  user_id: string;
  equipment_month: string;
  entry_type: 'award' | 'reversal';
  mode: 'simulate' | 'live';
  bonus_points: number;
}

export interface ShieldWallData {
  timezone: string;
  mode: ShieldMode;
  /** Current equipment month (first day, family time). */
  month: string;
  awards: MonthlyAwardRow[];
  /** Active equipment of the current month. */
  equipment: EquipmentRow[];
  ledger: LedgerRow[];
  schedules: DailySchedule[];
  firstSnapshotDay: string | null;
}

export const toEquippable = (a: MonthlyAwardRow): EquippableAward => ({
  id: a.id, shieldType: a.shield_type, tier: a.tier, scope: a.scope, bonusRateBp: a.bonus_rate_bp, equipmentMonth: a.equipment_month,
});

const PAGE = 1000;

/** Reads the family's Shield Wall (RLS: own family only). The only write is
 *  setLoadout, which goes through the validating shield_set_loadout RPC. */
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
      const today = zonedDayHour(new Date(), timezone).day;
      const month = periodContaining('month', today).start;
      // Live "earn next month" needs this month and the two before it.
      const since = previousPeriod(previousPeriod(periodContaining('month', today))).start;
      const ledgerSince = previousPeriod(previousPeriod(previousPeriod(periodContaining('month', today)))).start;

      const ledger: LedgerRow[] = [];
      for (let from = 0; from < 20 * PAGE; from += PAGE) {
        const page = await db.from('shield_bonus_ledger').select('user_id,equipment_month,entry_type,mode,bonus_points')
          .eq('family_id', familyId).gte('equipment_month', ledgerSince).order('created_at').range(from, from + PAGE - 1);
        if (page.error) throw new Error(page.error.message);
        ledger.push(...((page.data ?? []) as LedgerRow[]));
        if ((page.data ?? []).length < PAGE) break;
      }
      const [config, awards, equipment, schedules, first] = await Promise.all([
        db.from('shield_config').select('mode').eq('id', 1).maybeSingle(),
        db.from('shield_monthly_awards').select('id,user_id,evaluation_month,equipment_month,shield_type,tier,category,scope,bonus_rate_bp,qualification_metrics,created_at').eq('family_id', familyId).order('evaluation_month', { ascending: false }).limit(2000),
        db.from('shield_equipment').select('id,user_id,award_id,slot_number,equipped_at').eq('family_id', familyId).eq('equipment_month', month).is('unequipped_at', null),
        db.from('shield_daily_schedules').select('user_id,day,slots').eq('family_id', familyId).gte('day', addDays(since, -1)).order('day').limit(5000),
        db.from('shield_daily_schedules').select('day').eq('family_id', familyId).order('day').limit(1),
      ]);
      const failed = [config, awards, equipment, schedules, first].find(r => r.error);
      if (failed?.error) throw new Error(failed.error.message);
      if (!live) return;
      setData({
        timezone,
        mode: ((config.data as { mode?: ShieldMode } | null)?.mode) ?? 'off',
        month,
        awards: (awards.data ?? []) as MonthlyAwardRow[],
        equipment: (equipment.data ?? []) as EquipmentRow[],
        ledger,
        schedules: (schedules.data ?? []).map(r => ({ userId: r.user_id, day: r.day, slots: Array.isArray(r.slots) ? r.slots : [] })),
        firstSnapshotDay: (first.data?.[0]?.day as string | undefined) ?? null,
      });
      setError(null);
    })().catch(err => { if (live) setError(err instanceof Error ? err.message : 'load failed'); });
    return () => { live = false; };
  }, [familyId, refreshKey, nonce]);

  const setLoadout = useCallback(async (userId: string, awardIds: string[]) => {
    const db = createBrowserSupabase();
    const { error: rpcError } = await db.rpc('shield_set_loadout', { p_user_id: userId, p_award_ids: awardIds });
    if (rpcError) throw new Error(rpcError.message);
    reload();
  }, [reload]);

  return { data, error, reload, setLoadout };
}
