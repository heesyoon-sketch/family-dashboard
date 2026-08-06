'use client';

import type { CSSProperties } from 'react';
import { Film, Gamepad2, Sparkles, TicketCheck } from 'lucide-react';
import type { PerfectDayCoupon, PerfectDayCouponKind } from '@/lib/db';

export function formatPerfectDay(value: string, lang: 'en' | 'ko'): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, Math.max(0, month - 1), day);
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

export function PerfectDayTicket({
  coupon,
  lang,
  state = 'available',
  redeemedFor,
  cutoutColor = '#12131D',
  className = '',
}: {
  coupon: PerfectDayCoupon;
  lang: 'en' | 'ko';
  state?: 'awarded' | 'available' | 'redeemed';
  redeemedFor?: PerfectDayCouponKind;
  cutoutColor?: string;
  className?: string;
}) {
  const isRedeemed = state === 'redeemed';
  const chosenKind = redeemedFor ?? coupon.redeemedFor;
  const subtitle = chosenKind === 'game'
    ? (lang === 'en' ? 'Game time' : '게임 시간')
    : chosenKind === 'media'
      ? (lang === 'en' ? 'Media time' : '미디어 시간')
      : state === 'awarded'
        ? (lang === 'en' ? 'Game or media time' : '게임 또는 미디어 시간')
        : (lang === 'en' ? 'Choose your fun' : '원하는 즐거움을 골라요');
  const KindIcon = chosenKind === 'game' ? Gamepad2 : chosenKind === 'media' ? Film : TicketCheck;
  const ticketStyle = { '--ticket-cutout': cutoutColor } as CSSProperties;

  return (
    <div
      style={ticketStyle}
      className={[
        'relative overflow-hidden rounded-lg border-2 px-5 py-5 text-left',
        isRedeemed
          ? 'border-[#8B877B] bg-[#E8E5D8] text-[#4A4842] opacity-85'
          : 'border-[#17151E] bg-[#FFE56B] text-[#17151E] shadow-[6px_6px_0_#FF7BAC]',
        className,
      ].join(' ')}
    >
      <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[var(--ticket-cutout)]" aria-hidden />
      <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[var(--ticket-cutout)]" aria-hidden />
      <div className="flex items-start justify-between gap-4 border-b-2 border-dashed border-current/25 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
            <Sparkles size={13} aria-hidden />
            Perfect Day Pass
          </div>
          <div className="mt-2 text-3xl font-black leading-none">30 MIN</div>
          <div className="mt-1 truncate text-sm font-black">{subtitle}</div>
        </div>
        <KindIcon size={43} strokeWidth={1.7} className="shrink-0" aria-hidden />
      </div>
      <div className="flex items-center justify-between pt-3 text-[10px] font-black uppercase">
        <span>{formatPerfectDay(coupon.earnedForDay, lang)}</span>
        <span>NO. {coupon.id.slice(0, 6).toUpperCase()}</span>
      </div>
      {isRedeemed && (
        <div className="absolute inset-0 grid place-items-center bg-[#E8E5D8]/20" aria-hidden>
          <span className="-rotate-12 rounded-full border-[3px] border-[#C74456] px-3 py-2 text-sm font-black uppercase text-[#C74456]">
            {lang === 'en' ? 'Used' : '사용 완료'}
          </span>
        </div>
      )}
    </div>
  );
}
