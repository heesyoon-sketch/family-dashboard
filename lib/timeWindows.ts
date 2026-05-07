export type TimeWindow = 'morning' | 'evening';
export type TaskTimeWindow = TimeWindow | 'both';
export type TimeWindowLang = 'ko' | 'en';

export const TIME_WINDOW_ORDER: Record<TaskTimeWindow, number> = {
  morning: 0,
  both: 1,
  evening: 2,
};

export function getCurrentTimeWindow(date = new Date()): TimeWindow {
  const hour = date.getHours();
  if (hour < 13) return 'morning';
  return 'evening';
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
    start.setHours(13, 0, 0, 0);
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
    end.setHours(13, 0, 0, 0);
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

export function getTimeWindowRange(taskWindow: TaskTimeWindow | null | undefined): string {
  const normalized = normalizeTimeWindow(taskWindow);
  if (normalized === 'both') return '00:00-12:59 + 13:00-23:59';
  return normalized === 'morning' ? '00:00-12:59' : '13:00-23:59';
}

export function getTimeWindowDisplay(
  taskWindow: TaskTimeWindow | null | undefined,
  lang: TimeWindowLang,
): string {
  return `${getTimeWindowLabel(taskWindow, lang)} ${getTimeWindowRange(taskWindow)}`;
}
