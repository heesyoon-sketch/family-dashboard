'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { periodContaining } from '@/lib/shields/engine';
import { formatBp } from '@/lib/shields/weekly';
import { TIER_COPY, TYPE_COPY, explainAward, scopeLabel, shieldName } from '@/lib/shields/copy';
import { formatDay, useCopy } from '@/components/analytics/ui';
import { ShieldEmblem } from './ShieldEmblem';
import type { WeeklyAwardRow } from './useShieldWallData';
import { periodLabel } from './periodLabel';

export function ShieldDetail({ award, recipient, onClose }: { award: WeeklyAwardRow; recipient: string; onClose: () => void }) {
  const { en, t } = useCopy();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  const name = t(shieldName(award.shield_type, award.tier));
  const earned = periodContaining('week', award.evaluation_month);
  const equip = periodContaining('week', award.equipment_month);
  const earnedLabel = periodLabel('week', earned.start, earned.end);
  const why = explainAward(award.shield_type, award.qualification_metrics, recipient, earnedLabel);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="shield-award-title" onClick={e => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,rgba(165,166,255,0.18),transparent_60%),#141a31] p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex justify-end">
          <button ref={closeRef} type="button" onClick={onClose} aria-label={en ? 'Close' : '닫기'} className="grid h-11 w-11 place-items-center rounded-full text-[#B3B7CE] hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="flex flex-col items-center text-center">
          <ShieldEmblem type={award.shield_type} tier={award.tier} size={140} title={name} />
          <h2 id="shield-award-title" className="mt-3 text-2xl font-bold text-white">{name}</h2>
          <p className="mt-1 text-sm text-[#C9CCE0]">{recipient} · {en ? `earned ${earnedLabel.en}` : `${earnedLabel.ko}에 획득`}</p>
          <p className="mt-3 text-sm italic text-[#A9AECB]">“{t(TYPE_COPY[award.shield_type].theme)}”</p>
        </div>
        {why && <p className="mt-5 rounded-2xl bg-black/25 p-4 text-sm leading-relaxed text-[#E7E9F5]">{t(why)}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-[#8E94B4]">{en ? 'Bonus' : '보너스'}</dt><dd className="mt-0.5 font-semibold text-[#9FF0CE]">+{formatBp(award.bonus_rate_bp)}</dd></div>
          <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-[#8E94B4]">{en ? 'Applies to' : '적용 대상'}</dt><dd className="mt-0.5 font-semibold text-white">{t(scopeLabel(award.scope))}</dd></div>
          <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-[#8E94B4]">{en ? 'Tier' : '등급'}</dt><dd className="mt-0.5 font-semibold text-white">{t(TIER_COPY[award.tier])}</dd></div>
          <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-[#8E94B4]">{en ? 'Active' : '적용 기간'}</dt><dd className="mt-0.5 font-semibold text-white">{formatDay(equip.start, en)} – {formatDay(equip.end, en)}</dd></div>
        </dl>
        <details className="mt-4 rounded-xl bg-black/20 p-3 text-xs leading-relaxed text-[#C9CCE0]">
          <summary className="min-h-9 cursor-pointer font-semibold text-white">{en ? 'How this shield works' : '이 쉴드를 받는 방법'}</summary>
          <p className="mt-2">{t(TYPE_COPY[award.shield_type].how)}</p>
          <p className="mt-2 text-[#8E94B4]">{en
            ? 'Earned from one week’s record, it is equipped automatically for the following week only, on that area’s base points, rounded up (at least +1). Earned shields stay in your history.'
            : '한 주의 기록으로 얻은 쉴드는 다음 한 주 동안 자동으로 장착되고, 그 영역의 기본 포인트에 더해져요(올림 계산이라 최소 +1). 받은 쉴드는 기록에 남아요.'}</p>
        </details>
      </div>
    </div>
  );
}
