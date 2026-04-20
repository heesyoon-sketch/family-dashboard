import { db } from './db';
import { createBrowserSupabase } from './supabase';

const MIGRATION_FLAG = 'supabase_migrated_v1';

export async function migrateToSupabase(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  try {
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [users, tasks, completions, streaks, badges, userBadges, levels] = await Promise.all([
      db.users.toArray(),
      db.tasks.toArray(),
      db.taskCompletions.toArray(),
      db.streaks.toArray(),
      db.badges.toArray(),
      db.userBadges.toArray(),
      db.levels.toArray(),
    ]);

    if (!users.length) {
      localStorage.setItem(MIGRATION_FLAG, '1');
      return;
    }

    await supabase.from('users').upsert(users.map(r => ({
      id: r.id, name: r.name, role: r.role, theme: r.theme,
      avatar_url: r.avatarUrl ?? null, pin_hash: r.pinHash ?? null,
      created_at: r.createdAt.toISOString(),
    })));

    if (tasks.length) {
      await supabase.from('tasks').upsert(tasks.map(r => ({
        id: r.id, user_id: r.userId, code: r.code ?? null,
        title: r.title, icon: r.icon, difficulty: r.difficulty,
        base_points: r.basePoints, recurrence: r.recurrence,
        time_window: r.timeWindow ?? null, active: r.active, sort_order: r.sortOrder,
      })));
    }

    if (completions.length) {
      const CHUNK = 500;
      for (let i = 0; i < completions.length; i += CHUNK) {
        await supabase.from('task_completions').upsert(
          completions.slice(i, i + CHUNK).map(r => ({
            id: r.id, user_id: r.userId, task_id: r.taskId,
            completed_at: new Date(r.completedAt).toISOString(),
            points_awarded: r.pointsAwarded, partial: r.partial,
            forgiveness_used: r.forgivenessUsed,
          }))
        );
      }
    }

    if (streaks.length) {
      await supabase.from('streaks').upsert(streaks.map(r => ({
        id: r.id, user_id: r.userId, task_id: r.taskId,
        current: r.current, longest: r.longest,
        last_completed_at: r.lastCompletedAt?.toISOString() ?? null,
        forgiveness_used_at: r.forgivenessUsedAt?.toISOString() ?? null,
      })));
    }

    if (badges.length) {
      await supabase.from('badges').upsert(badges.map(r => ({
        id: r.id, code: r.code, name: r.name, description: r.description,
        icon: r.icon, category: r.category, condition_json: r.conditionJson, active: r.active,
      })));
    }

    if (userBadges.length) {
      await supabase.from('user_badges').upsert(userBadges.map(r => ({
        id: r.id, user_id: r.userId, badge_id: r.badgeId,
        earned_at: new Date(r.earnedAt).toISOString(),
      })));
    }

    if (levels.length) {
      await supabase.from('levels').upsert(levels.map(r => ({
        user_id: r.userId, current_level: r.currentLevel,
        total_points: r.totalPoints, updated_at: new Date(r.updatedAt).toISOString(),
      })));
    }

    localStorage.setItem(MIGRATION_FLAG, '1');
  } catch (e) {
    console.error('Migration failed, will retry next login:', e);
  }
}
