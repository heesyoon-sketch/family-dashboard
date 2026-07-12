'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  if (reward.sale_enabled && reward.sale_price != null) {
    return Math.max(0, Math.min(reward.cost_points, Math.round(reward.sale_price)));
  }
  const pct = salePercentage(reward);
  return Math.max(0, Math.floor(reward.cost_points * (100 - pct) / 100));
}

function saleLabel(reward: Reward): string {
  const customName = reward.sale_name?.trim();
  if (customName) return customName;
  if (reward.sale_price != null) return 'SALE';
  return `${salePercentage(reward)}% OFF`;
}

// ── Cash trade ($1 = 100pt, price rounded to the nearest dollar) ─────────────

const CASH_MAX_CENTS = 99999;

function sanitizeCashInput(raw: string): string {
  let out = raw.replace(/[^0-9.]/g, '');
  const firstDot = out.indexOf('.');
  if (firstDot !== -1) {
    out = out.slice(0, firstDot + 1) + out.slice(firstDot + 1).replace(/\./g, '');
    out = out.slice(0, firstDot + 3); // at most 2 decimals
  }
  return out.slice(0, 7);
}

function cashCents(input: string): number {
  const value = Number.parseFloat(input);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

/** Must mirror redeem_cash_trade_atomic: nearest dollar, minimum $1. */
function cashPoints(cents: number): number {
  if (cents <= 0) return 0;
  return Math.max(1, Math.round(cents / 100)) * 100;
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
  const { lang, t } = useLanguage();
  const copy = {
    soldOut: lang === 'en' ? 'Sold out' : '품절',
    totalCost: lang === 'en' ? 'Total cost' : '총 비용',
    checkoutPrompt: lang === 'en' ? 'How do you want to pay?' : '어떻게 결제할까요?',
    payAlone: lang === 'en' ? 'Pay alone' : '혼자 결제하기',
    payTogether: lang === 'en' ? 'Pay together' : '같이 결제하기',
    aloneSummary: (name: string, cost: number, currentBalance: number) => (
      lang === 'en'
        ? `${name} will pay ${cost}pt alone. Current balance is ${currentBalance}pt.`
        : `${name} 혼자 ${cost}pt를 결제합니다. 현재 잔액은 ${currentBalance}pt예요.`
    ),
    insufficientPoints: lang === 'en' ? 'Not enough points' : '포인트가 부족해요',
    jointPartner: lang === 'en' ? 'Family member to pay with' : '같이 결제할 가족',
    family: lang === 'en' ? 'Family' : '가족',
    balance: lang === 'en' ? 'Balance' : '잔액',
    splitSummary: (shareTotal: number, cost: number) => (
      lang === 'en' ? `Total ${shareTotal}pt / Need ${cost}pt` : `합계 ${shareTotal}pt / 필요 ${cost}pt`
    ),
    splitMismatch: lang === 'en' ? 'Total must match' : '합계가 맞아야 해요',
    balanceShortage: (name: string) => (
      lang === 'en' ? `${name} needs more points` : `${name} 잔액 부족`
    ),
    paying: lang === 'en' ? 'Paying...' : '결제 중…',
    payComplete: lang === 'en' ? 'Complete payment' : '결제 완료',
    jointSuccess: lang === 'en' ? 'Joint purchase complete!' : '합동 구매 성공!',
    cashTitle: lang === 'en' ? 'Buy something at a store' : '가게에서 사고 싶은 게 있어요',
    cashRate: '$1 = 100pt',
    cashHint: lang === 'en'
      ? 'Type the price tag and pay with points'
      : '가격표 금액을 입력하고 포인트로 결제해요',
    cashPriceLabel: lang === 'en' ? 'Price on the tag' : '가격표 금액',
    cashRoundNote: lang === 'en'
      ? 'Rounds to the nearest dollar (minimum $1)'
      : '1달러 단위로 반올림돼요 (최소 $1)',
    cashConversion: (price: string, dollars: number, points: number) => (
      lang === 'en'
        ? `$${price} counts as $${dollars}, so it costs ${points}pt`
        : `$${price}는 $${dollars}(으)로 계산해서 ${points}pt예요`
    ),
    cashBalanceAfter: (remaining: number) => (
      lang === 'en' ? `Points left after paying: ${remaining}pt` : `결제 후 남는 포인트: ${remaining}pt`
    ),
    cashTooHigh: lang === 'en' ? 'Price is too high (max $999.99)' : '금액이 너무 커요 (최대 $999.99)',
    cashPay: (points: number) => (lang === 'en' ? `Pay ${points}pt` : `${points}pt 결제하기`),
    cashSuccess: (price: string, points: number) => (
      lang === 'en'
        ? `💵 Paid ${points}pt for the $${price} item!`
        : `💵 $${price} 물건을 ${points}pt로 결제했어요!`
    ),
  };
  const rewards = useFamilyStore(state => state.rewards);
  const users = useFamilyStore(state => state.users);
  const levelsByUser = useFamilyStore(state => state.levelsByUser);
  const hydrate = useFamilyStore(state => state.hydrate);
  const hydrated = useFamilyStore(state => state.hydrated);
  const purchaseRewardJoint = useFamilyStore(state => state.purchaseRewardJoint);
  const tradeCashForPoints = useFamilyStore(state => state.tradeCashForPoints);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  const [cashInput, setCashInput] = useState('');
  // One id per checkout session (not per attempt) so a retry after a lost
  // response can't charge twice — the RPC is idempotent on request_id.
  const cashRequestIdRef = useRef('');
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutReward, setCheckoutReward] = useState<Reward | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<'alone' | 'together'>('alone');
  const [jointUserId, setJointUserId] = useState('');
  const [userShare, setUserShare] = useState(0);
  const [partnerShare, setPartnerShare] = useState(0);
  const redeemingRef = useRef(false);

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
    if (redeemingRef.current) return;
    redeemingRef.current = true;
    setRedeeming(reward.id);

    try {
      await refreshRewards().catch(error => {
        console.warn('Failed to refresh rewards before redeem', error);
      });

      const latestReward = useFamilyStore.getState().rewards.find(r => r.id === reward.id) ?? reward;
      if (latestReward.is_hidden || latestReward.is_sold_out) {
        toast.error(latestReward.is_sold_out ? copy.soldOut : t('exchange_fail'));
        return;
      }
      const cost = discountedCost(latestReward);
      const latestBalance = useFamilyStore.getState().levelsByUser[user.id]?.spendableBalance ?? balance;
      if (latestBalance < cost) return;

      const effectiveReward: Reward = { ...latestReward, cost_points: cost };
      await onRedeem(effectiveReward);
      toast.success(`🎉 "${latestReward.title}" ${t('exchange_complete')}`);
      setCheckoutReward(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('exchange_fail'));
    } finally {
      redeemingRef.current = false;
      setRedeeming(null);
    }
  };

  const cashCentsValue = cashCents(cashInput);
  const cashTooHigh = cashCentsValue > CASH_MAX_CENTS;
  const cashValid = cashCentsValue > 0 && !cashTooHigh;
  const cashPointsValue = cashValid ? cashPoints(cashCentsValue) : 0;
  const cashDollars = cashValid ? cashPointsValue / 100 : 0;
  const cashPriceLabel = cashValid ? (cashCentsValue / 100).toFixed(2) : '';
  const cashAffordable = cashValid && balance >= cashPointsValue;

  const closeCash = () => {
    if (redeeming) return;
    setCashOpen(false);
  };

  const handleCashTrade = async () => {
    if (redeemingRef.current || !cashValid) return;
    redeemingRef.current = true;
    setRedeeming('cash-trade');

    try {
      await tradeCashForPoints(user.id, cashCentsValue, cashRequestIdRef.current || undefined);
      toast.success(copy.cashSuccess(cashPriceLabel, cashPointsValue));
      setCashOpen(false);
      setCashInput('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('exchange_fail'));
    } finally {
      redeemingRef.current = false;
      setRedeeming(null);
    }
  };

  const handleJointRedeem = async (reward: Reward) => {
    if (redeemingRef.current || !jointPartner) return;
    redeemingRef.current = true;
    setRedeeming(reward.id);

    try {
      await refreshRewards().catch(error => {
        console.warn('Failed to refresh rewards before joint redeem', error);
      });

      const latestReward = useFamilyStore.getState().rewards.find(r => r.id === reward.id) ?? reward;
      if (latestReward.is_hidden || latestReward.is_sold_out) {
        toast.error(latestReward.is_sold_out ? copy.soldOut : t('exchange_fail'));
        return;
      }

      const cost = discountedCost(latestReward);
      const share1 = Math.max(0, Math.round(userShare) || 0);
      const share2 = Math.max(0, Math.round(partnerShare) || 0);
      const latestLevels = useFamilyStore.getState().levelsByUser;
      const latestUserBalance = latestLevels[user.id]?.spendableBalance ?? balance;
      const latestPartnerBalance = latestLevels[jointPartner.id]?.spendableBalance ?? jointPartnerBalance;
      if (share1 + share2 !== cost) return;
      if (latestUserBalance < share1 || latestPartnerBalance < share2) return;

      await purchaseRewardJoint(latestReward.id, user.id, share1, jointPartner.id, share2);
      toast.success(copy.jointSuccess);
      setCheckoutReward(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('exchange_fail'));
    } finally {
      redeemingRef.current = false;
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
          <button
            type="button"
            onClick={() => {
              setCashInput('');
              cashRequestIdRef.current = crypto.randomUUID();
              setCashOpen(true);
            }}
            disabled={!!redeeming}
            className="mb-2 w-full rounded-xl border border-emerald-400/50 bg-emerald-400/10 p-3 text-left transition-colors disabled:cursor-not-allowed"
            style={{ boxShadow: '0 0 12px rgba(52, 211, 153, 0.14)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-400/15 flex items-center justify-center shrink-0">
                <Icons.DollarSign size={17} className="text-emerald-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs text-[var(--fg)] leading-tight">{copy.cashTitle}</div>
                <div className="text-[10px] text-[var(--fg-muted)] mt-0.5 truncate">{copy.cashHint}</div>
              </div>
              <span className="px-2 py-1 rounded-full text-[10px] font-bold shrink-0 bg-emerald-400 text-black">
                {copy.cashRate}
              </span>
            </div>
          </button>
          <div className="grid grid-cols-2 gap-2">
            {visibleRewards.map(r => {
              const itemTitle = r.title || (r as unknown as Record<string, string>).name || '';
              const pct = salePercentage(r);
              const cost = discountedCost({ ...r, title: itemTitle });
              const hasDeal = Boolean(r.sale_enabled) && cost < r.cost_points && (pct > 0 || r.sale_price != null);
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
                          {copy.soldOut}
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
                      {busy ? '…' : soldOut ? copy.soldOut : t('redeem')}
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
                    {copy.totalCost} <span className="font-bold text-[var(--accent)]">{checkoutCost}pt</span>
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

              <div className="mb-2 text-sm font-bold text-[var(--fg)]">{copy.checkoutPrompt}</div>
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
                  {copy.payAlone}
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
                  🤝 {copy.payTogether}
                </button>
              </div>

              {checkoutMode === 'alone' ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--fg-muted)]">
                    {copy.aloneSummary(user.name, checkoutCost, balance)}
                    {balance < checkoutCost && (
                      <span className="ml-2 font-semibold text-rose-300">{copy.insufficientPoints}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)]">{copy.jointPartner}</span>
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
                      <span className="mt-1 block text-[10px] text-[var(--fg-muted)]">{copy.balance} {balance}pt</span>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)]">
                        {jointPartner?.name ?? copy.family}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={checkoutCost}
                        value={partnerShare}
                        onChange={e => setPartnerShare(Number(e.target.value))}
                        className="h-10 w-full rounded-xl border border-gray-300 bg-white px-2 text-center text-sm font-bold text-gray-900 placeholder-gray-400 outline-none focus:border-gray-500"
                      />
                      <span className="mt-1 block text-[10px] text-[var(--fg-muted)]">{copy.balance} {jointPartnerBalance}pt</span>
                    </label>
                  </div>

                  <div className={[
                    'rounded-xl border px-3 py-2 text-xs',
                    shareTotal === checkoutCost && !jointInvalid
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                      : 'border-rose-400/30 bg-rose-400/10 text-rose-300',
                  ].join(' ')}>
                    {copy.splitSummary(shareTotal, checkoutCost)}
                    {shareTotal !== checkoutCost && <span className="ml-2">{copy.splitMismatch}</span>}
                    {balance < userShare && <span className="ml-2">{copy.balanceShortage(user.name)}</span>}
                    {jointPartner && jointPartnerBalance < partnerShare && <span className="ml-2">{copy.balanceShortage(jointPartner.name)}</span>}
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
                {redeeming === checkoutReward.id ? copy.paying : copy.payComplete}
              </button>
            </div>
          </div>
        )}

        {cashOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.62)' }}
            onClick={e => { if (e.target === e.currentTarget) closeCash(); }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Icons.DollarSign size={18} className="text-emerald-300" />
                    <h3 className="truncate text-sm font-bold text-[var(--fg)]">{copy.cashTitle}</h3>
                  </div>
                  <div className="mt-1 text-xs text-[var(--fg-muted)]">
                    {copy.cashRate} · {copy.balance} <span className="font-bold text-[var(--accent)]">{balance}pt</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCash}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--fg-muted)]"
                >
                  <Icons.X size={15} />
                </button>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)]">{copy.cashPriceLabel}</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    placeholder="4.99"
                    value={cashInput}
                    onChange={e => {
                      // New price → new idempotency key; retries of the same
                      // price keep the same key.
                      cashRequestIdRef.current = crypto.randomUUID();
                      setCashInput(sanitizeCashInput(e.target.value));
                    }}
                    className="h-14 w-full rounded-xl border border-gray-300 bg-white pl-8 pr-3 text-2xl font-bold text-gray-900 placeholder-gray-300 outline-none focus:border-emerald-500"
                  />
                </div>
                <span className="mt-1 block text-[10px] text-[var(--fg-muted)]">{copy.cashRoundNote}</span>
              </label>

              <div className={[
                'mt-3 rounded-xl border px-3 py-2 text-xs',
                cashTooHigh || (cashValid && !cashAffordable)
                  ? 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                  : cashValid
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                    : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]',
              ].join(' ')}>
                {cashTooHigh
                  ? copy.cashTooHigh
                  : cashValid
                    ? (
                      <>
                        {copy.cashConversion(cashPriceLabel, cashDollars, cashPointsValue)}
                        <br />
                        {cashAffordable
                          ? copy.cashBalanceAfter(balance - cashPointsValue)
                          : copy.insufficientPoints}
                      </>
                    )
                    : copy.cashHint}
              </div>

              <button
                type="button"
                onClick={() => void handleCashTrade()}
                disabled={redeeming === 'cash-trade' || !cashValid || !cashAffordable}
                className="mt-4 h-12 w-full rounded-xl bg-emerald-400 text-black text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {redeeming === 'cash-trade'
                  ? copy.paying
                  : cashValid ? copy.cashPay(cashPointsValue) : copy.payComplete}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
