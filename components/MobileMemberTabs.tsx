'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { User } from '@/lib/db';
import { useFamilyStore } from '@/lib/store';

interface MobileMemberTabsProps {
  users: User[];
}

// Sticky horizontal navigation for the mobile dashboard. With 4+ members the
// vertical stack on phone gets long (2000px+); this gives a one-tap jump to
// any member's panel and a visible at-a-glance summary of who's done what.
export function MobileMemberTabs({ users }: MobileMemberTabsProps) {
  const todayCompletions = useFamilyStore(s => s.todayCompletions);
  const tasksByUser = useFamilyStore(s => s.tasksByUser);
  const dailyStreakByUser = useFamilyStore(s => s.dailyStreakByUser);
  const [activeUserId, setActiveUserId] = useState<string | null>(users[0]?.id ?? null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver tracks which panel is currently most visible so we can
  // highlight the matching tab. rootMargin compensates for the page header +
  // sticky tab strip above the panels (≈110px combined).
  useEffect(() => {
    if (typeof window === 'undefined' || users.length === 0) return;

    const elements: HTMLElement[] = users
      .map(u => document.getElementById(`mobile-member-${u.id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        // Pick the entry with the highest intersection ratio whose top is below
        // the sticky chrome — that's the panel the user is actually focused on.
        let bestId: string | null = null;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestId = entry.target.id.replace(/^mobile-member-/, '');
          }
        }
        if (bestId) setActiveUserId(bestId);
      },
      { rootMargin: '-110px 0px -40% 0px', threshold: [0.15, 0.5, 0.85] },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [users]);

  // Auto-scroll the tab row to keep the active chip in view.
  useEffect(() => {
    if (!activeUserId || !tabsRef.current) return;
    const chip = tabsRef.current.querySelector<HTMLElement>(`[data-tab-user="${activeUserId}"]`);
    if (chip) chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeUserId]);

  if (users.length === 0) return null;

  const handleTap = (userId: string) => {
    const target = document.getElementById(`mobile-member-${userId}`);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveUserId(userId);
  };

  return (
    <div
      ref={tabsRef}
      className="sticky top-[52px] z-[5] -mx-3 mb-2 flex gap-1.5 overflow-x-auto bg-[#0D0E1C]/95 px-3 py-2 backdrop-blur-md md:hidden"
      style={{ scrollbarWidth: 'none' }}
    >
      {users.map(user => {
        const isActive = user.id === activeUserId;
        const totalToday = (tasksByUser[user.id] ?? []).length;
        const doneToday = (todayCompletions[user.id] ?? []).length;
        const streak = dailyStreakByUser[user.id] ?? 0;

        return (
          <button
            key={user.id}
            type="button"
            data-tab-user={user.id}
            onClick={() => handleTap(user.id)}
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
          </button>
        );
      })}
    </div>
  );
}
