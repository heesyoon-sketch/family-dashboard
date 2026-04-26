'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { User } from '@/lib/db';
import { createBrowserSupabase } from '@/lib/supabase';
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Reward {
  id: string;
  title: string;
  cost_points: number;
  icon: string;
}

function normaliseRewardRow(row: Record<string, unknown>): Reward {
  return {
    id: row.id as string,
    title: (row.title ?? row.name ?? '') as string,
    cost_points: Number(row.cost_points ?? 0),
    icon: (row.icon ?? 'gift') as string,
  };
}

// ── Weekend deal config ───────────────────────────────────────────────────────

function isWeekendNow(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

function effectiveCost(reward: Reward, weekend: boolean): number {
  if (!weekend) return reward.cost_points;
  return Math.max(1, Math.floor(reward.cost_points * 0.7));
}

function initialWeekendState(): { weekend: boolean; countdown: string } {
  if (typeof window === 'undefined') return { weekend: false, countdown: '' };
  const weekend = isWeekendNow();
  return { weekend, countdown: weekend ? timeUntilWeekendEnds() : '' };
}

// Returns e.g. "23시간 47분" until next Monday 00:00 local time.
function timeUntilWeekendEnds(): string {
  const now = new Date();
  const day = now.getDay();
  const daysToMonday = day === 6 ? 2 : 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMonday);
  monday.setHours(0, 0, 0, 0);
  const diffMs = monday.getTime() - now.getTime();
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${h}시간 ${m}분`;
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
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [{ weekend, countdown }, setWeekendState] = useState(initialWeekendState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRewards = useCallback(async (): Promise<Reward[]> => {
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .order('cost_points');

    if (error) throw error;
    const nextRewards = (data ?? []).map((row: Record<string, unknown>) => normaliseRewardRow(row));
    setRewards(nextRewards);
    setLoading(false);
    return nextRewards;
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadRewards).catch(error => {
      console.warn('Failed to load rewards', error);
      setLoading(false);
    });

    const channel = new BroadcastChannel('habit_sync');
    channel.onmessage = () => {
      loadRewards().catch(error => console.warn('Failed to refresh rewards', error));
    };
    const onFocus = () => {
      loadRewards().catch(error => console.warn('Failed to refresh rewards', error));
    };
    window.addEventListener('focus', onFocus);

    return () => {
      channel.close();
      window.removeEventListener('focus', onFocus);
    };
  }, [loadRewards]);

  // Live countdown tick — only runs when weekend is true.
  useEffect(() => {
    if (!weekend) return;
    timerRef.current = setInterval(() => {
      setWeekendState(prev => ({ ...prev, countdown: timeUntilWeekendEnds() }));
    }, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [weekend]);

  const handleRedeem = async (reward: Reward) => {
    const latestRewards = await loadRewards().catch(error => {
      console.warn('Failed to refresh rewards before redeem', error);
      return rewards;
    });
    const latestReward = latestRewards.find(r => r.id === reward.id) ?? reward;
    const cost = effectiveCost(latestReward, weekend);
    if (balance < cost || redeeming) return;
    setRedeeming(reward.id);
    // Backend ignores this cost and recalculates from the DB row; this keeps the
    // local affordability check aligned with the displayed price.
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
        {/* header */}
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

        {/* weekend banner */}
        <AnimatePresence>
          {weekend && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden shrink-0"
            >
              <div className="mx-3 mt-2 px-2.5 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center gap-2">
                <span className="text-base leading-none">🎉</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-amber-400 leading-tight">주말 한정 혜택입니다!</div>
                  <div className="text-[10px] text-amber-400/70 mt-0.5 leading-tight">
                    종료까지 {countdown} 남음
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* body */}
        <div className="overflow-y-auto p-3">
          {loading && (
            <div className="text-center text-[var(--fg-muted)] py-8 text-sm">{t('loading')}</div>
          )}
          {!loading && rewards.length === 0 && (
            <div className="text-center text-[var(--fg-muted)] py-8 text-sm">
              {t('no_rewards')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {rewards.map(r => {
              const itemTitle = r.title || (r as unknown as Record<string, string>).name || '';
              const hasDeal   = weekend;
              const cost      = effectiveCost({ ...r, title: itemTitle }, weekend);
              const canAfford = balance >= cost;
              const busy      = redeeming === r.id;

              return (
                <motion.button
                  key={r.id}
                  layout
                  onClick={() => handleRedeem(r)}
                  disabled={!canAfford || !!redeeming}
                  className={[
                    'min-h-[82px] rounded-xl bg-[var(--bg-card)] border p-2 text-left transition-colors',
                    'flex flex-col justify-between gap-1 disabled:cursor-not-allowed',
                    hasDeal ? 'border-amber-400/50' : 'border-[var(--border)]',
                  ].join(' ')}
                  style={{
                    opacity: canAfford ? 1 : 0.48,
                    boxShadow: hasDeal ? '0 0 10px rgba(251, 191, 36, 0.14)' : undefined,
                  }}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className={[
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      hasDeal ? 'bg-amber-400/15' : 'bg-[var(--accent-glow)]',
                    ].join(' ')}>
                      <RewardIcon
                        name={r.icon}
                        size={17}
                        className={hasDeal ? 'text-amber-400' : 'text-[var(--accent)]'}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-[var(--fg)] leading-tight line-clamp-2">
                        {itemTitle}
                      </div>
                      {hasDeal && (
                        <div className="text-[9px] font-bold text-amber-400 leading-tight mt-0.5">
                          30% OFF
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
                        hasDeal ? 'text-amber-400' : 'text-[var(--fg-muted)]',
                      ].join(' ')}>
                        {cost}pt
                      </span>
                    </div>
                    <span className={[
                      'px-2 py-1 rounded-full text-[10px] font-bold shrink-0',
                      canAfford
                        ? hasDeal ? 'bg-amber-400 text-black' : 'bg-[var(--accent)] text-white'
                        : 'bg-transparent text-[var(--fg-muted)]',
                    ].join(' ')}>
                      {busy ? '…' : t('redeem')}
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
