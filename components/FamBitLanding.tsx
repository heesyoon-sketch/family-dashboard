import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Gift,
  HeartHandshake,
  Languages,
  LockKeyhole,
  LogIn,
  Mail,
  MonitorSmartphone,
  Moon,
  Palmtree,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sunrise,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react';
import { FamBitWordmark } from '@/components/FamBitLogo';

type LandingLocale = 'en' | 'ko';
type LandingIcon = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

const MINT = '#4EEDB0';
const BLUE = '#5B8EFF';
const PINK = '#FF7BAC';
const AMBER = '#FFB830';
const VIOLET = '#B78BFF';

interface MockTask {
  title: string;
  points: number;
  done?: boolean;
}

interface MockMember {
  name: string;
  points: string;
  accent: string;
  questMarks: number;
  tasks: MockTask[];
}

interface TextSection {
  eyebrow: string;
  headline: string;
  body: string[];
}

interface RhythmStep {
  time: string;
  title: string;
  body: string;
  accent: string;
  icon: LandingIcon;
}

interface FeatureItem {
  icon: LandingIcon;
  accent: string;
  title: string;
  body: string;
}

interface LandingCopy {
  nav: {
    features: string;
    rhythm: string;
    flow: string;
    admin: string;
    join: string;
    signIn: string;
    languageLabel: string;
    languageHref: string;
  };
  hero: {
    badge: string;
    headline: string;
    headlineAccent: string;
    body: string;
    primary: string;
    secondary: string;
  };
  stats: Array<{ value: string; label: string }>;
  mock: {
    family: string;
    today: string;
    tomorrow: string;
    todayEvent: string;
    todayMore: string;
    tomorrowEvent: string;
    morning: string;
    evening: string;
    quest: string;
    members: MockMember[];
  };
  problem: TextSection;
  rhythm: {
    eyebrow: string;
    headline: string;
    body: string;
    steps: RhythmStep[];
    specialDay: { title: string; body: string };
  };
  quest: {
    eyebrow: string;
    headline: string;
    body: string;
    weekdays: string[];
    weekend: string[];
    weekdayRule: string;
    weekendRule: string;
    pass: string;
  };
  store: {
    eyebrow: string;
    headline: string;
    body: string;
    items: Array<{ title: string; price: number; sale?: number; tag?: string }>;
    saleBadge: string;
    cashLabel: string;
    cashValue: string;
    cashNote: string;
    tiersLabel: string;
    tiers: Array<{ minutes: string; points: number }>;
  };
  calendar: {
    eyebrow: string;
    headline: string;
    body: string;
    views: string[];
    days: Array<{ day: string; date: number; events: Array<{ title: string; accent: string }> }>;
  };
  features: {
    eyebrow: string;
    headline: string;
    body: string;
    items: FeatureItem[];
  };
  story: TextSection;
  flow: {
    eyebrow: string;
    headline: string;
    body: string;
    steps: Array<{ title: string; body: string }>;
  };
  admin: {
    eyebrow: string;
    headline: string;
    body: string;
    cards: FeatureItem[];
  };
  why: TextSection;
  final: {
    headline: string;
    body: string;
    primary: string;
    secondary: string;
    privacy: string;
  };
}

