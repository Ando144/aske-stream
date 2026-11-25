import { create } from 'zustand';
import { t } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { StudyLock, type PinState } from '../native/studyLock';
import { setAmbientLevel, stopAllAmbient, type AmbientId } from '../study/ambient';
import { buildStudyQueue } from '../study/queue';
import type { StudyRecord } from '../study/records';
import { getStudyRepo } from '../study/repo';
import {
  CHIME_TOTAL_MS,
  clampStudyMinutes,
  createSession,
  musicFactor,
  restoreDecision,
  studiedMinutes,
  type StudySession,
  type StudySource,
} from '../study/session';
import { useLibrary } from './library';
import { usePlayer } from './player';
import { useSleepTimer } from './sleepTimer';
import { useStats } from './stats';
import { toast } from './ui';

export type StudyPhase = 'idle' | 'running' | 'done';

type Ambient = Partial<Record<AmbientId, number>>;
interface StudyChoice {
  minutes: number;
  source: StudySource;
}

interface StudyState {
  phase: StudyPhase;
  session: StudySession | null;
  pin: PinState;
  lastResult: { minutes: number; completed: boolean } | null;
  fellBack: boolean;
  ambient: Ambient;
  lastChoice: StudyChoice;
  start: (minutes: number, source: StudySource) => Promise<void>;
  changeSource: (source: StudySource) => void;
  setAmbient: (id: AmbientId, level: number) => void;
  repin: () => Promise<void>;
  giveUp: () => Promise<void>;
  dismissDone: () => void;
}

const SESSION_KEY = 'study-session';
const AMBIENT_KEY = 'study-ambient';
const LAST_KEY = 'study-last';
const VOLUME_KEY = 'study-base-volume';
const PIN_POLL_TICKS = 2;

// Plumbing kept outside zustand: the UI does not render it.
let interval: ReturnType<typeof setInterval> | null = null;
let baseVolume: number | null = null;
let ticks = 0;
let finishing = false;

function reportError(message: string, error: unknown, toastKey?: string) {
  console.error(message, error);
  if (toastKey) toast(t(toastKey as Parameters<typeof t>[0]));
}

function stopTick() {
  if (interval) clearInterval(interval);
  interval = null;
}

function restoreVolume() {
  if (baseVolume === null) return;
  usePlayer.getState().setVolume(baseVolume);
  baseVolume = null;
  savePref(VOLUME_KEY, null);
}

function applyVolume(session: StudySession, now: number) {
  const factor = musicFactor(session, now);
  if (factor >= 1) return;
  const player = usePlayer.getState();
  if (baseVolume === null) {
    baseVolume = player.volume;
    // Kept on disk so a killed app can still give the volume back.
    savePref(VOLUME_KEY, baseVolume);
  }
  player.setVolume(baseVolume * factor);
}

function applyAmbient(levels: Ambient) {
  for (const [id, level] of Object.entries(levels) as [AmbientId, number][]) {
    setAmbientLevel(id, level).catch((e) => console.error('ambient sound failed', e));
  }
}

function queueFor(source: StudySource) {
  const { tracks, order, playlists } = useLibrary.getState();
  const list = order.map((id) => tracks[id]).filter((tr) => !!tr);
  return buildStudyQueue(list, playlists, source);
}

function playQueue(ids: string[], source: StudySource) {
  usePlayer.getState().playTracks(ids, null, {
    shuffle: true,
    context: { label: t('study.queueLabel'), cycleKey: `study:${source.kind}` },
  });
}

async function saveRecord(session: StudySession, now: number, completed: boolean) {
  if (useStats.getState().consent !== 'on') return;
  const record: StudyRecord = {
    id: session.id,
    startedAt: session.startedAt,
    endedAt: Math.min(now, session.endsAt),
    plannedMin: session.plannedMin,
    studiedMin: studiedMinutes(session, now),
    completed,
  };
  try {
    await getStudyRepo().put(record);
  } catch (e) {
    reportError('could not save the study record', e, 'study.err.save');
  }
}

async function releasePin() {
  try {
    await StudyLock.cancelChime();
  } catch (e) {
    reportError('could not cancel the chime', e);
  }
  try {
    await StudyLock.unpin();
  } catch (e) {
    reportError('could not release the pinned screen', e);
  }
}

async function playChime(session: StudySession) {
  try {
    await StudyLock.chimeNow({ endsAt: session.endsAt });
  } catch (e) {
    reportError('could not play the chime', e);
  }
  await new Promise((resolve) => setTimeout(resolve, CHIME_TOTAL_MS));
  usePlayer.getState().pause();
}

async function finish(completed: boolean) {
  const { session } = useStudy.getState();
  if (!session || finishing) return;
  finishing = true;
  try {
    await endSession(session, completed);
  } finally {
    finishing = false;
  }
}

