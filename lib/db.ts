export type UserRole = 'PARENT' | 'CHILD';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ThemeName = 'dark_minimal' | 'warm_minimal' | 'robot_neon' | 'pastel_cute';

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
  pinHash?: string;
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
  recurrence: string;
  timeWindow?: 'morning' | 'afternoon' | 'evening';
  active: number; // 0 | 1
  sortOrder: number;
}

export interface TaskCompletion {
  id: string;
  userId: string;
  taskId: string;
  completedAt: Date;
  pointsAwarded: number;
  partial: boolean;
  forgivenessUsed: boolean;
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
