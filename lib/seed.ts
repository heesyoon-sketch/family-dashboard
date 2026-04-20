import { db } from './db';
import { hashPin } from './pin';

const CHILD_TASKS = [
  { code: 'brush_teeth',   title: '양치 (하루 2회)',               icon: 'sparkles',    difficulty: 'EASY'   as const, basePoints: 5,  recurrence: 'daily', timeWindow: undefined },
  { code: 'vitamins',      title: '영양제 챙겨먹기',               icon: 'pill',        difficulty: 'EASY'   as const, basePoints: 5,  recurrence: 'daily', timeWindow: 'morning' as const },
  { code: 'wash_lotion',   title: '씻기 & 로션',                   icon: 'droplets',    difficulty: 'EASY'   as const, basePoints: 5,  recurrence: 'daily', timeWindow: 'evening' as const },
  { code: 'chores',        title: '집안일 돕기',                   icon: 'house',       difficulty: 'MEDIUM' as const, basePoints: 10, recurrence: 'daily', timeWindow: undefined },
  { code: 'journal',       title: '일기쓰기 (최소 1/2 Page)',      icon: 'pencil-line', difficulty: 'MEDIUM' as const, basePoints: 10, recurrence: 'daily', timeWindow: undefined },
  { code: 'exercise',      title: '운동하기 (최소 30분)',           icon: 'dumbbell',    difficulty: 'MEDIUM' as const, basePoints: 10, recurrence: 'daily', timeWindow: undefined },
  { code: 'reading',       title: '독서 & 독후감 (1줄 이상)',      icon: 'book-open',   difficulty: 'MEDIUM' as const, basePoints: 10, recurrence: 'daily', timeWindow: undefined },
  { code: 'bible_prayer',  title: '말씀 읽고 기도하기 (최소 1장)', icon: 'cross',       difficulty: 'HARD'   as const, basePoints: 15, recurrence: 'daily', timeWindow: undefined },
];

const PARENT_TASKS = [
  { code: 'workout',  title: '운동 (30분+)', icon: 'dumbbell', difficulty: 'MEDIUM' as const, basePoints: 10, recurrence: 'daily', timeWindow: undefined },
  { code: 'read',     title: '독서·학습',   icon: 'book',     difficulty: 'MEDIUM' as const, basePoints: 10, recurrence: 'daily', timeWindow: undefined },
  { code: 'hydrate',  title: '수분 섭취',   icon: 'droplet',  difficulty: 'EASY'   as const, basePoints: 5,  recurrence: 'daily', timeWindow: undefined },
];

const CHILD_TASK_MIGRATION_KEY = 'child_tasks_v2';
const PARENT_ICON_MIGRATION_KEY = 'parent_task_icons_v2';

const HEESIK_ICONS: Record<string, string> = {
  '영양제 먹기':                          'pill',
  '운동하기 (최소 30분)':                  'dumbbell',
  '씻기 (양치 2x + 세수 + 샤워)':          'droplets',
  '일기쓰기 (최소 1/2 페이지)':            'pencil-line',
  '독서 (30분 이상) & 독후감 (1줄 이상)':  'book-open',
  '물 마시기 (1L 이상)':                   'cup-soda',
  '말씀 묵상 & 기도':                      'cross',
  '7시간+ 숙면':                           'moon',
};

const ARAM_ICONS: Record<string, string> = {
  '영양제 먹기':                           'pill',
  '운동하기 (최소 30분)':                  'dumbbell',
  '씻기 (양치+세수+샤워+로션)':            'droplets',
  '일기 쓰기 (최소 1/2 페이지)':           'pencil-line',
  '독서(30분 이상) & 독후감 (1줄 이상)':   'book-open',
  '물 마시기 (1L 이상)':                   'cup-soda',
  '말씀 묵상 & 기도':                      'cross',
  '영어공부 하기':                          'globe',
};

// lucide-react에 없는 아이콘 → 대체 아이콘
const ICON_FIXES: Record<string, string> = {
  'shower-head':    'droplets',
  'glass-water':    'cup-soda',
  'notebook-pen':   'pencil-line',
  'heart-handshake':'heart',
  'languages':      'globe',
};

const ICON_FIX_MIGRATION_KEY = 'icon_fix_v1';
const PRAYER_ICON_FIX_KEY = 'prayer_icon_cross_v1';

