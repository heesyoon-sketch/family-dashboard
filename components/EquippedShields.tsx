'use client';

import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFamilyStore } from '@/lib/store';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { useShieldSnapshot } from '@/lib/achievements/useShieldSnapshot';
import { MAX_INSIGNIA_SLOTS, insigniaSlotsForLevel } from '@/lib/progression';
import { ShieldEmblem } from '@/components/hall/ShieldEmblem';
import { useMonthlyLoadouts } from '@/components/hall/useMonthlyLoadouts';
import { legacyInsigniaBonusActive } from '@/lib/shields/transition';

const SHIELD_PX = 26;
const SHIELD_FAN_CLASSES = {
  1: [''],
  2: ['-rotate-3 translate-y-px', 'rotate-3 translate-y-px'],
  3: ['-rotate-6 translate-y-px', '', 'rotate-6 translate-y-px'],
} as const;
const SHIELD_DEFINITIONS_BY_ID = new Map(
  ACHIEVEMENTS.map(achievement => [achievement.achievementId, achievement]),
);

/** Compact equipped-shield stack for the dashboard header: this month's
 *  equipped Shields, or — until the insignia bonus ends — the insignias that
 *  still give it. The fanned overlap keeps all three legible in one row. */
export function EquippedShields({ userId, link = true }: { userId: string; link?: boolean }) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const familyId = useFamilyStore(s => s.familyId);
  const levelsByUser = useFamilyStore(s => s.levelsByUser);
  const timezone = useFamilyStore(s => s.automaticSaleConfig.timezone) || 'America/Toronto';
  const level = levelsByUser[userId]?.currentLevel ?? 1;
  const unlockedSlots = insigniaSlotsForLevel(level);
  const snapshot = useShieldSnapshot(familyId);
  const loadouts = useMonthlyLoadouts(familyId);
  const state = snapshot?.state.children[userId];

  const shields = (loadouts ?? []).filter(r => r.userId === userId).sort((a, b) => a.slot - b.slot);
  const legacy = shields.length === 0 && state && legacyInsigniaBonusActive(new Date(), timezone)
    ? state.equippedInsigniaIds
      .map(id => SHIELD_DEFINITIONS_BY_ID.get(id))
      .filter((achievement): achievement is (typeof ACHIEVEMENTS)[number] => Boolean(achievement))
      .slice(0, Math.min(unlockedSlots, MAX_INSIGNIA_SLOTS))
    : [];
  const count = shields.length || legacy.length;
  const label = count > 0
    ? (en ? `${count} equipped. Open Shield Wall.` : `장착 ${count}개. 쉴드 월 열기.`)
    : (en ? 'Nothing equipped. Open Shield Wall.' : '장착한 쉴드가 없어요. 쉴드 월 열기.');
  const fanClasses = SHIELD_FAN_CLASSES[count as keyof typeof SHIELD_FAN_CLASSES] ?? [];
  const fan = (key: string, index: number, node: ReactNode) => (
    <span key={key} className={`relative transition-transform group-hover:-translate-y-0.5 ${index === 0 ? '' : '-ml-[14px]'} ${fanClasses[index] ?? ''}`} style={{ zIndex: index + 1 }}>{node}</span>
  );

  const icons = (
    <>
      {shields.length > 0
        ? shields.map((s, i) => fan(`${s.shieldType}`, i, <ShieldEmblem type={s.shieldType} tier={s.tier} category={s.category} size={SHIELD_PX} />))
        : legacy.length > 0
          ? legacy.map((badge, i) => fan(badge.achievementId, i, (
            <InsigniaBadge rarity={badge.rarity} icon={badge.icon} seed={badge.achievementId} size={SHIELD_PX} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" ariaLabel={badge.title} />
          )))
          : (
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-dashed border-[var(--border)] text-[var(--fg-muted)]/65">
              <Shield size={15} strokeWidth={2.2} aria-hidden />
            </span>
          )}
    </>
  );
  if (!link) return <span className="inline-flex h-8 shrink-0 items-center" title={label}>{icons}</span>;
  return (
    <Link
      href={`/stats?member=${encodeURIComponent(userId)}#shield-wall`}
      className="group inline-flex h-8 shrink-0 items-center justify-center transition hover:brightness-110 max-[380px]:h-7"
      title={label}
      aria-label={label}
    >
      {icons}
    </Link>
  );
}
