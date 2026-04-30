import { createBrowserSupabase } from './supabase';

export async function resetAllProgress(): Promise<void> {
  const supabase = createBrowserSupabase();

  const { error } = await supabase.rpc('admin_reset_family_progress');
  if (error) throw error;
}
