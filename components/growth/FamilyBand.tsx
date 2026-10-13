'use client';

import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Clock, Flag, HeartHandshake, Palmtree, ShieldCheck, Tag } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import { mondayOf, summarizeRange, type MemberHistory } from '@/lib/analytics/history';
import {
  MISSION_COPY,
  ROUTINE_DEADLINES,
  ROUTINE_PENALTY_POINTS,
  type MissionProgress,
  type ProtectionState,
  type ProtectionStatus,
} from '@/lib/analytics/family';
import type { AnalyticsMember } from '@/lib/analytics/history';
import type { Localized } from '@/lib/analytics/insights';
import type { PenaltyRecord } from '@/lib/analytics/useFamilyAnalytics';
import { MEMBER_TONES, MemberAvatar, formatDay, pctText, useCopy } from '@/components/analytics/ui';
import { FamilyEmblem } from './FamilyEmblem';

const STATE_LABEL: Record<ProtectionState, Localized> = {
  vacation: { en: 'Protected · vacation mode', ko: '보호 중 · 휴가 모드' },
  'sale-day': { en: 'Protected today · sale day', ko: '오늘은 보호 중 · 세일일' },
  secured: { en: 'Secured', ko: '든든해요' },
  open: { en: 'Routines still open', ko: '아직 남은 루틴' },
  missed: { en: 'A deadline slipped today', ko: '오늘 놓친 마감이 있어요' },
};

function ProgressTrack({ value, tone = '#A5A6FF', thin = false }: { value: number; tone?: string; thin?: boolean }) {
  return (
    <span className={`block overflow-hidden rounded-full bg-white/10 ${thin ? 'h-1.5' : 'h-2'}`} aria-hidden>
      <span className="block h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, background: tone }} />
    </span>
  );
}

/** One line on today's routine protection, e.g. "Evening routine · 2 left · due 22:00". */
function protectionLine(p: ProtectionStatus, en: boolean): string {
  if (p.state === 'vacation') return en ? 'Routine deductions are paused for everyone.' : '모두의 루틴 차감이 잠시 멈췄어요.';
  if (p.state === 'sale-day') return en ? 'Missed routines are not deducted today.' : '오늘은 루틴을 놓쳐도 차감되지 않아요.';
  const next = p.deadlines.find(d => !d.closed && d.members.some(m => m.done < m.due));
  if (next) {
    const left = next.members.filter(m => m.done < m.due).length;
    const name = next.window === 'morning' ? (en ? 'Morning routine' : '아침 루틴') : (en ? 'Evening routine' : '저녁 루틴');
    return en ? `${name} · ${left} member${left === 1 ? '' : 's'} to go · due ${next.hour}:00` : `${name} · ${left}명 남음 · ${next.hour}:00 마감`;
  }
  if (p.state === 'missed') return en ? 'The next routine is a fresh start for everyone.' : '다음 루틴부터 함께 다시 시작해요.';
  return en ? 'Every routine due so far is done.' : '지금까지 마감된 루틴을 모두 지켰어요.';
}

