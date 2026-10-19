'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PartyPopper, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createBrowserSupabase } from '@/lib/supabase';
import { useFamilyStore } from '@/lib/store';
import { MISSION_COPY, currentWeekStart, evaluateMission, type MissionProgress, type MissionWeekRow } from '@/lib/analytics/family';
import { mapTask } from '@/lib/analytics/useFamilyAnalytics';
import type { AnalyticsCompletion } from '@/lib/analytics/history';

// The family's one shared goal: this week's Family Mission. It replaces the
// Harmony chip and the daily Family Quest, which measured the same thing.
// Completing it is celebrated; it adds no points.

let cached: { key: string; promise: Promise<MissionProgress | null> } | null = null;

async function loadMission(familyId: string): Promise<MissionProgress | null> {
  const db = createBrowserSupabase();
  const { data: tz, error: tzError } = await db.rpc('shield_family_timezone', { p_family_id: familyId });
  if (tzError) throw new Error(tzError.message);
  const timezone = String(tz);
  const now = new Date();
  const weekStart = currentWeekStart(now, timezone);
  const { data: row, error } = await db.from('family_mission_weeks')
    .select('family_id,week_start,mission_id,rules,status,result,finalized_at')
    .eq('family_id', familyId).eq('week_start', weekStart).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;
  const mission = row as MissionWeekRow;
  const userIds = mission.rules.participants.map(p => p.id);
  // Completions from a week earlier cover the comeback mission's comparison.
  const since = new Date(`${weekStart}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 8);
  const [tasks, completions] = await Promise.all([
    db.from('tasks').select('id,user_id,title,icon,days_of_week,recurrence,time_window,task_type,active,created_at,deleted_at,streak_count').eq('family_id', familyId).limit(2000),
    db.from('task_completions').select('id,user_id,task_id,completed_at,partial').in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']).gte('completed_at', since.toISOString()).limit(10000),
  ]);
  if (tasks.error) throw new Error(tasks.error.message);
  if (completions.error) throw new Error(completions.error.message);
  const done: AnalyticsCompletion[] = (completions.data ?? []).map(c => ({ id: c.id, userId: c.user_id, taskId: c.task_id, completedAt: c.completed_at, partial: c.partial === true }));
  return evaluateMission({ missionId: mission.mission_id, weekStart, rules: mission.rules, tasks: (tasks.data ?? []).map(r => mapTask(r as Record<string, unknown>)), completions: done, now, timezone });
}

export function FamilyMissionChip({ className }: { className?: string }) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const familyId = useFamilyStore(s => s.familyId);
  const lastHydrateAt = useFamilyStore(s => s.lastHydrateAt);
  const todayDone = useFamilyStore(s => Object.values(s.todayCompletionsByWindow).reduce((n, w) => n + w.morning.length + w.evening.length, 0));
  const [mission, setMission] = useState<MissionProgress | null>(null);

  useEffect(() => {
    if (!familyId) return;
    const key = `${familyId}|${lastHydrateAt}|${todayDone}`;
    if (!cached || cached.key !== key) cached = { key, promise: loadMission(familyId) };
    let live = true;
    cached.promise
      .then(next => { if (live) setMission(next); })
      .catch(error => console.warn('[family mission] load failed', error));
    return () => { live = false; };
  }, [familyId, lastHydrateAt, todayDone]);

  if (!mission) return null;
  const title = en ? MISSION_COPY[mission.missionId].title.en : MISSION_COPY[mission.missionId].title.ko;
  const label = mission.complete
    ? (en ? `Family mission complete: ${title}` : `가족 미션 달성: ${title}`)
    : (en ? `Family mission ${title}: ${mission.current} of ${mission.target}` : `가족 미션 ${title}: ${mission.target} 중 ${mission.current}`);

  return (
    <Link
      href="/stats"
      title={label}
      aria-label={label}
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition hover:brightness-110 ${
        mission.complete
          ? 'border-[#79E8BD]/50 bg-[#79E8BD]/12 text-[#9FF0CE]'
          : 'border-white/10 bg-white/[0.04] text-white/80'
      } ${className ?? ''}`}
    >
      {mission.complete ? <PartyPopper size={13} aria-hidden /> : <Users size={13} aria-hidden />}
      <span className="truncate">{en ? 'Family mission' : '가족 미션'} · {title}</span>
      <span className="shrink-0 tabular-nums">{mission.complete ? (en ? 'Done! 🎉' : '달성! 🎉') : `${mission.current}/${mission.target}`}</span>
    </Link>
  );
}