const landingCopy: Record<LandingLocale, LandingCopy> = {
  en: {
    nav: {
      features: 'Features',
      rhythm: 'Daily rhythm',
      flow: 'How it works',
      admin: 'For parents',
      join: 'Join',
      signIn: 'Sign in',
      languageLabel: '한국어',
      languageHref: '/home/ko',
    },
    hero: {
      badge: 'The family dashboard for the living-room screen',
      headline: "Nagging doesn't work.",
      headlineAccent: 'Price tags do.',
      body: 'Fambit is the family currency your kids actually want to earn. Routines with clear deadlines, a weekly quest, a shop your family prices, and the family calendar — all on one shared screen.',
      primary: 'Start your family',
      secondary: 'See how it works',
    },
    stats: [
      { value: '10 · 15 · 30 · 50', label: 'points by how long a task takes' },
      { value: '3 of 5', label: 'perfect weekdays earn a 30-min pass' },
      { value: '12:00 · 22:00', label: 'two daily deadlines, no nagging' },
      { value: '$1 = 100pt', label: 'trade points for real price tags' },
    ],
    mock: {
      family: 'The Yoon family',
      today: 'Today',
      tomorrow: 'Tomorrow',
      todayEvent: '3:00 PM Swim',
      todayMore: '+1',
      tomorrowEvent: 'School picnic',
      morning: 'Morning',
      evening: 'Evening',
      quest: 'Week',
      members: [
        {
          name: 'Dad', points: '474', accent: BLUE, questMarks: 2,
          tasks: [
            { title: 'Read 30 minutes', points: 30, done: true },
            { title: 'Workout', points: 30, done: true },
            { title: 'Plan the week', points: 15 },
          ],
        },
        {
          name: 'Mom', points: '424', accent: PINK, questMarks: 3,
          tasks: [
            { title: 'Morning stretch', points: 15, done: true },
            { title: 'Plan dinner', points: 10, done: true },
            { title: 'Evening reading', points: 30 },
          ],
        },
        {
          name: 'Jun', points: '1,530', accent: MINT, questMarks: 2,
          tasks: [
            { title: 'Homework block', points: 50 },
            { title: 'Journal', points: 15, done: true },
            { title: 'Pack school bag', points: 10, done: true },
          ],
        },
        {
          name: 'Jiu', points: '1,563', accent: AMBER, questMarks: 1,
          tasks: [
            { title: 'Brush teeth', points: 10, done: true },
            { title: 'Reading time', points: 30 },
            { title: 'Tidy the desk', points: 10 },
          ],
        },
      ],
    },
    problem: {
      eyebrow: 'The problem',
      headline: 'You\'ve said "brush your teeth" four thousand times. There\'s a better way.',
      body: [
        'Most mornings end the same way. You ask. They ignore. You ask louder. They negotiate. By the time everyone\'s out the door, nobody\'s happy.',
        'The problem isn\'t your kid. It\'s that the rules keep changing. Kids don\'t push back against rules — they push back against rules that feel unfair.',
        'Fambit takes the daily decisions off your plate. You set the prices and the deadlines once. The screen keeps the time. Your kids earn, save, and spend on what they want.',
      ],
    },
    rhythm: {
      eyebrow: 'Daily rhythm',
      headline: 'The day has a shape. Everyone can see it.',
      body: 'The dashboard switches from morning to afternoon at noon, and two gentle deadlines keep routines from sliding. The same rules apply to everyone — parents included.',
      steps: [
        { time: 'Wake – 12:00', title: 'Morning routine', body: 'Brush, dress, pack the bag. Each task shows its points up front.', accent: AMBER, icon: Sunrise },
        { time: '12:00', title: 'Noon deadline', body: 'An unfinished morning routine costs 50 spendable points. Lifetime XP is never touched.', accent: PINK, icon: LockKeyhole },
        { time: '12:00 – 22:00', title: 'Afternoon & evening', body: 'Homework, chores, reading, and the evening routine.', accent: BLUE, icon: Moon },
        { time: '22:00', title: 'Evening deadline', body: 'Same rule at night: finish the evening routine or lose 50 points.', accent: VIOLET, icon: LockKeyhole },
        { time: 'Every day', title: 'Perfect day', body: 'Morning and evening both complete? That day earns a mark on the weekly quest.', accent: MINT, icon: Trophy },
      ],
      specialDay: {
        title: 'Special Day Mode',
        body: 'Travel, holidays, a sick day — one tap pauses every deduction for the day, shows a banner on the dashboard, and gives each family member a 30-minute pass.',
      },
    },
    quest: {
      eyebrow: 'Weekly quest',
      headline: 'One missed day never wipes out a week.',
      body: 'Perfect weekdays add up. Hit three of five and the week pays out — no perfectionism required.',
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      weekend: ['Sat', 'Sun'],
      weekdayRule: '3 of 5 perfect weekdays',
      weekendRule: 'Both weekend days perfect',
      pass: '30-min game or media pass',
    },
    store: {
      eyebrow: 'Family shop',
      headline: 'A shop your family prices.',
      body: 'Screen time, choosing dinner, a late bedtime — you write the catalog. Weekends and public holidays trigger sales automatically, and kids can trade points for something with a real price tag.',
      items: [
        { title: '30 min screen time', price: 300, sale: 240 },
        { title: 'Pick tonight\'s dinner', price: 500, sale: 400 },
        { title: 'Stay up 30 min late', price: 800, tag: 'Popular' },
      ],
      saleBadge: 'Weekend sale',
      cashLabel: 'Cash trade-in',
      cashValue: '$4.99 → 500pt',
      cashNote: 'Rounded to the nearest dollar, every purchase logged.',
      tiersLabel: 'Task points by duration',
      tiers: [
        { minutes: '≤5 min', points: 10 },
        { minutes: '6–10 min', points: 15 },
        { minutes: '11–20 min', points: 30 },
        { minutes: '21+ min', points: 50 },
      ],
    },
    calendar: {
      eyebrow: 'Family calendar',
      headline: 'Today and tomorrow, right at the top.',
      body: 'Connect your Google Calendars once. The dashboard header shows today\'s and tomorrow\'s events at a glance, and one tap opens the full calendar in week, list, or month view.',
      views: ['Week', 'List', 'Month'],
      days: [
        { day: 'Sun', date: 20, events: [] },
        { day: 'Mon', date: 21, events: [{ title: 'Swim', accent: MINT }] },
        { day: 'Tue', date: 22, events: [{ title: 'Piano', accent: BLUE }] },
        { day: 'Wed', date: 23, events: [{ title: 'Swim', accent: MINT }, { title: 'Dentist', accent: PINK }] },
        { day: 'Thu', date: 24, events: [] },
        { day: 'Fri', date: 25, events: [{ title: 'Movie night', accent: AMBER }] },
        { day: 'Sat', date: 26, events: [{ title: 'Picnic', accent: VIOLET }] },
      ],
    },
    features: {
      eyebrow: 'Everything else',
      headline: 'Built for how your family actually works.',
      body: '',
      items: [
        { icon: MonitorSmartphone, accent: MINT, title: 'Made for a shared screen', body: 'Big touch targets on the living-room laptop or tablet, member tabs on phones, and an installable app that updates itself.' },
        { icon: ShieldCheck, accent: BLUE, title: 'Shields & insignia', body: 'Consistency builds Momentum, the family builds Harmony, and reachable shields add a visible bonus layer.' },
        { icon: HeartHandshake, accent: PINK, title: 'A mailbox for what\'s hard to say', body: 'Send a few points with "thank you," "I\'m sorry," or "I love you." Every gift stays in the family feed.' },
        { icon: BarChart3, accent: AMBER, title: 'Weekly recap', body: 'Completions, best days, and streaks for every member, plus a recap moment each new week.' },
        { icon: Palmtree, accent: VIOLET, title: 'Rest days built in', body: 'Special Day Mode and sale-day exemptions keep the system fair when life happens.' },
        { icon: Users, accent: MINT, title: 'Everyone plays', body: 'Parents have routines too. Kids see Dad finish his workout — and notice when he doesn\'t.' },
      ],
    },
    story: {
      eyebrow: 'Why we built it',
      headline: 'The night I scolded him, my son sent me 10 points.',
      body: [
        '"Sorry, dad."',
        'He earned those 10 points himself — brushing his teeth, doing his homework, reading for thirty minutes. Then he opened the mailbox and chose to send them to me.',
        'A nine-year-old can\'t always say "I\'m sorry" to your face. But he\'ll send ten points he earned himself.',
        'Fambit isn\'t just a chore tracker. It\'s a way for families to say the things that are hardest to say out loud.',
      ],
    },
    flow: {
      eyebrow: 'How it works',
      headline: 'Five minutes to set up. Then the screen does the reminding.',
      body: 'Parents own the family space with Google. Kids join with a family code and use the shared screen — no personal phones needed.',
      steps: [
        { title: 'Create your family', body: 'Sign in with Google and name your family space.' },
        { title: 'Invite everyone', body: 'Share a family code with kids and the other parent.' },
        { title: 'Set routines & prices', body: 'Pick tasks, rewards, avatars, and your admin PIN.' },
        { title: 'Put it on the big screen', body: 'Open it on the living-room laptop and let the day run.' },
      ],
    },
    admin: {
      eyebrow: 'For parents',
      headline: 'Controls for real household rules.',
      body: 'Families change. Rewards run out. Kids outgrow routines. Adjust the system without rebuilding it.',
      cards: [
        { icon: Settings2, accent: MINT, title: 'Tasks & routines', body: 'Morning and evening routines, duration-based points, per-member schedules.' },
        { icon: ShoppingBag, accent: AMBER, title: 'Store & sales', body: 'Hidden and sold-out items, automatic weekend and holiday sales, refunds.' },
        { icon: Mail, accent: PINK, title: 'History & mailbox', body: 'Purchases, cash trades, gifts, and system notes in one feed.' },
        { icon: LockKeyhole, accent: BLUE, title: 'PIN-protected admin', body: 'A family PIN guards sensitive actions; the owner account can always recover.' },
      ],
    },
    why: {
      eyebrow: 'Fair question',
      headline: "Isn't this just paying kids to do what they should already do?",
      body: [
        'Brushing teeth. Packing a bag. Doing homework. Kids don\'t find these intrinsically rewarding to begin with — there\'s no inner motivation here for a reward to "ruin."',
        'What Fambit does is make effort visible, rules consistent, and rewards predictable. Kids learn that effort has value, savings have purpose, and decisions have weight — in a system small enough to be safe.',
        'This works especially well for kids who shut down when rules feel arbitrary. A clear price beats a thousand reminders.',
      ],
    },
    final: {
      headline: 'Stop the nagging. Start the system.',
      body: 'Free to start. Set up your family in five minutes. No credit card.',
      primary: 'Create your family',
      secondary: 'Join with a code',
      privacy: 'Privacy',
    },
  },
  ko: {
    nav: {
      features: '기능',
      rhythm: '하루 흐름',
      flow: '시작하기',
      admin: '부모 관리',
      join: '참여',
      signIn: '로그인',
      languageLabel: 'English',
      languageHref: '/home',
    },
    hero: {
      badge: '거실 공용 화면을 위한 가족 대시보드',
      headline: '잔소리 대신,',
      headlineAccent: '가격표를 붙이세요.',
      body: 'FamBit은 아이들이 스스로 벌고 싶어 하는 가족 화폐입니다. 마감이 분명한 루틴, 주간 퀘스트, 가족이 가격을 정하는 상점, 가족 캘린더까지 — 한 화면에 모았습니다.',
      primary: 'Google로 시작하기',
      secondary: '어떻게 쓰나요?',
    },
    stats: [
      { value: '10 · 15 · 30 · 50', label: '걸리는 시간에 따라 정해지는 포인트' },
      { value: '5일 중 3일', label: '퍼펙트 데이면 30분 이용권' },
      { value: '12:00 · 22:00', label: '하루 두 번의 마감, 잔소리는 없음' },
      { value: '$1 = 100점', label: '실제 가격표도 포인트로 교환' },
    ],
    mock: {
      family: '윤씨네',
      today: '오늘',
      tomorrow: '내일',
      todayEvent: '오후 3:00 수영',
      todayMore: '+1',
      tomorrowEvent: '학교 소풍',
      morning: '아침',
      evening: '저녁',
      quest: '주간',
      members: [
        {
          name: '아빠', points: '474', accent: BLUE, questMarks: 2,
          tasks: [
            { title: '독서 30분', points: 30, done: true },
            { title: '운동하기', points: 30, done: true },
            { title: '한 주 계획', points: 15 },
          ],
        },
        {
          name: '엄마', points: '424', accent: PINK, questMarks: 3,
          tasks: [
            { title: '아침 스트레칭', points: 15, done: true },
            { title: '저녁 메뉴 정하기', points: 10, done: true },
            { title: '저녁 독서', points: 30 },
          ],
        },
        {
          name: '준서', points: '1,530', accent: MINT, questMarks: 2,
          tasks: [
            { title: '문제집 풀기', points: 50 },
            { title: '일기 쓰기', points: 15, done: true },
            { title: '가방 챙기기', points: 10, done: true },
          ],
        },
        {
          name: '지우', points: '1,563', accent: AMBER, questMarks: 1,
          tasks: [
            { title: '양치하기', points: 10, done: true },
            { title: '독서 시간', points: 30 },
            { title: '책상 정리', points: 10 },
          ],
        },
      ],
    },
    problem: {
      eyebrow: '문제는',
      headline: '"양치해" 벌써 사천 번째. 더 나은 방법이 있습니다.',
      body: [
        '아침은 늘 비슷하게 끝납니다. 말하고, 못 들은 척하고, 더 크게 말하고, 협상이 시작되죠. 현관문을 나설 때쯤엔 모두 기분이 상해 있습니다.',
        '문제는 아이가 아니라 매일 바뀌는 규칙입니다. 아이들은 규칙에 반발하는 게 아니라, 불공평하게 느껴지는 규칙에 반발합니다.',
        'FamBit은 매일의 판단을 부모 손에서 덜어 줍니다. 가격과 마감은 한 번만 정하세요. 시간은 화면이 지키고, 아이들은 스스로 벌고, 모으고, 원하는 데 씁니다.',
      ],
    },
    rhythm: {
      eyebrow: '하루 흐름',
      headline: '하루에는 모양이 있고, 모두가 볼 수 있습니다.',
      body: '정오가 되면 대시보드가 아침에서 오후로 바뀌고, 두 번의 마감이 루틴이 흐트러지지 않게 잡아 줍니다. 규칙은 부모를 포함해 모두에게 똑같습니다.',
      steps: [
        { time: '기상 – 12:00', title: '아침 루틴', body: '양치, 옷 입기, 가방 챙기기. 할 일마다 포인트가 먼저 보입니다.', accent: AMBER, icon: Sunrise },
        { time: '12:00', title: '정오 마감', body: '아침 루틴을 다 못 하면 사용 가능 포인트 50점 차감. 누적 XP는 그대로입니다.', accent: PINK, icon: LockKeyhole },
        { time: '12:00 – 22:00', title: '오후 · 저녁', body: '숙제, 집안일, 독서, 그리고 저녁 루틴.', accent: BLUE, icon: Moon },
        { time: '22:00', title: '저녁 마감', body: '밤에도 같은 규칙. 저녁 루틴을 못 끝내면 50점 차감.', accent: VIOLET, icon: LockKeyhole },
        { time: '매일', title: '퍼펙트 데이', body: '아침과 저녁 루틴을 모두 끝낸 날은 주간 퀘스트에 한 칸이 채워집니다.', accent: MINT, icon: Trophy },
      ],
      specialDay: {
        title: '특별한 날 모드',
        body: '여행, 명절, 아픈 날 — 한 번 누르면 그날의 모든 차감이 멈추고, 대시보드에 배너가 뜨고, 가족 모두에게 30분 이용권이 지급됩니다.',
      },
    },
    quest: {
      eyebrow: '주간 퀘스트',
      headline: '하루 놓쳤다고 한 주가 무너지지 않아요.',
      body: '퍼펙트 데이가 쌓이면 됩니다. 평일 5일 중 3일만 채워도 보상이 나와요. 완벽주의는 필요 없습니다.',
      weekdays: ['월', '화', '수', '목', '금'],
      weekend: ['토', '일'],
      weekdayRule: '평일 5일 중 3일 퍼펙트',
      weekendRule: '토·일 모두 퍼펙트',
      pass: '게임 또는 영상 30분 이용권',
    },
    store: {
      eyebrow: '가족 상점',
      headline: '가격은 우리 가족이 정합니다.',
      body: '영상 시간, 저녁 메뉴 고르기, 30분 늦게 자기 — 상품 목록은 부모가 씁니다. 주말과 공휴일엔 자동으로 세일이 열리고, 실제 가격이 있는 물건도 포인트로 바꿀 수 있어요.',
      items: [
        { title: '영상 30분', price: 300, sale: 240 },
        { title: '오늘 저녁 메뉴 고르기', price: 500, sale: 400 },
        { title: '30분 늦게 자기', price: 800, tag: '인기' },
      ],
      saleBadge: '주말 세일',
      cashLabel: '현금 교환',
      cashValue: '$4.99 → 500점',
      cashNote: '달러 단위로 반올림되고, 모든 구매가 기록됩니다.',
      tiersLabel: '걸리는 시간별 포인트',
      tiers: [
        { minutes: '5분 이하', points: 10 },
        { minutes: '6~10분', points: 15 },
        { minutes: '11~20분', points: 30 },
        { minutes: '21분 이상', points: 50 },
      ],
    },
    calendar: {
      eyebrow: '가족 캘린더',
      headline: '오늘과 내일 일정이 맨 위에.',
      body: '구글 캘린더를 한 번만 연결하세요. 대시보드 상단에서 오늘과 내일 일정을 바로 확인하고, 누르면 주간 · 목록 · 월간 보기로 전체 캘린더가 열립니다.',
      views: ['주간', '목록', '월간'],
      days: [
        { day: '일', date: 20, events: [] },
        { day: '월', date: 21, events: [{ title: '수영', accent: MINT }] },
        { day: '화', date: 22, events: [{ title: '피아노', accent: BLUE }] },
        { day: '수', date: 23, events: [{ title: '수영', accent: MINT }, { title: '치과', accent: PINK }] },
        { day: '목', date: 24, events: [] },
        { day: '금', date: 25, events: [{ title: '영화의 밤', accent: AMBER }] },
        { day: '토', date: 26, events: [{ title: '소풍', accent: VIOLET }] },
      ],
    },
    features: {
      eyebrow: '그리고 더',
      headline: '실제 가족의 하루에 맞춰 만들었습니다.',
      body: '',
      items: [
        { icon: MonitorSmartphone, accent: MINT, title: '공용 화면에 최적화', body: '거실 노트북이나 태블릿에서 누르기 쉬운 큰 버튼, 휴대폰에선 가족별 탭. 설치형 앱으로 자동 업데이트됩니다.' },
        { icon: ShieldCheck, accent: BLUE, title: '쉴드와 휘장', body: '꾸준함은 모멘텀이, 가족의 협력은 하모니가 되고, 손에 닿는 쉴드 목표가 보너스를 더합니다.' },
        { icon: HeartHandshake, accent: PINK, title: '말로 하기 어려운 마음', body: '"고마워", "미안해", "사랑해"를 포인트와 함께 보내세요. 모든 선물은 가족 피드에 남습니다.' },
        { icon: BarChart3, accent: AMBER, title: '주간 리캡', body: '가족별 완료 수, 가장 좋았던 날, 연속 기록. 새 주가 시작되면 지난주를 함께 돌아봅니다.' },
        { icon: Palmtree, accent: VIOLET, title: '쉬는 날도 설계에 포함', body: '특별한 날 모드와 세일 날 차감 면제로, 사정이 생긴 날에도 시스템이 공정하게 유지됩니다.' },
        { icon: Users, accent: MINT, title: '부모도 함께', body: '부모에게도 루틴이 있습니다. 아빠가 운동을 끝내는 것도, 빼먹는 것도 아이들이 봅니다.' },
      ],
    },
    story: {
      eyebrow: '만든 이유',
      headline: '혼낸 날 밤, 아들이 10점을 보냈습니다.',
      body: [
        '"아빠, 미안해."',
        '양치하고, 숙제하고, 30분 책을 읽어서 스스로 번 10점이었습니다. 아이는 메일함을 열어 그 점수를 저에게 보내기로 했습니다.',
        '아홉 살은 얼굴을 보고 "미안해"라고 말하기 어렵습니다. 하지만 자기가 번 10점은 보낼 수 있습니다.',
        'FamBit은 단순한 집안일 체크표가 아닙니다. 소리 내어 말하기 가장 어려운 말을 가족이 전할 수 있는 방법입니다.',
      ],
    },
    flow: {
      eyebrow: '시작하기',
      headline: '설정은 5분. 그다음부터는 화면이 알려 줍니다.',
      body: '부모는 Google 계정으로 가족 공간을 만들고, 아이들은 가족 코드로 들어와 공용 화면에서 사용합니다. 아이 개인 휴대폰은 필요 없어요.',
      steps: [
        { title: '가족 공간 만들기', body: 'Google로 로그인하고 가족 이름을 정합니다.' },
        { title: '가족 초대하기', body: '가족 코드를 아이들과 배우자에게 공유합니다.' },
        { title: '루틴과 가격 정하기', body: '할 일, 보상, 아바타, 관리자 PIN을 설정합니다.' },
        { title: '큰 화면에 띄우기', body: '거실 노트북에 열어 두면 하루가 알아서 굴러갑니다.' },
      ],
    },
    admin: {
      eyebrow: '부모 관리',
      headline: '진짜 집안 규칙을 위한 관리 기능.',
      body: '가족은 변합니다. 보상은 품절되고, 아이들은 자랍니다. 처음부터 다시 만들지 않고 규칙만 바꾸세요.',
      cards: [
        { icon: Settings2, accent: MINT, title: '할 일과 루틴', body: '아침·저녁 루틴, 시간 기반 포인트, 가족별 요일 설정.' },
        { icon: ShoppingBag, accent: AMBER, title: '상점과 세일', body: '숨김·품절 상품, 주말·공휴일 자동 세일, 환불 처리.' },
        { icon: Mail, accent: PINK, title: '기록과 메일함', body: '구매, 현금 교환, 선물, 시스템 알림을 한 피드에서.' },
        { icon: LockKeyhole, accent: BLUE, title: 'PIN 보호 관리자 모드', body: '민감한 작업은 가족 PIN으로 보호하고, 소유자 계정으로 언제든 복구합니다.' },
      ],
    },
    why: {
      eyebrow: '자주 받는 질문',
      headline: '당연히 해야 할 일에 보상을 주는 게 맞나요?',
      body: [
        '양치, 가방 챙기기, 숙제. 이런 일은 원래 아이에게 즐거운 활동이 아닙니다. 보상이 "망칠" 내적 동기가 애초에 크지 않아요.',
        'FamBit이 하는 일은 노력을 눈에 보이게 하고, 규칙을 일관되게 하고, 보상을 예측 가능하게 만드는 것입니다. 아이는 노력에 가치가 있고, 저축에 목적이 있고, 선택에 무게가 있다는 걸 — 안전할 만큼 작은 시스템 안에서 배웁니다.',
        '규칙이 제멋대로라고 느끼면 마음을 닫는 아이들에게 특히 잘 맞습니다. 분명한 가격표 하나가 천 번의 잔소리보다 낫습니다.',
      ],
    },
    final: {
      headline: '잔소리는 멈추고, 시스템을 시작하세요.',
      body: '무료로 시작하세요. 가족 설정은 5분이면 충분하고, 카드 등록도 필요 없습니다.',
      primary: 'Google로 시작하기',
      secondary: '초대 코드로 참여',
      privacy: '개인정보 처리방침',
    },
  },
};

