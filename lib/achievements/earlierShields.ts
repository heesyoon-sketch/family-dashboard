'use client';

// Earlier shields (the retired lifetime insignias), read-only.
//
// Insignias are no longer earned, awarded or synced. What each member earned
// is a frozen record in achievement_states.unlocked_at_by_achievement_id;
// the Shield Wall shows it as history. This is the only reader.

import { useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { ACHIEVEMENTS, type AchievementDefinition } from './definitions';

export interface EarlierShield {
  definition: AchievementDefinition;
  /** ISO timestamp it was earned. */
  unlockedAt: string;
}

const DEFINITIONS = new Map(ACHIEVEMENTS.map(def => [def.achievementId, def]));

/** Known insignias a member earned, newest first. Unknown ids are skipped. */
export function toEarlierShields(unlockedAtById: Record<string, unknown> | null | undefined): EarlierShield[] {
  return Object.entries(unlockedAtById ?? {})
    .flatMap(([id, at]) => {
      const definition = DEFINITIONS.get(id);
      return definition && typeof at === 'string' ? [{ definition, unlockedAt: at }] : [];
    })
    .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));
}

const cache = new Map<string, Promise<Record<string, EarlierShield[]>>>();

function load(familyId: string): Promise<Record<string, EarlierShield[]>> {
  let hit = cache.get(familyId);
  if (!hit) {
    hit = (async () => {
      const { data, error } = await createBrowserSupabase()
        .from('achievement_states')
        .select('user_id,unlocked_at_by_achievement_id')
        .eq('family_id', familyId);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).map(row => [
        row.user_id as string,
        toEarlierShields(row.unlocked_at_by_achievement_id as Record<string, unknown> | null),
      ]));
    })();
    // The records never change, so one successful read per family is enough.
    hit.catch(() => cache.delete(familyId));
    cache.set(familyId, hit);
  }
  return hit;
}

export function useEarlierShields(familyId: string | null, memberId: string): EarlierShield[] {
  const [byMember, setByMember] = useState<Record<string, EarlierShield[]>>({});
  useEffect(() => {
    if (!familyId) return;
    let live = true;
    load(familyId)
      .then(next => { if (live) setByMember(next); })
      .catch(error => console.warn('[earlier shields] load failed', error));
    return () => { live = false; };
  }, [familyId]);
  return byMember[memberId] ?? [];
}
