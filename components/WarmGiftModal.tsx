'use client';

import { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { Heart, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '@/lib/db';
import { useFamilyStore } from '@/lib/store';
import { useLanguage, type Lang } from '@/contexts/LanguageContext';

const QUICK_MESSAGES: Record<Lang, string[]> = {
  ko: [
    '👍 도와줘서 고마워!',
    '🔥 조금만 더 힘내!',
    '❤️ 사랑해!',
    '🙏 미안해!',
    '🎁 깜짝 선물이야!',
  ],
  en: [
    '👍 Thanks for helping!',
    '🔥 Keep going!',
    '❤️ Love you!',
    '🙏 I am sorry!',
    '🎁 A surprise gift!',
  ],
};

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
  const { lang } = useLanguage();
  const transferPoints = useFamilyStore(state => state.transferPointsWithMessage);
  const copy = {
    title: lang === 'en' ? 'Warm Gift' : '마음 나누기',
    summary: lang === 'en'
      ? `${sender.name} can share warm points with family.`
      : `${sender.name}의 마음 포인트를 가족에게 나눠요.`,
    available: lang === 'en' ? `Available ${balance}pt` : `보낼 수 있는 포인트 ${balance}pt`,
    receiver: lang === 'en' ? 'Receiver' : '받는 사람',
    amount: lang === 'en' ? 'Points to send' : '보낼 포인트',
    message: lang === 'en' ? 'Message' : '메시지',
    custom: lang === 'en' ? 'Write a custom message' : '직접 메시지 쓰기',
    placeholder: lang === 'en' ? 'Example: Sorry about today' : '예: 오늘 속상하게 해서 미안해',
    sending: lang === 'en' ? 'Sending...' : '보내는 중…',
    submit: lang === 'en' ? 'Send warm points' : '마음 보내기',
    success: (name: string, points: number) => (
      lang === 'en' ? `Sent ${points}pt to ${name}` : `${name}에게 ${points}pt를 보냈어요`
    ),
    error: lang === 'en' ? 'Could not send warm points' : '마음을 보낼 수 없습니다',
  };
  const quickMessages = QUICK_MESSAGES[lang];
  const [receiverId, setReceiverId] = useState(receivers[0]?.id ?? '');
  const [amount, setAmount] = useState(10);
  const [messageIndex, setMessageIndex] = useState(0);
  const [customMessage, setCustomMessage] = useState('');
  const [usingCustomMessage, setUsingCustomMessage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const receiver = useMemo(
    () => receivers.find(member => member.id === receiverId) ?? null,
    [receiverId, receivers],
  );
  const safeAmount = Math.max(1, Math.round(amount) || 1);
  const finalMessage = usingCustomMessage ? customMessage.trim() : quickMessages[messageIndex];
  const canSubmit = Boolean(receiver) && safeAmount > 0 && safeAmount <= balance && finalMessage.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit || !receiver) return;
    setSubmitting(true);
    try {
      await transferPoints(sender.id, receiver.id, safeAmount, finalMessage);
      fireWarmConfetti();
      toast.success(copy.success(receiver.name, safeAmount));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.error);
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
            {copy.title}
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
            <span>{copy.summary}</span>
            <span className="ml-1 font-semibold text-rose-300">{copy.available}</span>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)]">{copy.receiver}</span>
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
            <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)]">{copy.amount}</span>
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
            <div className="mb-2 text-xs font-semibold text-[var(--fg-muted)]">{copy.message}</div>
            <div className="grid grid-cols-1 gap-2">
              {quickMessages.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setUsingCustomMessage(false);
                    setMessageIndex(index);
                  }}
                  className={[
                    'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                    !usingCustomMessage && messageIndex === index
                      ? 'border-rose-300/50 bg-rose-300/15 text-[var(--fg)]'
                      : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-muted)]',
                  ].join(' ')}
                >
                  {option}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setUsingCustomMessage(value => !value)}
              className={[
                'mt-2 text-xs font-semibold transition-colors',
                usingCustomMessage ? 'text-rose-300' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
              ].join(' ')}
            >
              {copy.custom}
            </button>
            {usingCustomMessage && (
              <input
                type="text"
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                maxLength={60}
                placeholder={copy.placeholder}
                className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] outline-none focus:border-rose-300/60"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => { void submit(); }}
            disabled={!canSubmit}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-400 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} />
            {submitting ? copy.sending : copy.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
