import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Gift,
  HeartHandshake,
  Languages,
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
import { FamBitWordmark } from '@/components/FamBitLogo';

type LandingLocale = 'en' | 'ko';
type LandingIcon = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

interface PreviewTask {
  title: string;
  points: number;
  done?: boolean;
}

interface PreviewPanelCopy {
  name: string;
  role: string;
  points: string;
  accent: string;
  tasks: PreviewTask[];
}

interface FeatureCopy {
  icon: LandingIcon;
  title: string;
  body: string;
}

interface AdminCardCopy {
  icon: LandingIcon;
  title: string;
  body: string;
}

const landingCopy: Record<LandingLocale, {
  nav: {
    features: string;
    flow: string;
    admin: string;
    join: string;
    signIn: string;
    languageLabel: string;
    languageHref: string;
  };
  hero: {
    tagline: string;
    headline: string;
    body: string;
    primary: string;
    secondary: string;
  };
  proof: Array<{ label: string; value: string }>;
  features: {
    eyebrow: string;
    headline: string;
    body: string;
    items: FeatureCopy[];
  };
  flow: {
    eyebrow: string;
    headline: string;
    body: string;
    steps: string[];
  };
  admin: {
    eyebrow: string;
    headline: string;
    body: string;
    cards: AdminCardCopy[];
  };
  final: {
    label: string;
    headline: string;
    body: string;
    primary: string;
    secondary: string;
  };
  previewPanels: PreviewPanelCopy[];
}> = {
  en: {
    nav: {
      features: 'Features',
      flow: 'How it works',
      admin: 'Admin',
      join: 'Join',
      signIn: 'Sign in',
      languageLabel: '한국어',
      languageHref: '/home/ko',
    },
    hero: {
      tagline: 'Family routines, rewards, and warm encouragement in one daily dashboard.',
      headline: 'Build better family habits without turning home into a chore chart.',
      body: 'FamBit gives each family member a focused habit panel, turns consistency into points, and lets those points become rewards, gifts, notes, and shared momentum.',
      primary: 'Start with Google',
      secondary: 'Join with invite code',
    },
    proof: [
      { label: 'For parents', value: 'Admin PIN, rewards, resets, invites' },
      { label: 'For kids', value: 'Clear tasks, points, streaks, store goals' },
      { label: 'For connection', value: 'Gift notes, mailbox history, shared wins' },
    ],
    features: {
      eyebrow: 'Key functions',
      headline: 'Everything the daily family loop needs.',
      body: 'The app is built for repeat use: quick scanning, low-friction task completion, parent controls, and meaningful rewards that families can actually maintain.',
      items: [
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
      ],
    },
    flow: {
      eyebrow: 'How it works',
      headline: 'A private family space first, a reward economy second.',
      body: 'FamBit keeps account ownership practical: parents can use Google for setup and control, while kids can join through family invitations and use the dashboard from shared devices.',
      steps: [
        'Create a family space with a Google owner account.',
        'Invite kids or adults with a family code.',
        'Customize habits, points, avatars, and rewards.',
        'Let the dashboard run on a tablet, phone, or shared family screen.',
      ],
    },
    admin: {
      eyebrow: 'Parent-ready',
      headline: 'Built for real household rules, not generic productivity.',
      body: 'Families change. Rewards run out. Kids outgrow routines. FamBit gives parents the controls to adjust the system without rebuilding it from scratch.',
      cards: [
        { icon: Users, title: 'Member profiles', body: 'Avatars, roles, display order, child profiles, and account linking.' },
        { icon: BarChart3, title: 'Progress history', body: 'Weekly completions, streak signals, best days, and point balances.' },
        { icon: Mail, title: 'Activity mailbox', body: 'Gift messages, reward purchases, and family system notes in one feed.' },
        { icon: LockKeyhole, title: 'Admin protection', body: 'A family PIN and owner recovery flow for sensitive actions.' },
      ],
    },
    final: {
      label: 'FamBit',
      headline: 'Give your family habits a place to live.',
      body: 'Start a family workspace, invite members, and turn small daily actions into visible progress.',
      primary: 'Sign in with Google',
      secondary: 'Privacy',
    },
    previewPanels: [
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
    ],
  },
  ko: {
    nav: {
      features: '기능',
      flow: '사용 흐름',
      admin: '관리',
      join: '참여',
      signIn: '로그인',
      languageLabel: 'English',
      languageHref: '/home',
    },
    hero: {
      tagline: '온 가족의 습관을 함께. 매일의 루틴, 보상, 따뜻한 응원을 한 화면에.',
      headline: '가족 습관을 잔소리표가 아니라 함께 보는 리듬으로.',
      body: 'FamBit은 가족 구성원마다 오늘의 습관 패널을 만들고, 꾸준함을 포인트와 보상, 선물, 작은 편지로 이어 줍니다.',
      primary: 'Google로 시작하기',
      secondary: '초대 코드로 참여',
    },
    proof: [
      { label: '부모를 위해', value: '관리자 PIN, 보상, 초기화, 초대 코드' },
      { label: '아이들을 위해', value: '명확한 습관, 포인트, 연속 달성, 목표 상점' },
      { label: '가족 연결을 위해', value: '선물 메시지, 메일함 기록, 함께 보는 성취' },
    ],
    features: {
      eyebrow: '핵심 기능',
      headline: '가족의 매일 반복되는 흐름에 필요한 것들.',
      body: 'FamBit은 한 번 보고 끝나는 앱이 아니라 매일 쓰는 가족 도구입니다. 빠르게 확인하고, 쉽게 완료하고, 부모가 규칙을 조정할 수 있게 설계했습니다.',
      items: [
        {
          icon: CheckCircle2,
          title: '오늘 할 습관이 한눈에 보임',
          body: '가족 구성원별 패널에서 아침, 저녁, 공부, 집안일 같은 오늘의 루틴과 완료 상태를 바로 확인합니다.',
        },
        {
          icon: Trophy,
          title: '포인트, XP, 연속 달성',
          body: '아이들은 꾸준함이 레벨, 보유 포인트, 보너스 배수, 개인 최고 기록으로 바뀌는 과정을 볼 수 있습니다.',
        },
        {
          icon: Gift,
          title: '실제로 운영 가능한 보상 상점',
          body: '부모는 보상, 할인 이벤트, 숨김 상품, 품절 상태, 공동 구매, 환불, 포인트 비용을 가족 규칙에 맞게 관리합니다.',
        },
        {
          icon: HeartHandshake,
          title: '따뜻한 선물과 짧은 편지',
          body: '가족끼리 포인트를 보내며 짧은 메시지를 남길 수 있어 격려, 사과, 작은 축하가 기록으로 남습니다.',
        },
        {
          icon: Settings2,
          title: '부모용 관리 기능',
          body: '멤버, 습관, 아바타, 초대 코드, 언어, 보상 내역, 진행 초기화, 가족 데이터 관리까지 한곳에서 다룹니다.',
        },
        {
          icon: ShieldCheck,
          title: '가족별로 분리된 비공개 공간',
          body: 'Google 기반 소유자 계정, 초대 코드 참여, PIN 보호 관리자 모드, 가족별 데이터 범위로 각 가족 공간을 분리합니다.',
        },
      ],
    },
    flow: {
      eyebrow: '사용 흐름',
      headline: '먼저 비공개 가족 공간을 만들고, 그다음 보상 흐름을 붙입니다.',
      body: '부모는 Google 계정으로 가족 공간을 만들고 관리할 수 있고, 아이들은 초대 코드로 들어와 태블릿, 휴대폰, 공용 화면에서 대시보드를 사용할 수 있습니다.',
      steps: [
        'Google 소유자 계정으로 가족 공간을 만듭니다.',
        '가족 코드를 공유해 아이와 어른을 초대합니다.',
        '습관, 포인트, 아바타, 보상을 가족 방식에 맞게 조정합니다.',
        '태블릿, 휴대폰, 공용 가족 화면에서 매일 함께 확인합니다.',
      ],
    },
    admin: {
      eyebrow: '부모가 쓰기 좋은 관리',
      headline: '일반 생산성 앱이 아니라 실제 집안 규칙에 맞게 만들었습니다.',
      body: '가족의 루틴은 계속 바뀝니다. 보상은 품절되고, 아이들은 자라고, 규칙은 조정됩니다. FamBit은 처음부터 다시 만들지 않고도 부모가 시스템을 바꿀 수 있게 합니다.',
      cards: [
        { icon: Users, title: '멤버 프로필', body: '아바타, 역할, 표시 순서, 아이 프로필, 계정 연결을 관리합니다.' },
        { icon: BarChart3, title: '진행 기록', body: '주간 완료, 연속 달성 신호, 좋은 날, 포인트 잔액을 확인합니다.' },
        { icon: Mail, title: '활동 메일함', body: '선물 메시지, 보상 구매, 가족 시스템 알림을 한 피드에 모읍니다.' },
        { icon: LockKeyhole, title: '관리자 보호', body: '가족 PIN과 소유자 복구 흐름으로 민감한 작업을 보호합니다.' },
      ],
    },
    final: {
      label: 'FamBit',
      headline: '가족 습관이 머물 자리를 만들어 보세요.',
      body: '가족 공간을 만들고 구성원을 초대해 작은 매일의 행동을 보이는 진전으로 바꿔 보세요.',
      primary: 'Google로 로그인',
      secondary: '개인정보 처리방침',
    },
    previewPanels: [
      {
        name: '아빠',
        role: '아침 리셋',
        points: '474점',
        accent: '#5B8EFF',
        tasks: [
          { title: '독서 30분', points: 30, done: true },
          { title: '묵상과 기도', points: 50, done: true },
          { title: '운동하기', points: 40 },
        ],
      },
      {
        name: '엄마',
        role: '가족 리듬',
        points: '424점',
        accent: '#FF7BAC',
        tasks: [
          { title: '저녁 준비 계획', points: 20, done: true },
          { title: '운동하기', points: 30 },
          { title: '저녁 독서', points: 24 },
        ],
      },
      {
        name: '준서',
        role: '하교 후',
        points: '1,530점',
        accent: '#4EEDB0',
        tasks: [
          { title: '문제집 풀기', points: 36 },
          { title: '일기쓰기', points: 30, done: true },
          { title: '빨래 정리 돕기', points: 20 },
        ],
      },
      {
        name: '지우',
        role: '작은 성공',
        points: '1,563점',
        accent: '#FFB830',
        tasks: [
          { title: '양치하기', points: 10, done: true },
          { title: '독서 시간', points: 24 },
          { title: '가방 정리', points: 12, done: true },
        ],
      },
    ],
  },
};

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
}: PreviewPanelCopy) {
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

function DashboardScene({ panels }: { panels: PreviewPanelCopy[] }) {
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

export function FamBitLanding({ locale }: { locale: LandingLocale }) {
  const c = landingCopy[locale];

  return (
    <main className="min-h-screen bg-[#0D0E1C] text-white">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0D0E1C]/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/home" aria-label="FamBit home">
            <FamBitWordmark compact />
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-white/62 md:flex">
            <a href="#features" className="hover:text-white">{c.nav.features}</a>
            <a href="#flow" className="hover:text-white">{c.nav.flow}</a>
            <a href="#admin" className="hover:text-white">{c.nav.admin}</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href={c.nav.languageHref}
              className="hidden h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-white/80 hover:bg-white/10 sm:inline-flex"
            >
              <Languages size={16} />
              {c.nav.languageLabel}
            </Link>
            <Link
              href="/join"
              className="hidden h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-white/80 hover:bg-white/10 lg:inline-flex"
            >
              <Ticket size={16} />
              {c.nav.join}
            </Link>
            <Link
              href="/login"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4EEDB0] px-3 text-sm font-black text-[#07120E] hover:bg-[#71F4C0]"
            >
              <LogIn size={16} />
              {c.nav.signIn}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[86svh] overflow-hidden">
        <DashboardScene panels={c.previewPanels} />
        <div className="relative z-10 mx-auto flex min-h-[86svh] w-full max-w-7xl flex-col justify-center px-4 pb-16 pt-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <FamBitWordmark />
            <p className="mt-6 max-w-2xl text-base font-bold text-[#4EEDB0] sm:text-lg">
              {c.hero.tagline}
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              {c.hero.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
              {c.hero.body}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] px-5 text-sm font-black text-[#07120E] hover:bg-[#71F4C0]"
              >
                {c.hero.primary}
                <ArrowRight size={17} />
              </Link>
              <Link
                href="/join"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.055] px-5 text-sm font-black text-white hover:bg-white/10"
              >
                {c.hero.secondary}
                <Ticket size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#111224] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-3">
          {c.proof.map(item => (
            <div key={item.label} className="rounded-lg border border-white/8 bg-white/[0.035] px-4 py-3">
              <div className="text-xs font-bold text-[#5B8EFF]">{item.label}</div>
              <div className="mt-1 text-sm font-semibold text-white/78">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black text-[#FF7BAC]">{c.features.eyebrow}</p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
            {c.features.headline}
          </h2>
          <p className="mt-4 text-base leading-7 text-white/64">
            {c.features.body}
          </p>
        </div>
        <div className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {c.features.items.map(feature => {
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
            <p className="text-sm font-black text-[#14A870]">{c.flow.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              {c.flow.headline}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {c.flow.body}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {c.flow.steps.map((step, index) => (
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
          <p className="text-sm font-black text-[#FFB830]">{c.admin.eyebrow}</p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
            {c.admin.headline}
          </h2>
          <p className="mt-4 text-base leading-7 text-white/64">
            {c.admin.body}
          </p>
        </div>
        <div className="grid gap-3">
          {c.admin.cards.map(item => {
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
              <span className="text-sm font-black">{c.final.label}</span>
            </div>
            <h2 className="text-3xl font-black text-white">{c.final.headline}</h2>
            <p className="mt-3 text-base leading-7 text-white/64">
              {c.final.body}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] px-5 text-sm font-black text-[#07120E] hover:bg-[#71F4C0]"
            >
              {c.final.primary}
              <ArrowRight size={17} />
            </Link>
            <Link
              href="/privacy"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-white/12 bg-white/[0.045] px-5 text-sm font-black text-white/78 hover:bg-white/10"
            >
              {c.final.secondary}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
