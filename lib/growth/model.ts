/** Calendar arithmetic uses family-local dates, never the viewer's timezone. */
export interface GrowthMember { id: string; name: string }
export interface GrowthTask { id: string; user_id: string; title: string }
export interface GrowthCompletion { id: string; user_id: string; task_id: string; completed_at: string; partial?: boolean | null }
export interface GrowthMemory { id: string; family_id: string; author_id: string; memory_date: string; body: string; created_at: string }
export interface GrowthMoment { id: string; day: string; kind: 'first' | 'milestone' | 'return'; title: string; count?: number }
export function dayInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function shiftDay(day: string, amount: number): string {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10);
}
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); return shiftDay(day, -((weekday + 6) % 7));
}
export function buildGrowth(members: GrowthMember[], tasks: GrowthTask[], input: GrowthCompletion[], now: Date, timezone: string) {
  const today = dayInZone(now, timezone), weekStart = mondayOf(today);
  const previousStart = shiftDay(weekStart, -7), previousEnd = shiftDay(today, -7);
  const memberIds = new Set(members.map(m => m.id));
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const seen = new Set<string>();
  const rows = input.filter(c => {
    if (seen.has(c.id) || !memberIds.has(c.user_id) || c.partial || !Number.isFinite(Date.parse(c.completed_at)) || Date.parse(c.completed_at) > now.getTime()) return false;
    seen.add(c.id); return true;
  }).map(c => ({ ...c, day: dayInZone(new Date(c.completed_at), timezone) })).sort((a, b) => a.completed_at.localeCompare(b.completed_at) || a.id.localeCompare(b.id));
  const people = members.map(member => {
    const history = rows.filter(c => c.user_id === member.id);
    const week = history.filter(c => c.day >= weekStart && c.day <= today);
    const previous = history.filter(c => c.day >= previousStart && c.day <= previousEnd);
    const days = [...new Set(history.map(c => c.day))];
    const habits = new Map<string, { id: string; title: string; total: number; week: number; days: Set<string> }>();
    const moments: GrowthMoment[] = [];
    for (const row of history) {
      const title = taskById.get(row.task_id)?.title ?? '';
      const habit = habits.get(row.task_id) ?? { id: row.task_id, title, total: 0, week: 0, days: new Set<string>() };
      habit.total++; habit.days.add(row.day);
      if (row.day >= weekStart) habit.week++;
      habits.set(row.task_id, habit);
      if ([10, 30, 50, 100, 200, 365, 500, 1000].includes(habit.total)) moments.push({ id: `milestone:${row.id}`, kind: 'milestone', day: row.day, title, count: habit.total });
    }
    if (history.length) moments.push({ id: `first:${member.id}`, kind: 'first', day: history[0].day, title: taskById.get(history[0].task_id)?.title ?? '' });
    for (let i = 1; i < days.length; i++) {
      // Three full calendar days without a recorded completion, then a return.
      if (days[i] > shiftDay(days[i - 1], 3)) moments.push({ id: `return:${member.id}:${days[i]}`, kind: 'return', day: days[i], title: '' });
    }
    const calendar = Array.from({ length: 28 }, (_, i) => {
      const day = shiftDay(today, i - 27); return { day, count: history.filter(c => c.day === day).length };
    });
    return { ...member, total: history.length, activeDays: days.length, week: week.length, previous: previous.length, weekDays: new Set(week.map(c => c.day)).size, habits: [...habits.values()].sort((a, b) => b.week - a.week || b.total - a.total || a.title.localeCompare(b.title)), moments: moments.sort((a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id)), calendar };
  });
  // Matching titles are evidence of the same recorded activity, not proof of
  // physical togetherness. Only explicitly family activities become shared cards.
  const shared = new Map<string, { id: string; title: string; day: string; memberIds: Set<string> }>();
  for (const row of rows) {
    const task = taskById.get(row.task_id);
    if (!task || !/가족|family/i.test(task.title)) continue;
    const normalized = task.title.trim().replace(/\s+/g, ' ').toLowerCase();
    const key = `${row.day}:${normalized}`;
    const item = shared.get(key) ?? { id: key, title: task.title, day: row.day, memberIds: new Set<string>() };
    item.memberIds.add(row.user_id); shared.set(key, item);
  }
  const familyMoments = [...shared.values()].filter(x => x.memberIds.size >= 2).sort((a, b) => b.day.localeCompare(a.day) || a.title.localeCompare(b.title));
  return { today, weekStart, previousStart, previousEnd, people, familyMoments, total: rows.length, firstDay: rows[0]?.day ?? null, weekTotal: people.reduce((n, p) => n + p.week, 0) };
}
