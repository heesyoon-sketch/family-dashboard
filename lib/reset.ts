import { createBrowserSupabase } from './supabase';

export async function resetAllProgress(): Promise<void> {
  const supabase = createBrowserSupabase();

  const { data: familyId, error: familyErr } = await supabase.rpc('get_my_family_id');
  if (familyErr) throw familyErr;
  if (!familyId) throw new Error('No family found');

  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id')
    .eq('family_id', familyId);
  if (usersErr) throw usersErr;

  const userIds = (users ?? []).map(u => u.id);
  if (userIds.length === 0) return;

  await Promise.all([
    supabase.from('task_completions').delete().in('user_id', userIds),
    supabase.from('streaks').delete().in('user_id', userIds),
  ]);

  await supabase.from('levels').upsert(
    userIds.map(id => ({
      user_id: id,
      current_level: 1,
      total_points: 0,
      spendable_balance: 0,
      updated_at: new Date().toISOString(),
    }))
  );
}
