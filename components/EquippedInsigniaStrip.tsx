'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import { useFamilyStore } from '@/lib/store';
import { syncAchievements, loadAchievementState, type ChildAchievementState } from '@/lib/achievements/storage';
import type { AchievementProgress } from '@/lib/achievements/engine';
import { insigniaSlotsForLevel } from '@/lib/progression';

/** Small inline strip that shows a member's equipped insignias in their
 *  panel header. Tapping any slot deep-links to the Insignia Wall where
 *  the user can swap loadouts. */
export function EquippedInsigniaStrip({ userId }: { userId: string }) {
  const familyId = useFamilyStore(s => s.familyId);
  const users = useFamilyStore(s => s.users);
  const tasksByUser = useFamilyStore(s => s.tasksByUser);
  const levelsByUser = useFamilyStore(s => s.levelsByUser);
  const level = levelsByUser[userId]?.currentLevel ?? 1;
  const slotCount = insigniaSlotsForLevel(level);
  const [equipped, setEquipped] = useState<AchievementProgress[]>([]);
  const [state, setState] = useState<ChildAchievementState | undefined>(undefined);

  useEffect(() => {
    if (!familyId || users.length === 0) return;
    let cancelled = false;
    syncAchievements({ familyId, children: users, tasksByUser, levelsByUser, awardNew: false })
      .then(result => {
        if (cancelled) return;
        const memberState = result.state.children[userId];
        setState(memberState);
        const ids = memberState?.equippedInsigniaIds ?? [];
        const all = result.achievementsByChild[userId] ?? [];
        const byId = new Map(all.map(a => [a.achievementId, a]));
        setEquipped(ids.map(id => byId.get(id)).filter((b): b is AchievementProgress => Boolean(b)));
      })
      .catch(() => {
        // Best-effort — fall back to local state alone.
        if (!familyId) return;
        const fallback = loadAchievementState(familyId, users).children[userId];
        setState(fallback);
      });
    return () => { cancelled = true; };
  }, [familyId, users, tasksByUser, levelsByUser, userId]);

  // Hide entirely if the member doesn't have at least one slot meaning yet
  // and hasn't unlocked anything to equip.
  if (!state) return null;

  const filled = equipped.slice(0, slotCount);
  const empties = Math.max(0, slotCount - filled.length);

  return (
    <Link
      href={`/stats?view=insignia&member=${userId}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)]/50 px-1.5 py-1 transition hover:border-[var(--accent)]/45"
      title="Equipped insignias — tap to manage on the Insignia Wall"
    >
      {filled.map(badge => (
        <InsigniaBadge
          key={badge.achievementId}
          rarity={badge.rarity}
          icon={badge.icon}
          size={22}
          ariaLabel={badge.title}
        />
      ))}
      {Array.from({ length: empties }).map((_, i) => (
        <span
          key={`empty-${i}`}
          aria-label="Empty insignia slot"
          className="grid h-[22px] w-[22px] place-items-center rounded-full border border-dashed border-[var(--border)]/80 text-[var(--fg-muted)]/55"
        >
          <Plus size={11} strokeWidth={2.5} />
        </span>
      ))}
    </Link>
  );
}
