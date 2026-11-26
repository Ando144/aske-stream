import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStatsRepo } from '../src/stats/repo';
import { setStatsRepo, useStats } from '../src/stores/stats';

const h = vi.hoisted(() => ({
  prefs: new Map<string, unknown>(),
  uploadStats: vi.fn(async () => undefined),
}));

vi.mock('../src/lib/storage', () => ({
  loadValue: (key: string, fallback: unknown) => h.prefs.get(key) ?? fallback,
  savePref: (key: string, value: unknown) => h.prefs.set(key, value),
}));
vi.mock('../src/stores/ui', () => ({ toast: vi.fn() }));
vi.mock('../src/i18n', () => ({ t: (key: string) => key }));
vi.mock('../src/hub/groupsClient', () => ({ uploadStats: h.uploadStats }));

import { syncGroupStats } from '../src/groups/sync';
import { useGroups } from '../src/stores/groups';

const group = { id: 'g1', name: 'Friends', members: 2, isOwner: true, photoAt: null };
const HOUR = 3600_000;

beforeEach(async () => {
  h.prefs.clear();
  h.uploadStats.mockClear();
  const repo = memoryStatsRepo();
  setStatsRepo(repo);
  await repo.put({
    id: 'r1',
    trackId: 'a',
    title: 'Song',
    artist: 'Band',
    album: '',
    startedAt: Date.now(),
    listenedSec: 120,
    durationSec: 180,
    skipped: false,
  });
  useStats.setState({ consent: 'on' });
  useGroups.setState({ consent: 'on', groups: [group] });
});

describe('syncGroupStats', () => {
  it('uploads the first time', async () => {
    await syncGroupStats();
    expect(h.uploadStats).toHaveBeenCalledTimes(1);
    expect(h.prefs.get('groups-last-sync')).toBeTypeOf('number');
  });

  it.each([
    ['sharing off', () => useGroups.setState({ consent: 'off' })],
    ['no groups', () => useGroups.setState({ groups: [] })],
    ['Recap off', () => useStats.setState({ consent: 'off' })],
  ])('uploads nothing with %s', async (_name, change) => {
    change();
    await syncGroupStats();
    expect(h.uploadStats).not.toHaveBeenCalled();
  });

  it('respects the 6 hour throttle', async () => {
    h.prefs.set('groups-last-sync', Date.now() - 5 * HOUR);
    await syncGroupStats();
    expect(h.uploadStats).not.toHaveBeenCalled();
    h.prefs.set('groups-last-sync', Date.now() - 7 * HOUR);
    await syncGroupStats();
    expect(h.uploadStats).toHaveBeenCalledTimes(1);
  });

  it('forces only after 15 minutes', async () => {
    h.prefs.set('groups-last-sync', Date.now() - 5 * 60_000);
    await syncGroupStats({ force: true });
    expect(h.uploadStats).not.toHaveBeenCalled();
    h.prefs.set('groups-last-sync', Date.now() - 20 * 60_000);
    await syncGroupStats({ force: true });
    expect(h.uploadStats).toHaveBeenCalledTimes(1);
  });

  it('does not stamp the sync when the upload fails', async () => {
    h.uploadStats.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await syncGroupStats();
    expect(h.prefs.has('groups-last-sync')).toBe(false);
  });
});