export async function seedIfEmpty() {
  const count = await db.users.count();
  if (count > 0) {
    const allUsers = await db.users.toArray();
    const defaultPinHash = await hashPin('0000');
    for (const u of allUsers) {
      const updates: Partial<typeof u> = {};
      if (u.name === '아빠') updates.name = '윤희식';
      if (u.name === '엄마') updates.name = '장아람';
      if (u.role === 'PARENT' && !u.pinHash) updates.pinHash = defaultPinHash;
      if (Object.keys(updates).length > 0) await db.users.update(u.id, updates);
    }

    // One-time progress reset
    const RESET_KEY = 'family_progress_reset_v1';
    if (!localStorage.getItem(RESET_KEY)) {
      const { resetAllProgress } = await import('./reset');
      await resetAllProgress();
      localStorage.setItem(RESET_KEY, '1');
    }

    // One-time icon fix: replace lucide-react에 없는 아이콘
    if (!localStorage.getItem(ICON_FIX_MIGRATION_KEY)) {
      const allTasks = await db.tasks.toArray();
      let fixed = 0;
      for (const t of allTasks) {
        const replacement = ICON_FIXES[t.icon];
        if (replacement) {
          await db.tasks.update(t.id, { icon: replacement });
          console.log(`[icon fix] "${t.title}" ${t.icon} → ${replacement}`);
          fixed++;
        }
      }
      console.log(`[icon fix] 총 ${fixed}건 수정`);
      localStorage.setItem(ICON_FIX_MIGRATION_KEY, '1');
    }

    // One-time prayer icon → cross
    if (!localStorage.getItem(PRAYER_ICON_FIX_KEY)) {
      const allTasks = await db.tasks.toArray();
      let fixed = 0;
      for (const t of allTasks) {
        if ((t.code === 'bible_prayer' || t.title.includes('기도')) && t.icon !== 'cross') {
          await db.tasks.update(t.id, { icon: 'cross' });
          fixed++;
        }
      }
      console.log(`[prayer icon fix] ${fixed}건 → cross`);
      localStorage.setItem(PRAYER_ICON_FIX_KEY, '1');
    }

    // One-time parent icon migration
    if (!localStorage.getItem(PARENT_ICON_MIGRATION_KEY)) {
      const iconMap: Record<string, Record<string, string>> = {
        '윤희식': HEESIK_ICONS,
        '장아람': ARAM_ICONS,
      };
      for (const [name, icons] of Object.entries(iconMap)) {
        const user = allUsers.find(u => u.name === name);
        if (!user) { console.warn(`[icon migration] 유저 없음: ${name}`); continue; }
        const tasks = await db.tasks.where('userId').equals(user.id).toArray();
        console.log(`[icon migration] ${name} tasks (${tasks.length}건):`, tasks.map(t => ({ title: t.title, icon: t.icon })));
        let updated = 0;
        for (const t of tasks) {
          const newIcon = icons[t.title.trim()];
          if (newIcon && newIcon !== t.icon) {
            await db.tasks.update(t.id, { icon: newIcon });
            console.log(`  ✓ "${t.title}" → ${newIcon}`);
            updated++;
          } else if (!newIcon) {
            console.warn(`  ✗ 매칭 없음: "${t.title}"`);
          }
        }
        console.log(`[icon migration] ${name}: ${updated}건 업데이트`);
      }
      localStorage.setItem(PARENT_ICON_MIGRATION_KEY, '1');
    }

    // One-time child task migration
    if (!localStorage.getItem(CHILD_TASK_MIGRATION_KEY)) {
      const children = allUsers.filter(u => u.role === 'CHILD');
      for (const child of children) {
        // 기존 task 및 streak 삭제
        const oldTasks = await db.tasks.where('userId').equals(child.id).toArray();
        for (const t of oldTasks) {
          await db.streaks.where('[userId+taskId]').equals([child.id, t.id]).delete();
        }
        await db.tasks.where('userId').equals(child.id).delete();

        // 새 task 추가
        await db.tasks.bulkAdd(
          CHILD_TASKS.map((t, i) => ({
            id: crypto.randomUUID(),
            userId: child.id,
            active: 1,
            sortOrder: i,
            ...t,
          }))
        );
      }
      localStorage.setItem(CHILD_TASK_MIGRATION_KEY, '1');
    }

    return;
  }

  // 최초 시드
  const now = new Date();
  const defaultPinHash = await hashPin('0000');
  const users = [
    { id: crypto.randomUUID(), name: '윤희식', role: 'PARENT' as const, theme: 'dark_minimal' as const, pinHash: defaultPinHash, createdAt: now },
    { id: crypto.randomUUID(), name: '장아람', role: 'PARENT' as const, theme: 'warm_minimal' as const, pinHash: defaultPinHash, createdAt: now },
    { id: crypto.randomUUID(), name: '윤준서', role: 'CHILD'  as const, theme: 'robot_neon'   as const, createdAt: now },
    { id: crypto.randomUUID(), name: '윤지우', role: 'CHILD'  as const, theme: 'pastel_cute'  as const, createdAt: now },
  ];
  await db.users.bulkAdd(users);

  for (const user of users) {
    const tasks = user.role === 'CHILD' ? CHILD_TASKS : PARENT_TASKS;
    await db.tasks.bulkAdd(
      tasks.map((t, i) => ({
        id: crypto.randomUUID(),
        userId: user.id,
        active: 1,
        sortOrder: i,
        ...t,
      }))
    );
    await db.levels.add({ userId: user.id, currentLevel: 1, totalPoints: 0, updatedAt: now });
  }

  localStorage.setItem(CHILD_TASK_MIGRATION_KEY, '1');

  const MVP_BADGES = [
    { id: crypto.randomUUID(), code: 'vitamin_hero',  name: '비타민 히어로',  description: '영양제 14일 연속 완료',       icon: 'heart-pulse', category: 'habit' as const, conditionJson: { type: 'streak' as const, taskCode: 'vitamins',     days: 14 }, active: 1 },
    { id: crypto.randomUUID(), code: 'bible_master',  name: '말씀 마스터',    description: '말씀·기도 7일 연속 완료',     icon: 'sparkles',    category: 'habit' as const, conditionJson: { type: 'streak' as const, taskCode: 'bible_prayer', days: 7  }, active: 1 },
    { id: crypto.randomUUID(), code: 'reader_hero',   name: '독서왕',         description: '독서·독후감 30일 달성 80%+', icon: 'book-open',   category: 'habit' as const, conditionJson: { type: 'monthly_rate' as const, taskCode: 'reading', percent: 80 }, active: 1 },
  ];
  await db.badges.bulkAdd(MVP_BADGES);
}
