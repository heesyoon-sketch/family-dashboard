export type TimeWindow = 'morning' | 'evening';
export type TimeWindowLang = 'ko' | 'en';

export const TIME_WINDOW_ORDER: Record<TimeWindow, number> = {
  morning: 0,
  evening: 1,
};

export function getCurrentTimeWindow(date = new Date()): TimeWindow {
  const hour = date.getHours();
  if (hour < 13) return 'morning';
  return 'evening';
}

export function normalizeTimeWindow(taskWindow: string | null | undefined): TimeWindow {
  return taskWindow === 'morning' ? 'morning' : 'evening';
}

export function isTaskActiveInTimeWindow(
  taskWindow: string | null | undefined,
  currentWindow: TimeWindow,
): boolean {
  return normalizeTimeWindow(taskWindow) === currentWindow;
}

export function taskWindowSortRank(taskWindow: string | null | undefined): number {
  return TIME_WINDOW_ORDER[normalizeTimeWindow(taskWindow)] ?? 99;
}

export function getCompletionWindowStart(dayStart: Date, taskWindow: string | null | undefined): Date {
  const start = new Date(dayStart);
  if (normalizeTimeWindow(taskWindow) === 'evening') {
    start.setHours(13, 0, 0, 0);
  }
  return start;
}

export function getTimeWindowLabel(
  taskWindow: TimeWindow | null | undefined,
  lang: TimeWindowLang,
): string {
  return normalizeTimeWindow(taskWindow) === 'morning'
    ? (lang === 'en' ? 'Morning' : '오전')
    : (lang === 'en' ? 'Afternoon / evening' : '오후·저녁');
}

export function getTimeWindowRange(taskWindow: TimeWindow | null | undefined): string {
  return normalizeTimeWindow(taskWindow) === 'morning' ? '00:00-12:59' : '13:00-23:59';
}

export function getTimeWindowDisplay(
  taskWindow: TimeWindow | null | undefined,
  lang: TimeWindowLang,
): string {
  return `${getTimeWindowLabel(taskWindow, lang)} ${getTimeWindowRange(taskWindow)}`;
}