export interface FamilyBandProps {
  members: AnalyticsMember[];
  histories: MemberHistory[];
  today: string;
  mission: MissionProgress | null;
  missionStrongRate: number;
  missionsUnavailable: boolean;
  missionsCompleted: number;
  missionsFinished: number;
  protection: ProtectionStatus;
  penalties: PenaltyRecord[];
  activeToday: number;
  withHabits: number;
  /** Equipped shields shown on each member card. */
  renderBadges?: (memberId: string) => ReactNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FamilyBand(props: FamilyBandProps) {
  const { en, t } = useCopy();
  const users = useFamilyStore(s => s.users);
  const harmony = useFamilyStore(s => s.harmony);
  const penaltyPauseEnabled = useFamilyStore(s => s.penaltyPauseEnabled);
  const saleActive = useFamilyStore(s => s.automaticSaleStatus.active);
  const [missionOpen, setMissionOpen] = useState(false);
  const [protectionOpen, setProtectionOpen] = useState(false);
  const { mission, protection, members } = props;
  const memberName = (id: string) => members.find(m => m.id === id)?.name ?? '';
  const toneOf = (id: string) => MEMBER_TONES[Math.max(0, members.findIndex(m => m.id === id)) % MEMBER_TONES.length];

  return (
    <section aria-labelledby="family-band-title" className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(ellipse_at_15%_0%,rgba(165,166,255,0.20),transparent_55%),radial-gradient(ellipse_at_95%_100%,rgba(121,232,189,0.12),transparent_55%),linear-gradient(160deg,#171c36,#0f1324)] p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <div className="shrink-0"><FamilyEmblem state={protection.state} activeToday={props.activeToday} members={Math.max(1, props.withHabits)} size={84} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A5A6FF]">{en ? 'Today, together' : '오늘 우리 가족'}</p>
          <h2 id="family-band-title" className="mt-0.5 flex items-center gap-1.5 text-lg font-bold text-white sm:text-xl">
            <ShieldCheck size={20} className="shrink-0 text-[#79E8BD]" aria-hidden /><span className="truncate">{t(STATE_LABEL[protection.state])}</span>
          </h2>
          <p className="mt-0.5 text-sm text-[#C9CCE0]">{protectionLine(protection, en)}</p>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#A9AECB]">
            <span>{en ? 'Active today' : '오늘 참여'} <strong className="text-white">{props.activeToday}/{props.withHabits}</strong></span>
            {harmony && <span>{en ? 'Together' : '함께한 날'} <strong className="text-white">{harmony.sideBySideDays}/7</strong></span>}
            <span>{en ? 'Missions' : '달성 미션'} <strong className="text-white">{props.missionsCompleted}</strong>{props.missionsFinished > 0 ? `/${props.missionsFinished}` : ''}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {/* Mission — one line, details on demand */}
        <div className="rounded-2xl bg-black/25">
          <button type="button" aria-expanded={missionOpen} aria-controls="mission-details" onClick={() => setMissionOpen(o => !o)} disabled={!mission} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default">
            <HeartHandshake size={18} className="shrink-0 text-[#A5A6FF]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex justify-between gap-2 text-sm">
                <span className="truncate text-[#C9CCE0]">{mission ? <>{en ? 'Mission' : '이번 주 미션'} · <strong className="text-white">{t(MISSION_COPY[mission.missionId].title)}</strong></> : props.missionsUnavailable ? (en ? 'Missions unavailable right now' : '지금은 미션을 불러올 수 없어요') : props.withHabits < 2 ? (en ? 'Missions start with two members' : '두 명 이상이면 미션이 시작돼요') : (en ? 'Preparing this week’s mission' : '이번 주 미션 준비 중')}</span>
                {mission && <span className="shrink-0 text-xs text-[#C9CCE0]">{mission.complete ? (en ? 'Complete!' : '달성!') : `${mission.current}/${mission.target}`}{!mission.ended && ` · ${en ? `${mission.daysLeft}d left` : `${mission.daysLeft}일 남음`}`}</span>}
              </span>
              {mission && <span className="mt-1.5 block"><ProgressTrack thin value={mission.target ? mission.current / mission.target : 0} tone={mission.complete ? '#79E8BD' : '#A5A6FF'} /></span>}
            </span>
            {mission && <ChevronDown size={16} aria-hidden className={`shrink-0 text-[#8E94B4] transition motion-reduce:transition-none ${missionOpen ? 'rotate-180' : ''}`} />}
          </button>
          {mission && missionOpen && (
            <div id="mission-details" className="border-t border-white/[0.06] px-3 pb-3 pt-2 text-sm">
              <p className="leading-relaxed text-[#C9CCE0]">{t(MISSION_COPY[mission.missionId].goal(mission.target, props.missionStrongRate))}</p>
              <ul className="mt-2 space-y-1">
                {mission.participants.map(p => (
                  <li key={p.id} className="flex items-center gap-2 text-xs">
                    <span className={`grid h-5 w-5 place-items-center rounded-full ${p.met ? 'bg-[#79E8BD]/20 text-[#79E8BD]' : 'bg-white/5 text-[#7F86A8]'}`} aria-label={p.met ? (en ? 'done' : '달성') : (en ? 'in progress' : '진행 중')}>{p.met ? <Check size={11} /> : <Clock size={10} />}</span>
                    <span className="font-semibold text-white">{memberName(p.id)}</span><span className="text-[#A9AECB]">{t(p.value)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-[#8E94B4]">{en ? 'Rules lock when the week begins and reset every Monday. Missions add no points — they’re about doing it together.' : '규칙은 주가 시작될 때 고정되고 매주 월요일에 새로 시작해요. 미션에는 포인트가 없어요. 함께하는 게 목적이에요.'}</p>
            </div>
          )}
        </div>

        {/* Protection — rules and recent misses on demand */}
        <div className="rounded-2xl bg-black/25">
          <button type="button" aria-expanded={protectionOpen} aria-controls="protection-details" onClick={() => setProtectionOpen(o => !o)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left">
            <Clock size={18} className="shrink-0 text-[#E8C77B]" aria-hidden />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block text-[#C9CCE0]">{en ? 'Routine deadlines' : '루틴 마감'}</span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                {protection.deadlines.map(d => {
                  const left = d.members.filter(m => m.done < m.due).length;
                  return <span key={d.window} className={`rounded-full px-2 py-0.5 text-[11px] ${d.closed || left === 0 ? 'bg-white/5 text-[#A9AECB]' : 'bg-[#E8C77B]/15 text-[#F3E3BC]'}`}>{d.window === 'morning' ? (en ? 'AM' : '아침') : (en ? 'PM' : '저녁')} {d.hour}:00 · {d.members.length === 0 ? (en ? 'none' : '없음') : d.closed ? (en ? 'closed' : '마감') : left === 0 ? (en ? 'all done' : '모두 완료') : (en ? `${left} to go` : `${left}명 남음`)}</span>;
                })}
              </span>
            </span>
            <ChevronDown size={16} aria-hidden className={`shrink-0 text-[#8E94B4] transition motion-reduce:transition-none ${protectionOpen ? 'rotate-180' : ''}`} />
          </button>
          {protectionOpen && (
            <div id="protection-details" className="space-y-2 border-t border-white/[0.06] px-3 pb-3 pt-2 text-xs leading-relaxed text-[#C9CCE0]">
              {protection.deadlines.map(d => d.members.length > 0 && (
                <p key={d.window} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[#A9AECB]">{d.window === 'morning' ? (en ? 'Morning' : '아침') : (en ? 'Evening' : '저녁')}</span>
                  {d.members.map(m => <span key={m.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${m.done >= m.due ? 'border-[#79E8BD]/30 text-[#BFF5DE]' : 'border-white/12'}`}>{m.done >= m.due && <Check size={10} aria-hidden />}{memberName(m.id)} {m.done}/{m.due}</span>)}
                </p>
              ))}
              <p>{en ? `Finish morning routines by ${ROUTINE_DEADLINES.morning}:00 and evening routines by ${ROUTINE_DEADLINES.evening}:00. A routine left unfinished deducts ${ROUTINE_PENALTY_POINTS} spendable points (never below zero; XP and levels stay).` : `아침 루틴은 ${ROUTINE_DEADLINES.morning}시, 저녁 루틴은 ${ROUTINE_DEADLINES.evening}시까지 마치면 돼요. 못 마치면 사용 가능 포인트가 ${ROUTINE_PENALTY_POINTS}점 차감돼요 (0 아래로는 내려가지 않고, XP와 레벨은 그대로).`}</p>
              <p className="flex items-start gap-1.5"><Palmtree size={13} className="mt-0.5 shrink-0 text-[#79E8BD]" aria-hidden />{en ? 'Vacation mode (parents, dashboard menu) pauses deductions.' : '휴가 모드(부모님, 대시보드 메뉴)를 켜면 차감이 멈춰요.'} <strong className="text-white">{penaltyPauseEnabled ? (en ? 'On.' : '켜짐') : (en ? 'Off.' : '꺼짐')}</strong></p>
              <p className="flex items-start gap-1.5"><Tag size={13} className="mt-0.5 shrink-0 text-[#E8C77B]" aria-hidden />{en ? 'Weekend/holiday sale days skip deductions.' : '주말·공휴일 세일일에는 차감되지 않아요.'} <strong className="text-white">{saleActive ? (en ? 'Today is one.' : '오늘이 세일일') : (en ? 'Not today.' : '오늘은 아님')}</strong></p>
              <p className="text-[#A9AECB]">{en ? `Missed deadlines, last 14 days: ${props.penalties.length}` : `최근 14일 놓친 마감: ${props.penalties.length}번`}</p>
              {props.penalties.length > 0 && (
                <ul className="space-y-0.5">
                  {props.penalties.slice(0, 10).map(p => <li key={p.id} className="flex justify-between gap-2"><span>{formatDay(p.date, en)} · {memberName(p.userId)} · {p.kind === 'morning' ? (en ? 'morning' : '아침') : (en ? 'evening' : '저녁')}</span><span className="text-[#8E94B4]">−{p.pointsDeducted}P</span></li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Member cards double as the member picker for everything below. */}
      <div role="group" aria-label={en ? 'Choose a family member' : '가족 구성원 선택'} className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {members.map(m => {
          const h = props.histories.find(x => x.memberId === m.id);
          const week = h ? summarizeRange(h, mondayOf(props.today), props.today) : null;
          const activeToday = (h?.days.get(props.today)?.completed ?? 0) > 0;
          const part = mission?.participants.find(p => p.id === m.id);
          const selected = props.selectedId === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={selected}
              onClick={() => props.onSelect(m.id)}
              className={`rounded-2xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A5A6FF] ${selected ? 'border-[#A5A6FF]/70 bg-[#A5A6FF]/[0.14] shadow-[0_0_0_1px_rgba(165,166,255,0.25)]' : 'border-white/[0.08] bg-black/20 hover:bg-white/[0.05]'}`}
            >
              <span className="flex items-center gap-2">
                <MemberAvatar name={m.name} avatarUrl={users.find(u => u.id === m.id)?.avatarUrl} tone={toneOf(m.id)} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{m.name}</span>
                  <span className={`flex items-center gap-1 text-[11px] ${activeToday ? 'text-[#79E8BD]' : 'text-[#8E94B4]'}`}>{activeToday ? <Check size={11} aria-hidden /> : <Clock size={11} aria-hidden />}{activeToday ? (en ? 'Active today' : '오늘 참여') : (en ? 'Not yet' : '아직')}</span>
                </span>
                {props.renderBadges?.(m.id)}
                <span className="text-lg font-bold text-white">{pctText(week?.rate ?? null)}</span>
              </span>
              <span className="mt-2 block"><ProgressTrack thin value={week?.rate ?? 0} tone={toneOf(m.id)} /></span>
              <span className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#8E94B4]">
                <span>{en ? 'This week' : '이번 주'}{week && week.eligible > 0 ? ` ${week.completed}/${week.eligible}` : ''}</span>
                {part && <span className={`inline-flex min-w-0 items-center gap-1 truncate ${part.met ? 'text-[#79E8BD]' : ''}`}><Flag size={10} aria-hidden className="shrink-0" /><span className="truncate">{t(part.value)}</span></span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
