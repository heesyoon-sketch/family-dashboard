'use client';

import { createBrowserSupabase } from './supabase';

export async function deleteCurrentFamilyData(): Promise<void> {
  const supabase = createBrowserSupabase();

  const { data: familyId, error: familyErr } = await supabase.rpc('get_my_family_id');
  if (familyErr) throw familyErr;
  if (!familyId) throw new Error('No family found');

  const { data: parentAllowed, error: parentErr } = await supabase.rpc('is_my_family_parent');
  if (parentErr) throw parentErr;
  if (!parentAllowed) throw new Error('Parent admin access required');

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const [{ data: users, error: usersErr }, { data: rewards, error: rewardsErr }] = await Promise.all([
    supabase.from('users').select('id, auth_user_id').eq('family_id', familyId),
    supabase.from('rewards').select('id').eq('family_id', familyId),
  ]);
  if (usersErr) throw usersErr;
  if (rewardsErr) throw rewardsErr;

  const userIds = (users ?? []).map(row => row.id);
  const rewardIds = (rewards ?? []).map(row => row.id);
  const currentProfileId = (users ?? []).find(row => row.auth_user_id === authUser.id)?.id;
  const deletableUserIds = userIds.filter(id => id !== currentProfileId);

  if (userIds.length > 0) {
    const childDeletes = await Promise.all([
      supabase.from('task_completions').delete().in('user_id', userIds),
      supabase.from('streaks').delete().in('user_id', userIds),
      supabase.from('levels').delete().in('user_id', userIds),
      supabase.from('user_badges').delete().in('user_id', userIds),
      supabase.from('reward_redemptions').delete().in('user_id', userIds),
    ]);
    const childError = childDeletes.find(result => result.error)?.error;
    if (childError) throw childError;
  }

  if (rewardIds.length > 0) {
    const { error } = await supabase.from('reward_redemptions').delete().in('reward_id', rewardIds);
    if (error) throw error;
  }

  const directDeletes = await Promise.all([
    supabase.from('tasks').delete().eq('family_id', familyId),
    supabase.from('rewards').delete().eq('family_id', familyId),
    supabase.from('family_settings').delete().eq('family_id', familyId),
  ]);
  const directError = directDeletes.find(result => result.error)?.error;
  if (directError) throw directError;

  if (deletableUserIds.length > 0) {
    const { error } = await supabase.from('users').delete().in('id', deletableUserIds);
    if (error) throw error;
  }

  const { error: familyDeleteErr } = await supabase
    .from('families')
    .delete()
    .eq('id', familyId);
  if (familyDeleteErr) throw familyDeleteErr;
}
