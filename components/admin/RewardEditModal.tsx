'use client';

import * as Icons from 'lucide-react';
import { useEffect } from 'react';
import type { Reward } from '@/lib/db';
import { useLanguage } from '@/contexts/LanguageContext';
import { buildAdminCopy } from '@/lib/admin/adminCopy';
import { LucideIcon } from '@/components/admin/IconPicker';

interface RewardEditModalProps {
  reward: Reward;
  title: string;
  cost: number;
  salePercentage: number;
  saleName: string;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onCostChange: (value: number) => void;
  onSalePercentageChange: (value: number) => void;
  onSaleNameChange: (value: string) => void;
  onChangeIcon: () => void;
  onToggleSale: () => void;
  onSave: () => void;
  onClose: () => void;
}

export function RewardEditModal({
  reward,
  title,
  cost,
  salePercentage,
  saleName,
  saving,
  onTitleChange,
  onCostChange,
  onSalePercentageChange,
  onSaleNameChange,
  onChangeIcon,
  onToggleSale,
  onSave,
  onClose,
}: RewardEditModalProps) {
  const { lang, t } = useLanguage();
  const copy = buildAdminCopy(lang);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/72 p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={event => {
          event.preventDefault();
          onSave();
        }}
        className="w-full max-w-md overflow-hidden rounded-lg border border-white/14 bg-[#14162A] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FF7BAC]/12 text-[#FFB8CF]">
              <Icons.Pencil size={17} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-black text-white">
                {lang === 'en' ? 'Edit reward' : '보상 수정'}
              </h2>
              <p className="truncate text-xs font-bold text-white/42">{reward.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-11 w-11 place-items-center rounded-lg text-white/52 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-45"
            aria-label={copy.cancel}
            title={copy.cancel}
          >
            <Icons.X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={onChangeIcon}
              disabled={saving}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#FF7BAC]/24 bg-[#FF7BAC]/10 text-[#FFB8CF] transition-colors hover:border-[#FF7BAC]/50 disabled:opacity-45"
              aria-label={t('icon_change')}
              title={t('icon_change')}
            >
              <LucideIcon name={reward.icon} size={20} />
            </button>
            <label className="min-w-0 flex-1 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-white/42">
                {lang === 'en' ? 'Reward name' : '보상 이름'}
              </span>
              <input
                type="text"
                value={title}
                onChange={event => onTitleChange(event.target.value)}
                autoFocus
                className="h-11 w-full rounded-lg border border-white/10 bg-[#111224] px-3 text-sm font-bold text-white outline-none focus:border-[#FF7BAC]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase text-white/42">
                {lang === 'en' ? 'Price' : '가격'}
              </span>
              <span className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#111224] px-3">
                <Icons.Coins size={15} className="text-[#FFB830]" />
                <input
                  type="number"
                  min={1}
                  value={cost}
                  onChange={event => onCostChange(Number(event.target.value))}
                  className="min-w-0 flex-1 bg-transparent text-center text-sm font-black text-white outline-none"
                />
                <span className="text-xs font-bold text-white/40">pt</span>
              </span>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase text-white/42">
                {lang === 'en' ? 'Discount' : '할인율'}
              </span>
              <span className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#111224] px-3">
                <Icons.BadgePercent size={15} className="text-[#FF7BAC]" />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={salePercentage}
                  onChange={event => onSalePercentageChange(Number(event.target.value))}
                  className="min-w-0 flex-1 bg-transparent text-center text-sm font-black text-white outline-none"
                />
                <span className="text-xs font-bold text-white/40">%</span>
              </span>
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-black uppercase text-white/42">{copy.saleLabel}</span>
            <input
              type="text"
              value={saleName}
              onChange={event => onSaleNameChange(event.target.value)}
              placeholder={copy.saleLabel}
              className="h-11 w-full rounded-lg border border-white/10 bg-[#111224] px-3 text-sm font-bold text-white outline-none placeholder:text-white/28 focus:border-[#FF7BAC]"
            />
          </label>

          <button
            type="button"
            onClick={onToggleSale}
            disabled={saving}
            aria-pressed={Boolean(reward.sale_enabled)}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border text-sm font-black transition-colors disabled:opacity-45 ${
              reward.sale_enabled
                ? 'border-[#FF7BAC] bg-[#FF7BAC] text-[#220610]'
                : 'border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.07]'
            }`}
          >
            <Icons.BadgePercent size={16} />
            {lang === 'en' ? 'Manual sale' : '수동 세일'} {reward.sale_enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-white/8 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 rounded-lg border border-white/10 text-sm font-black text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-45"
          >
            {copy.cancel}
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] text-sm font-black text-[#071510] transition-colors hover:bg-[#7BF4C7] disabled:opacity-45"
          >
            {saving ? <Icons.LoaderCircle size={16} className="animate-spin" /> : <Icons.Save size={16} />}
            {lang === 'en' ? 'Save reward' : '보상 저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
