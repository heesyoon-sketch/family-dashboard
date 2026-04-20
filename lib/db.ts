import Dexie, { Table } from 'dexie';

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
  active: number;  // Dexie boolean index limitation → 0/1
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
  updatedAt: Date;
}

export class FamilyDB extends Dexie {
  users!: Table<User, string>;
  tasks!: Table<Task, string>;
  taskCompletions!: Table<TaskCompletion, string>;
  streaks!: Table<Streak, string>;
  badges!: Table<Badge, string>;
  userBadges!: Table<UserBadge, string>;
  levels!: Table<Level, string>;

  constructor() {
    super('FamilyDashboardDB');
    this.version(1).stores({
      users:           'id, role',
      tasks:           'id, userId, [userId+code], [userId+active], sortOrder',
      taskCompletions: 'id, [userId+completedAt], [taskId+completedAt]',
      streaks:         'id, [userId+taskId], userId',
      badges:          'id, &code, category, active',
      userBadges:      'id, [userId+badgeId], [userId+earnedAt]',
      levels:          'userId',
    });
  }
}

export const db = new FamilyDB();

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}
