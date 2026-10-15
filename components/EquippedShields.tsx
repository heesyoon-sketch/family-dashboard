'use client';

import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFamilyStore } from '@/lib/store';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { useShieldSnapshot } from '@/lib/achievements/useShieldSnapshot';
import { MAX_INSIGNIA_SLOTS, insigniaSlotsForLevel } from '@/lib/progression';
import { CompactShield, achievementMark, categoryMark } from '@/components/insignia/CompactShield';
import { useMonthlyLoadouts } from '@/components/hall/useMonthlyLoadouts';
import { legacyInsigniaBonusActive } from '@/lib/shields/transition';
import { shieldName } from '@/lib/shields/copy';

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
 *  still give it. Dashboard presentation gives every emblem its own space. */
export function EquippedShields({ userId, link = true, showcase = false }: { userId: string; link?: boolean; showcase?: boolean }) {
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
  const shieldSize = showcase ? 38 : SHIELD_PX;
  const fan = (key: string, index: number, name: string, node: ReactNode) => (
    <span key={key} title={name} className={showcase
      ? 'equipped-shield-emblem relative flex shrink-0 items-center justify-center'
      : `relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-transform group-hover:-translate-y-0.5 ${index === 0 ? '' : '-ml-[8px]'} ${fanClasses[index] ?? ''}`} style={{ zIndex: index + 1 }}>{node}</span>
  );

  const icons = (
    <>
      {shields.length > 0
        ? shields.map((s, i) => {
          const name = shieldName(s.shieldType, s.tier, s.category)[en ? 'en' : 'ko'];
          return fan(`${s.shieldType}`, i, name,
            <CompactShield tier={s.tier} mark={s.shieldType === 'dedication' ? categoryMark(s.category) : s.shieldType} size={shieldSize} title={name} />);
        })
        : legacy.length > 0
          ? legacy.map((badge, i) => fan(badge.achievementId, i, badge.title,
            <CompactShield rarity={badge.rarity} mark={achievementMark(badge)} size={shieldSize} title={badge.title} />))
          : (
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-dashed border-[var(--border)] text-[var(--fg-muted)]/65">
              <Shield size={15} strokeWidth={2.2} aria-hidden />
            </span>
          )}
    </>
  );
  const presentation = showcase && count > 0 ? 'equipped-shield-showcase' : 'inline-flex h-8 shrink-0 items-center justify-center';
  if (!link) return <span className={presentation} title={label}>{icons}</span>;
  return (
    <Link
      href={`/stats?member=${encodeURIComponent(userId)}#shield-wall`}
      className={`group ${presentation} transition hover:brightness-110`}
      title={label}
      aria-label={label}
    >
      {icons}
    </Link>
  );
}
