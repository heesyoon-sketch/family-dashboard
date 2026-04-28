'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { Reward, User } from '@/lib/db';
import { useFamilyStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';

// ── Icon renderer ─────────────────────────────────────────────────────────────

function pascalCase(s: string) {
  return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

const IconMap = Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>;

function RewardIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Comp = IconMap[pascalCase(name)] ?? Icons.Gift;
  return <Comp size={size} className={className} />;
}

function salePercentage(reward: Reward): number {
  if (!reward.sale_enabled) return 0;
  const n = Math.round(Number(reward.sale_percentage ?? 0));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function discountedCost(reward: Reward): number {
  const pct = salePercentage(reward);
  return Math.max(0, Math.floor(reward.cost_points * (100 - pct) / 100));
}

function saleLabel(reward: Reward): string {
  const customName = reward.sale_name?.trim();
  return customName || `${salePercentage(reward)}% OFF`;
}

// ── StoreModal ────────────────────────────────────────────────────────────────

export function StoreModal({
  user,
  balance,
  onClose,
  onRedeem,
}: {
  user: User;
  balance: number;
  onClose: () => void;
  onRedeem: (reward: Reward) => Promise<void>;
}) {
  const { t } = useLanguage();
  const rewards = useFamilyStore(state => state.rewards);
  const hydrate = useFamilyStore(state => state.hydrate);
  const hydrated = useFamilyStore(state => state.hydrated);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshRewards = useCallback(async () => {
    setRefreshing(true);
    try {
      await hydrate();
    } finally {
      setRefreshing(false);
    }
  }, [hydrate]);

  useEffect(() => {
    const channel = new BroadcastChannel('habit_sync');
    channel.onmessage = () => {
      refreshRewards().catch(error => console.warn('Failed to refresh rewards', error));
    };
    const onFocus = () => {
      refreshRewards().catch(error => console.warn('Failed to refresh rewards', error));
    };
    window.addEventListener('focus', onFocus);

    return () => {
      channel.close();
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshRewards]);

  const handleRedeem = async (reward: Reward) => {
    if (redeeming) return;

    await refreshRewards().catch(error => {
      console.warn('Failed to refresh rewards before redeem', error);
    });

    const latestReward = useFamilyStore.getState().rewards.find(r => r.id === reward.id) ?? reward;
    if (latestReward.is_hidden || latestReward.is_sold_out) {
      toast.error(latestReward.is_sold_out ? '품절된 보상입니다' : t('exchange_fail'));
      return;
    }
    const cost = discountedCost(latestReward);
    if (balance < cost) return;

    setRedeeming(reward.id);
    const effectiveReward: Reward = { ...latestReward, cost_points: cost };
    try {
      await onRedeem(effectiveReward);
      toast.success(`🎉 "${latestReward.title}" ${t('exchange_complete')}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('exchange_fail'));
    } finally {
      setRedeeming(null);
    }
  };

  const loading = !hydrated || refreshing;
  const visibleRewards = rewards.filter(reward => !reward.is_hidden);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-theme={user.theme}
        className="bg-[var(--bg)] rounded-2xl w-full max-w-xl flex flex-col border border-[var(--border)]"
        style={{ maxHeight: '82vh' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <span className="font-bold text-[var(--fg)] text-sm">🛒 {user.name}{t('user_store_suffix')}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--accent)]">💰 {balance}pt</span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-[var(--bg-card)] text-[var(--fg-muted)] flex items-center justify-center border border-[var(--border)]"
            >
              <Icons.X size={15} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-3">
          {loading && visibleRewards.length === 0 && (
            <div className="text-center text-[var(--fg-muted)] py-8 text-sm">{t('loading')}</div>
          )}
          {!loading && visibleRewards.length === 0 && (
            <div className="text-center text-[var(--fg-muted)] py-8 text-sm">
              {t('no_rewards')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {visibleRewards.map(r => {
              const itemTitle = r.title || (r as unknown as Record<string, string>).name || '';
              const pct = salePercentage(r);
              const hasDeal = pct > 0;
              const cost = discountedCost({ ...r, title: itemTitle });
              const soldOut = Boolean(r.is_sold_out);
              const canAfford = !soldOut && balance >= cost;
              const busy = redeeming === r.id;

              return (
                <motion.button
                  key={r.id}
                  layout
                  onClick={() => handleRedeem(r)}
                  disabled={!canAfford || !!redeeming}
                  className={[
                    'min-h-[92px] rounded-xl bg-[var(--bg-card)] border p-2 text-left transition-colors',
                    'flex flex-col justify-between gap-1 disabled:cursor-not-allowed',
                    hasDeal ? 'border-rose-400/60' : 'border-[var(--border)]',
                  ].join(' ')}
                  style={{
                    opacity: canAfford ? 1 : 0.48,
                    boxShadow: hasDeal ? '0 0 12px rgba(251, 113, 133, 0.16)' : undefined,
                  }}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className={[
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      hasDeal ? 'bg-rose-400/15' : 'bg-[var(--accent-glow)]',
                    ].join(' ')}>
                      <RewardIcon
                        name={r.icon}
                        size={17}
                        className={hasDeal ? 'text-rose-300' : 'text-[var(--accent)]'}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-[var(--fg)] leading-tight line-clamp-2">
                        {itemTitle}
                      </div>
                      {soldOut && (
                        <div className="inline-flex max-w-full rounded-full bg-zinc-500/20 px-1.5 py-0.5 text-[9px] font-bold text-zinc-300 leading-tight mt-1 truncate">
                          품절
                        </div>
                      )}
                      {!soldOut && hasDeal && (
                        <div className="inline-flex max-w-full rounded-full bg-rose-400/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 leading-tight mt-1 truncate">
                          {saleLabel(r)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1 min-w-0">
                      {hasDeal && (
                        <span className="text-[10px] line-through text-[var(--fg-muted)]">{r.cost_points}</span>
                      )}
                      <span className={[
                        'text-xs font-bold',
                        hasDeal ? 'text-rose-300' : 'text-[var(--fg-muted)]',
                      ].join(' ')}>
                        {cost}pt
                      </span>
                    </div>
                    <span className={[
                      'px-2 py-1 rounded-full text-[10px] font-bold shrink-0',
                      canAfford
                        ? hasDeal ? 'bg-rose-400 text-black' : 'bg-[var(--accent)] text-white'
                        : 'bg-transparent text-[var(--fg-muted)]',
                    ].join(' ')}>
                      {busy ? '…' : soldOut ? '품절' : t('redeem')}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
