'use client';

import { Shield } from 'lucide-react';
import Link from 'next/link';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFamilyStore } from '@/lib/store';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { useShieldSnapshot } from '@/lib/achievements/useShieldSnapshot';
import { MAX_INSIGNIA_SLOTS, insigniaSlotsForLevel } from '@/lib/progression';

const SHIELD_PX = 26;
const SHIELD_FAN_CLASSES = {
  1: [''],
  2: ['-rotate-3 translate-y-px', 'rotate-3 translate-y-px'],
  3: ['-rotate-6 translate-y-px', '', 'rotate-6 translate-y-px'],
} as const;
const SHIELD_DEFINITIONS_BY_ID = new Map(
  ACHIEVEMENTS.map(achievement => [achievement.achievementId, achievement]),
);

/** Compact equipped-shield stack for the dashboard header. The fanned overlap
 *  keeps all three shields legible in one action-sized row. */
export function EquippedInsigniaStrip({ userId }: { userId: string }) {
  const { lang } = useLanguage();
  const familyId = useFamilyStore(s => s.familyId);
  const levelsByUser = useFamilyStore(s => s.levelsByUser);
  const level = levelsByUser[userId]?.currentLevel ?? 1;
  const unlockedSlots = insigniaSlotsForLevel(level);
  const snapshot = useShieldSnapshot(familyId);
  const state = snapshot?.state.children[userId];

  if (!state) return null;

  const equipped = state.equippedInsigniaIds
    .map(id => SHIELD_DEFINITIONS_BY_ID.get(id))
    .filter((achievement): achievement is (typeof ACHIEVEMENTS)[number] => Boolean(achievement))
    .slice(0, Math.min(unlockedSlots, MAX_INSIGNIA_SLOTS));

  const label = equipped.length > 0
    ? (lang === 'en'
        ? `Equipped shields: ${equipped.map(shield => shield.title).join(', ')}. Open Shield Wall.`
        : `장착 쉴드 ${equipped.length}개. 쉴드 월 열기.`)
    : (lang === 'en' ? 'No shields equipped. Open Shield Wall.' : '장착한 쉴드가 없습니다. 쉴드 월 열기.');
  const fanClasses = SHIELD_FAN_CLASSES[equipped.length as keyof typeof SHIELD_FAN_CLASSES] ?? [];

  return (
    <Link
      href={`/stats?view=shield&member=${userId}`}
      className="group inline-flex h-8 shrink-0 items-center justify-center transition hover:brightness-110 max-[380px]:h-7"
      title={label}
      aria-label={label}
    >
      {equipped.length > 0 ? (
        equipped.map((badge, index) => (
          <span
            key={badge.achievementId}
            className={`relative transition-transform group-hover:-translate-y-0.5 ${index === 0 ? '' : '-ml-[14px]'} ${fanClasses[index] ?? ''}`}
            style={{ zIndex: index + 1 }}
          >
            <InsigniaBadge
              rarity={badge.rarity}
              icon={badge.icon}
              seed={badge.achievementId}
              size={SHIELD_PX}
              className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
              ariaLabel={badge.title}
            />
          </span>
        ))
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-dashed border-[var(--border)] text-[var(--fg-muted)]/65">
          <Shield size={15} strokeWidth={2.2} aria-hidden />
        </span>
      )}
    </Link>
  );
}
