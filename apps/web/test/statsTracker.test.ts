import { describe, expect, it, vi } from 'vitest';
import type { PlayerSample } from '../src/stats/listen';
import type { PlayRecord } from '../src/stats/recap';
import { memoryStatsRepo } from '../src/stats/repo';
import { createListenTracker, type TrackInfo } from '../src/stats/tracker';

vi.mock('../src/stores/library', () => ({ useLibrary: {} }));
vi.mock('../src/stores/player', () => ({ usePlayer: {} }));
vi.mock('../src/stores/stats', () => ({ useStats: {}, getStatsRepo: () => ({}) }));

const SONG: TrackInfo = { title: 'Song', artist: 'Band', album: 'LP', durationSec: 180 };

function setup(opts: { enabled?: boolean; info?: TrackInfo | null } = {}) {
  const repo = memoryStatsRepo();
  const puts: PlayRecord[] = [];
  const put = repo.put.bind(repo);
  repo.put = async (r) => {
    puts.push({ ...r });
    await put(r);
  };
  let n = 0;
  const tracker = createListenTracker({
    repo,
    isEnabled: () => opts.enabled ?? true,
    lookupTrack: () => (opts.info === undefined ? SONG : opts.info),
    newId: () => `id${++n}`,
  });
  let now = 1_000_000;
  /** Plays `seconds` of `trackId` from `from`, one sample per second. */
  function play(trackId: string | null, seconds: number, from = 0, playing = true) {
    for (let i = 0; i <= seconds; i++) {
      tracker.onSample(sample(trackId, from + i, playing));
    }
  }
  function sample(trackId: string | null, position: number, isPlaying = true): PlayerSample {
    now += 1000;
    return { trackId, isPlaying, position, durationSec: 180, now };
  }
  const latest = () => [...new Map(puts.map((p) => [p.id, p])).values()];
  return { tracker, puts, latest, play, sample };
}

describe('listen tracker', () => {
  it('saves nothing when consent is not on', () => {
    const { tracker, puts, play } = setup({ enabled: false });
    play('a', 300);
    tracker.flush();
    expect(puts).toHaveLength(0);
  });

  it('saves a counted listen with its metadata', () => {
    const { tracker, latest, play } = setup();
    play('a', 40);
    tracker.flush();
    const [r] = latest();
    expect(latest()).toHaveLength(1);
    expect(r).toMatchObject({ title: 'Song', artist: 'Band', skipped: false });
    expect(r!.listenedSec).toBeGreaterThanOrEqual(30);
    expect(r!.listenedSec).toBeCloseTo(40, 0);
  });

  it('saves a skip when changing song before the threshold', () => {
    const { latest, play } = setup();
    play('a', 10);
    play('b', 0);
    expect(latest()).toHaveLength(1);
    expect(latest()[0]).toMatchObject({ skipped: true, trackId: 'a' });
    expect(latest()[0]!.listenedSec).toBeCloseTo(10, 0);
  });

  it('ignores listens under one second', () => {
    const { tracker, puts, sample } = setup();
    tracker.onSample(sample('a', 0));
    tracker.onSample(sample('a', 0.5));
    tracker.onSample(sample('b', 0));
    expect(puts).toHaveLength(0);
  });

  it('does not save an uncounted session on pagehide', () => {
    const { tracker, puts, play } = setup();
    play('a', 10);
    tracker.flush();
    expect(puts).toHaveLength(0);
  });

  it('records two listens with repeat one', () => {
    const { latest, play } = setup();
    play('a', 40, 150); // reaches the end region: 150..190 is clamped by the player
    play('a', 40, 0);
    expect(latest()).toHaveLength(2);
  });

  it('records nothing for podcasts or radio', () => {
    const podcast = setup({ info: null });
    podcast.play('a', 100);
    const radio = setup();
    radio.play(null, 100);
    expect(podcast.puts).toHaveLength(0);
    expect(radio.puts).toHaveLength(0);
  });

  it('refreshes the record every 15 s and on pause', () => {
    const { puts, play, sample, tracker } = setup();
    play('a', 31);
    const before = puts.length;
    play('a', 20, 31);
    expect(puts.length).toBeGreaterThan(before);
    const afterPlay = puts.length;
    tracker.onSample(sample('a', 52, false));
    expect(puts.length).toBe(afterPlay + 1);
  });

  it('warns instead of throwing when saving fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { tracker, sample } = setup();
    const failing = createListenTracker({
      repo: {
        put: () => Promise.reject(new Error('boom')),
        listBetween: async () => [],
        clear: async () => {},
      },
      isEnabled: () => true,
      lookupTrack: () => SONG,
      newId: () => 'x',
    });
    for (let i = 0; i <= 31; i++) failing.onSample(sample('a', i));
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(tracker).toBeDefined();
  });
});
