import { useMemo, type Dispatch, type SetStateAction } from 'react';
import * as Icons from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { AutomaticSaleConfig, Reward } from '@/lib/db';
import { LucideIcon } from '@/components/admin/IconPicker';
import { RewardEditModal } from '@/components/admin/RewardEditModal';
import { RewardHistoryPanel } from '@/components/admin/RewardHistoryPanel';
import type { RewardRedemption, SaveStatus } from '@/lib/admin/adminHelpers';
import { buildAdminCopy } from '@/lib/admin/adminCopy';
import {
  holidayCountries,
  holidaySubdivisions,
  publicHolidayDates,
} from '@/lib/holidayCalendar';
import {
  automaticSaleLabel,
  formatAutomaticSaleDate,
  nextAutomaticSaleStatus,
} from '@/lib/automaticSale';
import { useFamilyStore } from '@/lib/store';

interface AdminStorePanelProps {
  rewards: Reward[];
  automaticSaleConfig: AutomaticSaleConfig;
  setAutomaticSaleConfig: Dispatch<SetStateAction<AutomaticSaleConfig>>;
  automaticSaleSaving: boolean;
  saveAutomaticSale: () => void;
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
  updateRewardFlags: (rewardId: string, patch: Partial<Pick<Reward, 'sale_enabled'>>) => void;
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
  automaticSaleConfig,
  setAutomaticSaleConfig,
  automaticSaleSaving,
  saveAutomaticSale,
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
  const savedAutomaticSaleConfig = useFamilyStore(state => state.automaticSaleConfig);
  const savedAutomaticSaleStatus = useFamilyStore(state => state.automaticSaleStatus);
  const countryOptions = useMemo(() => holidayCountries(lang), [lang]);
  const subdivisionOptions = useMemo(
    () => holidaySubdivisions(automaticSaleConfig.countryCode, lang),
    [automaticSaleConfig.countryCode, lang],
  );
  const upcomingHolidays = useMemo(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const year = new Date().getFullYear();
      return publicHolidayDates(
        automaticSaleConfig.countryCode,
        automaticSaleConfig.subdivisionCode,
        year,
        year + 1,
        lang,
      ).filter(holiday => holiday.date >= today).slice(0, 3);
    } catch {
      return [];
    }
  }, [automaticSaleConfig.countryCode, automaticSaleConfig.subdivisionCode, lang]);
  const nextSavedAutomaticSale = useMemo(
    () => nextAutomaticSaleStatus(savedAutomaticSaleConfig),
    [savedAutomaticSaleConfig],
  );
  const savedScheduleEnabled = savedAutomaticSaleConfig.weekendEnabled || savedAutomaticSaleConfig.holidayEnabled;
  const editingReward = rewards.find(reward => reward.id === editingRewardId) ?? null;

  const openRewardEditor = (reward: Reward) => {
    setEditingRewardId(reward.id);
    setEditingRewardTitle(reward.title);
    setRewardCostDrafts(previous => ({ ...previous, [reward.id]: reward.cost_points }));
    setRewardSalePercentageDrafts(previous => ({ ...previous, [reward.id]: reward.sale_percentage ?? 0 }));
    setRewardSaleNameDrafts(previous => ({ ...previous, [reward.id]: reward.sale_name ?? '' }));
  };

  return (
    <div className="space-y-5">
      {editingReward && (
        <RewardEditModal
          reward={editingReward}
          title={editingRewardTitle}
          cost={rewardCostDrafts[editingReward.id] ?? editingReward.cost_points}
          salePercentage={rewardSalePercentageDrafts[editingReward.id] ?? editingReward.sale_percentage ?? 0}
          saleName={rewardSaleNameDrafts[editingReward.id] ?? editingReward.sale_name ?? ''}
          saving={savingRewardId === editingReward.id || rewardSaveStatus[editingReward.id] === 'saving'}
          onTitleChange={setEditingRewardTitle}
          onCostChange={value => setRewardCostDrafts(previous => ({ ...previous, [editingReward.id]: value }))}
          onSalePercentageChange={value => setRewardSalePercentageDrafts(previous => ({ ...previous, [editingReward.id]: value }))}
          onSaleNameChange={value => setRewardSaleNameDrafts(previous => ({ ...previous, [editingReward.id]: value }))}
          onChangeIcon={() => setRewardIconPickerRewardId(editingReward.id)}
          onToggleSale={() => { void updateRewardFlags(editingReward.id, { sale_enabled: !editingReward.sale_enabled }); }}
          onSave={() => { void saveRewardEdit(editingReward.id); }}
          onClose={() => setEditingRewardId(null)}
        />
      )}
      <section className="rounded-lg border border-[#4EEDB0]/20 bg-[#101D22] p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4EEDB0]/12 shadow-[inset_0_0_0_1px_rgba(78,237,176,0.18)]">
              <Icons.CalendarDays size={18} className="text-[#4EEDB0]" />
            </span>
            <div>
              <h2 className="text-base font-black text-white">
                {lang === 'en' ? 'Automatic sale days' : '자동 세일 날짜'}
              </h2>
              <p className="mt-1 text-xs font-bold text-white/48">
                {lang === 'en' ? 'Public holidays and weekends' : '공휴일 및 주말'}
              </p>
            </div>
          </div>
          <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-[#FFB830]/24 bg-[#FFB830]/10 px-3 sm:w-36">
            <Icons.BadgePercent size={16} className="text-[#FFB830]" />
            <input
              type="number"
              min={0}
              max={100}
              value={automaticSaleConfig.percentage}
              onChange={event => setAutomaticSaleConfig(current => ({
                ...current,
                percentage: Number(event.target.value),
              }))}
              className="min-w-0 flex-1 bg-transparent text-center text-sm font-black text-white outline-none"
              aria-label={lang === 'en' ? 'Automatic discount percentage' : '자동 할인율'}
            />
            <span className="text-xs font-black text-[#FFB830]">%</span>
          </label>
        </div>

        <div className={`mb-3 flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 ${
          savedAutomaticSaleStatus.active
            ? 'border-[#4EEDB0]/35 bg-[#4EEDB0]/12'
            : 'border-white/10 bg-white/[0.035]'
        }`}>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            savedAutomaticSaleStatus.active ? 'bg-[#4EEDB0] shadow-[0_0_10px_rgba(78,237,176,0.8)]' : 'bg-white/24'
          }`} />
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-black ${savedAutomaticSaleStatus.active ? 'text-[#7BF4C7]' : 'text-white/70'}`}>
              {savedAutomaticSaleStatus.active
                ? `${automaticSaleLabel(savedAutomaticSaleStatus, lang)} · ${savedAutomaticSaleStatus.percentage}% ${lang === 'en' ? 'off now' : '현재 할인'}`
                : savedScheduleEnabled
                  ? (lang === 'en' ? 'No automatic sale today' : '오늘은 자동 세일이 없어요')
                  : (lang === 'en' ? 'Automatic sales are off' : '자동 세일이 꺼져 있어요')}
            </div>
            {!savedAutomaticSaleStatus.active && nextSavedAutomaticSale && (
              <div className="mt-0.5 truncate text-xs font-bold text-white/42">
                {lang === 'en' ? 'Next' : '다음 세일'} · {formatAutomaticSaleDate(nextSavedAutomaticSale.localDate, lang)} · {nextSavedAutomaticSale.percentage}%
              </div>
            )}
          </div>
          <Icons.DatabaseZap size={16} className={savedAutomaticSaleStatus.active ? 'text-[#4EEDB0]' : 'text-white/28'} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAutomaticSaleConfig(current => ({
              ...current,
              weekendEnabled: !current.weekendEnabled,
            }))}
            aria-pressed={automaticSaleConfig.weekendEnabled}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-black transition-colors ${
              automaticSaleConfig.weekendEnabled
                ? 'border-[#4EEDB0]/45 bg-[#4EEDB0]/16 text-[#7BF4C7]'
                : 'border-white/10 bg-white/[0.035] text-white/48'
            }`}
          >
            <Icons.CalendarRange size={16} />
            {lang === 'en' ? 'Weekends' : '주말'}
            {automaticSaleConfig.weekendEnabled ? ' ON' : ' OFF'}
          </button>
          <button
            type="button"
            onClick={() => setAutomaticSaleConfig(current => ({
              ...current,
              holidayEnabled: !current.holidayEnabled,
            }))}
            aria-pressed={automaticSaleConfig.holidayEnabled}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-black transition-colors ${
              automaticSaleConfig.holidayEnabled
                ? 'border-[#FF7BAC]/45 bg-[#FF7BAC]/16 text-[#FFB8CF]'
                : 'border-white/10 bg-white/[0.035] text-white/48'
            }`}
          >
            <Icons.CalendarHeart size={16} />
            {lang === 'en' ? 'Holidays' : '공휴일'}
            {automaticSaleConfig.holidayEnabled ? ' ON' : ' OFF'}
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[11px] font-black uppercase text-white/42">
              {lang === 'en' ? 'Country' : '국가'}
            </span>
            <select
              value={automaticSaleConfig.countryCode}
              onChange={event => {
                const countryCode = event.target.value;
                const firstSubdivision = holidaySubdivisions(countryCode, lang)[0]?.code ?? '';
                setAutomaticSaleConfig(current => ({
                  ...current,
                  countryCode,
                  subdivisionCode: firstSubdivision,
                  holidayDates: [],
                  generatedThrough: 0,
                }));
              }}
              className="h-11 w-full rounded-lg border border-white/10 bg-[#111821] px-3 text-sm font-bold text-white outline-none focus:border-[#4EEDB0]/55"
            >
              {countryOptions.map(country => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-black uppercase text-white/42">
              {lang === 'en' ? 'Province / state' : '주 / 지역'}
            </span>
            <select
              value={automaticSaleConfig.subdivisionCode}
              disabled={subdivisionOptions.length === 0}
              onChange={event => setAutomaticSaleConfig(current => ({
                ...current,
                subdivisionCode: event.target.value,
                holidayDates: [],
                generatedThrough: 0,
              }))}
              className="h-11 w-full rounded-lg border border-white/10 bg-[#111821] px-3 text-sm font-bold text-white outline-none disabled:opacity-45 focus:border-[#4EEDB0]/55"
            >
              {subdivisionOptions.length === 0 && <option value="">{lang === 'en' ? 'National' : '전국'}</option>}
              {subdivisionOptions.map(subdivision => (
                <option key={subdivision.code} value={subdivision.code}>{subdivision.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-3 border-t border-white/8 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 text-xs text-white/48">
            <div className="flex items-center gap-1.5 font-bold text-white/64">
              <Icons.Landmark size={13} className="text-[#FFB830]" />
              {lang === 'en' ? 'Public holidays only' : '공식 공휴일만 적용'}
              {automaticSaleConfig.generatedThrough > 0 && ` · ${automaticSaleConfig.generatedThrough}`}
            </div>
            <div className="mt-1 truncate">{automaticSaleConfig.timezone}</div>
            {upcomingHolidays.length > 0 && (
              <div className="mt-1 truncate">
                {upcomingHolidays.map(holiday => `${holiday.date} ${holiday.name}`).join(' · ')}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={saveAutomaticSale}
            disabled={automaticSaleSaving}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] px-4 text-sm font-black text-[#071510] transition-colors hover:bg-[#7BF4C7] disabled:opacity-55"
          >
            {automaticSaleSaving ? <Icons.LoaderCircle size={16} className="animate-spin" /> : <Icons.Save size={16} />}
            {lang === 'en' ? 'Save schedule' : '일정 저장'}
          </button>
        </div>
      </section>

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
                ? 'Manage rewards, prices, and sales.'
                : '보상, 가격, 세일을 한 곳에서 관리하세요.'}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#FF7BAC]/20 bg-[#FF7BAC]/10 px-3 py-2 text-sm font-black text-[#FFB8CF]">
            <Icons.Tags size={15} />
            <span>{rewards.length}</span>
          </div>
        </div>

        <div className="space-y-2.5">
          {rewards.map(reward => {
            const saveStatus = rewardSaveStatus[reward.id];
            return (
              <div
                key={reward.id}
                className="flex min-h-16 items-center gap-3 rounded-lg border border-white/10 bg-[#1A1B2E] p-3"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#FF7BAC]/20 bg-[#FF7BAC]/10 text-[#FFB8CF]">
                  <LucideIcon name={reward.icon} size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black text-white">{reward.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-black">
                    <span className="inline-flex items-center gap-1 text-[#FFDB7A]">
                      <Icons.Coins size={12} />{reward.cost_points}pt
                    </span>
                    {reward.sale_enabled && (reward.sale_percentage ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FF7BAC]/14 px-2 py-0.5 text-[#FFB8CF]">
                        <Icons.BadgePercent size={11} />
                        {reward.sale_name?.trim() || `${reward.sale_percentage}% OFF`}
                      </span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="inline-flex items-center gap-1 text-[#4EEDB0]">
                        <Icons.Check size={11} />{lang === 'en' ? 'Saved' : '저장됨'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => openRewardEditor(reward)}
                    className="grid h-11 w-11 place-items-center rounded-lg bg-white/[0.045] text-white/58 transition-colors hover:bg-white/[0.08] hover:text-white"
                    title={lang === 'en' ? 'Edit reward' : '보상 수정'}
                    aria-label={lang === 'en' ? 'Edit reward' : '보상 수정'}
                  >
                    <Icons.Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteReward(reward.id)}
                    className="grid h-11 w-11 place-items-center rounded-lg bg-[#FF7BAC]/12 text-[#FFB8CF] transition-colors hover:bg-[#FF7BAC]/20"
                    title={t('delete')}
                    aria-label={t('delete')}
                  >
                    <Icons.Trash2 size={15} />
                  </button>
                </div>
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
