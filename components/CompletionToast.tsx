import Image from 'next/image';
import { shieldArtSource } from '@/lib/shields/art';
import type { CSSProperties } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { TIER_COPY } from '@/lib/shields/copy';
import { shieldCreditMessage, type ShieldCredit } from '@/lib/shields/completionReward';

const TIER_ACCENT = { bronze: '#C9A27E', silver: '#CDD9EA', gold: '#E8C77B', epic: '#C4B5FD', legendary: '#FFB18D' };

export function CompletionToast({ taskTitle, basePoints, pointsAwarded, shieldBonus, en, detail, onDismiss }: {
  taskTitle: string;
  basePoints: number;
  pointsAwarded: number;
  shieldBonus: ShieldCredit | null;
  en: boolean;
  detail?: string;
  onDismiss: () => void;
}) {
  const accent = shieldBonus?.tier ? TIER_ACCENT[shieldBonus.tier] : '#79E8BD';
  const shieldLabel = shieldBonus?.tier
    ? `${TIER_COPY[shieldBonus.tier][en ? 'en' : 'ko']} ${en ? 'Shield' : '쉴드'}`
    : en ? 'Shield' : '쉴드';
  return (
    <div className="completion-toast" style={{ '--reward-accent': accent } as CSSProperties}>
      <div className="completion-toast__header">
        <span className="completion-toast__check"><Check size={13} strokeWidth={3} aria-hidden="true" /></span>
        <span className="completion-toast__task">{taskTitle}</span>
        <span className="completion-toast__done">{en ? 'Done' : '완료'}</span>
      </div>
      <button type="button" onClick={onDismiss} className="completion-toast__close" aria-label={en ? 'Dismiss' : '닫기'}><X size={15} aria-hidden="true" /></button>
      <div className="completion-toast__total">
        <span>+{pointsAwarded}<span className="completion-toast__unit">P</span></span>
        <span className="completion-toast__earned">{en ? 'Points earned' : '포인트 획득'}</span>
      </div>
      <div className="completion-toast__breakdown" aria-label={shieldBonus ? shieldCreditMessage(basePoints, shieldBonus, en ? 'en' : 'ko') : undefined}>
        <span className="completion-toast__base">{en ? 'Base' : '기본'} <strong>+{basePoints}P</strong></span>
        {shieldBonus && <span className="completion-toast__shield"><span aria-hidden="true">{shieldBonus.tier ? <Image src={shieldArtSource(shieldBonus.tier)} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" /> : <ShieldCheck size={14} />}</span>{shieldLabel}<strong>+{shieldBonus.points}P</strong></span>}
      </div>
      {detail && <p className="completion-toast__detail">{detail}</p>}
    </div>
  );
}
