import * as Icons from 'lucide-react';
import { LucideIcon } from '@/components/admin/IconPicker';
import { formatShortDateTime, type RewardRedemption } from '@/lib/admin/adminHelpers';
import type { Lang } from '@/contexts/LanguageContext';

interface RewardHistoryCopy {
  rewardHistory: string;
  refresh: string;
  refunded: string;
  refund: string;
  refundComplete: string;
  processing: string;
  noPurchases: string;
  sharedPayment: string;
  sharedWith: (a: string, ap: number, b: string, bp: number) => string;
  sharedBuyer: (a: string, b: string) => string;
}

interface RewardHistoryPanelProps {
  lang: Lang;
  copy: RewardHistoryCopy;
  redemptions: RewardRedemption[];
  refundInFlightId: string | null;
  onRefresh: () => void | Promise<void>;
  onRefund: (redemption: RewardRedemption) => void | Promise<void>;
}

export function RewardHistoryPanel({
  lang,
  copy,
  redemptions,
  refundInFlightId,
  onRefresh,
  onRefund,
}: RewardHistoryPanelProps) {
  return (
    <section className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A1B2E] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <Icons.History size={18} className="text-[#5B8EFF]" />
            </span>
            <h2 className="text-base font-black text-white">{copy.rewardHistory}</h2>
          </div>
          <p className="text-sm leading-6 text-white/54">
            {lang === 'en'
              ? 'Recent reward redemptions across the family.'
              : '최근 가족 보상 교환 내역입니다.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void onRefresh(); }}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-black text-white/64 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <Icons.RefreshCw size={14} />
          {copy.refresh}
        </button>
      </div>
      <div className="space-y-2.5">
        {redemptions.map(redemption => {
          const refunded = Boolean(redemption.refunded_at);
          const isJoint = redemption.is_joint_purchase;
          const u1 = redemption.joint_user1_name ?? '';
          const u2 = redemption.joint_user2_name ?? '';
          const buyerLabel = isJoint && u1 && u2
            ? copy.sharedBuyer(u1, u2)
            : redemption.user_name;
          return (
            <div
              key={redemption.id}
              className="flex flex-col gap-3 rounded-lg border border-white/8 bg-[#1A1B2E] p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#5B8EFF]/24 bg-[#5B8EFF]/10 text-[#8EAFFF]">
                  <LucideIcon name={redemption.reward_icon} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-white">
                    {redemption.reward_title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-white/54">
                    <span>{buyerLabel}</span>
                    <span className="h-1 w-1 rounded-full bg-white/30" />
                    <span>{formatShortDateTime(redemption.redeemed_at)}</span>
                    {!isJoint && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-white/30" />
                        <span className="font-bold text-[#FFB830]">{redemption.cost_charged}pt</span>
                      </>
                    )}
                  </div>
                  {isJoint && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#5B8EFF]/14 px-2 py-0.5 text-[10px] font-black text-[#8EAFFF]">
                      <Icons.Users2 size={11} />
                      {copy.sharedPayment} · {copy.sharedWith(u1, redemption.joint_user1_amount, u2, redemption.joint_user2_amount)}
                    </div>
                  )}
                  {refunded && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#4EEDB0]/14 px-2 py-0.5 text-[10px] font-black text-[#4EEDB0]">
                      <Icons.Undo2 size={11} />
                      {copy.refunded} · {redemption.refunded_at ? formatShortDateTime(redemption.refunded_at) : ''}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { void onRefund(redemption); }}
                disabled={refunded || refundInFlightId === redemption.id}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#111224] px-3 text-xs font-black text-white/64 transition-colors hover:border-[#4EEDB0]/40 hover:bg-[#4EEDB0]/10 hover:text-[#4EEDB0] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-[#111224] disabled:hover:text-white/64"
              >
                <Icons.Undo2 size={13} />
                {refundInFlightId === redemption.id ? copy.processing : refunded ? copy.refundComplete : copy.refund}
              </button>
            </div>
          );
        })}
        {redemptions.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/12 bg-[#111224] px-4 py-8 text-center">
            <Icons.History className="mx-auto mb-2 text-white/34" size={24} />
            <p className="text-sm font-bold text-white/50">{copy.noPurchases}</p>
          </div>
        )}
      </div>
    </section>
  );
}
