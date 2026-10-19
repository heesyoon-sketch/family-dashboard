// Shields — server-side weekly finalization (cron route only, service role).
//
// For every family, finalize_due_shield_weeks evaluates each ended week that
// has no evaluation yet (Morning / Evening / Bonus Shields, computed in
// Postgres from schedule snapshots) and equips last week's Shields for the
// current week. It is idempotent: a repeat run writes nothing.
//
// Nothing before the first snapshot is ever evaluated, so no historical
// award is fabricated from reconstructed schedules.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface FamilyRunReport {
  familyId: string;
  evaluated: number;
  awarded: number;
  autoEquipped: number;
  errors: string[];
}

export async function finalizeFamily(db: SupabaseClient, familyId: string): Promise<FamilyRunReport> {
  const report: FamilyRunReport = { familyId, evaluated: 0, awarded: 0, autoEquipped: 0, errors: [] };
  const { data, error } = await db.rpc('finalize_due_shield_weeks', { p_family_id: familyId });
  if (error) {
    report.errors.push(`weekly shields: ${error.message}`);
    return report;
  }
  for (const week of (data as { weeks?: Array<{ evaluated: number; awarded: number; equipped: number }> } | null)?.weeks ?? []) {
    report.evaluated += week.evaluated;
    report.awarded += week.awarded;
    report.autoEquipped += week.equipped;
  }
  return report;
}

export async function runShieldFinalization(db: SupabaseClient): Promise<FamilyRunReport[]> {
  const { data: families, error } = await db.from('families').select('id');
  if (error) throw new Error(`families: ${error.message}`);
  // Tidy last week's open equipment rows. Bonuses never depend on this:
  // the database only applies Shields whose equipment week is the current one.
  const closed = await db.rpc('close_expired_shield_equipment');
  if (closed.error) console.error('[shields cron] close expired equipment failed', closed.error.message);
  const reports: FamilyRunReport[] = [];
  for (const family of families ?? []) reports.push(await finalizeFamily(db, family.id));
  return reports;
}
