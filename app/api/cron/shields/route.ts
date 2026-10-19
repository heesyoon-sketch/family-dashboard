import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { runShieldFinalization } from '@/lib/shields/finalize';

// Vercel Cron calls this once a day (vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET`; anything else is rejected. The run is
// idempotent, so a retry or a manual call never creates a second award.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: 'server not configured' }, { status: 500 });
  }
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // The daily snapshot normally comes from pg_cron; capturing here too covers
  // a missed hourly run (the function is idempotent per member and day).
  const capture = await db.rpc('capture_shield_daily_schedules');
  if (capture.error) console.error('[shields cron] snapshot capture failed', capture.error.message);

  const reports = await runShieldFinalization(db);
  const failures = reports.filter(r => r.errors.length > 0);
  for (const r of failures) console.error('[shields cron] family', r.familyId, r.errors);
  return NextResponse.json({
    ok: failures.length === 0,
    families: reports.length,
    evaluated: reports.reduce((n, r) => n + r.evaluated, 0),
    awarded: reports.reduce((n, r) => n + r.awarded, 0),
    autoEquipped: reports.reduce((n, r) => n + r.autoEquipped, 0),
    failures: failures.length,
  }, { status: failures.length ? 207 : 200 });
}
