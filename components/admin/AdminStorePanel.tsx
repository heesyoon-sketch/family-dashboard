import type { Dispatch, SetStateAction } from 'react';
import * as Icons from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Reward } from '@/lib/db';
import { LucideIcon } from '@/components/admin/IconPicker';
import { RewardHistoryPanel } from '@/components/admin/RewardHistoryPanel';
import type { RewardRedemption, SaveStatus } from '@/lib/admin/adminHelpers';
import { buildAdminCopy } from '@/lib/admin/adminCopy';

interface AdminStorePanelProps {
  rewards: Reward[];
  editingRewardId: string | null;
  setEditingRewardId: Dispatch<SetStateAction<string | null>>;
  editingRewardTitle: string;
  setEditingRewardTitle: Dispatch<SetStateAction<string>>;
  savingRewardId: string | null;
  rewardSaveStatus: Record<string, SaveStatus>;
  rewardCostDrafts: Record<string, number>;
  setRewardCostDrafts: Dispatch<SetStateAction<Record<string, number>>>;
  rewardSalePercentageDrafts: Record<string, number>;
  setRewardSalePercentageDrafts: Dispatch<SetStateAction<Record<string, number>>>;
  rewardSaleNameDrafts: Record<string, string>;
  setRewardSaleNameDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setRewardIconPickerRewardId: Dispatch<SetStateAction<string | null>>;
  saveRewardEdit: (rewardId: string, nextTitle?: string, closeEditor?: boolean) => void;
  deleteReward: (rewardId: string) => void;
  updateRewardCost: (rewardId: string, rawCost: number) => void;
  updateRewardSale: (rewardId: string, rawPercentage: number, rawName: string) => void;
  updateRewardFlags: (rewardId: string, patch: Partial<Pick<Reward, 'sale_enabled' | 'is_hidden' | 'is_sold_out'>>) => void;
  newRewardIcon: string;
  setRewardIconPickerOpen: Dispatch<SetStateAction<boolean>>;
  newRewardTitle: string;
  setNewRewardTitle: Dispatch<SetStateAction<string>>;
  newRewardPoints: number;
  setNewRewardPoints: Dispatch<SetStateAction<number>>;
  addReward: () => void;
  rewardRedemptions: RewardRedemption[];
  refundInFlightId: string | null;
  rewardProcessInFlightId: string | null;
  loadRewardRedemptions: () => void;
  refundRedemption: (redemption: RewardRedemption) => void;
  markRewardProcessed: (redemption: RewardRedemption) => void;
}

