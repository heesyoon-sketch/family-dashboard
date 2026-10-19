import { addDays, TIER_RANK, zonedDayHour, type ShieldTier } from './engine';

/** Four completed equipment weeks; this week's active Shields are shown above. */
export function recentShieldWeeks<A extends { equipment_month: string; tier: ShieldTier }, E extends { unlockedAt: string }>(
  awards: readonly A[], earlier: readonly E[], currentWeek: string, timezone: string,
) {
  const datedEarlier = earlier.flatMap(shield => {
    const at = new Date(shield.unlockedAt);
    return Number.isFinite(at.getTime()) ? [{ shield, day: zonedDayHour(at, timezone).day }] : [];
  });
  return [1, 2, 3, 4].map(weeksAgo => {
    const start = addDays(currentWeek, -7 * weeksAgo);
    const end = addDays(start, 6);
    return {
      start,
      awards: awards.filter(a => a.equipment_month === start).sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier]),
      earlier: datedEarlier.filter(s => s.day >= start && s.day <= end).map(s => s.shield),
    };
  }).filter(week => week.awards.length > 0 || week.earlier.length > 0);
}
