'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { TIER_COPY, TYPE_COPY, explainAward, shieldName } from '@/lib/shields/copy';
import { formatDay, useCopy } from '@/components/analytics/ui';
import { ShieldEmblem } from './ShieldEmblem';
import type { AwardRow } from './useHallData';
import { periodLabel } from './periodLabel';

export function ShieldDetail({ award, recipient, onClose }: { award: AwardRow; recipient: string; onClose: () => void }) {
  const { en, t } = useCopy();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  const name = t(shieldName(award.shield_type, award.tier, award.category));
  const label = periodLabel(award.period_type, award.period_start, award.period_end);
  const why = explainAward(award.shield_type, award.qualification_metrics, recipient, label);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="shield-award-title" onClick={e => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,rgba(165,166,255,0.18),transparent_60%),#141a31] p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex justify-end">
          <button ref={closeRef} type="button" onClick={onClose} aria-label={en ? 'Close' : '닫기'} className="grid h-11 w-11 place-items-center rounded-full text-[#B3B7CE] hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="flex flex-col items-center text-center">
          <ShieldEmblem type={award.shield_type} tier={award.tier} size={140} title={name} />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#E8C77B]">{award.period_type === 'week' ? (en ? 'Weekly Honors' : '주간 명예') : (en ? 'Monthly Honors' : '월간 명예')}</p>
          <h2 id="shield-award-title" className="mt-1 text-2xl font-bold text-white">{name}</h2>
          <p className="mt-1 text-sm text-[#C9CCE0]">{recipient} · {t(label)}</p>
          <p className="mt-3 text-sm italic text-[#A9AECB]">“{t(TYPE_COPY[award.shield_type].theme)}”</p>
        </div>
        {why && <p className="mt-5 rounded-2xl bg-black/25 p-4 text-sm leading-relaxed text-[#E7E9F5]">{t(why)}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-[#8E94B4]">{en ? 'Type' : '종류'}</dt><dd className="mt-0.5 font-semibold text-white">{t(TYPE_COPY[award.shield_type].name)}</dd></div>
          <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-[#8E94B4]">{en ? 'Tier' : '등급'}</dt><dd className="mt-0.5 font-semibold text-white">{t(TIER_COPY[award.tier])}</dd></div>
          <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-[#8E94B4]">{en ? 'Period' : '기간'}</dt><dd className="mt-0.5 font-semibold text-white">{formatDay(award.period_start, en)} – {formatDay(award.period_end, en)}</dd></div>
          <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-[#8E94B4]">{en ? 'Awarded' : '수여일'}</dt><dd className="mt-0.5 font-semibold text-white">{formatDay(award.awarded_at.slice(0, 10), en, { year: 'numeric', month: 'short', day: 'numeric' })}</dd></div>
        </dl>
        <details className="mt-4 rounded-xl bg-black/20 p-3 text-xs leading-relaxed text-[#C9CCE0]">
          <summary className="min-h-9 cursor-pointer font-semibold text-white">{en ? 'How this shield works' : '이 쉴드를 받는 방법'}</summary>
          <p className="mt-2">{t(TYPE_COPY[award.shield_type].how(award.period_type))}</p>
          <p className="mt-2 text-[#8E94B4]">{en ? 'Shields are honors, not points. Each person can earn at most one per week and one per month, and earned shields stay forever.' : '쉴드는 포인트가 아니라 명예예요. 한 사람이 주마다, 달마다 최대 하나씩 받을 수 있고, 받은 쉴드는 영원히 남아요.'}</p>
        </details>
      </div>
    </div>
  );
}
