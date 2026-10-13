'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookHeart, CalendarCheck2, Check, ChevronDown, Clock, Flag, HeartHandshake, Medal, Palmtree, ShieldCheck, Sparkles, Sprout, Tag, Users } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import { useShieldSnapshot } from '@/lib/achievements/useShieldSnapshot';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import {
  addDays,
  buildMemberHistory,
  mondayOf,
  summarizeRange,
  zonedDayHour,
  type MemberHistory,
} from '@/lib/analytics/history';
import {
  MISSION_COPY,
  ROUTINE_DEADLINES,
  ROUTINE_PENALTY_POINTS,
  currentWeekStart,
  evaluateMission,
  familyLegacy,
  protectionStatus,
  type LegacyKind,
  type MissionProgress,
  type ProtectionState,
} from '@/lib/analytics/family';
import type { Localized } from '@/lib/analytics/insights';
import { shieldTitle } from '@/lib/analytics/shieldCopy';
import { useMinuteClock, type FamilyAnalyticsState } from '@/lib/analytics/useFamilyAnalytics';
import { createBrowserSupabase } from '@/lib/supabase';
import { EmptyNote, ErrorBanner, LoadingBlock, MEMBER_TONES, MemberAvatar, Section, formatDay, pctText, useCopy } from '@/components/analytics/ui';
import { FamilyEmblem } from './FamilyEmblem';
import { FamilyMemoryForm, MemoryCard } from './FamilyMemories';

const STATE_COPY: Record<ProtectionState, { label: Localized; detail: (open: number) => Localized }> = {
  vacation: { label: { en: 'Protected · vacation mode', ko: '보호 중 · 휴가 모드' }, detail: () => ({ en: 'Routine deadlines are paused for everyone. Completions still count.', ko: '모두의 루틴 마감이 잠시 멈췄어요. 완료한 습관은 그대로 기록돼요.' }) },
  'sale-day': { label: { en: 'Protected today', ko: '오늘은 보호 중' }, detail: () => ({ en: 'Weekend/holiday sale day: missed routines are not deducted today.', ko: '주말·공휴일 세일일이라 오늘은 루틴을 놓쳐도 차감되지 않아요.' }) },
  secured: { label: { en: 'Secured', ko: '든든해요' }, detail: () => ({ en: 'Every routine due so far is finished. Nice teamwork.', ko: '지금까지 마감된 루틴을 모두 지켰어요. 멋진 팀워크예요.' }) },
  open: { label: { en: 'Routines still open', ko: '아직 남은 루틴' }, detail: open => ({ en: `${open} member${open === 1 ? '' : 's'} still ha${open === 1 ? 's' : 've'} a routine to finish before its deadline.`, ko: `${open}명에게 마감 전 마칠 루틴이 남아 있어요. 서로 응원해 주세요.` }) },
  missed: { label: { en: 'A deadline slipped today', ko: '오늘 놓친 마감이 있어요' }, detail: () => ({ en: 'It happens. The next routine is a fresh start for the whole family.', ko: '그럴 수 있어요. 다음 루틴부터 가족이 함께 다시 시작해요.' }) },
};

const LEGACY_ICON: Record<LegacyKind | 'memory', typeof Flag> = {
  'first-together': HeartHandshake,
  'together-days': Users,
  'family-total': Sparkles,
  'family-comeback': Sprout,
  mission: Flag,
  'team-shield': Medal,
  memory: BookHeart,
};

function ProgressTrack({ value, tone = '#A5A6FF' }: { value: number; tone?: string }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
      <span className="block h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, background: tone }} />
    </span>
  );
}

