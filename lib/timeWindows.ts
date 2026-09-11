export type TimeWindow = 'morning' | 'evening';
export type TaskTimeWindow = TimeWindow | 'both';
export type TimeWindowLang = 'ko' | 'en';
export type RoutineAvailability = Record<TimeWindow, boolean>;

export const AFTERNOON_START_HOUR = 12;
export const CHILD_MORNING_DEADLINE_HOUR = 9;
export const CHILD_EVENING_DEADLINE_HOUR = 21;

export const TIME_WINDOW_ORDER: Record<TaskTimeWindow, number> = {
  morning: 0,
  both: 1,
  evening: 2,
};

export function getCurrentTimeWindow(date = new Date()): TimeWindow {
  const hour = date.getHours();
  if (hour < AFTERNOON_START_HOUR) return 'morning';
  return 'evening';
}

export function getChildRoutineAvailability(date = new Date()): RoutineAvailability {
  const hour = date.getHours();
  return {
    morning: hour < CHILD_MORNING_DEADLINE_HOUR,
    evening: hour >= AFTERNOON_START_HOUR && hour < CHILD_EVENING_DEADLINE_HOUR,
  };
}

export function normalizeTimeWindow(taskWindow: string | null | undefined): TaskTimeWindow {
  if (taskWindow === 'morning' || taskWindow === 'evening' || taskWindow === 'both') {
    return taskWindow;
  }
  return 'evening';
}

export function isTaskActiveInTimeWindow(
  taskWindow: string | null | undefined,
  currentWindow: TimeWindow,
): boolean {
  const normalized = normalizeTimeWindow(taskWindow);
  return normalized === 'both' || normalized === currentWindow;
}

export function taskWindowSortRank(taskWindow: string | null | undefined): number {
  return TIME_WINDOW_ORDER[normalizeTimeWindow(taskWindow)] ?? 99;
}

export function getCompletionWindowStart(
  dayStart: Date,
  taskWindow: string | null | undefined,
  currentWindow?: TimeWindow,
): Date {
  const start = new Date(dayStart);
  const normalized = normalizeTimeWindow(taskWindow);
  const effectiveWindow = normalized === 'both' ? currentWindow ?? getCurrentTimeWindow() : normalized;
  if (effectiveWindow === 'evening') {
    start.setHours(AFTERNOON_START_HOUR, 0, 0, 0);
  }
  return start;
}

export function getCompletionWindowEnd(
  dayStart: Date,
  taskWindow: string | null | undefined,
  currentWindow?: TimeWindow,
): Date {
  const end = new Date(dayStart);
  const normalized = normalizeTimeWindow(taskWindow);
  const effectiveWindow = normalized === 'both' ? currentWindow ?? getCurrentTimeWindow() : normalized;
  if (effectiveWindow === 'morning') {
    end.setHours(AFTERNOON_START_HOUR, 0, 0, 0);
  } else {
    end.setDate(end.getDate() + 1);
  }
  return end;
}

export function getTimeWindowLabel(
  taskWindow: TaskTimeWindow | null | undefined,
  lang: TimeWindowLang,
): string {
  const normalized = normalizeTimeWindow(taskWindow);
  if (normalized === 'both') {
    return lang === 'en' ? 'Morning + afternoon / evening' : '오전 + 오후·저녁';
  }
  return normalized === 'morning'
    ? (lang === 'en' ? 'Morning' : '오전')
    : (lang === 'en' ? 'Afternoon / evening' : '오후·저녁');
}

export function getTimeWindowRange(
  taskWindow: TaskTimeWindow | null | undefined,
  childDeadlines = false,
): string {
  const normalized = normalizeTimeWindow(taskWindow);
  const morning = childDeadlines ? '00:00-08:59' : '00:00-11:59';
  const evening = childDeadlines ? '12:00-20:59' : '12:00-23:59';
  if (normalized === 'both') return `${morning} + ${evening}`;
  return normalized === 'morning' ? morning : evening;
}

export function getTimeWindowDisplay(
  taskWindow: TaskTimeWindow | null | undefined,
  lang: TimeWindowLang,
  childDeadlines = false,
): string {
  return `${getTimeWindowLabel(taskWindow, lang)} ${getTimeWindowRange(taskWindow, childDeadlines)}`;
}
