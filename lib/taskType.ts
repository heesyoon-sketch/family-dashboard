// Required vs. optional ("bonus") tasks.
//
// Optional tasks are completed and rewarded exactly like required ones, but
// they are never "due": skipping one must not cost points, break a perfect
// day, lower a completion rate or touch Shield evaluation. Every place that
// asks "what was this member supposed to do?" filters through
// `requiredTasks`; places that only reward finished work keep all tasks.

export type TaskType = 'required' | 'optional';

export function normalizeTaskType(value: unknown): TaskType {
  return value === 'optional' ? 'optional' : 'required';
}

export function isOptionalTask(task: { taskType?: TaskType | null }): boolean {
  return task.taskType === 'optional';
}

export function requiredTasks<T extends { taskType?: TaskType | null }>(tasks: readonly T[]): T[] {
  return tasks.filter(task => !isOptionalTask(task));
}

export function bonusTasks<T extends { taskType?: TaskType | null }>(tasks: readonly T[]): T[] {
  return tasks.filter(isOptionalTask);
}

export interface TaskDaySummary {
  requiredDone: number;
  requiredTotal: number;
  /** null when nothing required is scheduled, so a bonus-only day is not 0%. */
  requiredCompletionRate: number | null;
  bonusDone: number;
  bonusAvailable: number;
  bonusPointsEarned: number;
}

/**
 * Splits a member's tasks for one window/day into the required score and
 * the bonus tally. Bonus tasks never enter the required denominator.
 * `pointsByTaskId` overrides the base reward with what was actually awarded.
 */
export function summarizeTaskDay(
  tasks: ReadonlyArray<{ id: string; basePoints: number; taskType?: TaskType | null }>,
  completedIds: Iterable<string>,
  pointsByTaskId?: ReadonlyMap<string, number>,
): TaskDaySummary {
  const done = new Set(completedIds);
  const required = requiredTasks(tasks);
  const bonus = bonusTasks(tasks);
  const requiredDone = required.filter(task => done.has(task.id)).length;
  const bonusDoneTasks = bonus.filter(task => done.has(task.id));
  return {
    requiredDone,
    requiredTotal: required.length,
    requiredCompletionRate: required.length > 0 ? requiredDone / required.length : null,
    bonusDone: bonusDoneTasks.length,
    bonusAvailable: bonus.length,
    bonusPointsEarned: bonusDoneTasks.reduce(
      (sum, task) => sum + (pointsByTaskId?.get(task.id) ?? task.basePoints),
      0,
    ),
  };
}

export interface EarnedPointsSplit {
  requiredPointsEarned: number;
  bonusPointsEarned: number;
  bonusCompleted: number;
}

/**
 * Separates awarded points by task type over any period. Monthly evaluation
 * reads its completion rate from required-only schedule snapshots; this keeps
 * `bonusPointsEarned` available as its own figure instead of folding it in.
 */
export function splitEarnedPoints(
  completions: ReadonlyArray<{ taskId: string; pointsAwarded: number }>,
  tasks: ReadonlyArray<{ id: string; taskType?: TaskType | null }>,
): EarnedPointsSplit {
  const bonusIds = new Set(bonusTasks(tasks).map(task => task.id));
  const split: EarnedPointsSplit = { requiredPointsEarned: 0, bonusPointsEarned: 0, bonusCompleted: 0 };
  for (const completion of completions) {
    if (bonusIds.has(completion.taskId)) {
      split.bonusPointsEarned += completion.pointsAwarded;
      split.bonusCompleted += 1;
    } else {
      split.requiredPointsEarned += completion.pointsAwarded;
    }
  }
  return split;
}

export interface BonusTaskTemplate {
  icon: string;
  title: { en: string; ko: string };
}

export interface BonusTaskTemplateGroup {
  id: 'learning' | 'physical' | 'responsibility' | 'family' | 'creativity';
  label: { en: string; ko: string };
  templates: BonusTaskTemplate[];
}

