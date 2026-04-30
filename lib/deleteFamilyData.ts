'use client';

import { createBrowserSupabase } from './supabase';

export async function deleteCurrentFamilyData(): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase.rpc('admin_delete_current_family_data');
  if (error) throw error;
}
