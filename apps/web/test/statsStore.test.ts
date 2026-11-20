import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayRecord } from '../src/stats/recap';
import { memoryStatsRepo, type StatsRepo } from '../src/stats/repo';
import { setStatsRepo, useStats } from '../src/stores/stats';

const h = vi.hoisted(() => ({ prefs: new Map<string, unknown>() }));

vi.mock('../src/lib/storage', () => ({
  loadValue: (key: string, fallback: unknown) => h.prefs.get(key) ?? fallback,
  savePref: (key: string, value: unknown) => h.prefs.set(key, value),
}));
vi.mock('../src/stores/ui', () => ({ toast: vi.fn() }));
vi.mock('../src/i18n', () => ({ t: (key: string) => key }));

const record: PlayRecord = {
  id: 'r1',
  trackId: 'a',
  title: 'Song',
  artist: 'Band',
  album: '',
  startedAt: Date.now(),
  listenedSec: 60,
  durationSec: 180,
  skipped: false,
};

let repo: StatsRepo;

beforeEach(async () => {
  h.prefs.clear();
  repo = memoryStatsRepo();
  setStatsRepo(repo);
  useStats.setState({ consent: 'unset' });
  await repo.put(record);
});

describe('stats store', () => {
  it('persists the consent when enabling', async () => {
    expect(await useStats.getState().setEnabled(true)).toBe(true);
    expect(useStats.getState().consent).toBe('on');
    expect(h.prefs.get('stats-consent')).toBe('on');
    expect(await repo.listBetween(0, Infinity)).toHaveLength(1);
  });

  it('disabling persists off and empties the repo', async () => {
    await useStats.getState().setEnabled(true);
    expect(await useStats.getState().setEnabled(false)).toBe(true);
    expect(useStats.getState().consent).toBe('off');
    expect(h.prefs.get('stats-consent')).toBe('off');
    expect(await repo.listBetween(0, Infinity)).toHaveLength(0);
  });

  it('clearHistory keeps the consent', async () => {
    await useStats.getState().setEnabled(true);
    expect(await useStats.getState().clearHistory()).toBe(true);
    expect(useStats.getState().consent).toBe('on');
    expect(await repo.listBetween(0, Infinity)).toHaveLength(0);
  });

  it('returns false on failure and still turns off', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    setStatsRepo({ ...repo, clear: () => Promise.reject(new Error('boom')) });
    await useStats.getState().setEnabled(true);
    expect(await useStats.getState().setEnabled(false)).toBe(false);
    expect(useStats.getState().consent).toBe('off');
    expect(await useStats.getState().clearHistory()).toBe(false);
    error.mockRestore();
  });

  it('loadRecap summarises the period', async () => {
    const now = new Date();
    const summary = await useStats.getState().loadRecap({ kind: 'year', year: now.getFullYear() });
    expect(summary.plays).toBe(1);
  });
});