export function AdminStorePanel({
  rewards,
  editingRewardId,
  setEditingRewardId,
  editingRewardTitle,
  setEditingRewardTitle,
  savingRewardId,
  rewardSaveStatus,
  rewardCostDrafts,
  setRewardCostDrafts,
  rewardSalePercentageDrafts,
  setRewardSalePercentageDrafts,
  rewardSaleNameDrafts,
  setRewardSaleNameDrafts,
  setRewardIconPickerRewardId,
  saveRewardEdit,
  deleteReward,
  updateRewardCost,
  updateRewardSale,
  updateRewardFlags,
  newRewardIcon,
  setRewardIconPickerOpen,
  newRewardTitle,
  setNewRewardTitle,
  newRewardPoints,
  setNewRewardPoints,
  addReward,
  rewardRedemptions,
  refundInFlightId,
  rewardProcessInFlightId,
  loadRewardRedemptions,
  refundRedemption,
  markRewardProcessed,
}: AdminStorePanelProps) {
  const { lang, t } = useLanguage();
  const adminCopy = buildAdminCopy(lang);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A1B2E] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                <Icons.Store size={18} className="text-[#FF7BAC]" />
              </span>
              <h2 className="text-base font-black text-white">{t('store_management')}</h2>
            </div>
            <p className="text-sm leading-6 text-white/54">
              {lang === 'en'
                ? 'Manage rewards, prices, sales, and stock.'
                : '보상, 가격, 세일, 재고를 한 곳에서 관리하세요.'}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#FF7BAC]/20 bg-[#FF7BAC]/10 px-3 py-2 text-sm font-black text-[#FFB8CF]">
            <Icons.Tags size={15} />
            <span>{rewards.length}</span>
          </div>
        </div>

        <div className="space-y-2.5">
          {rewards.map(r => {
            const isEditing = editingRewardId === r.id;
            const saveStatus = rewardSaveStatus[r.id];
            const isSaving = savingRewardId === r.id || saveStatus === 'saving';
            const salePct = rewardSalePercentageDrafts[r.id] ?? r.sale_percentage ?? 0;
            return (
              <div
                key={r.id}
                className={`rounded-lg border bg-[#1A1B2E] p-3 transition-colors sm:p-4 ${
                  r.is_hidden ? 'border-white/6 opacity-70' : 'border-white/10'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRewardIconPickerRewardId(r.id)}
                        disabled={isSaving}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#FF7BAC]/24 bg-[#FF7BAC]/10 text-[#FFB8CF] transition-colors hover:border-[#FF7BAC]/50 hover:bg-[#FF7BAC]/16 disabled:opacity-50"
                        title={t('icon_change')}
                        aria-label={t('icon_change')}
                      >
                        <LucideIcon name={r.icon} size={21} />
                      </button>
                      <input
                        type="text"
                        value={editingRewardTitle}
                        onChange={e => setEditingRewardTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveRewardEdit(r.id); if (e.key === 'Escape') setEditingRewardId(null); }}
                        autoFocus
                        className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#FF7BAC] bg-[#111224] px-3 text-base font-bold text-white outline-none"
                      />
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => saveRewardEdit(r.id)}
                          disabled={isSaving}
                          className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#4EEDB0]/18 text-[#4EEDB0] transition-colors hover:bg-[#4EEDB0]/26 disabled:opacity-50"
                          title={t('confirm')}
                        >
                          <Icons.Check size={18} />
                        </button>
                        <button
                          onClick={() => setEditingRewardId(null)}
                          className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FF7BAC]/14 text-[#FFB8CF] transition-colors hover:bg-[#FF7BAC]/22"
                          title={adminCopy.cancel}
                        >
                          <Icons.X size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex h-11 items-center gap-2 rounded-lg border border-white/8 bg-[#111224] px-3">
                        <Icons.Coins size={15} className="text-[#FFB830]" />
                        <input
                          type="number"
                          value={rewardCostDrafts[r.id] ?? r.cost_points}
                          onChange={e => setRewardCostDrafts(prev => ({ ...prev, [r.id]: Number(e.target.value) }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveRewardEdit(r.id);
                            if (e.key === 'Escape') setEditingRewardId(null);
                          }}
                          min={1}
                          className="min-w-0 flex-1 bg-transparent text-center text-sm font-black text-white outline-none"
                          aria-label={lang === 'en' ? 'Points' : '포인트'}
                        />
                        <span className="text-xs font-bold text-white/40">pt</span>
                      </label>
                      <label className="flex h-11 items-center gap-2 rounded-lg border border-white/8 bg-[#111224] px-3">
                        <Icons.BadgePercent size={15} className="text-[#FF7BAC]" />
                        <input
                          type="number"
                          aria-label={lang === 'en' ? 'Discount %' : '할인율 %'}
                          value={salePct}
                          onChange={e => setRewardSalePercentageDrafts(prev => ({ ...prev, [r.id]: Number(e.target.value) }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveRewardEdit(r.id);
                            if (e.key === 'Escape') setEditingRewardId(null);
                          }}
                          min={0}
                          max={100}
                          className="min-w-0 flex-1 bg-transparent text-center text-sm font-black text-white outline-none"
                        />
                        <span className="text-xs font-bold text-white/40">%</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      aria-label={adminCopy.saleLabel}
                      value={rewardSaleNameDrafts[r.id] ?? r.sale_name ?? ''}
                      onChange={e => setRewardSaleNameDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void saveRewardEdit(r.id);
                        if (e.key === 'Escape') setEditingRewardId(null);
                      }}
                      placeholder={adminCopy.saleLabel}
                      className="min-h-11 w-full rounded-lg border border-white/10 bg-[#111224] px-3 text-sm font-bold text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#FF7BAC]"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <button
                      type="button"
                      onClick={() => setRewardIconPickerRewardId(r.id)}
                      disabled={isSaving}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#FF7BAC]/24 bg-[#FF7BAC]/10 text-[#FFB8CF] transition-colors hover:border-[#FF7BAC]/50 hover:bg-[#FF7BAC]/16 disabled:opacity-50"
                      title={t('icon_change')}
                      aria-label={t('icon_change')}
                    >
                      <LucideIcon name={r.icon} size={21} />
                    </button>

                    <div className="min-w-0 flex-1">
                      {/* Title row + edit/delete actions */}
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="min-w-0 truncate text-base font-black text-white">{r.title}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {(r.sale_percentage ?? 0) > 0 && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${
                                r.sale_enabled
                                  ? 'bg-[#FF7BAC]/16 text-[#FFB8CF]'
                                  : 'bg-white/[0.06] text-white/45'
                              }`}>
                                <Icons.BadgePercent size={11} />
                                {r.sale_enabled
                                  ? (r.sale_name?.trim() || `${r.sale_percentage}% OFF`)
                                  : `${adminCopy.saleOff} · ${r.sale_percentage}%`}
                              </span>
                            )}
                            {r.is_hidden && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-black text-white/55">
                                <Icons.EyeOff size={11} />
                                {adminCopy.hidden}
                              </span>
                            )}
                            {r.is_sold_out && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFB830]/16 px-2 py-0.5 text-[11px] font-black text-[#FFB830]">
                                <Icons.PackageX size={11} />
                                {adminCopy.soldOut}
                              </span>
                            )}
                            {saveStatus === 'saved' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#4EEDB0]/14 px-2 py-0.5 text-[11px] font-black text-[#4EEDB0]">
                                <Icons.Check size={11} />
                                {lang === 'en' ? 'Saved' : '저장됨'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            onClick={() => {
                              setEditingRewardId(r.id);
                              setEditingRewardTitle(r.title);
                              setRewardCostDrafts(prev => ({ ...prev, [r.id]: r.cost_points }));
                              setRewardSalePercentageDrafts(prev => ({ ...prev, [r.id]: r.sale_percentage ?? 0 }));
                              setRewardSaleNameDrafts(prev => ({ ...prev, [r.id]: r.sale_name ?? '' }));
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.045] text-white/54 transition-colors hover:bg-white/[0.08] hover:text-white"
                            title={lang === 'en' ? 'Edit reward' : '보상 수정'}
                            aria-label={lang === 'en' ? 'Edit reward' : '보상 수정'}
                          >
                            <Icons.Pencil size={16} />
                          </button>
                          <button
                            onClick={() => deleteReward(r.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF7BAC]/14 text-[#FFB8CF] transition-colors hover:bg-[#FF7BAC]/22"
                            title={t('delete')}
                            aria-label={t('delete')}
                          >
                            <Icons.Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Inline price + sale controls */}
                      <div className="mt-3 grid gap-2 sm:grid-cols-[120px_120px_minmax(0,1fr)]">
                        <label className="flex h-10 items-center gap-2 rounded-lg border border-white/8 bg-[#111224] px-2">
                          <Icons.Coins size={15} className="text-[#FFB830]" />
                          <input
                            type="number"
                            value={rewardCostDrafts[r.id] ?? r.cost_points}
                            onChange={e => setRewardCostDrafts(prev => ({ ...prev, [r.id]: Number(e.target.value) }))}
                            onBlur={e => { void updateRewardCost(r.id, Number(e.target.value)); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') {
                                setRewardCostDrafts(prev => ({ ...prev, [r.id]: r.cost_points }));
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            min={1}
                            disabled={isSaving}
                            className="min-w-0 flex-1 bg-transparent text-center text-sm font-black text-white outline-none"
                            aria-label={lang === 'en' ? 'Points' : '포인트'}
                          />
                          <span className="text-xs font-bold text-white/40">pt</span>
                        </label>
                        <label className="flex h-10 items-center gap-2 rounded-lg border border-white/8 bg-[#111224] px-2">
                          <Icons.BadgePercent size={15} className="text-[#FF7BAC]" />
                          <input
                            type="number"
                            aria-label={lang === 'en' ? 'Discount %' : '할인율 %'}
                            value={salePct}
                            onChange={e => setRewardSalePercentageDrafts(prev => ({ ...prev, [r.id]: Number(e.target.value) }))}
                            onBlur={e => {
                              void updateRewardSale(
                                r.id,
                                Number(e.target.value),
                                rewardSaleNameDrafts[r.id] ?? r.sale_name ?? '',
                              );
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') {
                                setRewardSalePercentageDrafts(prev => ({ ...prev, [r.id]: r.sale_percentage ?? 0 }));
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            min={0}
                            max={100}
                            disabled={isSaving}
                            className="min-w-0 flex-1 bg-transparent text-center text-sm font-black text-white outline-none"
                          />
                          <span className="text-xs font-bold text-white/40">%</span>
                        </label>
                        <input
                          type="text"
                          aria-label={adminCopy.saleLabel}
                          value={rewardSaleNameDrafts[r.id] ?? r.sale_name ?? ''}
                          onChange={e => setRewardSaleNameDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
                          onBlur={e => {
                            void updateRewardSale(
                              r.id,
                              rewardSalePercentageDrafts[r.id] ?? r.sale_percentage ?? 0,
                              e.target.value,
                            );
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') {
                              setRewardSaleNameDrafts(prev => ({ ...prev, [r.id]: r.sale_name ?? '' }));
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder={adminCopy.saleLabel}
                          disabled={isSaving}
                          className="min-h-10 rounded-lg border border-white/8 bg-[#111224] px-3 text-sm font-bold text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#FF7BAC]"
                        />
                      </div>

                      {/* Toggles */}
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => { void updateRewardFlags(r.id, { sale_enabled: !r.sale_enabled }); }}
                          disabled={isSaving}
                          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-black transition-colors disabled:opacity-50 ${
                            r.sale_enabled
                              ? 'bg-[#FF7BAC] text-[#220610]'
                              : 'bg-white/[0.045] text-white/54 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          <Icons.BadgePercent size={13} />
                          {lang === 'en' ? 'Sale' : '세일'} {r.sale_enabled ? 'ON' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void updateRewardFlags(r.id, { is_hidden: !r.is_hidden }); }}
                          disabled={isSaving}
                          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-black transition-colors disabled:opacity-50 ${
                            r.is_hidden
                              ? 'bg-white/[0.12] text-white'
                              : 'bg-white/[0.045] text-white/54 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          {r.is_hidden ? <Icons.EyeOff size={13} /> : <Icons.Eye size={13} />}
                          {r.is_hidden ? adminCopy.hidden : adminCopy.visible}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void updateRewardFlags(r.id, { is_sold_out: !r.is_sold_out }); }}
                          disabled={isSaving}
                          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-black transition-colors disabled:opacity-50 ${
                            r.is_sold_out
                              ? 'bg-[#FFB830] text-[#221606]'
                              : 'bg-white/[0.045] text-white/54 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          {r.is_sold_out ? <Icons.PackageX size={13} /> : <Icons.Package size={13} />}
                          {r.is_sold_out ? adminCopy.soldOut : adminCopy.inStock}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {rewards.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/12 bg-[#111224] px-4 py-8 text-center">
              <Icons.Gift className="mx-auto mb-2 text-white/34" size={24} />
              <p className="text-sm font-bold text-white/50">{t('no_rewards_registered')}</p>
            </div>
          )}
        </div>

        {/* Add new reward */}
        <div className="mt-5 rounded-lg border border-white/10 bg-[#111224] p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <Icons.PlusCircle size={17} className="text-[#FF7BAC]" />
            <h3 className="text-sm font-black text-white">{t('add_new_reward')}</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-[44px_minmax(0,1fr)_88px_auto]">
            <button
              onClick={() => setRewardIconPickerOpen(true)}
              className="flex h-11 w-full items-center justify-center rounded-lg border border-[#FF7BAC]/24 bg-[#FF7BAC]/10 text-[#FFB8CF] transition-colors hover:border-[#FF7BAC]/50 hover:bg-[#FF7BAC]/16"
              title={t('icon_select')}
              aria-label={t('icon_select')}
            >
              <LucideIcon name={newRewardIcon} size={20} />
            </button>
            <input
              type="text"
              value={newRewardTitle}
              onChange={e => setNewRewardTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addReward()}
              placeholder={t('reward_name_placeholder')}
              className="min-h-[var(--touch-target)] min-w-0 rounded-lg border border-white/10 bg-[#1A1B2E] px-3 text-base font-bold text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#FF7BAC]"
            />
            <input
              type="number"
              value={newRewardPoints}
              onChange={e => setNewRewardPoints(Number(e.target.value))}
              min={1}
              aria-label={lang === 'en' ? 'Points' : '포인트'}
              className="min-h-[var(--touch-target)] rounded-lg border border-white/10 bg-[#1A1B2E] px-3 text-center font-black text-white outline-none transition-colors focus:border-[#FF7BAC]"
            />
            <button
              onClick={addReward}
              className="inline-flex min-h-[var(--touch-target)] items-center justify-center gap-2 rounded-lg bg-[#FF7BAC] px-4 text-sm font-black text-[#220610] transition-colors hover:bg-[#FF99BF]"
            >
              <Icons.Plus size={16} />
              {t('add')}
            </button>
          </div>
        </div>
      </section>

      <RewardHistoryPanel
        lang={lang}
        copy={{
          rewardHistory: adminCopy.rewardHistory,
          refresh: adminCopy.refresh,
          pending: adminCopy.pending,
          processed: adminCopy.processed,
          markProcessed: adminCopy.markProcessed,
          processedAt: adminCopy.processedAt,
          processedBy: adminCopy.processedBy,
          processorUnknown: adminCopy.processorUnknown,
          refunded: adminCopy.refunded,
          refund: adminCopy.refund,
          refundComplete: adminCopy.refundComplete,
          processing: adminCopy.processing,
          noPurchases: adminCopy.noPurchases,
          sharedPayment: adminCopy.sharedPayment,
          sharedWith: adminCopy.sharedWith,
          sharedBuyer: adminCopy.sharedBuyer,
        }}
        redemptions={rewardRedemptions}
        refundInFlightId={refundInFlightId}
        processInFlightId={rewardProcessInFlightId}
        onRefresh={loadRewardRedemptions}
        onRefund={refundRedemption}
        onMarkProcessed={markRewardProcessed}
      />
    </div>
  );
}
