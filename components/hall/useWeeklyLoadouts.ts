'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { periodContaining, zonedDayHour, type ShieldTier, type ShieldType } from '@/lib/shields/engine';

export interface EquippedShield { userId: string; slot: number; shieldType: ShieldType; tier: ShieldTier }

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<EquippedShield[]> }>();

function load(familyId: string): Promise<EquippedShield[]> {
  const hit = cache.get(familyId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = (async () => {
    const db = createBrowserSupabase();
    const { data: tz, error: tzError } = await db.rpc('shield_family_timezone', { p_family_id: familyId });
    if (tzError) throw new Error(tzError.message);
    const week = periodContaining('week', zonedDayHour(new Date(), String(tz)).day).start;
    // equipment_month holds the Monday of the equipment week.
    const { data, error } = await db.from('shield_equipment')
      .select('user_id,slot_number,shield_monthly_awards(shield_type,tier)')
      .eq('family_id', familyId).eq('equipment_month', week).is('unequipped_at', null);
    if (error) throw new Error(error.message);
    return (data ?? []).flatMap(row => {
      const award = (Array.isArray(row.shield_monthly_awards) ? row.shield_monthly_awards[0] : row.shield_monthly_awards) as { shield_type: ShieldType; tier: ShieldTier } | null;
      return award ? [{ userId: row.user_id as string, slot: row.slot_number as number, shieldType: award.shield_type, tier: award.tier }] : [];
    });
  })();
  promise.catch(() => cache.delete(familyId));
  cache.set(familyId, { at: Date.now(), promise });
  return promise;
}

/** This week's equipped Shields for the whole family, shared by every
 *  dashboard strip (one request per family per minute). */
export function useWeeklyLoadouts(familyId: string | null): EquippedShield[] | null {
  const [rows, setRows] = useState<EquippedShield[] | null>(null);
  useEffect(() => {
    if (!familyId) return;
    let live = true;
    load(familyId).then(r => { if (live) setRows(r); }, () => { if (live) setRows([]); });
    return () => { live = false; };
  }, [familyId]);
  return rows;
}
