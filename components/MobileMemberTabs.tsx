'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import type { User } from '@/lib/db';
import { useFamilyStore } from '@/lib/store';
import { isTaskActiveInTimeWindow } from '@/lib/timeWindows';
import { useLanguage } from '@/contexts/LanguageContext';
import { FamilyQuestChip } from './FamilyQuestCard';

interface MobileMemberTabsProps {
  users: User[];
  activeUserId: string | null;
  onSelectUser: (userId: string) => void;
}

export function MobileMemberTabs({ users, activeUserId, onSelectUser }: MobileMemberTabsProps) {
  const { lang } = useLanguage();
  const todayCompletions = useFamilyStore(s => s.todayCompletions);
  const tasksByUser = useFamilyStore(s => s.tasksByUser);
  const timeOfDay = useFamilyStore(s => s.timeOfDay);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the tab row to keep the active chip in view.
  useEffect(() => {
    if (!activeUserId || !tabsRef.current) return;
    const chip = tabsRef.current.querySelector<HTMLElement>(`[data-tab-user="${activeUserId}"]`);
    if (chip) tabsRef.current.scrollTo({ left: chip.offsetLeft - (tabsRef.current.clientWidth - chip.clientWidth) / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [activeUserId]);

  if (users.length === 0) return null;

  return (
    <div className="mobile-member-nav sticky z-10 -mx-3 border-b border-white/8 bg-[#0D0E1C]/95 px-3 pb-2 pt-2 backdrop-blur-md md:hidden">
      <div ref={tabsRef} className="relative flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }} role="tablist" aria-label={lang === 'en' ? 'Family members' : '가족 구성원'}>
        {users.map(user => {
          const isActive = user.id === activeUserId;
          const currentTaskIds = new Set((tasksByUser[user.id] ?? [])
            .filter(task => isTaskActiveInTimeWindow(task.timeWindow, timeOfDay))
            .map(task => task.id));
          const totalToday = currentTaskIds.size;
          const doneToday = (todayCompletions[user.id] ?? []).filter(taskId => currentTaskIds.has(taskId)).length;


          return (
            <button
              key={user.id}
              type="button"
              id={`mobile-member-${user.id}`}
              data-tab-user={user.id}
              tabIndex={isActive ? 0 : -1}
              aria-controls="mobile-member-panel"
              onKeyDown={event => {
                const index = users.findIndex(member => member.id === user.id);
                const nextIndex = event.key === 'ArrowRight' ? (index + 1) % users.length
                  : event.key === 'ArrowLeft' ? (index - 1 + users.length) % users.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? users.length - 1 : null;
                if (nextIndex === null) return;
                event.preventDefault();
                onSelectUser(users[nextIndex].id);
                tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus({ preventScroll: true });
              }}
              onClick={() => onSelectUser(user.id)}
              role="tab"
              aria-selected={isActive}
              className={[
                'relative flex min-h-[72px] min-w-[72px] flex-1 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 transition-colors',
                isActive
                  ? 'border-[#4EEDB0]/60 bg-[#4EEDB0]/12 text-white'
                  : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/8',
              ].join(' ')}
            >
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt=""
                  width={22}
                  height={22}
                  referrerPolicy="no-referrer"
                  className="h-5.5 w-5.5 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-[10px] font-black">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="max-w-[90px] truncate text-xs font-bold">{user.name}</span>
              <span className="text-[10px] font-medium tabular-nums text-white/65">
                {doneToday}/{totalToday}
              </span>
              {isActive && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#4EEDB0]" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-white/55">{lang === 'en' ? 'Whose turn is it?' : '누구의 차례인가요?'}</span>
        <FamilyQuestChip className="max-w-[190px]" />
      </div>
    </div>
  );
}
