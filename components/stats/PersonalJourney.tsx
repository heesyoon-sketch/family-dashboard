'use client';

import { useState } from 'react';
import { CalendarCheck2, ChevronDown, Flag, Medal, Sprout, Trophy, Zap } from 'lucide-react';
import type { JourneyEvent, JourneyKind } from '@/lib/analytics/insights';
import { EmptyNote, formatDay, useCopy } from '@/components/analytics/ui';

const ICONS: Record<JourneyKind, typeof Flag> = {
  first: Flag,
  'full-week': CalendarCheck2,
  'best-week': Trophy,
  comeback: Sprout,
  milestone: Zap,
  shield: Medal,
};

export function PersonalJourney({ events }: { events: JourneyEvent[] }) {
  const { en, t } = useCopy();
  const [limit, setLimit] = useState(6);
  if (events.length === 0) {
    return <EmptyNote>{en ? 'Your story starts with your first completed habit. Every step from here will be remembered.' : '첫 습관을 완료하는 순간부터 이야기가 시작돼요. 그다음 걸음도 모두 여기에 남아요.'}</EmptyNote>;
  }
  return (
    <div>
      <ol className="relative space-y-4 border-l border-white/10 pl-6">
        {events.slice(0, limit).map(event => {
          const Icon = ICONS[event.kind];
          return (
            <li key={event.id} className="relative">
              <span className="absolute -left-[37px] grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-[#1d2340] text-[#A5A6FF]" aria-hidden><Icon size={14} /></span>
              <time dateTime={event.day} className="text-xs text-[#8E94B4]">{formatDay(event.day, en, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
              <p className="text-sm font-semibold text-[#F4F5FA]">{t(event.text)}</p>
              {event.detail && <p className="text-xs text-[#A9AECB]">{t(event.detail)}</p>}
            </li>
          );
        })}
      </ol>
      {events.length > limit && (
        <button type="button" onClick={() => setLimit(n => n + 8)} className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#A5A6FF] hover:bg-white/[0.05]">
          {en ? 'Earlier moments' : '이전 순간 더 보기'}<ChevronDown size={15} aria-hidden />
        </button>
      )}
    </div>
  );
}
