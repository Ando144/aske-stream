import { describe, expect, it } from 'vitest';
import {
  cycleFor,
  cycleKey,
  insertShuffled,
  MAX_REMEMBERED_CYCLES,
  recordPlayed,
  rememberCycle,
  shuffledCycleOrder,
  type ShuffleCycles,
} from '../src/player/shuffleCycle';

/** Deterministic pseudo-random generator (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

describe('cycleKey', () => {
  it('prefers cycleKey, then path, then label', () => {
    expect(cycleKey({ cycleKey: 'k', path: 'p', label: 'l' })).toBe('k');
    expect(cycleKey({ path: 'p', label: 'l' })).toBe('p');
    expect(cycleKey({ label: 'l' })).toBe('l');
  });
  it('uses "none" without context', () => {
    expect(cycleKey(null)).toBe('none');
  });
});

describe('cycleFor / rememberCycle', () => {
  it('returns an empty cycle for an unknown list', () => {
    expect(cycleFor({}, 'a', 5)).toEqual({ key: 'a', played: [], usedAt: 5 });
  });

  it('stores the cycle with the new usedAt', () => {
    const next = rememberCycle({}, { key: 'a', played: ['x'], usedAt: 1 }, 99);
    expect(next.a).toEqual({ key: 'a', played: ['x'], usedAt: 99 });
  });

  it('keeps at most 20 lists and drops the least recently used', () => {
    let cycles: ShuffleCycles = {};
    for (let i = 0; i < MAX_REMEMBERED_CYCLES + 5; i++) {
      cycles = rememberCycle(cycles, { key: `l${i}`, played: ['x'], usedAt: 0 }, i + 1);
    }
    const keys = Object.keys(cycles);
    expect(keys).toHaveLength(MAX_REMEMBERED_CYCLES);
    expect(keys).not.toContain('l0');
    expect(keys).not.toContain('l4');
    expect(keys).toContain('l24');
  });

  it('touching an old list protects it from eviction', () => {
    let cycles: ShuffleCycles = {};
    for (let i = 0; i < MAX_REMEMBERED_CYCLES; i++) {
      cycles = rememberCycle(cycles, { key: `l${i}`, played: [], usedAt: 0 }, i + 1);
    }
    cycles = rememberCycle(cycles, cycleFor(cycles, 'l0', 0), 100);
    cycles = rememberCycle(cycles, { key: 'new', played: [], usedAt: 0 }, 101);
    expect(cycles.l0).toBeDefined();
    expect(cycles.l1).toBeUndefined();
  });

  it('does not mutate the previous map', () => {
    const before: ShuffleCycles = {};
    rememberCycle(before, { key: 'a', played: [], usedAt: 0 }, 1);
    expect(before).toEqual({});
  });
});

describe('recordPlayed', () => {
  it('adds the song once', () => {
    const c = recordPlayed({ key: 'a', played: [], usedAt: 1 }, 't0', ids(3));
    expect(c.played).toEqual(['t0']);
    expect(recordPlayed(c, 't0', ids(3)).played).toEqual(['t0']);
  });

  it('resets the cycle when every song has been heard', () => {
    let c = { key: 'a', played: [] as string[], usedAt: 7 };
    for (const id of ids(3)) c = recordPlayed(c, id, ids(3));
    expect(c).toEqual({ key: 'a', played: [], usedAt: 7 });
  });

  it('never resets on an empty list', () => {
    expect(recordPlayed({ key: 'a', played: [], usedAt: 1 }, 'x', []).played).toEqual(['x']);
  });

  it('a song added to the list after the others were heard keeps the cycle open', () => {
    const c = recordPlayed({ key: 'a', played: ['t0', 't1'], usedAt: 1 }, 't0', ids(3));
    expect(c.played).toEqual(['t0', 't1']);
  });
});

describe('shuffledCycleOrder', () => {
  it('plays the unheard songs before the heard ones', () => {
    const all = ids(10);
    const played = new Set(['t0', 't1', 't2', 't3']);
    for (let seed = 1; seed <= 20; seed++) {
      const order = shuffledCycleOrder(all, null, played, null, seeded(seed));
      expect(order).toHaveLength(10);
      expect(new Set(order).size).toBe(10);
      const firstOld = order.findIndex((id) => played.has(id));
      expect(firstOld).toBe(6);
      expect(order.slice(0, 6).every((id) => !played.has(id))).toBe(true);
    }
  });

  it('puts the chosen first song at the head even if already heard', () => {
    const order = shuffledCycleOrder(ids(5), 't2', new Set(['t2', 't0']), null, seeded(3));
    expect(order[0]).toBe('t2');
    expect(new Set(order).size).toBe(5);
  });

  it('ignores a firstId that is not in the list', () => {
    const order = shuffledCycleOrder(ids(4), 'zzz', new Set(), null, seeded(3));
    expect(order).toHaveLength(4);
    expect(order).not.toContain('zzz');
  });

  it('a new round never opens with the last song that played', () => {
    const all = ids(6);
    for (let seed = 1; seed <= 200; seed++) {
      const order = shuffledCycleOrder(all, null, new Set(all), 't3', seeded(seed));
      expect(order[0]).not.toBe('t3');
      expect([...order].sort()).toEqual([...all].sort());
    }
  });

  it('handles empty and single-song lists', () => {
    expect(shuffledCycleOrder([], null, new Set(), null)).toEqual([]);
    expect(shuffledCycleOrder(['a'], null, new Set(['a']), 'a')).toEqual(['a']);
  });

  it('two-song list that is fully heard starts with the other song', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const order = shuffledCycleOrder(['a', 'b'], null, new Set(['a', 'b']), 'a', seeded(seed));
      expect(order).toEqual(['b', 'a']);
    }
  });

  it('every song plays exactly once per round across consecutive rounds', () => {
    const all = ids(7);
    let cycle = { key: 'k', played: [] as string[], usedAt: 0 };
    let last: string | null = null;
    const random = seeded(42);
    for (let round = 0; round < 5; round++) {
      const order = shuffledCycleOrder(all, null, new Set(cycle.played), last, random);
      const heard: string[] = [];
      for (const id of order) {
        heard.push(id);
        cycle = recordPlayed(cycle, id, all);
        last = id;
      }
      expect([...heard].sort()).toEqual([...all].sort());
      expect(cycle.played).toEqual([]);
    }
  });

  it('resumes an interrupted round without repeating heard songs', () => {
    const all = ids(8);
    const first = shuffledCycleOrder(all, null, new Set(), null, seeded(5));
    const heard = first.slice(0, 3);
    const second = shuffledCycleOrder(all, null, new Set(heard), heard[2]!, seeded(6));
    expect(second.slice(0, 5).some((id) => heard.includes(id))).toBe(false);
  });
});

describe('insertShuffled', () => {
  it('keeps the current song and everything before it untouched', () => {
    const context = ids(6);
    for (let seed = 1; seed <= 50; seed++) {
      const out = insertShuffled(context, 2, ['n1', 'n2', 'n3'], seeded(seed));
      expect(out.slice(0, 3)).toEqual(['t0', 't1', 't2']);
      expect(out).toHaveLength(9);
      expect(out.filter((x) => x.startsWith('t'))).toEqual(context);
    }
  });

  it('inserts at random upcoming positions, not always at the end', () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      positions.add(insertShuffled(ids(8), 0, ['n'], seeded(seed)).indexOf('n'));
    }
    expect(positions.size).toBeGreaterThan(3);
    expect(Math.min(...positions)).toBeGreaterThanOrEqual(1);
  });

  it('returns a copy when nothing is added', () => {
    const context = ids(3);
    const out = insertShuffled(context, 0, []);
    expect(out).toEqual(context);
    expect(out).not.toBe(context);
  });

  it('works when the current song is the last one', () => {
    const out = insertShuffled(['a', 'b'], 1, ['n']);
    expect(out).toEqual(['a', 'b', 'n']);
  });
});
