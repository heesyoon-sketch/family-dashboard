import { PrismaClient, UserRole, Difficulty } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { pbkdf2Sync } from 'crypto';
import path from 'path';

function hashPin(pin: string): string {
  const salt = 'familydashboard-salt';
  return pbkdf2Sync(pin, salt, 100000, 32, 'sha256').toString('hex');
}

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const libsql = createClient({ url: `file:${dbPath}` });
const adapter = new PrismaLibSQL(libsql);
const prisma = new PrismaClient({ adapter } as any);

const CHILD_TASKS = [
  {
    code: 'evening_routine',
    title: '저녁 루틴 (씻기·양치·로션)',
    icon: 'moon-star',
    difficulty: Difficulty.MEDIUM,
    basePoints: 10,
    recurrence: 'daily',
    timeWindow: 'evening',
  },
  {
    code: 'after_school',
    title: '학교 후 정리·숙제',
    icon: 'backpack',
    difficulty: Difficulty.MEDIUM,
    basePoints: 10,
    recurrence: 'weekdays',
    timeWindow: 'afternoon',
  },
  {
    code: 'vitamins',
    title: '아침 영양제',
    icon: 'pill',
    difficulty: Difficulty.EASY,
    basePoints: 5,
    recurrence: 'daily',
    timeWindow: 'morning',
  },
  {
    code: 'journal',
    title: '일기 쓰기',
    icon: 'book-open',
    difficulty: Difficulty.MEDIUM,
    basePoints: 10,
    recurrence: 'daily',
    timeWindow: null,
  },
  {
    code: 'reading',
    title: '독서',
    icon: 'book-heart',
    difficulty: Difficulty.MEDIUM,
    basePoints: 10,
    recurrence: 'daily',
    timeWindow: null,
  },
  {
    code: 'toy_tidy',
    title: '장난감 정리',
    icon: 'blocks',
    difficulty: Difficulty.EASY,
    basePoints: 5,
    recurrence: 'daily',
    timeWindow: 'evening',
  },
];

const PARENT_TASKS_DEFAULT = [
  { code: 'workout', title: '운동 (30분+)', icon: 'dumbbell', difficulty: Difficulty.MEDIUM, basePoints: 10, recurrence: 'daily', timeWindow: null },
  { code: 'read',    title: '독서·학습',   icon: 'book',     difficulty: Difficulty.MEDIUM, basePoints: 10, recurrence: 'daily', timeWindow: null },
  { code: 'hydrate', title: '수분 섭취',   icon: 'droplet',  difficulty: Difficulty.EASY,   basePoints: 5,  recurrence: 'daily', timeWindow: null },
];

async function main() {
  const dad = await prisma.user.create({
    data: { name: '아빠', role: UserRole.PARENT, theme: 'dark_minimal', pinHash: hashPin('0000') },
  });
  const mom = await prisma.user.create({
    data: { name: '엄마', role: UserRole.PARENT, theme: 'warm_minimal', pinHash: hashPin('0000') },
  });
  const junseo = await prisma.user.create({
    data: { name: '윤준서', role: UserRole.CHILD, theme: 'robot_neon' },
  });
  const jiwoo = await prisma.user.create({
    data: { name: '윤지우', role: UserRole.CHILD, theme: 'pastel_cute' },
  });

  for (const child of [junseo, jiwoo]) {
    for (const [i, t] of CHILD_TASKS.entries()) {
      await prisma.task.create({ data: { ...t, userId: child.id, sortOrder: i } });
    }
  }

  for (const parent of [dad, mom]) {
    for (const [i, t] of PARENT_TASKS_DEFAULT.entries()) {
      await prisma.task.create({ data: { ...t, userId: parent.id, sortOrder: i } });
    }
  }

  const MVP_BADGES = [
    {
      code: 'evening_master',
      name: '저녁 루틴 마스터',
      description: '저녁 루틴 7일 연속 완료',
      icon: 'moon',
      category: 'habit',
      conditionJson: JSON.stringify({ type: 'streak', taskCode: 'evening_routine', days: 7 }),
    },
    {
      code: 'vitamin_hero',
      name: '비타민 히어로',
      description: '아침 영양제 14일 연속 완료',
      icon: 'heart-pulse',
      category: 'habit',
      conditionJson: JSON.stringify({ type: 'streak', taskCode: 'vitamins', days: 14 }),
    },
    {
      code: 'tidy_king',
      name: '정리왕',
      description: '장난감 정리 월 90% 이상',
      icon: 'sparkles',
      category: 'habit',
      conditionJson: JSON.stringify({ type: 'monthly_rate', taskCode: 'toy_tidy', percent: 90 }),
    },
  ];
  for (const b of MVP_BADGES) await prisma.badge.create({ data: b });

  for (const u of [dad, mom, junseo, jiwoo]) {
    await prisma.level.create({ data: { userId: u.id, currentLevel: 1, totalPoints: 0 } });
  }

  console.log('✓ Seeded: 4 users, 18 tasks (6x2 children + 3x2 parents), 3 badges');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
