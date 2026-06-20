'use client';

import { useEffect, useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import Link from 'next/link';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import { useFamilyStore } from '@/lib/store';
import {
  loadAchievementState,
  subscribeToShieldState,
  syncAchievementsOnce,
  type ChildAchievementState,
} from '@/lib/achievements/storage';
import type { AchievementProgress } from '@/lib/achievements/engine';
import { MAX_INSIGNIA_SLOTS, insigniaSlotsForLevel } from '@/lib/progression';

// Match the dashboard header action buttons (h-8 = 32px) so the loadout
// reads as a peer of the store/mail buttons rather than a tiny accessory.
const SLOT_PX = 32;

/** Compact 3-slot strip in a member's panel header. Always shows three
 *  slots so the loadout shape is always visible — slots beyond the
 *  member's level appear locked with the level needed to unlock them.
 *  Tapping any slot deep-links to the Shield Wall. */
export function EquippedInsigniaStrip({ userId }: { userId: string }) {
  const familyId = useFamilyStore(s => s.familyId);
  const users = useFamilyStore(s => s.users);
  const tasksByUser = useFamilyStore(s => s.tasksByUser);
  const levelsByUser = useFamilyStore(s => s.levelsByUser);
  const level = levelsByUser[userId]?.currentLevel ?? 1;
  const unlockedSlots = insigniaSlotsForLevel(level);
  const [equipped, setEquipped] = useState<AchievementProgress[]>([]);
  const [state, setState] = useState<ChildAchievementState | undefined>(undefined);
  const [achievements, setAchievements] = useState<AchievementProgress[]>([]);

  // syncAchievements fetches fresh tasks + completions internally; tasksByUser
  // and levelsByUser here are only fallback maps. Keying this effect on those
  // (unstable) store references made every task completion re-run a *full
  // family* syncAchievements — once for each member panel's strip at the same
  // time. Key on the stable member-id list instead (as InsigniaWall does) so a
  // strip re-syncs only when the member set actually changes.
  const memberSignature = users.map(u => u.id).join(',');
  useEffect(() => {
    if (!familyId || users.length === 0) return;
    let cancelled = false;
    syncAchievementsOnce({ familyId, children: users, tasksByUser, levelsByUser })
      .then(result => {
        if (cancelled) return;
        const memberState = result.state.children[userId];
        setState(memberState);
        const ids = memberState?.equippedInsigniaIds ?? [];
        const all = result.achievementsByChild[userId] ?? [];
        setAchievements(all);
        const byId = new Map(all.map(a => [a.achievementId, a]));
        setEquipped(ids.map(id => byId.get(id)).filter((b): b is AchievementProgress => Boolean(b)));
      })
      .catch(() => {
        if (!familyId) return;
        const fallback = loadAchievementState(familyId, users).children[userId];
        setState(fallback);
      });
    return () => { cancelled = true; };
    // tasksByUser / levelsByUser intentionally omitted — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, memberSignature, userId]);

  useEffect(() => subscribeToShieldState(detail => {
    if (!familyId || detail.familyId !== familyId) return;
    const memberState = detail.state.children[userId];
    if (!memberState) return;
    const latestAchievements = detail.achievementsByChild?.[userId] ?? achievements;
    const byId = new Map(latestAchievements.map(item => [item.achievementId, item]));
    setState(memberState);
    if (detail.achievementsByChild?.[userId]) setAchievements(latestAchievements);
    setEquipped(
      memberState.equippedInsigniaIds
        .map(id => byId.get(id))
        .filter((item): item is AchievementProgress => Boolean(item)),
    );
  }), [familyId, userId, achievements]);

  if (!state) return null;

  const filled = equipped.slice(0, unlockedSlots);

  return (
    <Link
      href={`/stats?view=shield&member=${userId}`}
      className="inline-flex items-center gap-1 transition hover:opacity-80"
      title="Shield loadout — tap to manage on the Shield Wall"
      aria-label="Equipped shields"
    >
      {Array.from({ length: MAX_INSIGNIA_SLOTS }).map((_, idx) => {
        const isUnlockedSlot = idx < unlockedSlots;
        const badge = filled[idx];
        if (!isUnlockedSlot) {
          const unlockAt = idx === 1 ? 5 : 10;
          return (
            <span
              key={`locked-${idx}`}
              title={`Slot unlocks at Lv.${unlockAt}`}
              className="relative grid place-items-center rounded-full border border-dashed border-[var(--border)] text-[var(--fg-muted)]/60"
              style={{ width: SLOT_PX, height: SLOT_PX }}
            >
              <Lock size={13} strokeWidth={2.5} />
              <span className="absolute -bottom-0.5 right-0 rounded-full bg-[var(--bg-card)] px-1 text-[8px] font-black leading-none text-[var(--fg-muted)]">
                {unlockAt}
              </span>
            </span>
          );
        }
        if (badge) {
          return (
            <InsigniaBadge
              key={badge.achievementId}
              rarity={badge.rarity}
              icon={badge.icon}
              seed={badge.achievementId}
              size={SLOT_PX}
              ariaLabel={badge.title}
            />
          );
        }
        return (
          <span
            key={`empty-${idx}`}
            aria-label="Empty shield slot"
            className="grid place-items-center rounded-full border border-dashed border-[var(--border)]/80 text-[var(--fg-muted)]/55"
            style={{ width: SLOT_PX, height: SLOT_PX }}
          >
            <Plus size={14} strokeWidth={2.5} />
          </span>
        );
      })}
    </Link>
  );
}
