import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Gift,
  HeartHandshake,
  LockKeyhole,
  LogIn,
  Mail,
  Settings2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'FamBit | Family Habit Dashboard',
  description:
    'A private family habit dashboard for daily routines, points, rewards, warm gifts, and parent-friendly admin tools.',
};

function FamBitMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 84 84"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="84" height="84" rx="22" fill="#1A1B2E" />
      <rect x="16" y="16" width="13" height="52" rx="6.5" fill="#5B8EFF" />
      <rect x="33" y="16" width="36" height="13" rx="6.5" fill="#ffffff10" />
      <rect x="33" y="16" width="36" height="13" rx="6.5" fill="#5B8EFF" />
      <rect x="33" y="35" width="36" height="13" rx="6.5" fill="#ffffff10" />
      <rect x="33" y="35" width="26" height="13" rx="6.5" fill="#FF7BAC" />
      <rect x="33" y="54" width="36" height="13" rx="6.5" fill="#ffffff10" />
      <rect x="33" y="54" width="16" height="13" rx="6.5" fill="#4EEDB0" />
    </svg>
  );
}

function FamBitWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <FamBitMark size={compact ? 34 : 46} />
      <span className={compact ? 'text-xl font-black text-white' : 'text-3xl font-black text-white'}>
        Fam<span className="text-[#4EEDB0]">Bit</span>
      </span>
    </div>
  );
}

function MiniTask({
  title,
  points,
  done,
  accent,
}: {
  title: string;
  points: number;
  done?: boolean;
  accent: string;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-lg border border-white/5 bg-white/[0.045] px-2.5 py-2">
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border"
        style={{
          borderColor: done ? accent : 'rgba(255,255,255,0.18)',
          background: done ? accent : 'transparent',
        }}
      >
        {done && <CheckCircle2 size={13} className="text-white" strokeWidth={3} />}
      </span>
      <span className={['min-w-0 flex-1 truncate text-xs font-semibold', done ? 'text-white/40 line-through' : 'text-white/84'].join(' ')}>
        {title}
      </span>
      <span className="shrink-0 text-[11px] font-black text-[#FFB830]">+{points}</span>
    </div>
  );
}

