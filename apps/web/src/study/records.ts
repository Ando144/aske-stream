const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

export interface StudyRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  plannedMin: number;
  studiedMin: number;
  completed: boolean;
}

export interface StudySummary {
  todayMin: number;
  weekMin: number;
  sessions: number;
  completed: number;
  streakDays: number;
}

/** Local calendar day as an integer, so consecutive days differ by exactly 1 (DST-safe). */
function dayNumber(epochMs: number): number {
  const d = new Date(epochMs);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;
}

function streakEndingNearToday(days: Set<number>, today: number): number {
  let day = days.has(today) ? today : today - 1;
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

export function summarizeStudy(records: StudyRecord[], now: number): StudySummary {
  const today = dayNumber(now);
  const studiedDays = new Set<number>();
  let todayMin = 0;
  let weekMin = 0;
  let completed = 0;
  for (const r of records) {
    const day = dayNumber(r.startedAt);
    if (r.studiedMin > 0) studiedDays.add(day);
    if (day === today) todayMin += r.studiedMin;
    if (day <= today && day > today - WEEK_DAYS) weekMin += r.studiedMin;
    if (r.completed) completed += 1;
  }
  return {
    todayMin,
    weekMin,
    sessions: records.length,
    completed,
    streakDays: streakEndingNearToday(studiedDays, today),
  };
}
