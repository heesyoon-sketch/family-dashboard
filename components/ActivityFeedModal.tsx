'use client';

import { Mail, X } from 'lucide-react';
import { FamilyActivity, User } from '@/lib/db';

function formatActivity(activity: FamilyActivity): { icon: string; text: string; amount: string } {
  if (activity.type === 'GIFT_RECEIVED') {
    return {
      icon: '💌',
      text: `${activity.relatedUserName ?? '가족'}님이 따뜻한 마음 ${activity.amount}pt를 보냈어요!${activity.message ? ` : ${activity.message}` : ''}`,
      amount: `+${activity.amount}pt`,
    };
  }
  if (activity.type === 'GIFT_SENT') {
    return {
      icon: '💝',
      text: `${activity.relatedUserName ?? '가족'}님에게 따뜻한 마음 ${activity.amount}pt를 보냈어요!${activity.message ? ` : ${activity.message}` : ''}`,
      amount: `-${activity.amount}pt`,
    };
  }
  if (activity.type === 'REWARD_PURCHASED') {
    return {
      icon: '🛍️',
      text: `${activity.message ?? '리워드'}을(를) 구매했어요!`,
      amount: `-${activity.amount}pt`,
    };
  }
  return {
    icon: '✅',
    text: `${activity.message ?? 'Task'}을(를) 완료해서 포인트를 얻었어요!`,
    amount: `+${activity.amount}pt`,
  };
}

function formatTime(date: Date): string {
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityFeedModal({
  user,
  activities,
  onClose,
}: {
  user: User;
  activities: FamilyActivity[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-theme={user.theme}
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-2xl"
        style={{ maxHeight: '82vh' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent-glow)] text-[var(--accent)]">
              <Mail size={17} />
            </span>
            편지함 및 기록
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-muted)]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {activities.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
              아직 기록이 없어요
            </div>
          ) : (
            <div className="relative space-y-3">
              <div className="absolute bottom-3 left-[18px] top-3 w-px bg-[var(--border)]" />
              {activities.map(activity => {
                const display = formatActivity(activity);
                const positive = display.amount.startsWith('+');
                return (
                  <div key={activity.id} className="relative flex gap-3">
                    <div className="z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-base">
                      {display.icon}
                    </div>
                    <div className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
                      <div className="text-sm font-semibold leading-snug text-[var(--fg)]">
                        {display.text}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-[var(--fg-muted)]">{formatTime(activity.createdAt)}</span>
                        <span className={[
                          'text-xs font-bold',
                          positive ? 'text-emerald-300' : 'text-rose-300',
                        ].join(' ')}>
                          {display.amount}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
