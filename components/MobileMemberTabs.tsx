'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { TicketCheck } from 'lucide-react';
import type { User } from '@/lib/db';
import { useFamilyStore } from '@/lib/store';
import { isTaskActiveInTimeWindow } from '@/lib/timeWindows';

interface MobileMemberTabsProps {
  users: User[];
  activeUserId: string | null;
  onSelectUser: (userId: string) => void;
}

export function MobileMemberTabs({ users, activeUserId, onSelectUser }: MobileMemberTabsProps) {
  const todayCompletions = useFamilyStore(s => s.todayCompletions);
  const tasksByUser = useFamilyStore(s => s.tasksByUser);
  const dailyStreakByUser = useFamilyStore(s => s.dailyStreakByUser);
  const timeOfDay = useFamilyStore(s => s.timeOfDay);
  const couponsByUser = useFamilyStore(s => s.couponsByUser);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the tab row to keep the active chip in view.
  useEffect(() => {
    if (!activeUserId || !tabsRef.current) return;
    const chip = tabsRef.current.querySelector<HTMLElement>(`[data-tab-user="${activeUserId}"]`);
    if (chip) chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeUserId]);

  if (users.length === 0) return null;

  return (
    <div
      ref={tabsRef}
      className="sticky top-[52px] z-[5] -mx-3 mb-2 flex gap-1.5 overflow-x-auto bg-[#0D0E1C]/95 px-3 py-2 backdrop-blur-md md:hidden"
      style={{ scrollbarWidth: 'none' }}
    >
      {users.map(user => {
        const isActive = user.id === activeUserId;
        const totalToday = (tasksByUser[user.id] ?? [])
          .filter(task => isTaskActiveInTimeWindow(task.timeWindow, timeOfDay)).length;
        const doneToday = (todayCompletions[user.id] ?? []).length;
        const streak = dailyStreakByUser[user.id] ?? 0;
        const couponCount = (couponsByUser[user.id] ?? [])
          .filter(coupon => coupon.status === 'available').length;

        return (
          <button
            key={user.id}
            type="button"
            data-tab-user={user.id}
            onClick={() => onSelectUser(user.id)}
            aria-pressed={isActive}
            className={[
              'flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 transition-colors',
              isActive
                ? 'border-[#4EEDB0]/55 bg-[#4EEDB0]/12 text-white'
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
            <span className="max-w-[90px] truncate text-[12px] font-bold">{user.name}</span>
            <span className="text-[10px] font-bold tabular-nums text-white/55">
              {doneToday}/{totalToday}
            </span>
            {streak > 0 && (
              <span className="text-[10px] font-bold text-[#4EEDB0]">🔥{streak}</span>
            )}
            {couponCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-black text-[#FFE56B]">
                <TicketCheck size={11} />{couponCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
