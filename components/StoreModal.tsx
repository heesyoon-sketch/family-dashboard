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
  const users = useFamilyStore(state => state.users);
  const levelsByUser = useFamilyStore(state => state.levelsByUser);
  const hydrate = useFamilyStore(state => state.hydrate);
  const hydrated = useFamilyStore(state => state.hydrated);
  const purchaseRewardJoint = useFamilyStore(state => state.purchaseRewardJoint);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutReward, setCheckoutReward] = useState<Reward | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<'alone' | 'together'>('alone');
  const [jointUserId, setJointUserId] = useState('');
  const [userShare, setUserShare] = useState(0);
  const [partnerShare, setPartnerShare] = useState(0);

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

  const jointPartners = users.filter(member => member.id !== user.id);
  const jointPartner = jointPartners.find(member => member.id === jointUserId) ?? null;
  const jointPartnerBalance = jointPartner ? (levelsByUser[jointPartner.id]?.spendableBalance ?? 0) : 0;

  const openCheckout = (reward: Reward) => {
    const cost = discountedCost(reward);
    setCheckoutReward(reward);
    setCheckoutMode('alone');
    setJointUserId(jointPartners[0]?.id ?? '');
    setUserShare(Math.floor(cost / 2));
    setPartnerShare(cost - Math.floor(cost / 2));
  };

  const closeCheckout = () => {
    if (redeeming) return;
    setCheckoutReward(null);
  };

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
      setCheckoutReward(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('exchange_fail'));
    } finally {
      setRedeeming(null);
    }
  };

  const handleJointRedeem = async (reward: Reward) => {
    if (redeeming || !jointPartner) return;

    await refreshRewards().catch(error => {
      console.warn('Failed to refresh rewards before joint redeem', error);
    });

    const latestReward = useFamilyStore.getState().rewards.find(r => r.id === reward.id) ?? reward;
    if (latestReward.is_hidden || latestReward.is_sold_out) {
      toast.error(latestReward.is_sold_out ? '품절된 보상입니다' : t('exchange_fail'));
      return;
    }

    const cost = discountedCost(latestReward);
    const share1 = Math.max(0, Math.round(userShare) || 0);
    const share2 = Math.max(0, Math.round(partnerShare) || 0);
    if (share1 + share2 !== cost) return;
    if (balance < share1 || jointPartnerBalance < share2) return;

    setRedeeming(reward.id);
    try {
      await purchaseRewardJoint(latestReward.id, user.id, share1, jointPartner.id, share2);
      toast.success('합동 구매 성공!');
      setCheckoutReward(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('exchange_fail'));
    } finally {
      setRedeeming(null);
    }
  };

  const loading = !hydrated || refreshing;
  const visibleRewards = rewards.filter(reward => !reward.is_hidden);
  const checkoutCost = checkoutReward ? discountedCost(checkoutReward) : 0;
  const checkoutSoldOut = Boolean(checkoutReward?.is_sold_out);
  const shareTotal = Math.max(0, Math.round(userShare) || 0) + Math.max(0, Math.round(partnerShare) || 0);
  const jointInvalid =
    !jointPartner ||
    shareTotal !== checkoutCost ||
    userShare < 0 ||
    partnerShare < 0 ||
    balance < userShare ||
    jointPartnerBalance < partnerShare ||
    checkoutSoldOut;

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
                  onClick={() => openCheckout(r)}
                  disabled={soldOut || !!redeeming}
                  className={[
                    'min-h-[92px] rounded-xl bg-[var(--bg-card)] border p-2 text-left transition-colors',
                    'flex flex-col justify-between gap-1 disabled:cursor-not-allowed',
                    hasDeal ? 'border-rose-400/60' : 'border-[var(--border)]',
                  ].join(' ')}
                  style={{
                    opacity: soldOut ? 0.48 : 1,
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
                        ? hasDeal ? 'bg-rose-400 text-black' : 'bg-[var(--accent)] text-gray-950'
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

        {checkoutReward && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.62)' }}
            onClick={e => { if (e.target === e.currentTarget) closeCheckout(); }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <RewardIcon name={checkoutReward.icon} size={18} className="text-[var(--accent)]" />
                    <h3 className="truncate text-sm font-bold text-[var(--fg)]">{checkoutReward.title}</h3>
                  </div>
                  <div className="mt-1 text-xs text-[var(--fg-muted)]">
                    총 비용 <span className="font-bold text-[var(--accent)]">{checkoutCost}pt</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCheckout}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--fg-muted)]"
                >
                  <Icons.X size={15} />
                </button>
              </div>

              <div className="mb-2 text-sm font-bold text-[var(--fg)]">어떻게 결제할까요?</div>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCheckoutMode('alone')}
                  className={[
                    'min-h-14 rounded-xl border px-3 py-2 text-xs font-bold transition-colors',
                    checkoutMode === 'alone'
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-gray-950'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]',
                  ].join(' ')}
                >
                  혼자 결제하기
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutMode('together')}
                  disabled={jointPartners.length === 0}
                  className={[
                    'min-h-14 rounded-xl border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-40',
                    checkoutMode === 'together'
                      ? 'border-rose-400 bg-rose-400 text-black'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]',
                  ].join(' ')}
                >
                  🤝 같이 결제하기
                </button>
              </div>

              {checkoutMode === 'alone' ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--fg-muted)]">
                    {user.name} 혼자 {checkoutCost}pt를 결제합니다. 현재 잔액은 {balance}pt예요.
                    {balance < checkoutCost && (
                      <span className="ml-2 font-semibold text-rose-300">포인트가 부족해요</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)]">같이 결제할 가족</span>
                    <select
                      value={jointUserId}
                      onChange={e => setJointUserId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500"
                    >
                      {jointPartners.map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)]">{user.name}</span>
                      <input
                        type="number"
                        min={0}
                        max={checkoutCost}
                        value={userShare}
                        onChange={e => setUserShare(Number(e.target.value))}
                        className="h-10 w-full rounded-xl border border-gray-300 bg-white px-2 text-center text-sm font-bold text-gray-900 placeholder-gray-400 outline-none focus:border-gray-500"
                      />
                      <span className="mt-1 block text-[10px] text-[var(--fg-muted)]">잔액 {balance}pt</span>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)]">
                        {jointPartner?.name ?? '가족'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={checkoutCost}
                        value={partnerShare}
                        onChange={e => setPartnerShare(Number(e.target.value))}
                        className="h-10 w-full rounded-xl border border-gray-300 bg-white px-2 text-center text-sm font-bold text-gray-900 placeholder-gray-400 outline-none focus:border-gray-500"
                      />
                      <span className="mt-1 block text-[10px] text-[var(--fg-muted)]">잔액 {jointPartnerBalance}pt</span>
                    </label>
                  </div>

                  <div className={[
                    'rounded-xl border px-3 py-2 text-xs',
                    shareTotal === checkoutCost && !jointInvalid
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                      : 'border-rose-400/30 bg-rose-400/10 text-rose-300',
                  ].join(' ')}>
                    합계 {shareTotal}pt / 필요 {checkoutCost}pt
                    {shareTotal !== checkoutCost && <span className="ml-2">합계가 맞아야 해요</span>}
                    {balance < userShare && <span className="ml-2">{user.name} 잔액 부족</span>}
                    {jointPartner && jointPartnerBalance < partnerShare && <span className="ml-2">{jointPartner.name} 잔액 부족</span>}
                  </div>

                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (checkoutMode === 'alone') void handleRedeem(checkoutReward);
                  else void handleJointRedeem(checkoutReward);
                }}
                disabled={
                  redeeming === checkoutReward.id ||
                  checkoutSoldOut ||
                  (checkoutMode === 'alone' ? balance < checkoutCost : jointInvalid)
                }
                className={[
                  'mt-4 h-12 w-full rounded-xl text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40',
                  checkoutMode === 'alone'
                    ? 'bg-[var(--accent)] text-gray-950'
                    : 'bg-rose-400 text-black',
                ].join(' ')}
              >
                {redeeming === checkoutReward.id ? '결제 중…' : '결제 완료'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
