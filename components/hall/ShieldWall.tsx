'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, FlaskConical, Info, Sparkles, Wand2, X } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import { useMinuteClock, type FamilyAnalyticsState } from '@/lib/analytics/useFamilyAnalytics';
import {
  RULES,
  SHIELD_TYPES,
  TIER_RANK,
  addDays,
  nextPeriod,
  periodContaining,
  zonedDayHour,
  type MissionWeekResult,
  type PastAward,
  type ShieldCandidate,
  type ShieldCompletion,
  type ShieldTier,
} from '@/lib/shields/engine';
import { CAP_BP, MAX_EQUIPPED, RATE_BP, autoEquip, formatBp, summarizeLoadout } from '@/lib/shields/equipment';
import { liveProgress } from '@/lib/shields/live';
import { CATEGORY_COPY, TIER_COPY, TYPE_COPY, scopeLabel, shieldName } from '@/lib/shields/copy';
import type { HabitCategory } from '@/lib/achievements/definitions';
import { EmptyNote, ErrorBanner, LoadingBlock, MEMBER_TONES, MemberAvatar, Section, Segmented, formatDay, useCopy } from '@/components/analytics/ui';
import { EmptyShield, ShieldEmblem } from './ShieldEmblem';
import { ShieldDetail } from './ShieldDetail';
import { periodLabel } from './periodLabel';
import { toEquippable, useShieldWallData, type MonthlyAwardRow, type ShieldWallData } from './useShieldWallData';

const monthText = (month: string, en: boolean) => {
  const p = periodContaining('month', month);
  const l = periodLabel('month', p.start, p.end);
  return en ? l.en : l.ko;
};

function ledgerTotal(data: ShieldWallData, userId: string | null, month: string) {
  let live = 0; let simulated = 0;
  for (const r of data.ledger) {
    if ((userId && r.user_id !== userId) || r.equipment_month !== month) continue;
    if (r.mode === 'live') live += r.bonus_points; else simulated += r.bonus_points;
  }
  return { live, simulated };
}

function AwardCard({ award, action, onOpen }: { award: MonthlyAwardRow; action?: React.ReactNode; onOpen: () => void }) {
  const { en, t } = useCopy();
  const name = t(shieldName(award.shield_type, award.tier, award.category));
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-[#141a31] p-3 text-center">
      <button type="button" onClick={onOpen} aria-label={`${name} — ${en ? 'details' : '자세히'}`} className="rounded-2xl p-1 transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#A5A6FF] motion-reduce:transition-none">
        <ShieldEmblem type={award.shield_type} tier={award.tier} size={84} />
      </button>
      <p className="text-sm font-semibold leading-tight text-white">{name}</p>
      <p className="text-xs text-[#9FF0CE]">+{formatBp(award.bonus_rate_bp)} · <span className="text-[#A9AECB]">{t(scopeLabel(award.scope))}</span></p>
      {action}
    </div>
  );
}

