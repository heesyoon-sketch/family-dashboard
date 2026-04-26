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
        className="bg-[var(--bg)] rounded-2xl w-full max-w-sm flex flex-col border border-[var(--border)]"
        style={{ maxHeight: '80vh' }}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <span className="font-bold text-[var(--fg)] text-base">🛒 {user.name}{t('user_store_suffix')}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[var(--accent)]">💰 {balance}pt</span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[var(--bg-card)] text-[var(--fg-muted)] flex items-center justify-center border border-[var(--border)]"
            >
              <Icons.X size={16} />
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
              <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center gap-2">
                <span className="text-lg leading-none">🎉</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-amber-400 leading-tight">주말 한정 혜택입니다!</div>
                  <div className="text-[10px] text-amber-400/70 mt-0.5 leading-tight">
                    종료까지 {countdown} 남음
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* body */}
        <div className="overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="text-center text-[var(--fg-muted)] py-8 text-sm">{t('loading')}</div>
          )}
          {!loading && rewards.length === 0 && (
            <div className="text-center text-[var(--fg-muted)] py-8 text-sm">
              {t('no_rewards')}
            </div>
          )}
          {rewards.map(r => {
            // Defensive: raw Supabase rows sometimes use `name` instead of `title`.
            const itemTitle = r.title || (r as unknown as Record<string, string>).name || '';
            const hasDeal   = weekend;
            const cost      = effectiveCost({ ...r, title: itemTitle }, weekend);
            const canAfford = balance >= cost;
            const busy      = redeeming === r.id;

            return (
              <motion.div
                key={r.id}
                layout
                className={[
                  'flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border transition-colors',
                  hasDeal ? 'border-amber-400/50' : 'border-[var(--border)]',
                ].join(' ')}
                style={{
                  opacity: canAfford ? 1 : 0.5,
                  boxShadow: hasDeal ? '0 0 12px rgba(251, 191, 36, 0.18)' : undefined,
                }}
              >
                {/* icon */}
                <div className={[
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                  hasDeal ? 'bg-amber-400/15' : 'bg-[var(--accent-glow)]',
                ].join(' ')}>
                  <RewardIcon
                    name={r.icon}
                    size={20}
                    className={hasDeal ? 'text-amber-400' : 'text-[var(--accent)]'}
                  />
                </div>

                {/* info */}
                <div className="flex-1 min-w-0">
                  {/* title + badge */}
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--fg)] leading-snug">
                      {itemTitle}{hasDeal ? ' (주말 30% 특가!)' : ''}
                    </span>
                  </div>

                  {/* price line */}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {hasDeal ? (
                      <>
                        <span className="text-xs line-through text-[var(--fg-muted)]">{r.cost_points}pt</span>
                        <span className="text-sm font-bold text-amber-400">{cost}pt</span>
                        <span className="px-1 py-px rounded bg-amber-400/20 text-[10px] font-bold text-amber-400 leading-tight shrink-0">
                          🔥 30% OFF
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--fg-muted)]">{cost}pt</span>
                    )}
                  </div>
                </div>

                {/* buy button */}
                <button
                  onClick={() => handleRedeem(r)}
                  disabled={!canAfford || !!redeeming}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors"
                  style={{
                    minHeight: 36,
                    background: canAfford
                      ? hasDeal ? 'rgb(251 191 36)' : 'var(--accent)'
                      : 'transparent',
                    color: canAfford
                      ? hasDeal ? '#000' : '#fff'
                      : 'var(--fg-muted)',
                    cursor: canAfford && !redeeming ? 'pointer' : 'not-allowed',
                  }}
                >
                  {busy ? '…' : t('redeem')}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
