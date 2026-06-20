'use client';

import { Lock, Plus } from 'lucide-react';
import Link from 'next/link';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import { useFamilyStore } from '@/lib/store';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { useShieldSnapshot } from '@/lib/achievements/useShieldSnapshot';
import { MAX_INSIGNIA_SLOTS, insigniaSlotsForLevel } from '@/lib/progression';

// Match the dashboard header action buttons (h-8 = 32px) so the loadout
// reads as a peer of the store/mail buttons rather than a tiny accessory.
const SLOT_PX = 32;
const SHIELD_DEFINITIONS_BY_ID = new Map(
  ACHIEVEMENTS.map(achievement => [achievement.achievementId, achievement]),
);

/** Compact 3-slot strip in a member's panel header. Always shows three
 *  slots so the loadout shape is always visible — slots beyond the
 *  member's level appear locked with the level needed to unlock them.
 *  Tapping any slot deep-links to the Shield Wall. */
export function EquippedInsigniaStrip({ userId }: { userId: string }) {
  const familyId = useFamilyStore(s => s.familyId);
  const levelsByUser = useFamilyStore(s => s.levelsByUser);
  const level = levelsByUser[userId]?.currentLevel ?? 1;
  const unlockedSlots = insigniaSlotsForLevel(level);
  const snapshot = useShieldSnapshot(familyId);
  const state = snapshot?.state.children[userId];

  if (!state) return null;

  const filled = state.equippedInsigniaIds
    .map(id => SHIELD_DEFINITIONS_BY_ID.get(id))
    .filter((achievement): achievement is (typeof ACHIEVEMENTS)[number] => Boolean(achievement))
    .slice(0, unlockedSlots);

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
