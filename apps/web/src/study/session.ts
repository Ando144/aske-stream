export type StudySource = { kind: 'library' } | { kind: 'calm' } | { kind: 'playlist'; id: string };

export interface StudySession {
  id: string;
  startedAt: number;
  endsAt: number;
  plannedMin: number;
  source: StudySource;
}

export const STUDY_PRESETS_MIN = [15, 25, 45, 60, 90] as const;
export const STUDY_MIN_MIN = 5;
export const STUDY_MAX_MIN = 240;
export const FADE_MS = 8000;
export const DUCK_LEVEL = 0.25;
export const CHIME_TOTAL_MS = 6600;

const DEFAULT_MIN = 25;
const MINUTE_MS = 60_000;

export function clampStudyMinutes(m: number): number {
  if (!Number.isFinite(m)) return DEFAULT_MIN;
  return Math.min(STUDY_MAX_MIN, Math.max(STUDY_MIN_MIN, Math.round(m)));
}

export function createSession(
  now: number,
  minutes: number,
  source: StudySource,
  id: string,
): StudySession {
  const plannedMin = clampStudyMinutes(minutes);
  return { id, startedAt: now, endsAt: now + plannedMin * MINUTE_MS, plannedMin, source };
}

export function remainingMs(s: StudySession, now: number): number {
  return Math.max(0, s.endsAt - now);
}

/** 1 while studying, fading down to DUCK_LEVEL over the last FADE_MS, DUCK_LEVEL after the end. */
export function musicFactor(s: StudySession, now: number): number {
  const left = s.endsAt - now;
  if (left >= FADE_MS) return 1;
  if (left <= 0) return DUCK_LEVEL;
  return DUCK_LEVEL + (1 - DUCK_LEVEL) * (left / FADE_MS);
}

export function studiedMinutes(s: StudySession, endedAt: number): number {
  const end = Math.min(endedAt, s.endsAt);
  return Math.max(0, Math.floor((end - s.startedAt) / MINUTE_MS));
}

export type RestoreDecision =
  | { kind: 'none' }
  | { kind: 'resume'; session: StudySession }
  | { kind: 'ended'; session: StudySession };

function isSource(v: unknown): v is StudySource {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as { kind?: unknown; id?: unknown };
  if (o.kind === 'library' || o.kind === 'calm') return true;
  return o.kind === 'playlist' && typeof o.id === 'string' && o.id !== '';
}

function asSession(v: unknown): StudySession | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const { id, startedAt, endsAt, plannedMin, source } = o;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return null;
  if (typeof endsAt !== 'number' || !Number.isFinite(endsAt) || endsAt <= startedAt) return null;
  if (typeof plannedMin !== 'number' || !Number.isFinite(plannedMin)) return null;
  if (!isSource(source)) return null;
  return { id, startedAt, endsAt, plannedMin, source };
}

export function restoreDecision(saved: unknown, now: number): RestoreDecision {
  const session = asSession(saved);
  if (!session) return { kind: 'none' };
  return now >= session.endsAt ? { kind: 'ended', session } : { kind: 'resume', session };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}
