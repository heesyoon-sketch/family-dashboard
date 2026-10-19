import { SHIELD_BONUS_POINTS } from '@/lib/shields/weekly';
import { TIER_COPY } from '@/lib/shields/copy';
import { TASK_DURATION_OPTIONS } from '@/lib/taskDurationPoints';

export function ShieldBonusTable({ en }: { en: boolean }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-center text-xs text-[#C9CCE0]">
        <caption className="px-2 py-2 text-left font-semibold text-white">
          {en ? 'Extra points per completed task' : '과제 완료 시 추가 포인트'}
        </caption>
        <thead className="bg-white/[0.04]">
          <tr>
            <th scope="col" className="px-2 py-2">{en ? 'Shield' : '쉴드'}</th>
            {TASK_DURATION_OPTIONS.map(({ points }) => <th key={points} scope="col" className="px-2 py-2">{points}P</th>)}
          </tr>
        </thead>
        <tbody>
          {(['silver', 'gold', 'epic', 'legendary'] as const).map(tier => (
            <tr key={tier} className="border-t border-white/[0.06]">
              <th scope="row" className="px-2 py-2 font-medium">{TIER_COPY[tier][en ? 'en' : 'ko']}</th>
              {TASK_DURATION_OPTIONS.map(({ points }) => <td key={points} className="px-2 py-2 text-[#9FF0CE]">+{SHIELD_BONUS_POINTS[tier][points]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
