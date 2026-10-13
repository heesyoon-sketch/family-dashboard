'use client';

import { useState } from 'react';
import { ChevronDown, Flame, Info } from 'lucide-react';
import { HABIT_RULES, type HabitGroup, type HabitPerformance } from '@/lib/analytics/history';
import type { DayOfWeek } from '@/lib/db';
import { EmptyNote, PointDelta, pctText, useCopy } from '@/components/analytics/ui';
import type { Localized } from '@/lib/analytics/insights';

const GROUP_COPY: Record<HabitGroup, { title: Localized; hint: Localized; tone: string }> = {
  strong: { title: { en: 'Strong habits', ko: '든든한 습관' }, hint: { en: `${Math.round(HABIT_RULES.strongRate * 100)}% or more of scheduled times`, ko: `예정된 횟수의 ${Math.round(HABIT_RULES.strongRate * 100)}% 이상` }, tone: '#79E8BD' },
  improving: { title: { en: 'Improving', ko: '좋아지는 습관' }, hint: { en: `Up ${HABIT_RULES.trendPoints}+ percentage points vs the previous period`, ko: `이전 기간보다 ${HABIT_RULES.trendPoints}%p 이상 상승` }, tone: '#A5A6FF' },
  attention: { title: { en: 'Room to grow', ko: '조금 더 챙겨볼 습관' }, hint: { en: `Below ${Math.round(HABIT_RULES.attentionRate * 100)}%, or down ${HABIT_RULES.trendPoints}+ points`, ko: `${Math.round(HABIT_RULES.attentionRate * 100)}% 미만이거나 ${HABIT_RULES.trendPoints}%p 이상 하락` }, tone: '#E8C77B' },
  steady: { title: { en: 'Steady', ko: '꾸준히 이어가는 습관' }, hint: { en: 'Holding a similar pace', ko: '비슷한 속도를 유지 중' }, tone: '#B3B7CE' },
  new: { title: { en: 'Just getting started', ko: '이제 막 시작한 습관' }, hint: { en: `Fewer than ${HABIT_RULES.minEligible} scheduled times in this period`, ko: `이 기간 예정 횟수 ${HABIT_RULES.minEligible}회 미만` }, tone: '#7FD3F7' },
};

const DAY_KO: Record<DayOfWeek, string> = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' };
const DAY_EN: Record<DayOfWeek, string> = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' };
const ORDER: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function frequency(h: HabitPerformance, en: boolean): string {
  const days = ORDER.filter(d => h.task.daysOfWeek.includes(d));
  const dayText = days.length === 7 ? (en ? 'Every day' : '매일')
    : days.join() === 'MON,TUE,WED,THU,FRI' ? (en ? 'Weekdays' : '평일')
    : days.join() === 'SAT,SUN' ? (en ? 'Weekends' : '주말')
    : days.map(d => (en ? DAY_EN[d] : DAY_KO[d])).join(en ? ', ' : '·');
  const window = h.task.timeWindow === 'both' ? (en ? 'morning + evening' : '오전+오후') : h.task.timeWindow === 'morning' ? (en ? 'morning' : '오전') : (en ? 'afternoon/evening' : '오후·저녁');
  return `${dayText} · ${window}`;
}

function Sparkline({ values, tone }: { values: Array<number | null>; tone: string }) {
  return (
    <span className="flex h-6 items-end gap-0.5" aria-hidden>
      {values.map((v, i) => (
        <span key={i} className="w-1.5 rounded-sm" style={{ height: v === null ? 2 : `${Math.max(12, v * 100)}%`, background: v === null ? 'rgba(255,255,255,0.12)' : tone, opacity: v === null ? 1 : 0.45 + (i / values.length) * 0.55 }} />
      ))}
    </span>
  );
}