export function ShieldWall({ analytics }: { analytics: FamilyAnalyticsState }) {
  const { en, t } = useCopy();
  const { members, records, timezone, error, refresh, familyId } = analytics;
  const users = useFamilyStore(s => s.users);
  const harmony = useFamilyStore(s => s.harmony);
  const todayTasksByUser = useFamilyStore(s => s.tasksByUser);
  const todayCompletionsByWindow = useFamilyStore(s => s.todayCompletionsByWindow);
  const penaltyPauseEnabled = useFamilyStore(s => s.penaltyPauseEnabled);
  const saleActive = useFamilyStore(s => s.automaticSaleStatus.active);
  const snapshot = useShieldSnapshot(familyId);
  const now = useMinuteClock();
  const [authId, setAuthId] = useState('');
  const [legacyLimit, setLegacyLimit] = useState(8);

  useEffect(() => {
    let live = true;
    void createBrowserSupabase().auth.getUser().then(({ data }) => { if (live) setAuthId(data.user?.id ?? ''); });
    return () => { live = false; };
  }, []);

  const model = useMemo(() => {
    if (!records) return null;
    const { day: today, hour } = zonedDayHour(now, timezone);
    const histories: MemberHistory[] = members.map(member => buildMemberHistory({ member, tasks: records.tasks, completions: records.completions, now, timezone }));
    const weekStart = currentWeekStart(now, timezone);
    const missionRow = records.missions.find(row => row.week_start === weekStart) ?? null;
    const mission: MissionProgress | null = missionRow
      ? evaluateMission({ missionId: missionRow.mission_id, weekStart, rules: missionRow.rules, tasks: records.tasks, completions: records.completions, now, timezone })
      : null;
    const finished = records.missions.filter(row => row.status !== 'active');
    const protection = protectionStatus({
      members,
      todayTasksByUser,
      todayCompletionsByWindow,
      nowHour: hour,
      vacation: penaltyPauseEnabled,
      saleDay: saleActive,
      penaltiesToday: records.penalties.filter(p => p.date === today).length,
    });
    const activeToday = histories.filter(h => (h.days.get(today)?.completed ?? 0) > 0).length;
    const withHabits = histories.filter(h => h.firstDay !== null || (todayTasksByUser[h.memberId]?.length ?? 0) > 0).length;
    return { today, histories, weekStart, mission, finished, protection, activeToday, withHabits, legacy: familyLegacy(histories, records.missions) };
  }, [records, members, now, timezone, todayTasksByUser, todayCompletionsByWindow, penaltyPauseEnabled, saleActive]);

  if (!records || !model) {
    return error ? <div className="p-4"><ErrorBanner onRetry={refresh} stale={false} /></div> : <LoadingBlock label={en ? 'Loading Shield Wall' : 'Shield Wall을 불러오는 중'} />;
  }

  const defs = new Map(ACHIEVEMENTS.map(def => [def.achievementId, def]));
  const memberName = (id: string) => members.find(m => m.id === id)?.name ?? '';
  const toneOf = (id: string) => MEMBER_TONES[Math.max(0, members.findIndex(m => m.id === id)) % MEMBER_TONES.length];
  const shieldsCollected = Object.values(snapshot?.achievementsByChild ?? {}).reduce((sum, list) => sum + list.filter(b => b.isUnlocked).length, 0);
  const stateCopy = STATE_COPY[model.protection.state];
  const { mission } = model;

  // Team shields join the family legacy (existing achievements, no duplicates).
  const teamShields = new Map<string, { day: string; title: Localized; names: string[] }>();
  for (const [memberId, badges] of Object.entries(snapshot?.achievementsByChild ?? {})) {
    for (const b of badges) {
      if (!b.isUnlocked || b.category !== 'Team Shields' || !b.unlockedAt) continue;
      const def = defs.get(b.achievementId);
      const entry = teamShields.get(b.achievementId) ?? { day: zonedDayHour(new Date(b.unlockedAt), timezone).day, title: def ? shieldTitle(def) : { en: b.title, ko: b.title }, names: [] };
      const day = zonedDayHour(new Date(b.unlockedAt), timezone).day;
      if (day < entry.day) entry.day = day;
      entry.names.push(memberName(memberId));
      teamShields.set(b.achievementId, entry);
    }
  }
  const legacyItems = [
    ...model.legacy.map(e => ({ key: e.id, day: e.day, kind: e.kind as LegacyKind | 'memory', title: t(e.text), detail: e.detail ? t(e.detail) : '', memory: null as null | (typeof records.memories)[number] })),
    ...[...teamShields.entries()].map(([id, s]) => ({ key: `team-${id}`, day: s.day, kind: 'team-shield' as const, title: en ? `Team shield: ${s.title.en}` : `팀 쉴드: ${s.title.ko}`, detail: s.names.filter(Boolean).join(' · '), memory: null })),
    ...records.memories.map(m => ({ key: `memory-${m.id}`, day: m.memory_date, kind: 'memory' as const, title: '', detail: '', memory: m })),
  ].sort((a, b) => b.day.localeCompare(a.day) || a.key.localeCompare(b.key));

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:px-6 sm:py-6">
      {error && <ErrorBanner onRetry={refresh} stale />}

      {/* 1. Family shield hero */}
      <section aria-labelledby="family-shield-title" className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(ellipse_at_20%_0%,rgba(165,166,255,0.22),transparent_55%),radial-gradient(ellipse_at_90%_100%,rgba(121,232,189,0.14),transparent_55%),linear-gradient(160deg,#171c36,#0f1324)] p-5 sm:p-8">
        <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
          <div className="mx-auto"><FamilyEmblem state={model.protection.state} activeToday={model.activeToday} members={Math.max(1, model.withHabits)} /></div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A5A6FF]">{en ? 'We grow stronger together' : '함께할수록 더 단단해져요'}</p>
            <h1 id="family-shield-title" className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={26} className="text-[#79E8BD]" aria-hidden />{t(stateCopy.label)}</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#C9CCE0]">{t(stateCopy.detail(model.protection.openMembers))}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-black/25 p-3"><dt className="text-xs text-[#A9AECB]">{en ? 'Active today' : '오늘 참여'}</dt><dd className="mt-1 text-lg font-bold text-white">{model.activeToday}/{model.withHabits}</dd></div>
              <div className="rounded-2xl bg-black/25 p-3"><dt className="text-xs text-[#A9AECB]">{en ? 'Family harmony' : '가족 하모니'}</dt><dd className="mt-1 text-lg font-bold text-white">{harmony ? `${harmony.score}` : '—'}<span className="ml-1 text-xs font-normal text-[#8E94B4]">{harmony ? (en ? `· ${harmony.sideBySideDays}/7 days together` : `· 최근 7일 중 ${harmony.sideBySideDays}일 함께`) : ''}</span></dd></div>
              <div className="rounded-2xl bg-black/25 p-3"><dt className="text-xs text-[#A9AECB]">{en ? 'Shields collected' : '모은 쉴드'}</dt><dd className="mt-1 text-lg font-bold text-white">{snapshot ? shieldsCollected : '—'}</dd></div>
              <div className="rounded-2xl bg-black/25 p-3"><dt className="text-xs text-[#A9AECB]">{en ? 'Missions completed' : '달성한 미션'}</dt><dd className="mt-1 text-lg font-bold text-white">{model.finished.filter(r => r.status === 'completed').length}<span className="ml-1 text-xs font-normal text-[#8E94B4]">/ {model.finished.length}{en ? ' weeks' : '주'}</span></dd></div>
            </dl>
            {mission && (
              <div className="mt-4">
                <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs text-[#C9CCE0]">
                  <span>{en ? 'This week’s objective' : '이번 주 목표'} · <strong className="text-white">{t(MISSION_COPY[mission.missionId].title)}</strong></span>
                  <span>{mission.current}/{mission.target}</span>
                </div>
                <ProgressTrack value={mission.target ? mission.current / mission.target : 0} tone={mission.complete ? '#79E8BD' : '#A5A6FF'} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Family contribution */}
      <Section title={en ? 'How everyone is contributing' : '가족 모두의 기여'} subtitle={en ? 'Each person is measured against their own schedule — no rankings.' : '각자 자신의 일정 기준으로 봐요. 순위는 없어요.'}>
        {members.length === 0 ? <EmptyNote>{en ? 'No family members yet.' : '아직 가족 구성원이 없어요.'}</EmptyNote> : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {members.map(m => {
              const h = model.histories.find(x => x.memberId === m.id)!;
              const week = summarizeRange(h, mondayOf(model.today), model.today);
              const activeToday = (h.days.get(model.today)?.completed ?? 0) > 0;
              const part = mission?.participants.find(p => p.id === m.id);
              const recentShield = (snapshot?.achievementsByChild?.[m.id] ?? [])
                .filter(b => b.isUnlocked && b.unlockedAt && zonedDayHour(new Date(b.unlockedAt), timezone).day >= addDays(model.today, -13))
                .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))[0];
              const recentDef = recentShield ? defs.get(recentShield.achievementId) : undefined;
              const user = users.find(u => u.id === m.id);
              return (
                <li key={m.id} className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
                  <div className="flex items-center gap-3">
                    <MemberAvatar name={m.name} avatarUrl={user?.avatarUrl} tone={toneOf(m.id)} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{m.name}</p>
                      <p className={`inline-flex items-center gap-1 text-xs ${activeToday ? 'text-[#79E8BD]' : 'text-[#8E94B4]'}`}>
                        {activeToday ? <Check size={12} aria-hidden /> : <Clock size={12} aria-hidden />}
                        {activeToday ? (en ? 'Active today' : '오늘 참여함') : (en ? 'Not yet today' : '오늘 아직')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-[#A9AECB]">{en ? 'This week' : '이번 주 완료율'}</p>
                      <p className="text-2xl font-bold text-white">{pctText(week.rate)}</p>
                    </div>
                    <p className="text-right text-xs text-[#8E94B4]">{week.eligible > 0 ? (en ? `${week.completed}/${week.eligible} · ${week.activeDays} days` : `${week.completed}/${week.eligible} · ${week.activeDays}일`) : (en ? 'No habits due yet' : '아직 해야 할 습관 없음')}</p>
                  </div>
                  <div className="mt-2"><ProgressTrack value={week.rate ?? 0} tone={toneOf(m.id)} /></div>
                  {part && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-[#C9CCE0]">
                      <Flag size={12} className={part.met ? 'text-[#79E8BD]' : 'text-[#8E94B4]'} aria-hidden />{t(part.value)}{part.met && <span className="sr-only">{en ? ' (done)' : ' (달성)'}</span>}
                    </p>
                  )}
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#C9CCE0]">
                    <Sparkles size={12} className="text-[#E8C77B]" aria-hidden />
                    {recentShield && recentDef ? (en ? `Earned “${shieldTitle(recentDef).en}”` : `‘${shieldTitle(recentDef).ko}’ 쉴드 획득`)
                      : h.completedSlots.length > 0 ? (en ? `${h.completedSlots.length.toLocaleString('en')} habits completed in total` : `지금까지 ${h.completedSlots.length.toLocaleString('ko')}번 완료`)
                      : (en ? 'Ready for a first step' : '첫걸음을 기다리고 있어요')}
                  </p>
                  <Link href={`/stats?member=${encodeURIComponent(m.id)}`} className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[#A5A6FF] hover:underline">{en ? 'Personal stats' : '개인 통계 보기'}<ArrowRight size={13} aria-hidden /></Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* 3. Family mission */}
      <Section title={en ? 'Family mission' : '가족 미션'} subtitle={en ? `Week of ${formatDay(model.weekStart, true)} · resets every Monday` : `${formatDay(model.weekStart, false)} 주간 · 매주 월요일에 새로 시작`}>
        {records.missionsError ? <EmptyNote>{en ? 'Missions are unavailable right now.' : '지금은 미션을 불러올 수 없어요.'}</EmptyNote>
          : !mission ? <EmptyNote>{model.withHabits < 2 ? (en ? 'Missions start once two or more members have habits.' : '두 명 이상이 습관을 가지면 가족 미션이 시작돼요.') : (en ? 'This week’s mission is being prepared.' : '이번 주 미션을 준비하고 있어요.')}</EmptyNote>
          : (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <p className="inline-flex items-center gap-2 text-lg font-bold text-white"><HeartHandshake size={20} className="text-[#A5A6FF]" aria-hidden />{t(MISSION_COPY[mission.missionId].title)}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#C9CCE0]">{t(MISSION_COPY[mission.missionId].goal(mission.target, records.missions.find(r => r.week_start === model.weekStart)?.rules.strongRate ?? 0.7))}</p>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-sm"><span className="font-semibold text-white">{mission.complete ? (en ? 'Mission complete!' : '미션 달성!') : (en ? 'Progress' : '진행')}</span><span className="text-[#C9CCE0]">{mission.current}/{mission.target}</span></div>
                  <ProgressTrack value={mission.target ? mission.current / mission.target : 0} tone={mission.complete ? '#79E8BD' : '#A5A6FF'} />
                  <p className="mt-2 text-xs text-[#8E94B4]">{mission.ended ? (en ? 'Week finished' : '이번 주 종료') : (en ? `${mission.daysLeft} day${mission.daysLeft === 1 ? '' : 's'} left, including today` : `오늘 포함 ${mission.daysLeft}일 남음`)}</p>
                </div>
                <p className="mt-4 rounded-xl bg-black/20 p-3 text-xs leading-relaxed text-[#A9AECB]">
                  {en ? 'Rules were locked when the week began, so habit edits don’t change this mission. Missions add no points or extra rewards — they’re about doing it together.' : '규칙은 주가 시작될 때 고정돼서, 습관을 수정해도 이번 미션은 바뀌지 않아요. 미션에는 포인트나 별도 보상이 없어요. 함께하는 게 목적이에요.'}
                </p>
              </div>
              <ul className="space-y-2">
                {mission.participants.map(p => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <MemberAvatar name={memberName(p.id)} avatarUrl={users.find(u => u.id === p.id)?.avatarUrl} tone={toneOf(p.id)} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{memberName(p.id)}</span>
                    <span className="text-xs text-[#C9CCE0]">{t(p.value)}</span>
                    <span className={`grid h-6 w-6 place-items-center rounded-full ${p.met ? 'bg-[#79E8BD]/20 text-[#79E8BD]' : 'bg-white/5 text-[#7F86A8]'}`} aria-label={p.met ? (en ? 'part done' : '달성') : (en ? 'in progress' : '진행 중')}>{p.met ? <Check size={13} /> : <Clock size={12} />}</span>
                  </li>
                ))}
                {mission.missionId === 'all-together' && <li className="px-1 text-xs text-[#8E94B4]">{en ? 'Each member’s line shows their days so far; the family counts days when everyone with habits showed up.' : '각자의 줄은 참여한 날이고, 가족 진행은 습관이 있는 모두가 함께한 날만 세요.'}</li>}
              </ul>
            </div>
          )}
      </Section>

      {/* 4. Protection center */}
      <Section title={en ? 'Protection center' : '보호 센터'} subtitle={en ? 'How routine protection works in FamBit today.' : 'FamBit의 루틴 보호 규칙이에요.'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {model.protection.deadlines.map(d => (
              <div key={d.window} className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{d.window === 'morning' ? (en ? 'Morning routine' : '아침 루틴') : (en ? 'Evening routine' : '저녁 루틴')}</p>
                  <span className="text-xs text-[#A9AECB]">{en ? `Due ${d.hour}:00` : `${d.hour}:00 마감`}{d.closed ? (en ? ' · closed' : ' · 마감됨') : ''}</span>
                </div>
                {d.members.length === 0 ? <p className="mt-2 text-xs text-[#8E94B4]">{en ? 'No routines scheduled today.' : '오늘은 예정된 루틴이 없어요.'}</p> : (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {d.members.map(ms => {
                      const finished = ms.done >= ms.due;
                      return (
                        <li key={ms.id} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs ${finished ? 'border-[#79E8BD]/30 bg-[#79E8BD]/10 text-[#BFF5DE]' : 'border-white/12 text-[#C9CCE0]'}`}>
                          {finished ? <Check size={12} aria-hidden /> : <Clock size={12} aria-hidden />}{memberName(ms.id)} {ms.done}/{ms.due}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-[#C9CCE0]">
            <p>{en ? `Finish every morning routine by ${ROUTINE_DEADLINES.morning}:00 and every evening routine by ${ROUTINE_DEADLINES.evening}:00. A routine left unfinished at its deadline deducts ${ROUTINE_PENALTY_POINTS} spendable points (never below zero). XP and levels are not affected.` : `아침 루틴은 ${ROUTINE_DEADLINES.morning}시, 저녁 루틴은 ${ROUTINE_DEADLINES.evening}시까지 모두 마치면 돼요. 마감까지 못 마치면 사용 가능 포인트가 ${ROUTINE_PENALTY_POINTS}점 차감돼요 (0 아래로는 내려가지 않고, XP와 레벨은 그대로예요).`}</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2"><Palmtree size={16} className="mt-0.5 shrink-0 text-[#79E8BD]" aria-hidden /><span>{en ? 'Vacation mode (parents, from the dashboard menu) pauses deductions for the whole family.' : '휴가 모드(부모님이 대시보드 메뉴에서 켜요)를 켜면 가족 모두의 차감이 멈춰요.'} <strong className="text-white">{penaltyPauseEnabled ? (en ? 'On now.' : '지금 켜져 있어요.') : (en ? 'Off now.' : '지금은 꺼져 있어요.')}</strong></span></li>
              <li className="flex items-start gap-2"><Tag size={16} className="mt-0.5 shrink-0 text-[#E8C77B]" aria-hidden /><span>{en ? 'Automatic weekend/holiday sale days skip deductions.' : '자동 주말·공휴일 세일일에는 차감되지 않아요.'} <strong className="text-white">{saleActive ? (en ? 'Today is one.' : '오늘이 세일일이에요.') : (en ? 'Not today.' : '오늘은 아니에요.')}</strong></span></li>
            </ul>
            <details className="rounded-xl bg-black/20 p-3">
              <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-white">
                {en ? `Missed deadlines · last 14 days (${records.penalties.length})` : `최근 14일 놓친 마감 (${records.penalties.length})`}<ChevronDown size={14} aria-hidden />
              </summary>
              {records.penalties.length === 0 ? <p className="mt-2 text-xs text-[#8E94B4]">{en ? 'None. Every deadline was kept.' : '없어요. 모든 마감을 지켰어요.'}</p> : (
                <ul className="mt-2 space-y-1 text-xs">
                  {records.penalties.slice(0, 20).map(p => (
                    <li key={p.id} className="flex justify-between gap-2 text-[#C9CCE0]">
                      <span>{formatDay(p.date, en)} · {memberName(p.userId)} · {p.kind === 'morning' ? (en ? 'morning' : '아침') : (en ? 'evening' : '저녁')}</span>
                      <span className="text-[#8E94B4]">−{p.pointsDeducted}P</span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </div>
        </div>
      </Section>

      {/* 5. Family legacy */}
      <Section title={en ? 'Family legacy' : '가족의 발자취'} subtitle={en ? 'Milestones found in your family’s real records, plus your own words.' : '가족의 실제 기록에서 찾은 순간과, 직접 남긴 한 줄이에요.'}>
        <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
          <div>
            {familyId && <FamilyMemoryForm familyId={familyId} today={model.today} onSaved={refresh} />}
            {records.memoriesError && <p className="mt-2 text-xs text-[#F3E3BC]">{en ? 'Family memories could not be loaded.' : '가족의 한 줄을 불러오지 못했어요.'}</p>}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-[#8E94B4]"><CalendarCheck2 size={13} aria-hidden />{en ? 'Only events backed by records appear here.' : '기록으로 확인되는 순간만 보여드려요.'}</p>
          </div>
          {legacyItems.length === 0 ? <EmptyNote>{en ? 'Your family story begins with the first day everyone shows up.' : '모두가 함께하는 첫날부터 가족의 이야기가 시작돼요.'}</EmptyNote> : (
            <div>
              <ol className="relative space-y-4 border-l border-white/10 pl-6">
                {legacyItems.slice(0, legacyLimit).map(item => {
                  const Icon = LEGACY_ICON[item.kind];
                  return (
                    <li key={item.key} className="relative">
                      <span className={`absolute -left-[37px] grid h-7 w-7 place-items-center rounded-full border border-white/10 ${item.kind === 'memory' ? 'bg-[#2a2440] text-[#F2A7C3]' : 'bg-[#1d2340] text-[#E8C77B]'}`} aria-hidden><Icon size={14} /></span>
                      <time dateTime={item.day} className="text-xs text-[#8E94B4]">{formatDay(item.day, en, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
                      {item.memory ? <MemoryCard memory={item.memory} mine={item.memory.author_id === authId} onDeleted={refresh} /> : (
                        <>
                          <p className="text-sm font-semibold text-[#F4F5FA]">{item.title}</p>
                          {item.detail && <p className="text-xs text-[#A9AECB]">{item.detail}</p>}
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
              {legacyItems.length > legacyLimit && (
                <button type="button" onClick={() => setLegacyLimit(n => n + 10)} className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#A5A6FF] hover:bg-white/[0.05]">{en ? 'Earlier moments' : '이전 순간 더 보기'}<ChevronDown size={15} aria-hidden /></button>
              )}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
