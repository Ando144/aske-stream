import { describe, expect, it } from 'vitest';
import {
  planRotation,
  selectSwapOut,
  type OfflineEntry,
  type PlanInput,
} from '../src/offline/planner';

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = 1_800_000_000_000;

/** Deterministic PRNG so the "random" picks are reproducible. */
function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

const tracks = (n: number, minutes = 4) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, durationMs: minutes * MIN }));

const entry = (trackId: string, patch: Partial<OfflineEntry> = {}): OfflineEntry => ({
  trackId,
  mode: 'auto',
  durationMs: 4 * MIN,
  sizeBytes: 3_000_000,
  downloadedAt: NOW - 2 * HOUR,
  listenedAt: null,
  ...patch,
});

const base = (patch: Partial<PlanInput> = {}): PlanInput => ({
  entries: [],
  tracks: tracks(100),
  quotaMs: 60 * MIN,
  rotateAfterMs: 24 * HOUR,
  autoFill: true,
  now: NOW,
  recentlyEvicted: new Map(),
  cooldownMs: 7 * 24 * HOUR,
  protectedIds: new Set(),
  random: seeded(),
  ...patch,
});

const minutesOf = (ids: string[], list = tracks(100)) =>
  ids.reduce((sum, id) => sum + list.find((t) => t.id === id)!.durationMs, 0) / MIN;

describe('planRotation', () => {
  it('fills an empty device up to the quota and never beyond it', () => {
    const plan = planRotation(base());
    expect(minutesOf(plan.download)).toBe(60);
    expect(new Set(plan.download).size).toBe(plan.download.length);
    expect(plan.removeNow).toEqual([]);
  });

  it('counts pinned songs against the quota and never rotates them', () => {
    const pinned = Array.from({ length: 5 }, (_, i) =>
      entry(`t${i}`, { mode: 'pinned', listenedAt: NOW - 100 * HOUR }),
    );
    const plan = planRotation(base({ entries: pinned }));
    expect(minutesOf(plan.download)).toBe(40);
    expect(plan.swapOut).toEqual([]);
    expect(plan.removeNow).toEqual([]);
    expect(plan.download.some((id) => pinned.some((p) => p.trackId === id))).toBe(false);
  });

  it('keeps unheard and recently heard songs, swaps out expired ones', () => {
    const entries = [
      entry('t0'), // never heard
      entry('t1', { listenedAt: NOW - 2 * HOUR }), // heard, still fresh
      entry('t2', { listenedAt: NOW - 30 * HOUR }), // expired
      entry('t3', { listenedAt: NOW - 50 * HOUR }), // expired, older
    ];
    const plan = planRotation(base({ entries }));
    expect(plan.swapOut).toEqual(['t3', 't2']); // oldest listen first
    expect(plan.removeNow).toEqual([]);
    // Budget for replacements excludes the expired songs: 60 - 8 (t0, t1) = 52 min → 13 songs.
    expect(minutesOf(plan.download)).toBe(52);
  });

  it('never touches the song playing now or the next one', () => {
    const entries = [entry('t0', { listenedAt: NOW - 99 * HOUR })];
    const plan = planRotation(base({ entries, protectedIds: new Set(['t0']) }));
    expect(plan.swapOut).not.toContain('t0');
    expect(plan.removeNow).not.toContain('t0');
  });

  it('removes songs that were deleted from the library', () => {
    const plan = planRotation(base({ entries: [entry('gone', { mode: 'pinned' })] }));
    expect(plan.removeNow).toEqual(['gone']);
  });

  it('shrinks immediately when the quota is lowered, keeping unheard songs first', () => {
    const entries = [
      entry('t0', { listenedAt: NOW - HOUR }),
      entry('t1'),
      entry('t2', { listenedAt: NOW - 2 * HOUR }),
      entry('t3'),
    ];
    const plan = planRotation(base({ entries, quotaMs: 8 * MIN }));
    expect(plan.removeNow.sort()).toEqual(['t0', 't2']);
    expect(plan.download).toEqual([]);
  });

  it('avoids songs rotated out recently, unless nothing else is left', () => {
    const lib = tracks(4);
    const recentlyEvicted = new Map([
      ['t0', NOW - HOUR],
      ['t1', NOW - HOUR],
    ]);
    const plan = planRotation(base({ tracks: lib, quotaMs: 8 * MIN, recentlyEvicted }));
    expect(plan.download.sort()).toEqual(['t2', 't3']);

    const tiny = planRotation(
      base({
        tracks: lib,
        entries: [entry('t2'), entry('t3')],
        quotaMs: 16 * MIN,
        recentlyEvicted,
      }),
    );
    expect(tiny.download.sort()).toEqual(['t0', 't1']);
  });

  it('does nothing new when auto-fill is off', () => {
    const entries = [entry('t0', { listenedAt: NOW - 99 * HOUR })];
    const plan = planRotation(base({ entries, autoFill: false }));
    expect(plan).toEqual({ removeNow: [], download: [], swapOut: [] });
  });

  it('keeps the whole library offline when it fits in the quota', () => {
    const lib = tracks(3);
    const entries = lib.map((t) => entry(t.id, { listenedAt: NOW - 99 * HOUR }));
    const plan = planRotation(base({ tracks: lib, entries }));
    expect(plan.download).toEqual([]);
    // Expired, but there is nothing to replace them with: selectSwapOut keeps them.
    expect(selectSwapOut(plan.swapOut, new Map(lib.map((t) => [t.id, t.durationMs])), 0)).toEqual(
      [],
    );
  });
});

describe('selectSwapOut', () => {
  const durations = new Map([
    ['a', 4 * MIN],
    ['b', 4 * MIN],
    ['c', 4 * MIN],
  ]);

  it('only deletes as much as was actually downloaded', () => {
    expect(selectSwapOut(['a', 'b', 'c'], durations, 0)).toEqual([]);
    expect(selectSwapOut(['a', 'b', 'c'], durations, 3 * MIN)).toEqual(['a']);
    expect(selectSwapOut(['a', 'b', 'c'], durations, 8 * MIN)).toEqual(['a', 'b']);
    expect(selectSwapOut(['a', 'b', 'c'], durations, 60 * MIN)).toEqual(['a', 'b', 'c']);
  });
});