async function endSession(session: StudySession, completed: boolean) {
  stopTick();
  const now = Date.now();
  if (completed) await playChime(session);
  restoreVolume();
  stopAllAmbient();
  await releasePin();
  await saveRecord(session, now, completed);
  savePref(SESSION_KEY, null);
  const minutes = studiedMinutes(session, now);
  useStudy.setState({
    phase: completed ? 'done' : 'idle',
    session: null,
    pin: 'none',
    lastResult: { minutes, completed },
  });
  if (!completed) toast(t('study.gaveUp', { minutes }));
}

function refreshPin() {
  StudyLock.status()
    .then(({ pin }) => useStudy.setState({ pin }))
    .catch((e) => console.error('could not read the pin state', e));
}

function tick() {
  const { session } = useStudy.getState();
  if (!session) return;
  const now = Date.now();
  if (now >= session.endsAt) {
    applyVolume(session, now);
    void finish(true);
    return;
  }
  applyVolume(session, now);
  ticks += 1;
  if (ticks % PIN_POLL_TICKS === 0) refreshPin();
}

function startTick() {
  stopTick();
  ticks = 0;
  interval = setInterval(tick, 1000);
}

async function pinScreen() {
  try {
    await StudyLock.pin();
  } catch (e) {
    reportError('could not pin the screen', e, 'study.err.pin');
  }
}

async function scheduleChime(endsAt: number) {
  try {
    await StudyLock.scheduleChime({ endsAt });
  } catch (e) {
    reportError('could not schedule the chime', e, 'study.err.pin');
  }
}

const DEFAULT_CHOICE: StudyChoice = { minutes: 25, source: { kind: 'library' } };

export const useStudy = create<StudyState>((set, get) => ({
  phase: 'idle',
  session: null,
  pin: 'none',
  lastResult: null,
  fellBack: false,
  ambient: loadValue<Ambient>(AMBIENT_KEY, {}),
  lastChoice: loadValue<StudyChoice>(LAST_KEY, DEFAULT_CHOICE),

  async start(minutes, source) {
    if (get().phase === 'running') return;
    const { ids, fellBack } = queueFor(source);
    if (ids.length === 0) {
      toast(t('study.err.noMusic'));
      return;
    }
    useSleepTimer.getState().cancel();
    playQueue(ids, source);
    const session = createSession(Date.now(), minutes, source, crypto.randomUUID());
    const lastChoice = { minutes: clampStudyMinutes(minutes), source };
    savePref(SESSION_KEY, session);
    savePref(LAST_KEY, lastChoice);
    set({ phase: 'running', session, fellBack, lastChoice, lastResult: null, pin: 'none' });
    applyAmbient(get().ambient);
    startTick();
    await scheduleChime(session.endsAt);
    // The session may have ended (giveUp) while the chime was being scheduled.
    if (get().session?.id !== session.id) {
      await releasePin();
      return;
    }
    await pinScreen();
  },

  changeSource(source) {
    const { session } = get();
    if (!session) return;
    const { ids, fellBack } = queueFor(source);
    if (ids.length === 0) {
      toast(t('study.err.noMusic'));
      return;
    }
    playQueue(ids, source);
    const next = { ...session, source };
    savePref(SESSION_KEY, next);
    savePref(LAST_KEY, { minutes: get().lastChoice.minutes, source });
    set({ session: next, fellBack, lastChoice: { ...get().lastChoice, source } });
  },

  setAmbient(id, level) {
    const ambient = { ...get().ambient, [id]: level };
    savePref(AMBIENT_KEY, ambient);
    set({ ambient });
    applyAmbient({ [id]: level });
  },

  async repin() {
    await pinScreen();
  },

  giveUp: () => finish(false),

  dismissDone() {
    set({ phase: 'idle', lastResult: null });
  },
}));

function restoreSavedVolume(resuming: boolean) {
  const saved = loadValue<number | null>(VOLUME_KEY, null);
  if (typeof saved !== 'number') return;
  if (resuming) {
    baseVolume = saved;
    return;
  }
  usePlayer.getState().setVolume(saved);
  savePref(VOLUME_KEY, null);
}

/** Resumes (or closes) a session saved before the app was reloaded or killed. */
export function restoreStudySession(): void {
  const decision = restoreDecision(loadValue<unknown>(SESSION_KEY, null), Date.now());
  restoreSavedVolume(decision.kind === 'resume');
  if (decision.kind === 'none') return;
  const { session } = decision;
  if (decision.kind === 'resume') {
    useStudy.setState({ phase: 'running', session });
    applyAmbient(useStudy.getState().ambient);
    startTick();
    void pinScreen();
    return;
  }
  const now = Date.now();
  useStudy.setState({
    phase: 'done',
    session: null,
    lastResult: { minutes: studiedMinutes(session, now), completed: true },
  });
  savePref(SESSION_KEY, null);
  void saveRecord(session, now, true).then(releasePin);
}

restoreStudySession();
