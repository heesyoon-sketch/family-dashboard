'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { User } from '@/lib/db';
import { createBrowserSupabase } from '@/lib/supabase';

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
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.from('rewards').select('*').order('cost_points').then(({ data }) => {
      setRewards(data ?? []);
      setLoading(false);
    });
  }, []);

  const handleRedeem = async (reward: Reward) => {
    if (balance < reward.cost_points || redeeming) return;
    setRedeeming(reward.id);
    try {
      await onRedeem(reward);
      toast.success(`🎉 "${reward.title}" 교환 완료!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '교환 실패');
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
          <span className="font-bold text-[var(--fg)] text-base">🛒 {user.name}의 상점</span>
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

        {/* body */}
        <div className="overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="text-center text-[var(--fg-muted)] py-8 text-sm">불러오는 중…</div>
          )}
          {!loading && rewards.length === 0 && (
            <div className="text-center text-[var(--fg-muted)] py-8 text-sm">
              등록된 리워드가 없습니다
            </div>
          )}
          {rewards.map(r => {
            const canAfford = balance >= r.cost_points;
            const busy = redeeming === r.id;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]"
                style={{ opacity: canAfford ? 1 : 0.5 }}
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
                  <RewardIcon name={r.icon} size={20} className="text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[var(--fg)] truncate">{r.title}</div>
                  <div className="text-xs text-[var(--fg-muted)]">{r.cost_points}pt</div>
                </div>
                <button
                  onClick={() => handleRedeem(r)}
                  disabled={!canAfford || !!redeeming}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors"
                  style={{
                    minHeight: 36,
                    background: canAfford ? 'var(--accent)' : 'transparent',
                    color: canAfford ? '#fff' : 'var(--fg-muted)',
                    cursor: canAfford && !redeeming ? 'pointer' : 'not-allowed',
                  }}
                >
                  {busy ? '…' : '교환'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