export function ShieldWall({ analytics }: { analytics: FamilyAnalyticsState }) {
  const { en, t } = useCopy();
  const { members, records, familyId } = analytics;
  const users = useFamilyStore(s => s.users);
  const now = useMinuteClock();
  const { data, error, reload, setLoadout } = useShieldWallData(familyId, records?.loadedAt);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<MonthlyAwardRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const memberId = selected ?? members[0]?.id ?? null;
  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? '';
  const toneOf = (id: string) => MEMBER_TONES[Math.max(0, members.findIndex(m => m.id === id)) % MEMBER_TONES.length];

  const view = useMemo(() => {
    if (!data || !memberId) return null;
    const mine = data.awards.filter(a => a.user_id === memberId);
    const available = mine.filter(a => a.equipment_month === data.month);
    const equippedRows = data.equipment.filter(e => e.user_id === memberId).sort((a, b) => a.slot_number - b.slot_number);
    const equipped = equippedRows.map(e => data.awards.find(a => a.id === e.award_id)).filter((a): a is MonthlyAwardRow => !!a);
    const equippable = available.map(toEquippable);
    const best = autoEquip(equippable, data.month);
    const summary = summarizeLoadout(equipped.map(toEquippable));
    return { mine, available, equipped, best, summary };
  }, [data, memberId]);

  // Earn next month: live progress of the current month (never an award).
  const earning = useMemo(() => {
    if (!data || !records || !memberId) return null;
    const { day: today, hour } = zonedDayHour(now, data.timezone);
    const period = periodContaining('month', today);
    const completions: ShieldCompletion[] = records.completions.map(c => ({ id: c.id, userId: c.userId, taskId: c.taskId, completedAt: c.completedAt }));
    const missions: MissionWeekResult[] = records.missions.map(r => ({
      weekStart: r.week_start,
      missionId: r.mission_id,
      status: r.status,
      metMemberIds: (r.result?.participants ?? []).filter(p => p.met === true).map(p => p.id),
    }));
    const pastAwards: PastAward[] = data.awards.filter(a => a.user_id === memberId).map(a => ({ periodType: 'month', periodStart: a.evaluation_month, shieldType: a.shield_type }));
    const progress = liveProgress({ userId: memberId, period, today, nowHour: hour, firstSnapshotDay: data.firstSnapshotDay, schedules: data.schedules, completions, tasks: records.tasks, missions, pastAwards, timezone: data.timezone });
    return { period, progress, nextMonth: nextPeriod(period).start };
  }, [data, records, memberId, now]);

  const firstSnapshotDay = data?.firstSnapshotDay ?? null;
  const firstOfficialMonth = useMemo(() => {
    if (!firstSnapshotDay) return null;
    const p = periodContaining('month', firstSnapshotDay);
    return p.start >= firstSnapshotDay ? p.start : addDays(p.end, 1);
  }, [firstSnapshotDay]);

  if (error && !data) return <div className="p-4"><ErrorBanner onRetry={reload} stale={false} /></div>;
  if (!data || !records) return <LoadingBlock label={en ? 'Loading the Shield Wall' : '쉴드 월을 불러오는 중'} />;
  if (!memberId || !view) return <div className="p-4"><EmptyNote>{en ? 'No family members yet.' : '아직 가족 구성원이 없어요.'}</EmptyNote></div>;

  const memberName = nameOf(memberId);
  const equippedIds = view.equipped.map(a => a.id);
  const isBest = view.best.length === equippedIds.length && view.best.every(id => equippedIds.includes(id));
  const thisMonthTotal = ledgerTotal(data, memberId, data.month);

  const change = async (ids: string[]) => {
    setBusy(true); setActionError(null);
    try { await setLoadout(memberId, ids); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'failed'); }
    finally { setBusy(false); }
  };

  const historyMonths = [...new Set(view.mine.map(a => a.evaluation_month))].sort().reverse();

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      {error && <ErrorBanner onRetry={reload} stale />}

      <section className="relative overflow-hidden rounded-3xl border border-[#E8C77B]/15 bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,199,123,0.16),transparent_60%),radial-gradient(ellipse_at_0%_100%,rgba(165,166,255,0.14),transparent_55%),#11162b] px-5 py-6 text-center sm:py-8">
        <div className="flex justify-center gap-2" aria-hidden>
          {SHIELD_TYPES.map((type, i) => (
            <span key={type} className={i === 2 ? '' : 'mt-3 opacity-80'}><ShieldEmblem type={type} tier={(['silver', 'gold', 'legendary', 'epic', 'gold'] as ShieldTier[])[i]} size={i === 2 ? 56 : 40} /></span>
          ))}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{en ? 'Shield Wall' : '쉴드 월'}</h1>
        <p className="mt-1.5 text-sm font-semibold text-[#F3E3BC] sm:text-base">{en ? 'Earn last month. Equip this month.' : '지난달에 얻고, 이번 달에 장착해요.'}</p>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-[#8E94B4]">{en ? 'Shields earned from a month’s real record can be equipped the next month. Up to three — one per type — add a bonus to the base points of the habits they cover, up to 30% in total.' : '한 달의 실제 기록으로 얻은 쉴드는 다음 달에 장착할 수 있어요. 종류별로 하나씩 최대 3개까지, 해당 습관의 기본 포인트에 보너스를 더해 줘요. 합쳐서 최대 30%예요.'}</p>
        {members.length > 1 && (
          <div className="mt-4 flex justify-center">
            <Segmented label={en ? 'Family member' : '가족 구성원'} value={memberId} onChange={setSelected} options={members.map(m => ({ value: m.id, label: m.name }))} />
          </div>
        )}
      </section>

      {data.mode === 'simulate' && (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-[#7FD3F7]/25 bg-[#7FD3F7]/[0.07] p-3 text-sm text-[#D4EEFB]">
          <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden />
          {en ? 'Preview mode: shield bonuses are calculated and recorded, but not added to points yet.' : '미리보기 모드예요. 쉴드 보너스를 계산하고 기록하지만, 아직 포인트에 더하지는 않아요.'}
        </p>
      )}
      {data.mode === 'off' && (
        <p role="status" className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-[#C9CCE0]">{en ? 'Shield bonuses are paused.' : '쉴드 보너스가 잠시 멈춰 있어요.'}</p>
      )}
      {firstOfficialMonth && firstOfficialMonth > data.month && (
        <p className="flex items-start gap-2 rounded-2xl border border-[#A5A6FF]/20 bg-[#A5A6FF]/[0.07] p-3 text-sm text-[#D7DAF5]">
          <CalendarClock size={16} className="mt-0.5 shrink-0" aria-hidden />
          {en
            ? `The first official month is ${monthText(firstOfficialMonth, true)}. Shields earned then can be equipped from ${formatDay(nextPeriod(periodContaining('month', firstOfficialMonth)).start, true)}. Earlier months can’t be judged fairly, so no past shields are handed out.`
            : `첫 공식 달은 ${monthText(firstOfficialMonth, false)}이에요. 그때 얻은 쉴드는 ${formatDay(nextPeriod(periodContaining('month', firstOfficialMonth)).start, false)}부터 장착할 수 있어요. 그 전 기간은 공정하게 판단할 수 없어서 소급해서 주지 않아요.`}
        </p>
      )}
      {actionError && <p role="alert" className="rounded-2xl border border-[#F2A7C3]/30 bg-[#F2A7C3]/10 p-3 text-sm text-[#F8D3E1]">{en ? 'Couldn’t change the loadout: ' : '장착을 바꾸지 못했어요: '}{actionError}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* 1. Equipped */}
        <Section id="equipped" title={en ? `${memberName}’s equipped shields` : `${memberName}의 장착 쉴드`} subtitle={en ? `${monthText(data.month, true)} · ${view.equipped.length}/${MAX_EQUIPPED} slots` : `${monthText(data.month, false)} · ${view.equipped.length}/${MAX_EQUIPPED}칸`}>
          <ul className="grid grid-cols-3 gap-2 sm:gap-3">
            {Array.from({ length: MAX_EQUIPPED }, (_, i) => view.equipped[i]).map((award, i) => (
              <li key={award?.id ?? `empty-${i}`}>
                {award ? (
                  <AwardCard award={award} onOpen={() => setDetail(award)} action={
                    <button type="button" disabled={busy} onClick={() => change(equippedIds.filter(id => id !== award.id))} className="mt-1 inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/12 px-3 text-xs font-semibold text-[#C9CCE0] hover:bg-white/[0.06] disabled:opacity-50">
                      <X size={13} aria-hidden />{en ? 'Unequip' : '해제'}
                    </button>
                  } />
                ) : (
                  <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/12 p-3 text-center">
                    <EmptyShield size={56} />
                    <span className="text-xs text-[#8E94B4]">{en ? 'Empty slot' : '빈 칸'}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>

        {/* 2. Active bonus summary */}
        <Section id="bonus" title={en ? 'Active bonus' : '지금 적용되는 보너스'} subtitle={en ? 'Added to each habit’s base points when completed.' : '습관을 완료할 때 기본 포인트에 더해져요.'}>
          {view.equipped.length === 0 ? (
            <p className="text-sm text-[#A9AECB]">{en ? 'No bonus right now.' : '지금은 보너스가 없어요.'}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {view.summary.universalBp > 0 && <li className="flex justify-between gap-3"><span className="text-[#C9CCE0]">{en ? 'All habits' : '모든 습관'}</span><strong className="text-[#9FF0CE]">+{formatBp(view.summary.universalBp)}</strong></li>}
              {(Object.entries(view.summary.categoryBp) as Array<[HabitCategory, number]>).map(([cat, bp]) => (
                <li key={cat} className="flex justify-between gap-3"><span className="text-[#C9CCE0]">{en ? `${CATEGORY_COPY[cat].en} habits` : `${CATEGORY_COPY[cat].ko} 습관`}</span><strong className="text-[#9FF0CE]">+{formatBp(bp)}</strong></li>
              ))}
              {view.summary.missionBp > 0 && <li className="flex justify-between gap-3"><span className="text-[#C9CCE0]">{en ? 'Family Mission habits' : '가족 미션 습관'}</span><strong className="text-[#9FF0CE]">+{formatBp(view.summary.missionBp)}</strong></li>}
              <li className="flex justify-between gap-3 border-t border-white/[0.08] pt-2"><span className="text-[#C9CCE0]">{en ? 'Best case for one habit' : '한 습관 최대'}</span><strong className="text-white">+{formatBp(view.summary.maxBp)}{view.summary.capped && <span className="ml-1 text-xs font-normal text-[#E8C77B]">{en ? `(capped at ${formatBp(CAP_BP)})` : `(최대 ${formatBp(CAP_BP)})`}</span>}</strong></li>
            </ul>
          )}
          <p className="mt-3 rounded-xl bg-black/20 p-3 text-xs leading-relaxed text-[#C9CCE0]">
            {data.mode === 'live'
              ? (en ? `${monthText(data.month, true)}: +${thisMonthTotal.live} bonus points so far.` : `${monthText(data.month, false)}: 지금까지 보너스 +${thisMonthTotal.live}점.`)
              : (en ? `${monthText(data.month, true)}: would have earned +${thisMonthTotal.simulated} bonus points so far (preview).` : `${monthText(data.month, false)}: 지금까지 보너스 +${thisMonthTotal.simulated}점이 쌓였을 거예요 (미리보기).`)}
            <br /><span className="text-[#8E94B4]">{en ? 'Bonuses are rounded down, so very small habits may get +0.' : '보너스는 내림 계산이라 아주 작은 습관은 +0일 수 있어요.'}</span>
          </p>
        </Section>
      </div>

      {/* 3. Available */}
      <Section
        id="available"
        title={en ? 'Available this month' : '이번 달 장착할 수 있는 쉴드'}
        subtitle={en ? `Earned in ${monthText(addDays(data.month, -1), true)} · usable until ${formatDay(periodContaining('month', data.month).end, true)}` : `${monthText(addDays(data.month, -1), false)}에 획득 · ${formatDay(periodContaining('month', data.month).end, false)}까지 사용 가능`}
        action={view.available.length > 0 && !isBest ? (
          <button type="button" disabled={busy} onClick={() => change(view.best)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#A5A6FF]/20 px-3 text-sm font-semibold text-white hover:bg-[#A5A6FF]/30 disabled:opacity-50">
            <Wand2 size={15} aria-hidden />{en ? 'Use best combination' : '최고 조합으로 장착'}
          </button>
        ) : undefined}
      >
        {view.available.length === 0 ? (
          <EmptyNote>{en ? `No shields to equip this month. Shields earned in ${monthText(data.month, true)} arrive on ${formatDay(nextPeriod(periodContaining('month', data.month)).start, true)}.` : `이번 달 장착할 쉴드가 없어요. ${monthText(data.month, false)}에 얻는 쉴드는 ${formatDay(nextPeriod(periodContaining('month', data.month)).start, false)}에 도착해요.`}</EmptyNote>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {view.available.map(award => {
              const isOn = equippedIds.includes(award.id);
              const full = !isOn && equippedIds.length >= MAX_EQUIPPED;
              return (
                <li key={award.id}>
                  <AwardCard award={award} onOpen={() => setDetail(award)} action={isOn ? (
                    <span className="mt-1 inline-flex min-h-11 items-center rounded-xl bg-[#79E8BD]/15 px-3 text-xs font-semibold text-[#9FF0CE]">{en ? 'Equipped' : '장착 중'}</span>
                  ) : (
                    <button type="button" disabled={busy || full} onClick={() => change([...equippedIds, award.id])} title={full ? (en ? 'All three slots are full — unequip one first.' : '3칸이 모두 찼어요. 하나를 먼저 해제하세요.') : undefined} className="mt-1 inline-flex min-h-11 items-center rounded-xl bg-[#A5A6FF]/20 px-3 text-xs font-semibold text-white hover:bg-[#A5A6FF]/30 disabled:opacity-40">
                      {full ? (en ? 'Slots full' : '칸이 꽉 찼어요') : (en ? 'Equip' : '장착')}
                    </button>
                  )} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* 4. Earn next month */}
      {earning && (
        <Section id="earn" title={en ? 'Earn for next month' : '다음 달을 위해 얻기'} subtitle={en ? `What ${memberName} earns in ${monthText(earning.period.start, true)} can be equipped in ${monthText(earning.nextMonth, true)}.` : `${monthText(earning.period.start, false)}에 얻는 쉴드는 ${monthText(earning.nextMonth, false)}에 장착할 수 있어요.`}>
          {!earning.progress.official && <p className="mb-3 text-xs text-[#8E94B4]">{en ? 'This month is practice — it started before records were complete.' : '이번 달은 연습이에요. 기록이 완전해지기 전에 시작됐어요.'}</p>}
          <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="rounded-2xl bg-black/20 p-4 text-center sm:w-44">
              <p className="text-3xl font-bold text-white">{earning.progress.consistency.paceRate === null ? '—' : `${Math.round(earning.progress.consistency.paceRate)}%`}</p>
              <p className="text-xs text-[#A9AECB]">{en ? `${earning.progress.consistency.completed}/${earning.progress.consistency.eligibleSoFar} so far · ${earning.progress.consistency.remaining} ahead` : `${earning.progress.consistency.eligibleSoFar}개 중 ${earning.progress.consistency.completed}개 · 앞으로 ${earning.progress.consistency.remaining}개`}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#C9CCE0]">
                {!earning.progress.consistency.eligibilityReachable
                  ? (en ? `Needs ${RULES.month.minOccurrences}+ scheduled habits on ${RULES.month.minDays}+ days.` : `${RULES.month.minDays}일 이상, 습관 ${RULES.month.minOccurrences}개 이상이 필요해요.`)
                  : earning.progress.consistency.next
                    ? (en ? `${earning.progress.consistency.next.needed} more → ${TIER_COPY[earning.progress.consistency.next.tier].en} Consistency (+${formatBp(RATE_BP[earning.progress.consistency.next.tier])})` : `${earning.progress.consistency.next.needed}개 더 → ${TIER_COPY[earning.progress.consistency.next.tier].ko} 꾸준함 (+${formatBp(RATE_BP[earning.progress.consistency.next.tier])})`)
                    : earning.progress.consistency.bestPossibleTier
                      ? (en ? `Best possible: ${TIER_COPY[earning.progress.consistency.bestPossibleTier].en}` : `최대 ${TIER_COPY[earning.progress.consistency.bestPossibleTier].ko}까지 가능`)
                      : (en ? 'Other shields are still possible.' : '다른 쉴드는 아직 가능해요.')}
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {earning.progress.candidates.map((c: ShieldCandidate) => {
                const tier = c.status === 'qualified' ? c.tier : null;
                return (
                  <li key={c.type} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    {tier ? <ShieldEmblem type={c.type} tier={tier} size={40} projected /> : <EmptyShield size={36} />}
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-white">{t(TYPE_COPY[c.type].name)}</p>
                      <p className="text-xs text-[#A9AECB]">{tier
                        ? (en ? `On pace for ${TIER_COPY[tier].en} (+${formatBp(RATE_BP[tier])}) — not earned yet` : `${TIER_COPY[tier].ko} 페이스 (+${formatBp(RATE_BP[tier])}) — 아직 획득 아님`)
                        : c.status === 'insufficient_data' || c.status === 'unavailable'
                          ? (en ? 'Not enough data yet' : '아직 판단할 기록이 부족해요')
                          : (en ? 'Not on pace yet' : '아직 기준에 못 미쳐요')}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>
      )}

      {/* 5. Family showcase */}
      {members.length > 1 && (
        <Section id="showcase" title={en ? 'Family showcase' : '가족 쇼케이스'} subtitle={en ? `Everyone’s loadout for ${monthText(data.month, true)}` : `${monthText(data.month, false)} 모두의 장착`}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {members.map(m => {
              const eq = data.equipment.filter(e => e.user_id === m.id).sort((a, b) => a.slot_number - b.slot_number).map(e => data.awards.find(a => a.id === e.award_id)).filter((a): a is MonthlyAwardRow => !!a);
              const s = summarizeLoadout(eq.map(toEquippable));
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => setSelected(m.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:bg-white/[0.04] ${m.id === memberId ? 'border-[#A5A6FF]/40 bg-[#A5A6FF]/[0.06]' : 'border-white/[0.07] bg-[#141a31]'}`}>
                    <MemberAvatar name={m.name} avatarUrl={users.find(u => u.id === m.id)?.avatarUrl} tone={toneOf(m.id)} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-white">{m.name}</span>
                      <span className="text-xs text-[#A9AECB]">{eq.length ? (en ? `up to +${formatBp(s.maxBp)} per habit` : `습관당 최대 +${formatBp(s.maxBp)}`) : (en ? 'Nothing equipped' : '장착 없음')}</span>
                    </span>
                    <span className="flex gap-1" aria-hidden>{eq.map(a => <ShieldEmblem key={a.id} type={a.shield_type} tier={a.tier} size={32} />)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* 6. History */}
      <Section id="history" title={en ? `${memberName}’s shield history` : `${memberName}의 쉴드 기록`}>
        {historyMonths.length === 0 ? (
          <EmptyNote>{en ? 'No shields earned yet. The first ones arrive after the first official month ends.' : '아직 얻은 쉴드가 없어요. 첫 공식 달이 끝나면 도착해요.'}</EmptyNote>
        ) : (
          <ol className="space-y-5">
            {historyMonths.map(month => {
              const items = view.mine.filter(a => a.evaluation_month === month).sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier]);
              const equipMonth = items[0].equipment_month;
              const total = ledgerTotal(data, memberId, equipMonth);
              return (
                <li key={month}>
                  <h3 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-[#C9CCE0]">
                    <span>{en ? `Earned in ${monthText(month, true)}` : `${monthText(month, false)} 획득`}</span>
                    <span className="text-xs font-normal text-[#8E94B4]">{en ? `equippable in ${monthText(equipMonth, true)}` : `${monthText(equipMonth, false)} 장착`}{equipMonth <= data.month && (total.live || total.simulated) ? (total.live ? ` · +${total.live}${en ? ' pts' : '점'}` : ` · ${en ? 'preview' : '미리보기'} +${total.simulated}${en ? ' pts' : '점'}`) : ''}</span>
                  </h3>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {items.map(a => <li key={a.id}><AwardCard award={a} onOpen={() => setDetail(a)} /></li>)}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <details className="rounded-2xl border border-white/[0.07] bg-[#141a31] p-4 text-sm text-[#C9CCE0]">
        <summary className="flex min-h-9 cursor-pointer items-center gap-2 font-semibold text-white"><Info size={15} aria-hidden />{en ? 'The five shields and their bonuses' : '다섯 가지 쉴드와 보너스'}</summary>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {SHIELD_TYPES.map(type => (
            <li key={type} className="flex gap-3">
              <ShieldEmblem type={type} tier="gold" size={40} />
              <span><strong className="text-white">{t(TYPE_COPY[type].name)}</strong> — {t(TYPE_COPY[type].theme)}<br /><span className="text-xs text-[#A9AECB]">{t(TYPE_COPY[type].how('month'))}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-[#A9AECB]">{en
          ? 'Bonus by tier: Silver +2% · Gold +5% · Epic +10% · Legendary +15%, capped at 30% per habit. Consistency boosts every habit; Dedication its own habit area; Growth and Comeback the areas that improved (or every habit at half rate when that can’t be verified); Teamwork the habits in this week’s Family Mission. Bonuses use base points only, are rounded down, and are taken back if a completion is undone. Only habits on each day’s schedule (recorded just after midnight) count.'
          : '등급별 보너스: 실버 +2% · 골드 +5% · 에픽 +10% · 레전더리 +15%, 한 습관에 최대 30%. 꾸준함은 모든 습관, 몰입은 그 분야 습관, 성장·재도전은 좋아진 분야(확인이 안 되면 모든 습관에 절반), 협력은 이번 주 가족 미션 습관에 적용돼요. 보너스는 기본 포인트로만 계산하고 내림하며, 완료를 취소하면 함께 돌려받아요. 매일 자정 직후 기록된 그날의 일정만 계산해요.'}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[#8E94B4]"><Sparkles size={13} aria-hidden />{en ? 'A new month starts with the best combination equipped automatically. You can change it any time; changes apply from that moment on.' : '새 달이 시작되면 최고 조합이 자동으로 장착돼요. 언제든 바꿀 수 있고, 바꾼 순간부터 적용돼요.'}</p>
      </details>

      {detail && <ShieldDetail award={detail} recipient={nameOf(detail.user_id)} onClose={() => setDetail(null)} />}
    </div>
  );
}