/** Suggestions that prefill the add-task form. Nothing here is ever seeded. */
export const BONUS_TASK_TEMPLATES: BonusTaskTemplateGroup[] = [
  {
    id: 'learning',
    label: { en: 'Learning', ko: '배움' },
    templates: [
      { icon: 'book-open', title: { en: 'Read for 20 minutes', ko: '20분 책 읽기' } },
      { icon: 'calculator', title: { en: 'Extra math challenge', ko: '수학 도전 문제' } },
      { icon: 'languages', title: { en: 'Practice English for 10 minutes', ko: '10분 영어 연습' } },
      { icon: 'code', title: { en: 'Coding for 20 minutes', ko: '20분 코딩' } },
      { icon: 'lightbulb', title: { en: 'Learn something new and tell a parent', ko: '새로 배운 것 부모님께 알려주기' } },
      { icon: 'graduation-cap', title: { en: 'Teach someone something', ko: '누군가에게 무언가 가르쳐주기' } },
    ],
  },
  {
    id: 'physical',
    label: { en: 'Physical', ko: '운동' },
    templates: [
      { icon: 'dumbbell', title: { en: 'Hockey stickhandling for 15 minutes', ko: '15분 하키 스틱핸들링' } },
      { icon: 'target', title: { en: 'Shoot 50 pucks', ko: '퍽 50개 슈팅' } },
      { icon: 'activity', title: { en: 'Exercise for 15 minutes', ko: '15분 운동' } },
      { icon: 'trees', title: { en: 'Play outside for 30 minutes', ko: '30분 밖에서 놀기' } },
      { icon: 'stretch-horizontal', title: { en: 'Stretch for 10 minutes', ko: '10분 스트레칭' } },
    ],
  },
  {
    id: 'responsibility',
    label: { en: 'Responsibility', ko: '책임감' },
    templates: [
      { icon: 'backpack', title: { en: 'Organize your backpack', ko: '가방 정리하기' } },
      { icon: 'lamp-desk', title: { en: 'Clean your desk', ko: '책상 정리하기' } },
      { icon: 'calendar-check', title: { en: 'Prepare school things for tomorrow', ko: '내일 학교 준비하기' } },
      { icon: 'utensils', title: { en: 'Help clean the kitchen', ko: '부엌 정리 돕기' } },
      { icon: 'shirt', title: { en: 'Help with laundry', ko: '빨래 돕기' } },
      { icon: 'shirt', title: { en: 'Fold and put away laundry', ko: '빨래 개서 정리하기' } },
    ],
  },
  {
    id: 'family',
    label: { en: 'Character / Family', ko: '마음·가족' },
    templates: [
      { icon: 'hand-heart', title: { en: 'Help a sibling', ko: '형제자매 돕기' } },
      { icon: 'users', title: { en: 'Help a family member', ko: '가족 돕기' } },
      { icon: 'heart-handshake', title: { en: 'Do something helpful without being asked', ko: '말하기 전에 먼저 돕기' } },
      { icon: 'notebook-pen', title: { en: 'Write something you’re grateful for', ko: '감사한 일 적기' } },
      { icon: 'chef-hat', title: { en: 'Help prepare a family meal', ko: '가족 식사 준비 돕기' } },
    ],
  },
  {
    id: 'creativity',
    label: { en: 'Creativity', ko: '창의력' },
    templates: [
      { icon: 'palette', title: { en: 'Draw or make something', ko: '그림 그리거나 만들기' } },
      { icon: 'blocks', title: { en: 'Build something', ko: '무언가 조립하기' } },
      { icon: 'music', title: { en: 'Practice music', ko: '악기 연습' } },
      { icon: 'pen-line', title: { en: 'Write a short story or journal entry', ko: '짧은 이야기나 일기 쓰기' } },
    ],
  },
];
