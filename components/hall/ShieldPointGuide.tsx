import type { ShieldTier } from '@/lib/shields/engine';
import { SHIELD_BONUS_POINTS } from '@/lib/shields/weekly';
import { TASK_DURATION_OPTIONS } from '@/lib/taskDurationPoints';

/** The same four values used by the server, visible without opening a help panel. */
export function ShieldPointGuide({ tier, en, compact = false }: { tier: ShieldTier; en: boolean; compact?: boolean }) {
  return (
    <dl className={`shield-point-guide${compact ? ' shield-point-guide--compact' : ''}`} aria-label={en ? 'Task points → shield bonus' : '과제 포인트 → 쉴드 보너스'}>
      {TASK_DURATION_OPTIONS.map(({ points }) => (
        <div key={points}>
          <dt>{points}P</dt>
          <span aria-hidden="true">→</span>
          <dd>+{SHIELD_BONUS_POINTS[tier][points]}P</dd>
        </div>
      ))}
    </dl>
  );
}