function PreviewPanel({
  name,
  role,
  points,
  accent,
  tasks,
}: {
  name: string;
  role: string;
  points: string;
  accent: string;
  tasks: Array<{ title: string; points: number; done?: boolean }>;
}) {
  return (
    <div className="min-h-0 rounded-lg border border-white/8 bg-[#14162A]/92 p-3 shadow-2xl shadow-black/30">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-sm font-black"
          style={{ color: accent, borderColor: `${accent}88`, background: `${accent}18` }}
        >
          {name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-white">{name}</div>
          <div className="text-[11px] font-semibold text-white/45">{role}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/[0.045] px-2 py-1 text-xs font-black text-[#FFB830]">
          {points}
        </div>
      </div>
      <div className="space-y-1.5">
        {tasks.map(task => (
          <MiniTask key={task.title} {...task} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function DashboardScene() {
  const panels = [
    {
      name: 'Dad',
      role: 'Morning reset',
      points: '474pt',
      accent: '#5B8EFF',
      tasks: [
        { title: 'Read 30 minutes', points: 30, done: true },
        { title: 'Prayer and reflection', points: 50, done: true },
        { title: 'Workout', points: 40 },
      ],
    },
    {
      name: 'Mom',
      role: 'Family rhythm',
      points: '424pt',
      accent: '#FF7BAC',
      tasks: [
        { title: 'Plan dinner', points: 20, done: true },
        { title: 'Exercise', points: 30 },
        { title: 'Evening reading', points: 24 },
      ],
    },
    {
      name: 'Jun',
      role: 'After school',
      points: '1,530pt',
      accent: '#4EEDB0',
      tasks: [
        { title: 'Homework block', points: 36 },
        { title: 'Journal', points: 30, done: true },
        { title: 'Laundry help', points: 20 },
      ],
    },
    {
      name: 'Jiu',
      role: 'Little wins',
      points: '1,563pt',
      accent: '#FFB830',
      tasks: [
        { title: 'Brush teeth', points: 10, done: true },
        { title: 'Reading time', points: 24 },
        { title: 'School bag routine', points: 12, done: true },
      ],
    },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[#0D0E1C]" />
      <div className="absolute left-1/2 top-12 grid w-[980px] max-w-none -translate-x-1/2 grid-cols-2 gap-3 opacity-80 sm:top-16 md:left-auto md:right-[-90px] md:w-[820px] md:translate-x-0 md:rotate-1">
        {panels.map(panel => (
          <PreviewPanel key={panel.name} {...panel} />
        ))}
      </div>
      <div className="absolute inset-0 bg-[#0D0E1C]/62" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[#0D0E1C]" />
    </div>
  );
}

const features = [
  {
    icon: CheckCircle2,
    title: 'Daily habits that feel visible',
    body: 'Each family member gets a focused panel for today’s routines, streaks, morning and evening tasks, and quick completion.',
  },
  {
    icon: Trophy,
    title: 'Points, XP, and streak momentum',
    body: 'Kids can see progress turn into levels, spendable balances, bonus multipliers, and personal bests without a parent spreadsheet.',
  },
  {
    icon: Gift,
    title: 'A real reward store',
    body: 'Parents can create rewards, sale events, hidden items, sold-out states, joint purchases, refunds, and point costs that match family rules.',
  },
  {
    icon: HeartHandshake,
    title: 'Warm gifts and small notes',
    body: 'Family members can send points with a short message, creating a mailbox history for encouragement, apologies, and small celebrations.',
  },
  {
    icon: Settings2,
    title: 'Parent admin controls',
    body: 'Admin mode covers members, tasks, avatars, invite codes, language, reward history, progress resets, and family data controls.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by family',
    body: 'A Google-backed owner account, invite-code joining, PIN-protected admin mode, and tenant-scoped data keep each family workspace separate.',
  },
];

const steps = [
  'Create a family space with a Google owner account.',
  'Invite kids or adults with a family code.',
  'Customize habits, points, avatars, and rewards.',
  'Let the dashboard run on a tablet, phone, or shared family screen.',
];

const proof = [
  { label: 'For parents', value: 'Admin PIN, rewards, resets, invites' },
  { label: 'For kids', value: 'Clear tasks, points, streaks, store goals' },
  { label: 'For connection', value: 'Gift notes, mailbox history, shared wins' },
];

export default function HomeLandingPage() {
  return (
    <main className="min-h-screen bg-[#0D0E1C] text-white">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0D0E1C]/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/home" aria-label="FamBit home">
            <FamBitWordmark compact />
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-white/62 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#flow" className="hover:text-white">How it works</a>
            <a href="#admin" className="hover:text-white">Admin</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/join"
              className="hidden h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-white/80 hover:bg-white/10 sm:inline-flex"
            >
              <Ticket size={16} />
              Join
            </Link>
            <Link
              href="/login"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4EEDB0] px-3 text-sm font-black text-[#07120E] hover:bg-[#71F4C0]"
            >
              <LogIn size={16} />
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[86svh] overflow-hidden">
        <DashboardScene />
        <div className="relative z-10 mx-auto flex min-h-[86svh] w-full max-w-7xl flex-col justify-center px-4 pb-16 pt-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <FamBitWordmark />
            <p className="mt-6 max-w-2xl text-base font-bold text-[#4EEDB0] sm:text-lg">
              온 가족의 습관을 함께. Family routines, rewards, and warm encouragement in one daily dashboard.
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              Build better family habits without turning home into a chore chart.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
              FamBit gives each family member a focused habit panel, turns consistency into points, and lets those points become rewards, gifts, notes, and shared momentum.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] px-5 text-sm font-black text-[#07120E] hover:bg-[#71F4C0]"
              >
                Start with Google
                <ArrowRight size={17} />
              </Link>
              <Link
                href="/join"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.055] px-5 text-sm font-black text-white hover:bg-white/10"
              >
                Join with invite code
                <Ticket size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#111224] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-3">
          {proof.map(item => (
            <div key={item.label} className="rounded-lg border border-white/8 bg-white/[0.035] px-4 py-3">
              <div className="text-xs font-bold text-[#5B8EFF]">{item.label}</div>
              <div className="mt-1 text-sm font-semibold text-white/78">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black text-[#FF7BAC]">Key functions</p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
            Everything the daily family loop needs.
          </h2>
          <p className="mt-4 text-base leading-7 text-white/64">
            The app is built for repeat use: quick scanning, low-friction task completion, parent controls, and meaningful rewards that families can actually maintain.
          </p>
        </div>
        <div className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {features.map(feature => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-lg border border-white/8 bg-[#14162A] p-5">
                <div className="mb-5 grid h-10 w-10 place-items-center rounded-lg bg-white/[0.055] text-[#4EEDB0]">
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-black text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/62">{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="flow" className="bg-[#F4F7FB] px-4 py-20 text-[#111224] sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div>
            <p className="text-sm font-black text-[#14A870]">How it works</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              A private family space first, a reward economy second.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              FamBit keeps account ownership practical: parents can use Google for setup and control, while kids can join through family invitations and use the dashboard from shared devices.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {steps.map((step, index) => (
              <div key={step} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 grid h-9 w-9 place-items-center rounded-lg bg-[#1A1B2E] text-sm font-black text-[#4EEDB0]">
                  {index + 1}
                </div>
                <p className="text-base font-black leading-6">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="admin" className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
        <div>
          <p className="text-sm font-black text-[#FFB830]">Parent-ready</p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
            Built for real household rules, not generic productivity.
          </h2>
          <p className="mt-4 text-base leading-7 text-white/64">
            Families change. Rewards run out. Kids outgrow routines. FamBit gives parents the controls to adjust the system without rebuilding it from scratch.
          </p>
        </div>
        <div className="grid gap-3">
          {[
            { icon: Users, title: 'Member profiles', body: 'Avatars, roles, display order, child profiles, and account linking.' },
            { icon: BarChart3, title: 'Progress history', body: 'Weekly completions, streak signals, best days, and point balances.' },
            { icon: Mail, title: 'Activity mailbox', body: 'Gift messages, reward purchases, and family system notes in one feed.' },
            { icon: LockKeyhole, title: 'Admin protection', body: 'A family PIN and owner recovery flow for sensitive actions.' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="flex gap-4 rounded-lg border border-white/8 bg-[#14162A] p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.055] text-[#5B8EFF]">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="font-black text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-white/62">{item.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-t border-white/8 bg-[#111224] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-[#4EEDB0]">
              <Sparkles size={18} />
              <span className="text-sm font-black">FamBit</span>
            </div>
            <h2 className="text-3xl font-black text-white">Give your family habits a place to live.</h2>
            <p className="mt-3 text-base leading-7 text-white/64">
              Start a family workspace, invite members, and turn small daily actions into visible progress.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] px-5 text-sm font-black text-[#07120E] hover:bg-[#71F4C0]"
            >
              Sign in with Google
              <ArrowRight size={17} />
            </Link>
            <Link
              href="/privacy"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-white/12 bg-white/[0.045] px-5 text-sm font-black text-white/78 hover:bg-white/10"
            >
              Privacy
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
