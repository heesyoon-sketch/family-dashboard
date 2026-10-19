export function parsePenaltyPauseSetting(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as { enabled?: unknown };
    return Boolean(parsed?.enabled);
  } catch {
    return false;
  }
}

export const DEFAULT_ROUTINE_PENALTY_POINTS = 50;
export const MAX_ROUTINE_PENALTY_POINTS = 1000;

export interface RoutinePenaltySetting {
  enabled: boolean;
  points: number;
}

// Family-wide routine deadline penalty: on/off plus how many spendable points
// a missed deadline costs. Missing or malformed values fall back to "on, 50",
// matching the server's routine_penalty_enabled() / routine_penalty_points().
export function parseRoutinePenaltySetting(value: string | null | undefined): RoutinePenaltySetting {
  const fallback = { enabled: true, points: DEFAULT_ROUTINE_PENALTY_POINTS };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as { enabled?: unknown; points?: unknown };
    const points = typeof parsed?.points === 'number'
      && Number.isInteger(parsed.points)
      && parsed.points >= 1
      && parsed.points <= MAX_ROUTINE_PENALTY_POINTS
      ? parsed.points
      : DEFAULT_ROUTINE_PENALTY_POINTS;
    return { enabled: typeof parsed?.enabled === 'boolean' ? parsed.enabled : true, points };
  } catch {
    return fallback;
  }
}