// ── Building blocks ──────────────────────────────────────────────────────────

const container = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';
const primaryButton = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#4EEDB0] px-6 text-sm font-black text-[#07120E] shadow-[0_10px_40px_-10px_#4EEDB0aa] transition hover:-translate-y-0.5 hover:bg-[#71F4C0]';
const secondaryButton = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-6 text-sm font-black text-white transition hover:bg-white/10';

function Eyebrow({ children, color }: { children: ReactNode; color: string }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em]" style={{ color }}>
      <span className="h-px w-6" style={{ background: color }} />
      {children}
    </p>
  );
}

function SectionHeading({ eyebrow, color, headline, body, center }: {
  eyebrow: string;
  color: string;
  headline: string;
  body?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <Eyebrow color={color}>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-3xl font-black leading-[1.12] tracking-tight text-white sm:text-5xl">{headline}</h2>
      {body && <p className="mt-5 text-base leading-7 text-white/62 sm:text-lg">{body}</p>}
    </div>
  );
}

function Glow({ className, color }: { className: string; color: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{ background: color }}
    />
  );
}

// ── Hero dashboard mock ──────────────────────────────────────────────────────

function MockMemberPanel({ member, morning, evening, quest }: {
  member: MockMember;
  morning: string;
  evening: string;
  quest: string;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-white/8 bg-[#14162A] p-2.5">
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-black"
          style={{ borderColor: member.accent, color: member.accent, background: `${member.accent}1f` }}
        >
          {member.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-black text-white">{member.name}</div>
          <div className="text-[10px] font-black text-[#FFB830]">{member.points}pt</div>
        </div>
        <div className="flex items-center gap-0.5" title={quest}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: i < member.questMarks ? MINT : 'rgba(255,255,255,0.15)' }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-0.5 text-center text-[9px] font-black">
        <span className="rounded-md bg-white/10 py-1 text-white">{morning}</span>
        <span className="py-1 text-white/40">{evening}</span>
      </div>
      <div className="mt-2 space-y-1">
        {member.tasks.map(task => (
          <div
            key={task.title}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
            style={{ background: task.done ? `${member.accent}1a` : 'rgba(255,255,255,0.04)' }}
          >
            <span
              className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border"
              style={{ borderColor: task.done ? member.accent : 'rgba(255,255,255,0.2)', background: task.done ? member.accent : 'transparent' }}
            >
              {task.done && <CheckCircle2 size={10} className="text-[#0D0E1C]" strokeWidth={3} />}
            </span>
            <span className={`min-w-0 flex-1 truncate text-[10px] font-semibold ${task.done ? 'text-white/45 line-through' : 'text-white/85'}`}>
              {task.title}
            </span>
            <span className="text-[9px] font-black text-[#FFB830]">+{task.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardMock({ mock }: { mock: LandingCopy['mock'] }) {
  return (
    <div className="relative" aria-hidden="true">
      <Glow className="-inset-10 opacity-30" color="radial-gradient(closest-side, #5B8EFF, transparent)" />
      {/* Laptop screen */}
      <div className="relative rounded-[22px] border border-white/12 bg-[#05060d] p-2 shadow-[0_40px_120px_-30px_#000]">
        <div className="overflow-hidden rounded-2xl bg-[#0D0E1C]">
          {/* Header, mirroring the real dashboard header with the calendar peek */}
          <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-[#4EEDB0] text-[10px] font-black text-[#07120E]">F</span>
            <span className="shrink-0 text-xs font-black text-white">{mock.family}</span>
            <div className="ml-1 flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px]">
              <span className="flex min-w-0 items-center gap-1">
                <span className="font-black text-[#4EEDB0]">{mock.today}</span>
                <span className="h-1 w-1 shrink-0 rounded-full bg-[#4EEDB0]" />
                <span className="truncate font-semibold text-white/80">{mock.todayEvent}</span>
                <span className="font-bold text-white/40">{mock.todayMore}</span>
              </span>
              <span className="hidden min-w-0 items-center gap-1 sm:flex">
                <span className="font-black text-[#8EAFFF]">{mock.tomorrow}</span>
                <span className="h-1 w-1 shrink-0 rounded-full bg-[#B78BFF]" />
                <span className="truncate font-semibold text-white/80">{mock.tomorrowEvent}</span>
              </span>
            </div>
            <CalendarDays size={14} className="shrink-0 text-white/50" />
          </div>
          <div className="grid grid-cols-2 gap-2 p-2 md:grid-cols-4">
            {mock.members.map(member => (
              <MockMemberPanel key={member.name} member={member} morning={mock.morning} evening={mock.evening} quest={mock.quest} />
            ))}
          </div>
        </div>
      </div>
      {/* Laptop base */}
      <div className="mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-2xl border border-t-0 border-white/10 bg-linear-to-b from-[#20223a] to-[#0f1020]" />
    </div>
  );
}

// ── Feature visuals ──────────────────────────────────────────────────────────

function QuestVisual({ quest }: { quest: LandingCopy['quest'] }) {
  const perfect = [true, true, false, true, false];
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-bold text-white/50">{quest.weekdayRule}</div>
        <div className="flex gap-2">
          {quest.weekdays.map((day, i) => (
            <div
              key={day}
              className={`grid h-14 flex-1 place-items-center rounded-xl border text-xs font-black ${perfect[i] ? 'border-[#4EEDB0]/50 bg-[#4EEDB0]/15 text-[#4EEDB0]' : 'border-white/10 bg-white/[0.03] text-white/35'}`}
            >
              <span>{day}</span>
              {perfect[i] && <CheckCircle2 size={14} strokeWidth={3} />}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-bold text-white/50">{quest.weekendRule}</div>
        <div className="flex gap-2">
          {quest.weekend.map(day => (
            <div key={day} className="grid h-14 w-16 place-items-center rounded-xl border border-[#B78BFF]/45 bg-[#B78BFF]/12 text-xs font-black text-[#CDB3FF]">
              <span>{day}</span>
              <CheckCircle2 size={14} strokeWidth={3} />
            </div>
          ))}
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-dashed border-[#FFB830]/50 bg-[#FFB830]/10 px-3 text-xs font-black text-[#FFD37A]">
            <Ticket size={18} className="shrink-0" />
            <span>{quest.pass} ×2</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoreVisual({ store }: { store: LandingCopy['store'] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-2">
        {store.items.map(item => (
          <div key={item.title} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFB830]/15 text-[#FFB830]"><Gift size={17} /></span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{item.title}</span>
            {item.sale ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full bg-[#FF7BAC]/18 px-2 py-0.5 text-[10px] font-black text-[#FF9DBF]">{store.saleBadge}</span>
                <span className="text-xs font-bold text-white/35 line-through">{item.price}</span>
                <span className="text-sm font-black text-[#FFB830]">{item.sale}</span>
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1.5">
                {item.tag && <span className="rounded-full bg-[#5B8EFF]/18 px-2 py-0.5 text-[10px] font-black text-[#8EAFFF]">{item.tag}</span>}
                <span className="text-sm font-black text-[#FFB830]">{item.price}</span>
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-3">
        <div className="rounded-xl border border-[#4EEDB0]/25 bg-[#4EEDB0]/[0.07] p-4">
          <div className="text-xs font-bold text-[#4EEDB0]">{store.cashLabel}</div>
          <div className="mt-1 text-xl font-black tabular-nums text-white">{store.cashValue}</div>
          <div className="mt-1 text-xs leading-5 text-white/50">{store.cashNote}</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <div className="mb-2 text-xs font-bold text-white/50">{store.tiersLabel}</div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {store.tiers.map(tier => (
              <div key={tier.minutes} className="rounded-lg bg-white/[0.05] px-1 py-2">
                <div className="text-sm font-black text-[#FFB830]">{tier.points}</div>
                <div className="mt-0.5 text-[9px] font-semibold leading-tight text-white/45">{tier.minutes}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarVisual({ calendar }: { calendar: LandingCopy['calendar'] }) {
  return (
    <div>
      <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1 text-xs font-black">
        {calendar.views.map((view, i) => (
          <span key={view} className={`rounded-lg px-3 py-1.5 ${i === 0 ? 'bg-[#FFB830] text-[#1a1300]' : 'text-white/55'}`}>{view}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {calendar.days.map((day, i) => (
          <div
            key={day.day}
            className={`min-h-[112px] rounded-xl border p-1.5 ${i === 3 ? 'border-[#4EEDB0]/45 bg-[#4EEDB0]/[0.07]' : 'border-white/8 bg-white/[0.03]'}`}
          >
            <div className="flex items-baseline gap-1">
              <span className={`text-sm font-black ${i === 3 ? 'text-[#4EEDB0]' : i === 0 ? 'text-[#FF9DBF]' : i === 6 ? 'text-[#8EAFFF]' : 'text-white/80'}`}>{day.date}</span>
              <span className="text-[9px] font-bold text-white/40">{day.day}</span>
            </div>
            <div className="mt-1.5 space-y-1">
              {day.events.map(event => (
                <div
                  key={event.title}
                  className="truncate rounded border-l-2 bg-white/[0.06] px-1 py-0.5 text-[9px] font-bold text-white/85"
                  style={{ borderColor: event.accent }}
                >
                  {event.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function FamBitLanding({ locale }: { locale: LandingLocale }) {
  const c = landingCopy[locale];

  return (
    <main className={`min-h-screen overflow-x-clip bg-[#0A0B16] text-white ${locale === 'ko' ? 'break-keep' : ''}`}>
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0A0B16]/80 backdrop-blur-xl">
        <div className={`${container} flex h-16 items-center justify-between gap-4`}>
          <Link href={locale === 'ko' ? '/home/ko' : '/home'} aria-label="FamBit home">
            <FamBitWordmark compact />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-white/60 lg:flex">
            <a href="#rhythm" className="transition hover:text-white">{c.nav.rhythm}</a>
            <a href="#features" className="transition hover:text-white">{c.nav.features}</a>
            <a href="#flow" className="transition hover:text-white">{c.nav.flow}</a>
            <a href="#admin" className="transition hover:text-white">{c.nav.admin}</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href={c.nav.languageHref} className="hidden h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white/80 transition hover:bg-white/10 sm:inline-flex">
              <Languages size={16} />
              {c.nav.languageLabel}
            </Link>
            <Link href="/join" className="hidden h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white/80 transition hover:bg-white/10 md:inline-flex">
              <Ticket size={16} />
              {c.nav.join}
            </Link>
            <Link href="/login" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#4EEDB0] px-4 text-sm font-black text-[#07120E] transition hover:bg-[#71F4C0]">
              <LogIn size={16} />
              {c.nav.signIn}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <Glow className="-left-40 -top-40 -z-10 h-[520px] w-[520px] opacity-25" color={MINT} />
        <Glow className="-right-40 top-20 -z-10 h-[480px] w-[480px] opacity-20" color={BLUE} />
        <Glow className="bottom-0 left-1/3 -z-10 h-[360px] w-[360px] opacity-15" color={PINK} />

        <div className={`${container} grid items-center gap-14 pb-20 pt-16 lg:grid-cols-[1fr_1.1fr] lg:pb-28 lg:pt-24`}>
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-white/75">
              <Sparkles size={14} className="text-[#4EEDB0]" />
              {c.hero.badge}
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[1.04] tracking-tight sm:text-6xl xl:text-7xl">
              {c.hero.headline}
              <span className="block bg-linear-to-r from-[#4EEDB0] via-[#5B8EFF] to-[#FF7BAC] bg-clip-text pb-2 text-transparent">
                {c.hero.headlineAccent}
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">{c.hero.body}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className={primaryButton}>
                {c.hero.primary}
                <ArrowRight size={17} />
              </Link>
              <a href="#flow" className={secondaryButton}>
                {c.hero.secondary}
                <ArrowRight size={17} className="rotate-90" />
              </a>
            </div>
          </div>
          <DashboardMock mock={c.mock} />
        </div>

        {/* Stat ribbon */}
        <div className="border-y border-white/8 bg-white/[0.02]">
          <div className={`${container} grid grid-cols-2 divide-white/8 lg:grid-cols-4 lg:divide-x`}>
            {c.stats.map(stat => (
              <div key={stat.label} className="px-2 py-6 lg:px-6">
                <div className="text-xl font-black tabular-nums text-white sm:text-2xl">{stat.value}</div>
                <div className="mt-1 text-xs font-semibold leading-5 text-white/50 sm:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className={`${container} grid gap-10 py-24 lg:grid-cols-[0.95fr_1.05fr]`}>
        <div>
          <Eyebrow color={PINK}>{c.problem.eyebrow}</Eyebrow>
          <h2 className="mt-4 text-3xl font-black leading-[1.15] tracking-tight sm:text-4xl">{c.problem.headline}</h2>
        </div>
        <div className="space-y-5 text-base leading-8 text-white/65 sm:text-lg">
          {c.problem.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </section>

      {/* Daily rhythm */}
      <section id="rhythm" className="relative scroll-mt-16 border-y border-white/8 bg-[#0E0F1F] py-24">
        <div className={container}>
          <SectionHeading eyebrow={c.rhythm.eyebrow} color={AMBER} headline={c.rhythm.headline} body={c.rhythm.body} />
          <ol className="mt-14 grid gap-3 md:grid-cols-5">
            {c.rhythm.steps.map(step => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative rounded-2xl border border-white/8 bg-[#14162A] p-5">
                  <span className="absolute inset-x-5 top-0 h-0.5 rounded-full" style={{ background: step.accent }} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tabular-nums" style={{ color: step.accent }}>{step.time}</span>
                    <Icon size={18} className="text-white/35" />
                  </div>
                  <h3 className="mt-4 text-lg font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/58">{step.body}</p>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-[#4EEDB0]/25 bg-linear-to-r from-[#4EEDB0]/12 to-transparent p-5 sm:flex-row sm:items-center">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#4EEDB0]/18 text-[#4EEDB0]"><Palmtree size={22} /></span>
            <div>
              <h3 className="font-black text-white">{c.rhythm.specialDay.title}</h3>
              <p className="mt-1 text-sm leading-6 text-white/65">{c.rhythm.specialDay.body}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase: quest, store, calendar */}
      <section id="features" className="scroll-mt-16 py-24">
        <div className={`${container} space-y-6`}>
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="relative overflow-hidden rounded-3xl border border-white/8 bg-[#12142A] p-6 sm:p-8">
              <Glow className="-right-24 -top-24 h-64 w-64 opacity-20" color={MINT} />
              <Eyebrow color={MINT}>{c.quest.eyebrow}</Eyebrow>
              <h3 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{c.quest.headline}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60 sm:text-base">{c.quest.body}</p>
              <div className="mt-8"><QuestVisual quest={c.quest} /></div>
            </article>
            <article className="relative overflow-hidden rounded-3xl border border-white/8 bg-[#12142A] p-6 sm:p-8">
              <Glow className="-left-24 -top-24 h-64 w-64 opacity-20" color={AMBER} />
              <Eyebrow color={AMBER}>{c.calendar.eyebrow}</Eyebrow>
              <h3 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{c.calendar.headline}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60 sm:text-base">{c.calendar.body}</p>
              <div className="mt-8"><CalendarVisual calendar={c.calendar} /></div>
            </article>
          </div>
          <article className="relative overflow-hidden rounded-3xl border border-white/8 bg-[#12142A] p-6 sm:p-8">
            <Glow className="-bottom-32 right-1/4 h-72 w-72 opacity-15" color={PINK} />
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <Eyebrow color={PINK}>{c.store.eyebrow}</Eyebrow>
                <h3 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{c.store.headline}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60 sm:text-base">{c.store.body}</p>
              </div>
              <StoreVisual store={c.store} />
            </div>
          </article>

          <div className="pt-16">
            <SectionHeading eyebrow={c.features.eyebrow} color={BLUE} headline={c.features.headline} body={c.features.body || undefined} />
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.features.items.map(feature => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="group rounded-2xl border border-white/8 bg-[#12142A] p-6 transition hover:-translate-y-1 hover:border-white/15">
                    <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${feature.accent}1f`, color: feature.accent }}>
                      <Icon size={20} />
                    </span>
                    <h3 className="mt-5 text-lg font-black">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/58">{feature.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="relative overflow-hidden border-y border-white/8 bg-[#0E0F1F] py-24">
        <Glow className="left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-10" color={PINK} />
        <div className={`${container} relative max-w-4xl text-center`}>
          <Eyebrow color={PINK}>{c.story.eyebrow}</Eyebrow>
          <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-5xl">{c.story.headline}</h2>
          <p className="mt-8 text-3xl font-black text-[#4EEDB0] sm:text-4xl">{c.story.body[0]}</p>
          <div className="mx-auto mt-8 max-w-2xl space-y-4 text-base leading-8 text-white/65 sm:text-lg">
            {c.story.body.slice(1).map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="flow" className="scroll-mt-16 py-24">
        <div className={container}>
          <SectionHeading eyebrow={c.flow.eyebrow} color={MINT} headline={c.flow.headline} body={c.flow.body} center />
          <ol className="relative mt-14 grid gap-4 md:grid-cols-4">
            <span aria-hidden="true" className="absolute left-[12%] right-[12%] top-6 hidden h-px bg-linear-to-r from-[#4EEDB0]/0 via-[#4EEDB0]/40 to-[#4EEDB0]/0 md:block" />
            {c.flow.steps.map((step, index) => (
              <li key={step.title} className="relative text-center">
                <span className="relative mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#4EEDB0]/40 bg-[#0A0B16] text-lg font-black text-[#4EEDB0] shadow-[0_0_30px_-8px_#4EEDB0]">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-black">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-[240px] text-sm leading-6 text-white/58">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Parent admin */}
      <section id="admin" className="scroll-mt-16 border-t border-white/8 bg-[#0E0F1F] py-24">
        <div className={`${container} grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center`}>
          <SectionHeading eyebrow={c.admin.eyebrow} color={AMBER} headline={c.admin.headline} body={c.admin.body} />
          <div className="grid gap-3 sm:grid-cols-2">
            {c.admin.cards.map(card => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="rounded-2xl border border-white/8 bg-[#14162A] p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${card.accent}1f`, color: card.accent }}>
                    <Icon size={19} />
                  </span>
                  <h3 className="mt-4 font-black">{card.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/58">{card.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="bg-[#F4F6FB] py-24 text-[#111224]">
        <div className={`${container} grid gap-10 lg:grid-cols-[0.9fr_1.1fr]`}>
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#14A870]">
              <span className="h-px w-6 bg-[#14A870]" />
              {c.why.eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-black leading-[1.15] tracking-tight sm:text-4xl">{c.why.headline}</h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-slate-600 sm:text-lg">
            {c.why.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative isolate overflow-hidden py-24">
        <Glow className="left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 opacity-20" color={MINT} />
        <div className={`${container} text-center`}>
          <div className="flex justify-center"><FamBitWordmark /></div>
          <h2 className="mx-auto mt-8 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">{c.final.headline}</h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/62 sm:text-lg">{c.final.body}</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/login" className={primaryButton}>
              {c.final.primary}
              <ArrowRight size={17} />
            </Link>
            <Link href="/join" className={secondaryButton}>
              <Ticket size={17} />
              {c.final.secondary}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 py-8">
        <div className={`${container} flex flex-col items-center justify-between gap-4 text-sm text-white/45 sm:flex-row`}>
          <FamBitWordmark compact />
          <div className="flex items-center gap-5">
            <Link href={c.nav.languageHref} className="hover:text-white">{c.nav.languageLabel}</Link>
            <Link href="/privacy" className="hover:text-white">{c.final.privacy}</Link>
            <Link href="/login" className="hover:text-white">{c.nav.signIn}</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
