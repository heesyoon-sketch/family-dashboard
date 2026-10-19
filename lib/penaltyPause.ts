export function parsePenaltyPauseSetting(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as { enabled?: unknown };
    return Boolean(parsed?.enabled);
  } catch {
    return false;
  }
}

// Family-wide switch for the routine deadline penalty. Missing or malformed
// settings mean "on", matching the server's routine_penalty_enabled().
export function parseRoutinePenaltySetting(value: string | null | undefined): boolean {
  if (!value) return true;
  try {
    const parsed = JSON.parse(value) as { enabled?: unknown };
    return typeof parsed?.enabled === 'boolean' ? parsed.enabled : true;
  } catch {
    return true;
  }
}
