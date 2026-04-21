import { createBrowserSupabase } from './supabase';

export async function resetAllProgress(): Promise<void> {
  const supabase = createBrowserSupabase();
  const { data: users } = await supabase.from('users').select('id');

  await Promise.all([
    supabase.from('task_completions').delete().gt('completed_at', '2000-01-01T00:00:00Z'),
    supabase.from('streaks').delete().gt('id', ''),
  ]);

  if (users?.length) {
    await supabase.from('levels').upsert(
      users.map(u => ({
        user_id: u.id,
        current_level: 1,
        total_points: 0,
        updated_at: new Date().toISOString(),
      }))
    );
  }
}
