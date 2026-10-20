'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFamilyStore } from '@/lib/store';
import { EmptyShield, ShieldEmblem } from '@/components/hall/ShieldEmblem';
import { useWeeklyLoadouts } from '@/components/hall/useWeeklyLoadouts';
import { SHIELD_TYPES } from '@/lib/shields/engine';
import { TYPE_COPY, shieldName } from '@/lib/shields/copy';

const SHIELD_PX = 30;
const FAN_CLASSES = ['-rotate-6 translate-y-px', '', 'rotate-6 translate-y-px'] as const;

/** Compact shield strip for the dashboard header: always the three weekly
 *  slots (Morning, Evening, Bonus) in that order, so a slot not earned this
 *  week stays visible as an empty outline instead of disappearing. */
export function EquippedShields({ userId, link = true, showcase = false }: { userId: string; link?: boolean; showcase?: boolean }) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const familyId = useFamilyStore(s => s.familyId);
  const loadouts = useWeeklyLoadouts(familyId);
  const mine = (loadouts ?? []).filter(r => r.userId === userId);
  const slots = SHIELD_TYPES.map(type => ({ type, shield: mine.find(s => s.shieldType === type) ?? null }));
  const count = slots.filter(s => s.shield).length;

  const label = count > 0
    ? (en ? `${count} of 3 shields this week. Open Shield Wall.` : `이번 주 쉴드 3개 중 ${count}개. 쉴드 월 열기.`)
    : (en ? 'No shields this week. Open Shield Wall.' : '이번 주 쉴드가 없어요. 쉴드 월 열기.');
  const size = showcase ? 48 : SHIELD_PX;
  const slot = (key: string, index: number, title: string, node: ReactNode) => (
    <span key={key} title={title} className={showcase
      ? 'equipped-shield-emblem relative flex shrink-0 items-center justify-center'
      : `relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-transform group-hover:-translate-y-0.5 ${index === 0 ? '' : '-ml-[8px]'} ${FAN_CLASSES[index]}`} style={{ zIndex: index + 1 }}>{node}</span>
  );

  const icons = slots.map(({ type, shield }, i) => {
    if (shield) {
      const name = shieldName(shield.shieldType, shield.tier)[en ? 'en' : 'ko'];
      return slot(type, i, name, <ShieldEmblem type={shield.shieldType} tier={shield.tier} size={size} title={name} />);
    }
    const empty = en ? `${TYPE_COPY[type].name.en} — not this week` : `${TYPE_COPY[type].name.ko} — 이번 주엔 없어요`;
    // Slightly smaller and faded so earned shields stay the focus.
    return slot(type, i, empty, <span className="opacity-60"><EmptyShield size={Math.round(size * 0.86)} /></span>);
  });

  const presentation = showcase ? 'equipped-shield-showcase' : 'inline-flex h-8 shrink-0 items-center justify-center';
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
