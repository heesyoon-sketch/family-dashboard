import { BadgeCondition } from '../db';
import { createBrowserSupabase } from '../supabase';

export async function evaluateCondition(
  userId: string,
  cond: BadgeCondition,
): Promise<boolean> {
  const supabase = createBrowserSupabase();

  switch (cond.type) {
    case 'streak': {
      const { data: tasks } = await supabase.from('tasks')
        .select('streak_count').eq('user_id', userId).eq('code', cond.taskCode);
      return (tasks?.[0]?.streak_count ?? 0) >= cond.days;
    }

    case 'points_total': {
      const { data } = await supabase.from('levels')
        .select('total_points').eq('user_id', userId).single();
      return (data?.total_points ?? 0) >= cond.threshold;
    }

    case 'monthly_rate': {
      const { data: tasks } = await supabase.from('tasks')
        .select('id').eq('user_id', userId).eq('code', cond.taskCode);
      const task = tasks?.[0];
      if (!task) return false;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysInMonthSoFar = Math.floor((now.getTime() - monthStart.getTime()) / 86400000) + 1;
      if (daysInMonthSoFar < 7) return false;
      const { count } = await supabase.from('task_completions')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', task.id)
        .gte('completed_at', monthStart.toISOString())
        .lte('completed_at', now.toISOString());
      return ((count ?? 0) / daysInMonthSoFar) * 100 >= cond.percent;
    }

    case 'monthly_count': {
      const { data: tasks } = await supabase.from('tasks')
        .select('id').eq('user_id', userId).eq('code', cond.taskCode);
      const task = tasks?.[0];
      if (!task) return false;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const { count } = await supabase.from('task_completions')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', task.id)
        .gte('completed_at', monthStart.toISOString())
        .lte('completed_at', now.toISOString());
      return (count ?? 0) >= cond.count;
    }
  }
}
