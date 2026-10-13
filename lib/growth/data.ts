import { createBrowserSupabase } from '@/lib/supabase';
import type { GrowthCompletion, GrowthMemory, GrowthTask } from './model';

// Supabase caps result sizes. Every history query is paginated with a stable ID
// order so a large family never silently loses older effort.
export async function readPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 500) return all;
  }
}
export async function loadGrowthData(familyId: string, memberIds: string[], now: Date) {
  const db = createBrowserSupabase();
  if (!memberIds.length) return { tasks: [] as GrowthTask[], completions: [] as GrowthCompletion[] };
  const [tasks, completions] = await Promise.all([
    readPages<GrowthTask>((from, to) => db.from('tasks').select('id,user_id,title').eq('family_id', familyId).in('user_id', memberIds).order('id').range(from, to)),
    readPages<GrowthCompletion>((from, to) => db.from('task_completions').select('id,user_id,task_id,completed_at,partial').in('user_id', memberIds).lte('completed_at', now.toISOString()).order('id').range(from, to)),
  ]);
  return { tasks, completions };
}
export function loadMemories(familyId: string) {
  const db = createBrowserSupabase();
  return readPages<GrowthMemory>((from, to) => db.from('growth_memories').select('id,family_id,author_id,memory_date,body,created_at').eq('family_id', familyId).order('id').range(from, to));
}
