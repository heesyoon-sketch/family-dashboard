export function parsePenaltyPauseSetting(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as { enabled?: unknown };
    return Boolean(parsed?.enabled);
  } catch {
    return false;
  }
}

// Members listed here never get the routine (morning/evening) penalty.
export function parseRoutinePenaltyExemptSetting(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as { userIds?: unknown };
    return Array.isArray(parsed?.userIds)
      ? parsed.userIds.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}
