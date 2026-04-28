'use client';

import { Mail, X } from 'lucide-react';
import { FamilyActivity, User } from '@/lib/db';
import { useLanguage, type Lang } from '@/contexts/LanguageContext';

const MAILBOX_ACTIVITY_TYPES = new Set<FamilyActivity['type']>([
  'GIFT_SENT',
  'GIFT_RECEIVED',
  'REWARD_PURCHASED',
]);

function formatActivity(activity: FamilyActivity, lang: Lang): { icon: string; text: string; amount: string } {
  const family = lang === 'en' ? 'Family' : '가족';
  if (activity.type === 'GIFT_RECEIVED') {
    const name = activity.relatedUserName ?? family;
    return {
      icon: '💌',
      text: lang === 'en'
        ? `${name} sent you ${activity.amount} warm points!${activity.message ? `: ${activity.message}` : ''}`
        : `${name}님이 따뜻한 마음 ${activity.amount}pt를 보냈어요!${activity.message ? ` : ${activity.message}` : ''}`,
      amount: `+${activity.amount}pt`,
    };
  }
  if (activity.type === 'GIFT_SENT') {
    const name = activity.relatedUserName ?? family;
    return {
      icon: '💝',
      text: lang === 'en'
        ? `You sent ${activity.amount} warm points to ${name}!${activity.message ? `: ${activity.message}` : ''}`
        : `${name}님에게 따뜻한 마음 ${activity.amount}pt를 보냈어요!${activity.message ? ` : ${activity.message}` : ''}`,
      amount: `-${activity.amount}pt`,
    };
  }
  if (activity.type === 'REWARD_PURCHASED') {
    return {
      icon: '🛍️',
      text: lang === 'en'
        ? `Bought ${activity.message ?? 'a reward'}!`
        : `${activity.message ?? '리워드'}을(를) 구매했어요!`,
      amount: `-${activity.amount}pt`,
    };
  }
  return {
    icon: '✅',
    text: lang === 'en'
      ? `Completed ${activity.message ?? 'a task'} and earned points!`
      : `${activity.message ?? 'Task'}을(를) 완료해서 포인트를 얻었어요!`,
    amount: `+${activity.amount}pt`,
  };
}

function formatTime(date: Date, lang: Lang): string {
  return date.toLocaleString(lang === 'en' ? 'en-US' : 'ko-KR', {
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
  const { lang, t } = useLanguage();
  const visibleActivities = activities.filter(activity => MAILBOX_ACTIVITY_TYPES.has(activity.type));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-theme={user.theme}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-2xl"
        style={{ maxHeight: '82vh' }}
      >
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent-glow)] text-[var(--accent)]">
              <Mail size={17} />
            </span>
            {t('mailbox_history')}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-muted)]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="modal-scroll max-h-[60vh] overflow-y-auto px-4 pb-5 pt-4">
          {visibleActivities.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
              {lang === 'en' ? 'No activity yet' : '아직 기록이 없어요'}
            </div>
          ) : (
            <div className="relative space-y-3">
              <div className="absolute bottom-3 left-[18px] top-3 w-px bg-[var(--border)]" />
              {visibleActivities.map(activity => {
                const display = formatActivity(activity, lang);
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
                        <span className="text-[11px] text-[var(--fg-muted)]">{formatTime(activity.createdAt, lang)}</span>
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
