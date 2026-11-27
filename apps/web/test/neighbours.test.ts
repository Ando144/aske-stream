import { describe, expect, it } from 'vitest';
import { nextTrackId, previousTrackId, type QueueView } from '../src/player/neighbours';

const view = (changes: Partial<QueueView> = {}): QueueView => ({
  currentId: 'b',
  queue: [],
  context: ['a', 'b', 'c'],
  index: 1,
  fromQueue: false,
  repeat: 'off',
  contextShuffled: false,
  ...changes,
});

const atEnd = { currentId: 'c', index: 2 } as const;
const atStart = { currentId: 'a', index: 0 } as const;

describe('nextTrackId', () => {
  it('takes the first queued song before the list', () => {
    expect(nextTrackId(view({ queue: ['x', 'y'] }))).toBe('x');
  });

  it('follows the list', () => {
    expect(nextTrackId(view())).toBe('c');
  });

  it('returns to the list after a queued song', () => {
    expect(nextTrackId(view({ currentId: 'x', fromQueue: true }))).toBe('c');
  });

  it('has nothing after the end without repeat all', () => {
    expect(nextTrackId(view(atEnd))).toBeNull();
    expect(nextTrackId(view({ ...atEnd, repeat: 'one' }))).toBeNull();
  });

  it('goes back to the first song with repeat all', () => {
    expect(nextTrackId(view({ ...atEnd, repeat: 'all' }))).toBe('a');
  });

  it('is unknown when the shuffled list will be reshuffled', () => {
    expect(nextTrackId(view({ ...atEnd, repeat: 'all', contextShuffled: true }))).toBeNull();
  });

  it('repeats the only song of a shuffled list with repeat all', () => {
    const single = view({
      currentId: 'a',
      context: ['a'],
      index: 0,
      repeat: 'all',
      contextShuffled: true,
    });
    expect(nextTrackId(single)).toBe('a');
  });

  it('has nothing with an empty list', () => {
    expect(nextTrackId(view({ currentId: null, context: [], index: 0 }))).toBeNull();
  });
});

describe('previousTrackId', () => {
  it('follows the list backwards', () => {
    expect(previousTrackId(view())).toBe('a');
  });

  it('returns to where the list was from a queued song', () => {
    expect(previousTrackId(view({ currentId: 'x', fromQueue: true }))).toBe('b');
  });

  it('has nothing before the first song without repeat all', () => {
    expect(previousTrackId(view(atStart))).toBeNull();
  });

  it('goes to the last song with repeat all', () => {
    expect(previousTrackId(view({ ...atStart, repeat: 'all' }))).toBe('c');
  });

  it('has nothing when it would stay on the same song', () => {
    const single = view({ currentId: 'a', context: ['a'], index: 0, repeat: 'all' });
    expect(previousTrackId(single)).toBeNull();
  });

  it('has nothing without a list, even from a queued song', () => {
    expect(previousTrackId(view({ currentId: 'x', context: [], fromQueue: true }))).toBeNull();
  });
});
