import { describe, expect, it } from 'vitest';
import {
  insertAfter,
  nextIndex,
  previousIndex,
  reshuffleForNextLap,
  shuffleKeepingFirst,
  withoutTracks,
} from '../src/player/queue';

const ids = Array.from({ length: 50 }, (_, i) => `s${i}`);

describe('shuffle', () => {
  it('is a permutation that keeps the current song first', () => {
    const out = shuffleKeepingFirst(ids, 's17');
    expect(out[0]).toBe('s17');
    expect([...out].sort()).toEqual([...ids].sort());
    expect(out).not.toEqual(ids);
  });

  it('is uniform enough: every song can land in every position', () => {
    const firstSeen = new Set<string>();
    for (let i = 0; i < 2000; i++) firstSeen.add(shuffleKeepingFirst(ids.slice(0, 5), null)[0]!);
    expect(firstSeen.size).toBe(5);
  });

  it('never starts a new lap with the song that just ended', () => {
    for (let i = 0; i < 200; i++) {
      expect(reshuffleForNextLap(ids.slice(0, 3), 's0')[0]).not.toBe('s0');
    }
  });
});

describe('navigation', () => {
  it('stops at the end unless repeat all is on', () => {
    expect(nextIndex(3, 1, 'off')).toBe(2);
    expect(nextIndex(3, 2, 'off')).toBeNull();
    expect(nextIndex(3, 2, 'all')).toBe(0);
    expect(nextIndex(0, 0, 'all')).toBeNull();
  });

  it('wraps backwards only with repeat all', () => {
    expect(previousIndex(3, 0, 'off')).toBe(0);
    expect(previousIndex(3, 0, 'all')).toBe(2);
    expect(previousIndex(3, 2, 'off')).toBe(1);
  });

  it('"play next" inserts after the cursor and removes later duplicates', () => {
    expect(insertAfter(['a', 'b', 'c', 'd'], 1, ['d'])).toEqual(['a', 'b', 'd', 'c']);
    expect(insertAfter(['a', 'b'], 1, ['x', 'y'])).toEqual(['a', 'b', 'x', 'y']);
  });
});

describe('queue editing and data saver', () => {
  it('moves items for drag & drop', async () => {
    const { moveItem } = await import('../src/player/queue');
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a'], 3, 0)).toEqual(['a']);
  });

  it('plays songs available offline first, keeping or shuffling order inside each group', async () => {
    const { orderForDataSaver } = await import('../src/player/queue');
    const local = new Set(['b', 'd']);
    expect(orderForDataSaver(['a', 'b', 'c', 'd'], (id) => local.has(id), false)).toEqual([
      'b',
      'd',
      'a',
      'c',
    ]);
    const shuffledOrder = orderForDataSaver(['a', 'b', 'c', 'd'], (id) => local.has(id), true);
    expect(new Set(shuffledOrder.slice(0, 2))).toEqual(local);
  });
});

describe('withoutTracks', () => {
  const base = {
    currentId: 'c',
    context: ['a', 'b', 'c', 'd'],
    original: ['a', 'b', 'c', 'd'],
    index: 2,
    queue: ['q1', 'q2'],
  };

  it('lowers the index when songs before the cursor are removed', () => {
    const out = withoutTracks(base, new Set(['a']));
    expect(out.context).toEqual(['b', 'c', 'd']);
    expect(out.index).toBe(1);
    expect(out.currentRemoved).toBe(false);
  });

  it('leaves the index on the previous song when the current one is removed', () => {
    const out = withoutTracks(base, new Set(['c']));
    expect(out.context).toEqual(['a', 'b', 'd']);
    expect(out.index).toBe(1);
    expect(out.currentRemoved).toBe(true);
  });

  it('removes from queue and original too', () => {
    const out = withoutTracks(base, new Set(['q1', 'b']));
    expect(out.queue).toEqual(['q2']);
    expect(out.original).toEqual(['a', 'c', 'd']);
    expect(out.index).toBe(1);
  });

  it('keeps the index when the current song came from the queue', () => {
    const out = withoutTracks({ ...base, currentId: 'q1' }, new Set(['q1']));
    expect(out.queue).toEqual(['q2']);
    expect(out.index).toBe(2);
    expect(out.currentRemoved).toBe(true);
  });

  it('returns empty lists when everything is removed', () => {
    const out = withoutTracks(base, new Set(['a', 'b', 'c', 'd', 'q1', 'q2']));
    expect(out.context).toEqual([]);
    expect(out.queue).toEqual([]);
    expect(out.original).toEqual([]);
    expect(out.index).toBeLessThanOrEqual(0);
  });
});
