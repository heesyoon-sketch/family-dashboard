export function parsePenaltyPauseSetting(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as { enabled?: unknown };
    return Boolean(parsed?.enabled);
  } catch {
    return false;
  }
}
