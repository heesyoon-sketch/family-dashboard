import { Activity, CheckCircle2, Gift, Home, Sparkles, Users } from 'lucide-react';
import { redirect } from 'next/navigation';
import { RefreshDataButton } from './RefreshDataButton';
import { createFounderAdminClient, createFounderAuthClient } from './supabase';

export const dynamic = 'force-dynamic';

const FOUNDER_EMAIL = 'heesyoon@gmail.com';
const PAGE_SIZE = 1000;

type MetricTone = 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'teal';

interface KpiCard {
  label: string;
  value: number;
  description: string;
  tone: MetricTone;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface RecentCohort {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  totalPoints: number;
}

function metricToneClass(tone: MetricTone): string {
  const tones: Record<MetricTone, string> = {
    emerald: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25',
    sky: 'text-sky-300 bg-sky-400/10 border-sky-400/25',
    amber: 'text-amber-300 bg-amber-400/10 border-amber-400/25',
    rose: 'text-rose-300 bg-rose-400/10 border-rose-400/25',
    violet: 'text-violet-300 bg-violet-400/10 border-violet-400/25',
    teal: 'text-teal-300 bg-teal-400/10 border-teal-400/25',
  };
  return tones[tone];
}

function numberFormat(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function relativeDate(value: string): string {
  const date = new Date(value);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return 'just now';
}

function fullDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

async function countRows(
  admin: ReturnType<typeof createFounderAdminClient>,
  table: string,
): Promise<number> {
  const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true });
  if (error) throw new Error(`Failed to count ${table}: ${error.message}`);
  return count ?? 0;
}

async function countGiftActivities(admin: ReturnType<typeof createFounderAdminClient>): Promise<number> {
  const { count, error } = await admin
    .from('family_activities')
    .select('id', { count: 'exact', head: true })
    .in('type', ['GIFT_SENT', 'GIFT_RECEIVED']);

  if (error) throw new Error(`Failed to count gift activity: ${error.message}`);
  return count ?? 0;
}

