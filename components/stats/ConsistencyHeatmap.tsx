'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { addDays } from '@/lib/analytics/history';
import type { HeatCell, HeatLevel } from '@/lib/analytics/history';
import { formatDay, pctText, useCopy } from '@/components/analytics/ui';

const LEVEL_STYLE: Record<Exclude<HeatLevel, 'future'>, string> = {
  rest: 'bg-transparent border border-dashed border-white/12',
  0: 'bg-[#2a2f47] border border-[#3a4060]',
  1: 'bg-[#2c5a55]',
  2: 'bg-[#3f8f7c]',
  3: 'bg-[#5cc4a0]',
  4: 'bg-[#8ff0c8]',
};

const WEEKDAY_LABELS = { en: ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'], ko: ['월', '', '수', '', '금', '', '일'] };

/** Columns are Mon–Sun weeks. On narrow screens only the latest 13 weeks
 *  render, so cells stay touch-sized without horizontal page scroll. */
export function ConsistencyHeatmap({ weeks }: { weeks: HeatCell[][] }) {
  const { en } = useCopy();
  const today = weeks.flat().filter(c => c.level !== 'future').at(-1)?.day ?? null;
  const [selected, setSelected] = useState<string | null>(today);
  const cell = weeks.flat().find(c => c.day === selected) ?? null;
  const mobileStart = Math.max(0, weeks.length - 13);
  const gridRef = useRef<HTMLDivElement>(null);
  const days = new Set(weeks.flat().filter(c => c.level !== 'future').map(c => c.day));

  // Arrow keys move by day (up/down) and week (left/right); one tab stop.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = ({ ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 } as Record<string, number>)[event.key];
    if (!delta || !selected) return;
    const next = addDays(selected, delta);
    if (!days.has(next)) return;
    event.preventDefault();
    setSelected(next);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus();
  };

  const describe = (c: HeatCell) => {
    const date = formatDay(c.day, en, { weekday: 'short', month: 'short', day: 'numeric' });
    if (c.level === 'rest') return en ? `${date}: no habits scheduled (rest day)` : `${date}: 예정된 습관 없음 (쉬는 날)`;
    return en ? `${date}: ${c.completed} of ${c.eligible} completed (${pctText(c.rate)})` : `${date}: ${c.eligible}개 중 ${c.completed}개 완료 (${pctText(c.rate)})`;
  };

  return (
    <div>
      <div className="flex gap-1.5">
        <div className="grid shrink-0 grid-rows-7 gap-1 pt-0 text-[10px] leading-none text-[#8E94B4]" aria-hidden>
          {(en ? WEEKDAY_LABELS.en : WEEKDAY_LABELS.ko).map((d, i) => <span key={i} className="flex items-center">{d}</span>)}
        </div>
        <div ref={gridRef} role="group" onKeyDown={onKeyDown} aria-label={en ? 'Daily completion heatmap. Use arrow keys to move between days.' : '일별 완료 히트맵. 방향키로 날짜를 이동할 수 있어요.'} className="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1">
          {weeks.map((week, w) => (
            <div key={week[0].day} className={`grid grid-rows-7 gap-1 ${w < mobileStart ? 'hidden md:grid' : ''}`}>
              {week.map(c => c.level === 'future' ? (
                <span key={c.day} aria-hidden className="aspect-square rounded-[4px]" />
              ) : (
                <button
                  key={c.day}
                  type="button"
                  data-day={c.day}
                  tabIndex={selected === c.day ? 0 : -1}
                  aria-pressed={selected === c.day}
                  aria-label={describe(c)}
                  onClick={() => setSelected(c.day)}
                  className={`aspect-square min-h-0 rounded-[4px] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#A5A6FF] ${LEVEL_STYLE[c.level]} ${selected === c.day ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-[#151a2e]' : ''} ${c.day === today ? 'outline outline-1 outline-[#A5A6FF]/60' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="min-h-6 text-sm text-[#D7DAEC]">{cell ? describe(cell) : ''}</p>
        <div className="flex items-center gap-1.5 text-[11px] text-[#8E94B4]">
          <span className="mr-1 inline-flex items-center gap-1"><span className={`h-3 w-3 rounded-[3px] ${LEVEL_STYLE.rest}`} />{en ? 'Rest' : '쉬는 날'}</span>
          <span>0%</span>
          {([0, 1, 2, 3, 4] as const).map(l => <span key={l} className={`h-3 w-3 rounded-[3px] ${LEVEL_STYLE[l]}`} aria-hidden />)}
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