function HabitRow({ h, en, isArchived }: { h: HabitPerformance; en: boolean; isArchived: boolean }) {
  const [open, setOpen] = useState(false);
  const tone = GROUP_COPY[h.group].tone;
  const recentDone = h.recentOutcomes.filter(Boolean).length;
  return (
    <li className="rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A5A6FF]">
        <span className="text-xl" aria-hidden>{h.task.icon || '•'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[#F4F5FA]">{h.task.title}{isArchived && <span className="ml-2 text-xs font-normal text-[#8E94B4]">{en ? '(removed)' : '(삭제됨)'}</span>}</span>
          <span className="mt-0.5 block text-xs text-[#A9AECB]">{h.current.completed}/{h.current.eligible} {en ? 'times' : '회'} · {frequency(h, en)}</span>
        </span>
        <Sparkline values={h.recentWeeks} tone={tone} />
        <span className="w-12 text-right text-sm font-bold" style={{ color: tone }}>{pctText(h.current.rate)}</span>
        <ChevronDown size={16} aria-hidden className={`shrink-0 text-[#8E94B4] transition motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.06] px-3 py-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-[#8E94B4]">{en ? 'Completion rate' : '완료율'}</dt><dd className="mt-0.5 font-semibold text-white">{pctText(h.current.rate)}</dd></div>
          <div><dt className="text-xs text-[#8E94B4]">{en ? 'vs previous period' : '이전 기간 대비'}</dt><dd className="mt-0.5"><PointDelta points={h.pointChange} /></dd></div>
          <div><dt className="text-xs text-[#8E94B4]">{en ? 'Recent outcomes' : '최근 기록'}</dt><dd className="mt-1 flex gap-1" aria-label={en ? `${recentDone} of the last ${h.recentOutcomes.length} completed` : `최근 ${h.recentOutcomes.length}번 중 ${recentDone}번 완료`}>{h.recentOutcomes.map((ok, i) => <span key={i} className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-[#79E8BD]' : 'border border-white/25'}`} />)}</dd></div>
          <div><dt className="text-xs text-[#8E94B4]">{en ? 'Current streak' : '현재 연속'}</dt><dd className="mt-0.5 inline-flex items-center gap-1 font-semibold text-white"><Flame size={14} className="text-[#E8C77B]" aria-hidden />{h.task.streakCount}{en ? ' days' : '일'}</dd></div>
        </dl>
      )}
    </li>
  );
}

export function HabitPerformanceList({ habits }: { habits: HabitPerformance[] }) {
  const { en, t } = useCopy();
  const [showRules, setShowRules] = useState(false);
  if (habits.length === 0) {
    return <EmptyNote>{en ? 'No habits were scheduled in this period.' : '이 기간에는 예정된 습관이 없었어요.'}</EmptyNote>;
  }
  const groups = (['strong', 'improving', 'attention', 'steady', 'new'] as HabitGroup[])
    .map(group => ({ group, items: habits.filter(h => h.group === group) }))
    .filter(g => g.items.length > 0);
  return (
    <div className="space-y-5">
      <button type="button" aria-expanded={showRules} onClick={() => setShowRules(v => !v)} className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-[#A5A6FF] hover:underline">
        <Info size={14} aria-hidden />{en ? 'How habits are grouped' : '습관을 나누는 기준'}
      </button>
      {showRules && (
        <ul className="grid gap-1.5 rounded-xl bg-black/20 p-3 text-xs text-[#C9CCE0] sm:grid-cols-2">
          {(Object.keys(GROUP_COPY) as HabitGroup[]).map(g => <li key={g}><span className="font-semibold" style={{ color: GROUP_COPY[g].tone }}>{t(GROUP_COPY[g].title)}</span> — {t(GROUP_COPY[g].hint)}</li>)}
        </ul>
      )}
      {groups.map(({ group, items }) => (
        <div key={group}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: GROUP_COPY[group].tone }}>
            <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COPY[group].tone }} aria-hidden />
            {t(GROUP_COPY[group].title)} <span className="font-normal text-[#8E94B4]">{items.length}</span>
          </h3>
          <ul className="space-y-2">{items.map(h => <HabitRow key={h.task.id} h={h} en={en} isArchived={Boolean(h.task.deletedAt)} />)}</ul>
        </div>
      ))}
    </div>
  );
}