async function countActiveFamilies(admin: ReturnType<typeof createFounderAdminClient>, sinceIso: string): Promise<number> {
  const familyIds = new Set<string>();
  let start = 0;

  while (true) {
    const { data, error } = await admin
      .from('family_activities')
      .select('family_id')
      .gte('created_at', sinceIso)
      .range(start, start + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch active families: ${error.message}`);

    for (const row of data ?? []) {
      if (typeof row.family_id === 'string' && row.family_id) {
        familyIds.add(row.family_id);
      }
    }

    if (!data || data.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }

  return familyIds.size;
}

async function fetchRecentCohorts(admin: ReturnType<typeof createFounderAdminClient>): Promise<RecentCohort[]> {
  const { data: families, error: familiesError } = await admin
    .from('families')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (familiesError) throw new Error(`Failed to fetch recent families: ${familiesError.message}`);
  if (!families?.length) return [];

  const familyIds = families
    .map(row => (typeof row.id === 'string' ? row.id : null))
    .filter((id): id is string => Boolean(id));

  const { data: members, error: membersError } = await admin
    .from('users')
    .select('id, family_id')
    .in('family_id', familyIds);

  if (membersError) throw new Error(`Failed to fetch cohort members: ${membersError.message}`);

  const memberCounts = new Map<string, number>();
  const userFamily = new Map<string, string>();

  for (const member of members ?? []) {
    const userId = typeof member.id === 'string' ? member.id : null;
    const familyId = typeof member.family_id === 'string' ? member.family_id : null;
    if (!userId || !familyId) continue;

    userFamily.set(userId, familyId);
    memberCounts.set(familyId, (memberCounts.get(familyId) ?? 0) + 1);
  }

  const userIds = Array.from(userFamily.keys());
  const pointsByFamily = new Map<string, number>();

  if (userIds.length > 0) {
    const { data: levels, error: levelsError } = await admin
      .from('levels')
      .select('user_id, total_points')
      .in('user_id', userIds);

    if (levelsError) throw new Error(`Failed to fetch cohort points: ${levelsError.message}`);

    for (const level of levels ?? []) {
      const userId = typeof level.user_id === 'string' ? level.user_id : null;
      const familyId = userId ? userFamily.get(userId) : null;
      const points = Number(level.total_points ?? 0);
      if (!familyId || !Number.isFinite(points)) continue;
      pointsByFamily.set(familyId, (pointsByFamily.get(familyId) ?? 0) + points);
    }
  }

  return families.map(row => {
    const id = String(row.id);
    return {
      id,
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Untitled Family',
      createdAt: String(row.created_at),
      memberCount: memberCounts.get(id) ?? 0,
      totalPoints: pointsByFamily.get(id) ?? 0,
    };
  });
}

async function getFounderDashboardData() {
  const admin = createFounderAdminClient();
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalFamilies,
    totalUsers,
    totalTasks,
    totalTaskCompletions,
    totalGifts,
    activeFamilies,
    recentCohorts,
  ] = await Promise.all([
    countRows(admin, 'families'),
    countRows(admin, 'users'),
    countRows(admin, 'tasks'),
    countRows(admin, 'task_completions'),
    countGiftActivities(admin),
    countActiveFamilies(admin, sinceIso),
    fetchRecentCohorts(admin),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      totalFamilies,
      totalUsers,
      totalTasks,
      totalTaskCompletions,
      totalGifts,
      activeFamilies,
    },
    recentCohorts,
  };
}

function KpiCard({ card }: { card: KpiCard }) {
  const Icon = card.icon;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className={`rounded-lg border p-2.5 ${metricToneClass(card.tone)}`}>
          <Icon size={20} />
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
          Live
        </div>
      </div>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{card.label}</div>
      <div className="mt-2 text-4xl font-black tracking-normal text-emerald-300">{numberFormat(card.value)}</div>
      <div className="mt-3 min-h-10 text-sm leading-5 text-slate-400">{card.description}</div>
    </div>
  );
}

export default async function FounderPage() {
  const authClient = await createFounderAuthClient();
  const { data: { user }, error } = await authClient.auth.getUser();

  if (error || user?.email?.toLowerCase() !== FOUNDER_EMAIL) {
    redirect('/');
  }

  const data = await getFounderDashboardData();
  const cards: KpiCard[] = [
    {
      label: 'Total Families',
      value: data.metrics.totalFamilies,
      description: 'Top-line acquisition across all created family workspaces.',
      tone: 'emerald',
      icon: Home,
    },
    {
      label: 'Total Users',
      value: data.metrics.totalUsers,
      description: 'All parent and child member profiles currently in the system.',
      tone: 'sky',
      icon: Users,
    },
    {
      label: 'Tasks Created',
      value: data.metrics.totalTasks,
      description: 'Configured habits and routines, including generated starter tasks.',
      tone: 'amber',
      icon: Sparkles,
    },
    {
      label: 'Tasks Completed',
      value: data.metrics.totalTaskCompletions,
      description: 'Completed task history from the task completion ledger.',
      tone: 'teal',
      icon: CheckCircle2,
    },
    {
      label: 'Gifts Exchanged',
      value: data.metrics.totalGifts,
      description: 'Mailbox gift activity rows across sent and received events.',
      tone: 'rose',
      icon: Gift,
    },
    {
      label: 'Active Families',
      value: data.metrics.activeFamilies,
      description: 'Unique families with any activity in the last seven days.',
      tone: 'violet',
      icon: Activity,
    },
  ];

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
              Founder Console
            </div>
            <h1 className="text-3xl font-black tracking-normal text-white sm:text-5xl">
              Startup Operating Dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
              Secure service-role metrics for acquisition, activation, engagement, economy, and retention.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
              Updated <span className="font-semibold text-slate-200">{relativeDate(data.generatedAt)}</span>
            </div>
            <RefreshDataButton />
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(card => <KpiCard key={card.label} card={card} />)}
        </section>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/25">
          <div className="flex flex-col gap-2 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-normal text-white">Recent Cohort</h2>
              <p className="mt-1 text-sm text-slate-400">Latest 10 family workspaces and their onboarding momentum.</p>
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
              Onboarding Tracking
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-bold">Family Name</th>
                  <th className="px-5 py-4 font-bold">Created Date</th>
                  <th className="px-5 py-4 text-right font-bold">Member Count</th>
                  <th className="px-5 py-4 text-right font-bold">Total Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.recentCohorts.map(family => (
                  <tr key={family.id} className="transition hover:bg-white/[0.035]">
                    <td className="px-5 py-4">
                      <div className="truncate text-sm font-bold text-white">{family.name}</div>
                      <div className="mt-1 font-mono text-[11px] text-slate-600">{family.id}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-slate-200">{relativeDate(family.createdAt)}</div>
                      <div className="mt-1 text-xs text-slate-500">{fullDate(family.createdAt)}</div>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-sky-300">
                      {numberFormat(family.memberCount)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-emerald-300">
                      {numberFormat(family.totalPoints)}pt
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.recentCohorts.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No family workspaces have been created yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
