import { describe, expect, it } from 'vitest';
import {
  cycleFor,
  cycleKey,
  insertShuffled,
  MAX_REMEMBERED_CYCLES,
  newSeed,
  rankBySeed,
  recordPlayed,
  rememberCycle,
  reseedAll,
  roundOrder,
  type ShuffleCycle,
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

  it('starts a new round with another seed when every song has been heard', () => {
    const open = { key: 'a', played: ['t0', 't1'], usedAt: 7, seed: 1 };
    const c = recordPlayed(open, 't2', ids(3), seeded(9));
    expect(c).toMatchObject({ key: 'a', played: [], usedAt: 7 });
    expect(c.seed).not.toBe(1);
  });

  it('the last song heard never opens the new round', () => {
    const all = ids(3);
    for (let seed = 1; seed <= 100; seed++) {
      const open = { key: 'a', played: ['t0', 't1'], usedAt: 1 };
      const c = recordPlayed(open, 't2', all, seeded(seed));
      expect(rankBySeed(all, c.seed!)[0]).not.toBe('t2');
    }
  });

  it('keeps the seed while the round is open', () => {
    const c = recordPlayed({ key: 'a', played: [], usedAt: 1, seed: 5 }, 't0', ids(3));
    expect(c.seed).toBe(5);
  });

  it('never resets on an empty list', () => {
    expect(recordPlayed({ key: 'a', played: [], usedAt: 1 }, 'x', []).played).toEqual(['x']);
  });

  it('a song added to the list after the others were heard keeps the cycle open', () => {
    const c = recordPlayed({ key: 'a', played: ['t0', 't1'], usedAt: 1 }, 't0', ids(3));
    expect(c.played).toEqual(['t0', 't1']);
  });
});

describe('newSeed', () => {
  it('is an unsigned 32-bit integer taken from the random source', () => {
    expect(newSeed(() => 0)).toBe(0);
    expect(newSeed(() => 0.5)).toBe(2147483648);
    expect(newSeed(() => 0.9999999999)).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(newSeed())).toBe(true);
  });
});

describe('rankBySeed', () => {
  it('orders by the FNV-1a hash of seed and id', () => {
    const fnv = (text: string) => {
      let h = 0x811c9dc5;
      for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
      return h;
    };
    const expected = ids(12).sort((a, b) => fnv(`7:${a}`) - fnv(`7:${b}`));
    expect(rankBySeed(ids(12), 7)).toEqual(expected);
  });

  it('does not depend on the input order nor mutate it', () => {
    const input = ids(10).reverse();
    expect(rankBySeed(input, 3)).toEqual(rankBySeed(ids(10), 3));
    expect(input).toEqual(ids(10).reverse());
  });

  it('adding a song keeps the relative order of the others', () => {
    const before = rankBySeed(ids(10), 11);
    const after = rankBySeed([...ids(10), 'new'], 11);
    expect(after.filter((id) => id !== 'new')).toEqual(before);
  });

  it('different seeds give different orders', () => {
    expect(rankBySeed(ids(20), 1)).not.toEqual(rankBySeed(ids(20), 2));
  });
});

describe('roundOrder', () => {
  it('plays the unheard songs before the heard ones, both by rank', () => {
    const played = new Set(['t0', 't1', 't2', 't3']);
    const ranked = rankBySeed(ids(10), 4);
    expect(roundOrder(ids(10), null, played, 4)).toEqual([
      ...ranked.filter((id) => !played.has(id)),
      ...ranked.filter((id) => played.has(id)),
    ]);
  });

  it('puts the chosen first song at the head even if already heard', () => {
    const order = roundOrder(ids(5), 't2', new Set(['t2', 't0']), 3);
    expect(order[0]).toBe('t2');
    expect(order[4]).toBe('t0');
    expect(new Set(order).size).toBe(5);
  });

  it('ignores a firstId that is not in the list', () => {
    const order = roundOrder(ids(4), 'zzz', new Set(), 3);
    expect(order).toHaveLength(4);
    expect(order).not.toContain('zzz');
  });

  it('handles empty and single-song lists', () => {
    expect(roundOrder([], null, new Set(), 1)).toEqual([]);
    expect(roundOrder(['a'], null, new Set(['a']), 1)).toEqual(['a']);
  });

  it('every song plays exactly once per round across consecutive rounds', () => {
    const all = ids(7);
    const random = seeded(42);
    let cycle: ShuffleCycle = { key: 'k', played: [], usedAt: 0, seed: 1 };
    let last: string | undefined;
    for (let round = 0; round < 5; round++) {
      const order = roundOrder(all, null, new Set(cycle.played), cycle.seed!);
      expect(order[0]).not.toBe(last);
      for (const id of order) cycle = recordPlayed(cycle, id, all, random);
      last = order[order.length - 1];
      expect([...order].sort()).toEqual([...all].sort());
      expect(cycle.played).toEqual([]);
    }
  });

  it('resumes an interrupted round in the same order', () => {
    const first = roundOrder(ids(8), null, new Set(), 5);
    const second = roundOrder(ids(8), null, new Set(first.slice(0, 3)), 5);
    expect(second).toEqual([...first.slice(3), ...first.slice(0, 3)]);
  });
});

describe('reseedAll', () => {
  it('gives every round a new seed and keeps what was heard', () => {
    const before: ShuffleCycles = {
      a: { key: 'a', played: ['x'], usedAt: 1, seed: 1 },
      b: { key: 'b', played: [], usedAt: 2 },
    };
    const after = reseedAll(before, seeded(8));
    expect(after.a).toMatchObject({ key: 'a', played: ['x'], usedAt: 1 });
    expect(after.a!.seed).not.toBe(1);
    expect(after.b!.seed).toBeDefined();
    expect(before.a!.seed).toBe(1);
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
