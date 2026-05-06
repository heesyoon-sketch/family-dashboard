export type TimeWindow = 'morning' | 'afternoon' | 'evening';
export type TimeWindowLang = 'ko' | 'en';

export const TIME_WINDOW_ORDER: Record<TimeWindow, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
};

export function getCurrentTimeWindow(date = new Date()): TimeWindow {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function isTaskActiveInTimeWindow(
  taskWindow: string | null | undefined,
  currentWindow: TimeWindow,
): boolean {
  return !taskWindow || taskWindow === currentWindow;
}

export function taskWindowSortRank(taskWindow: string | null | undefined): number {
  if (!taskWindow) return -1;
  return TIME_WINDOW_ORDER[taskWindow as TimeWindow] ?? 99;
}

export function getCompletionWindowStart(dayStart: Date, taskWindow: string | null | undefined): Date {
  const start = new Date(dayStart);
  if (taskWindow === 'afternoon') {
    start.setHours(12, 0, 0, 0);
  } else if (taskWindow === 'evening') {
    start.setHours(18, 0, 0, 0);
  }
  return start;
}

export function getTimeWindowLabel(
  taskWindow: TimeWindow | null | undefined,
  lang: TimeWindowLang,
): string {
  if (!taskWindow) return lang === 'en' ? 'All day' : '종일';
  if (taskWindow === 'morning') return lang === 'en' ? 'Morning' : '오전';
  if (taskWindow === 'afternoon') return lang === 'en' ? 'Afternoon' : '오후';
  return lang === 'en' ? 'Evening' : '저녁';
}

export function getTimeWindowRange(taskWindow: TimeWindow | null | undefined): string {
  if (!taskWindow) return '00:00-23:59';
  if (taskWindow === 'morning') return '00:00-11:59';
  if (taskWindow === 'afternoon') return '12:00-17:59';
  return '18:00-23:59';
}

export function getTimeWindowDisplay(
  taskWindow: TimeWindow | null | undefined,
  lang: TimeWindowLang,
): string {
  return `${getTimeWindowLabel(taskWindow, lang)} ${getTimeWindowRange(taskWindow)}`;
}
