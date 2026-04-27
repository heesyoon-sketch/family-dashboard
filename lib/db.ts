export type UserRole = 'PARENT' | 'CHILD';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ThemeName = 'dark_minimal' | 'warm_minimal' | 'robot_neon' | 'pastel_cute';
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export const ALL_DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
export const WEEKDAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
export const WEEKEND: DayOfWeek[]  = ['SAT', 'SUN'];

/** Maps JS getDay() index (0=Sun … 6=Sat) → DayOfWeek key */
export const DOW_INDEX: Record<number, DayOfWeek> = {
  0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
};

/** Converts a legacy recurrence string to a daysOfWeek array. */
export function legacyRecurrenceToDays(recurrence: string): DayOfWeek[] {
  if (recurrence === 'weekdays') return [...WEEKDAYS];
  if (recurrence === 'weekend')  return [...WEEKEND];
  return [...ALL_DAYS];
}

export type BadgeCondition =
  | { type: 'streak';        taskCode: string;  days: number }
  | { type: 'points_total';  threshold: number }
  | { type: 'monthly_rate';  taskCode: string;  percent: number }
  | { type: 'monthly_count'; taskCode: string;  count: number };

export interface User {
  id: string;
  name: string;
  role: UserRole;
  theme: ThemeName;
  avatarUrl?: string;
  email?: string;
  pinHash?: string;
  authUserId?: string;
  loginMethod?: 'google' | 'device' | string;
  displayOrder: number;
  createdAt: Date;
}

export interface Task {
  id: string;
  userId: string;
  code?: string;
  title: string;
  icon: string;
  difficulty: Difficulty;
  basePoints: number;
  recurrence: string;      // legacy; kept for backward-compat reads
  daysOfWeek: DayOfWeek[]; // authoritative schedule; derived from recurrence if null in DB
  timeWindow?: 'morning' | 'afternoon' | 'evening';
  active: number; // 0 | 1
  sortOrder: number;
  streakCount: number;
  lastCompletedAt: Date | null;
}

export interface TaskCompletion {
  id: string;
  userId: string;
  taskId: string;
  completedAt: Date;
  pointsAwarded: number;
  partial: boolean;
  forgivenessUsed: boolean;
  streakBefore?: number | null;
  lastCompletedBefore?: Date | null;
}

export interface Streak {
  id: string;
  userId: string;
  taskId: string;
  current: number;
  longest: number;
  lastCompletedAt?: Date;
  forgivenessUsedAt?: Date;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: 'habit' | 'points' | 'event';
  conditionJson: BadgeCondition;
  active: number;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: Date;
}

export interface Level {
  userId: string;
  currentLevel: number;
  totalPoints: number;
  spendableBalance: number;
  updatedAt: Date;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}
