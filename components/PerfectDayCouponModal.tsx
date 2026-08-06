'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock3,
  Film,
  Gamepad2,
  TicketCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PerfectDayCoupon, PerfectDayCouponKind, User } from '@/lib/db';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPerfectDay, PerfectDayTicket } from './PerfectDayTicket';

export function PerfectDayCouponModal({
  user,
  coupons,
  onClose,
  onRedeem,
}: {
  user: User;
  coupons: PerfectDayCoupon[];
  onClose: () => void;
  onRedeem: (couponId: string, kind: PerfectDayCouponKind) => Promise<void>;
}) {
  const { lang } = useLanguage();
  const [selectedKind, setSelectedKind] = useState<PerfectDayCouponKind | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [justRedeemed, setJustRedeemed] = useState<{
    coupon: PerfectDayCoupon;
    kind: PerfectDayCouponKind;
  } | null>(null);
  const available = useMemo(
    () => coupons.filter(coupon => coupon.status === 'available').sort(
      (a, b) => a.awardedAt.getTime() - b.awardedAt.getTime(),
    ),
    [coupons],
  );
  const used = useMemo(
    () => coupons.filter(coupon => coupon.status === 'redeemed').slice(0, 4),
    [coupons],
  );
  const activeCoupon = available[0] ?? null;

  const redeem = async () => {
    if (!activeCoupon || !selectedKind || redeeming) return;
    setRedeeming(true);
    try {
      const redeemedCoupon = activeCoupon;
      const redeemedKind = selectedKind;
      await onRedeem(redeemedCoupon.id, redeemedKind);
      setJustRedeemed({ coupon: redeemedCoupon, kind: redeemedKind });
      toast.success(
        lang === 'en' ? 'Your 30-minute pass is ready!' : '30분 이용권을 사용했어요!',
        {
          description: selectedKind === 'game'
            ? (lang === 'en' ? 'Game time selected' : '게임 시간 선택')
            : (lang === 'en' ? 'Media time selected' : '미디어 시간 선택'),
        },
      );
      setSelectedKind(null);
    } catch (error) {
      toast.error(
        lang === 'en' ? 'Could not use this coupon' : '쿠폰을 사용할 수 없어요',
        { description: error instanceof Error ? error.message : undefined },
      );
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="perfect-day-wallet-title"
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-white/15 bg-[#12131D] text-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#FFE56B] text-[#17151E]">
              <TicketCheck size={19} strokeWidth={2.6} />
            </span>
            <div>
              <div id="perfect-day-wallet-title" className="text-sm font-black">
                {lang === 'en' ? `${user.name}'s Passes` : `${user.name}의 이용권`}
              </div>
              <div className="text-[11px] font-bold text-white/45">
                {lang === 'en' ? `${available.length} ready to use` : `${available.length}장 사용 가능`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close coupon wallet' : '쿠폰 지갑 닫기'}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </header>

        <div className="overflow-y-auto px-4 pb-5 pt-4">
          {justRedeemed ? (
            <div className="py-1 text-center" aria-live="polite">
              <CheckCircle2 size={30} className="mx-auto text-[#4EEDB0]" />
              <div className="mt-2 text-lg font-black">
                {lang === 'en' ? 'Pass activated' : '이용권을 사용했어요'}
              </div>
              <div className="mt-1 text-sm text-white/55">
                {justRedeemed.kind === 'game'
                  ? (lang === 'en' ? '30 minutes of game time' : '게임 시간 30분')
                  : (lang === 'en' ? '30 minutes of media time' : '미디어 시간 30분')}
              </div>
              <PerfectDayTicket
                coupon={justRedeemed.coupon}
                lang={lang}
                state="redeemed"
                redeemedFor={justRedeemed.kind}
                className="mt-5"
              />
              <button
                type="button"
                onClick={() => setJustRedeemed(null)}
                className="mt-5 h-11 w-full rounded-lg border border-white/15 bg-white/8 px-4 text-sm font-black transition hover:bg-white/12"
              >
                {available.length > 0
                  ? (lang === 'en' ? 'Back to my passes' : '남은 이용권 보기')
                  : (lang === 'en' ? 'Done' : '확인')}
              </button>
            </div>
          ) : activeCoupon ? (
            <>
              <PerfectDayTicket coupon={activeCoupon} lang={lang} />

              <div className="mt-6 text-xs font-black uppercase text-white/55">
                {lang === 'en' ? 'Pick one' : '하나를 골라요'}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedKind === 'game'}
                  onClick={() => setSelectedKind('game')}
                  className={[
                    'flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border-2 px-3 text-center transition',
                    selectedKind === 'game'
                      ? 'border-[#58E6FF] bg-[#58E6FF]/15 text-[#A9F3FF]'
                      : 'border-white/10 bg-white/[0.035] text-white/65 hover:border-[#58E6FF]/45',
                  ].join(' ')}
                >
                  <Gamepad2 size={28} />
                  <span className="text-sm font-black">{lang === 'en' ? 'Game Time' : '게임 시간'}</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedKind === 'media'}
                  onClick={() => setSelectedKind('media')}
                  className={[
                    'flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border-2 px-3 text-center transition',
                    selectedKind === 'media'
                      ? 'border-[#FF7BAC] bg-[#FF7BAC]/15 text-[#FFC0D7]'
                      : 'border-white/10 bg-white/[0.035] text-white/65 hover:border-[#FF7BAC]/45',
                  ].join(' ')}
                >
                  <Film size={28} />
                  <span className="text-sm font-black">{lang === 'en' ? 'Media Time' : '미디어 시간'}</span>
                </button>
              </div>

              <button
                type="button"
                disabled={!selectedKind || redeeming}
                onClick={() => { void redeem(); }}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FFE56B] px-4 text-sm font-black text-[#17151E] transition hover:bg-[#FFF09C] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <TicketCheck size={18} />
                {redeeming
                  ? (lang === 'en' ? 'Using pass...' : '이용권 사용 중...')
                  : (lang === 'en' ? 'Use this 30-minute pass' : '30분 이용권 사용하기')}
              </button>
            </>
          ) : (
            <div className="border-y border-dashed border-white/15 py-10 text-center">
              <TicketCheck size={42} className="mx-auto text-white/25" />
              <div className="mt-3 text-base font-black">
                {lang === 'en' ? 'No passes waiting' : '기다리는 이용권이 없어요'}
              </div>
              <div className="mx-auto mt-1 max-w-xs text-sm leading-6 text-white/48">
                {lang === 'en'
                  ? 'Finish every morning and evening routine in one day to earn one.'
                  : '하루의 오전과 저녁 루틴을 모두 끝내면 한 장을 받을 수 있어요.'}
              </div>
            </div>
          )}

          {used.length > 0 && (
            <section className="mt-6">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase text-white/45">
                <Clock3 size={13} />
                {lang === 'en' ? 'Recently used' : '최근 사용'}
              </div>
              <div className="divide-y divide-white/8 border-y border-white/8">
                {used.map(coupon => (
                  <div key={coupon.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2 font-bold text-white/70">
                      {coupon.redeemedFor === 'game' ? <Gamepad2 size={16} /> : <Film size={16} />}
                      {coupon.redeemedFor === 'game'
                        ? (lang === 'en' ? 'Game Time' : '게임 시간')
                        : (lang === 'en' ? 'Media Time' : '미디어 시간')}
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#58E6FF]">
                      <Check size={12} /> {formatPerfectDay(coupon.earnedForDay, lang)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
