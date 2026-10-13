'use client';

import { useId, useState } from 'react';
import type { TrendSeries } from '@/lib/analytics/history';
import { EmptyNote, formatDay, pctText, useCopy } from '@/components/analytics/ui';

const W = 640;
const H = 200;
const PAD = { top: 14, right: 12, bottom: 26, left: 34 };

export function TrendChart({ series }: { series: TrendSeries }) {
  const { en } = useCopy();
  const titleId = useId();
  const [active, setActive] = useState<number | null>(null);
  const points = series.points;
  const measured = points.filter(p => p.rate !== null);
  if (measured.length < 2) {
    return <EmptyNote>{en ? 'Not enough data yet. The trend appears after a few days with scheduled habits.' : '아직 데이터가 부족해요. 습관이 있는 날이 며칠 쌓이면 추이가 보여요.'}</EmptyNote>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const x = (i: number) => PAD.left + i * step;
  const y = (rate: number) => PAD.top + (1 - rate) * innerH;
  const path = (list: TrendSeries['points']) => {
    let d = '';
    let pen = false;
    list.forEach((p, i) => {
      if (p.rate === null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rate).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const label = (i: number) => {
    const p = points[i];
    return series.granularity === 'day' ? formatDay(p.from, en) : `${formatDay(p.from, en)} – ${formatDay(p.to, en)}`;
  };
  const avg = (list: TrendSeries['points']) => {
    const e = list.reduce((s, p) => s + p.eligible, 0);
    return e ? list.reduce((s, p) => s + p.completed, 0) / e : null;
  };
  const tickEvery = Math.max(1, Math.ceil(points.length / 6));
  const activePoint = active !== null ? points[active] : null;
  const previousPoint = active !== null && series.previous ? series.previous[active] : null;

  return (
    <figure aria-labelledby={titleId} className="relative">
      <figcaption id={titleId} className="sr-only">
        {en
          ? `Completion rate by ${series.granularity}. Average ${pctText(avg(points))}${series.previous ? `, previous period ${pctText(avg(series.previous))}` : ''}.`
          : `${series.granularity === 'day' ? '일별' : '주별'} 완료율. 평균 ${pctText(avg(points))}${series.previous ? `, 이전 기간 ${pctText(avg(series.previous))}` : ''}.`}
      </figcaption>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-[#B3B7CE]">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-[#79E8BD]" aria-hidden />{en ? 'This period' : '이번 기간'}</span>
        {series.previous && <span className="inline-flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-[#8E94B4]" aria-hidden />{en ? 'Previous period' : '이전 기간'}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y select-none" role="img" aria-hidden onPointerLeave={() => setActive(null)}>
        <defs>
          <linearGradient id={`${titleId}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#79E8BD" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#79E8BD" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(r => (
          <g key={r}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(r)} y2={y(r)} stroke="rgba(255,255,255,0.07)" />
            <text x={PAD.left - 6} y={y(r) + 4} textAnchor="end" fontSize="11" fill="#8E94B4">{r * 100}%</text>
          </g>
        ))}
        {series.previous && <path d={path(series.previous)} fill="none" stroke="#8E94B4" strokeWidth="1.5" strokeDasharray="4 4" />}
        <path d={`${path(points)}`} fill="none" stroke="#79E8BD" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => p.rate !== null && (
          <circle key={i} cx={x(i)} cy={y(p.rate)} r={active === i ? 5 : points.length > 40 ? 0 : 2.5} fill="#79E8BD" stroke="#151a2e" strokeWidth="1.5" />
        ))}
        {points.map((_, i) => i % tickEvery === 0 && (
          <text key={`t${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#8E94B4">{formatDay(points[i].from, en, { month: 'numeric', day: 'numeric' })}</text>
        ))}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="rgba(165,166,255,0.5)" />}
        {points.map((_, i) => (
          <rect key={`h${i}`} x={x(i) - step / 2} y={0} width={Math.max(step, 8)} height={H} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
        ))}
      </svg>
      {/* Visible scrubber: keyboard and precise touch access to every point. */}
      <label className="sr-only" htmlFor={`${titleId}-range`}>{en ? 'Choose a point on the chart' : '차트에서 지점 선택'}</label>
      <input
        id={`${titleId}-range`}
        type="range"
        min={0}
        max={points.length - 1}
        value={active ?? points.length - 1}
        onChange={e => setActive(Number(e.target.value))}
        onFocus={() => setActive(current => current ?? points.length - 1)}
        aria-valuetext={`${label(active ?? points.length - 1)}: ${pctText(points[active ?? points.length - 1].rate)}`}
        className="my-2 h-6 w-full cursor-pointer accent-[#79E8BD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A5A6FF]"
      />
      <p aria-live="polite" className="min-h-[2.75rem] rounded-xl bg-black/20 px-3 py-2 text-sm text-[#D7DAEC]">
        {activePoint ? (
          <>
            <span className="font-semibold text-white">{label(active!)}</span>{' · '}
            {activePoint.rate === null
              ? (en ? 'No habits scheduled' : '예정된 습관 없음')
              : <>{pctText(activePoint.rate)} <span className="text-[#A9AECB]">({activePoint.completed}/{activePoint.eligible})</span></>}
            {previousPoint && previousPoint.rate !== null && <span className="text-[#A9AECB]">{en ? ` · previous ${pctText(previousPoint.rate)}` : ` · 이전 ${pctText(previousPoint.rate)}`}</span>}
          </>
        ) : (
          <span className="text-[#A9AECB]">{en ? 'Tap or hover the chart to see each day.' : '차트를 누르거나 올려 보면 날짜별 기록이 보여요.'}</span>
        )}
      </p>
    </figure>
  );
}
