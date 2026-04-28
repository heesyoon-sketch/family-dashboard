'use client';

import { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { Heart, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '@/lib/db';
import { useFamilyStore } from '@/lib/store';

const QUICK_MESSAGES = [
  '👍 도와줘서 고마워!',
  '🔥 조금만 더 힘내!',
  '❤️ 사랑해!',
  '🎁 깜짝 선물이야!',
];

function fireWarmConfetti() {
  const colors = ['#fb7185', '#fda4af', '#facc15', '#86efac', '#93c5fd'];
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.72 }, colors });
  window.setTimeout(() => {
    confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.78 }, colors });
    confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.78 }, colors });
  }, 140);
}

export function WarmGiftModal({
  sender,
  receivers,
  balance,
  onClose,
}: {
  sender: User;
  receivers: User[];
  balance: number;
  onClose: () => void;
}) {
  const transferPoints = useFamilyStore(state => state.transferPointsWithMessage);
  const [receiverId, setReceiverId] = useState(receivers[0]?.id ?? '');
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState(QUICK_MESSAGES[0]);
  const [submitting, setSubmitting] = useState(false);

  const receiver = useMemo(
    () => receivers.find(member => member.id === receiverId) ?? null,
    [receiverId, receivers],
  );
  const safeAmount = Math.max(1, Math.round(amount) || 1);
  const canSubmit = Boolean(receiver) && safeAmount > 0 && safeAmount <= balance && !submitting;

  const submit = async () => {
    if (!canSubmit || !receiver) return;
    setSubmitting(true);
    try {
      await transferPoints(sender.id, receiver.id, safeAmount, message);
      fireWarmConfetti();
      toast.success(`${receiver.name}에게 ${safeAmount}pt를 보냈어요`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '마음을 보낼 수 없습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-theme={sender.theme}
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-400/15 text-rose-300">
              <Heart size={17} fill="currentColor" />
            </span>
            마음 나누기
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-muted)]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-[var(--fg-muted)]">
            <span className="font-semibold text-[var(--fg)]">{sender.name}</span>의 마음 포인트를 가족에게 나눠요.
            <span className="ml-1 font-semibold text-rose-300">보낼 수 있는 포인트 {balance}pt</span>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)]">받는 사람</span>
            <select
              value={receiverId}
              onChange={e => setReceiverId(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm outline-none"
            >
              {receivers.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)]">보낼 포인트</span>
            <input
              type="number"
              min={1}
              max={balance}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-center text-lg font-bold outline-none"
            />
          </label>

          <div>
            <div className="mb-2 text-xs font-semibold text-[var(--fg-muted)]">메시지</div>
            <div className="grid grid-cols-1 gap-2">
              {QUICK_MESSAGES.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMessage(option)}
                  className={[
                    'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                    message === option
                      ? 'border-rose-300/50 bg-rose-300/15 text-[var(--fg)]'
                      : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-muted)]',
                  ].join(' ')}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => { void submit(); }}
            disabled={!canSubmit}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-400 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} />
            {submitting ? '보내는 중…' : '마음 보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}
