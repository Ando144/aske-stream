import { describe, expect, it } from 'vitest';
import { HUB_LIMITS, type JamClientMessage, type JamMember } from '@aske/shared/hub';
import { applyAction, requestSkip, sortQueue, toSnapshot, type JamData } from '../src/jam/state';

const host: JamMember = { memberId: 'h', nickname: 'Host', isHost: true };
const ana: JamMember = { memberId: 'a', nickname: 'Ana', isHost: false };
const bob: JamMember = { memberId: 'b', nickname: 'Bob', isHost: false };

const empty = (): JamData => ({
  code: 'ABC234',
  hostName: 'Host',
  hostKeyHash: 'x',
  expiresAt: 9e12,
  nowPlaying: null,
  queue: [],
});
const song = (n: number) => ({
  videoId: `video${String(n).padStart(6, '0')}`,
  title: `T${n}`,
  artist: 'A',
});

function run(data: JamData, actor: JamMember, msg: JamClientMessage, t = 1, id = 'i'): JamData {
  const res = applyAction(data, actor, msg, t, id);
  if ('error' in res) throw new Error(res.error);
  return res.data;
}

describe('applyAction', () => {
  it('sorts by votes then by time', () => {
    let d = run(empty(), ana, { type: 'add', song: song(1) }, 10, 'one');
    d = run(d, bob, { type: 'add', song: song(2) }, 20, 'two');
    d = run(d, ana, { type: 'add', song: song(3) }, 5, 'three');
    expect(sortQueue(d.queue).map((i) => i.id)).toEqual(['three', 'one', 'two']);
    d = run(d, ana, { type: 'vote', itemId: 'two' });
    expect(sortQueue(d.queue).map((i) => i.id)).toEqual(['two', 'three', 'one']);
  });

  it('treats adding a repeated song as a vote', () => {
    let d = run(empty(), ana, { type: 'add', song: song(1) }, 1, 'one');
    d = run(d, bob, { type: 'add', song: song(1) }, 2, 'dup');
    expect(d.queue).toHaveLength(1);
    expect(d.queue[0]!.voterIds).toEqual(['a', 'b']);
  });

  it('auto-votes the adder and toggles votes off', () => {
    let d = run(empty(), ana, { type: 'add', song: song(1) }, 1, 'one');
    expect(d.queue[0]!.voterIds).toEqual(['a']);
    d = run(d, ana, { type: 'vote', itemId: 'one' });
    expect(d.queue[0]!.voterIds).toEqual([]);
  });

  it('enforces member_limit', () => {
    let d = empty();
    for (let n = 0; n < HUB_LIMITS.jamMaxPendingPerMember; n++) {
      d = run(d, ana, { type: 'add', song: song(n) }, n, `id${n}`);
    }
    expect(applyAction(d, ana, { type: 'add', song: song(99) }, 1, 'x')).toEqual({
      error: 'member_limit',
    });
  });

  it('enforces queue_full', () => {
    const base = run(empty(), ana, { type: 'add', song: song(0) }, 1, 'q');
    const full: JamData = {
      ...base,
      queue: Array.from({ length: HUB_LIMITS.jamMaxQueue }, (_, n) => ({
        ...base.queue[0]!,
        id: `q${n}`,
        song: song(n),
      })),
    };
    expect(applyAction(full, bob, { type: 'add', song: song(500) }, 1, 'x')).toEqual({
      error: 'queue_full',
    });
  });

  it('keeps host-only actions away from guests', () => {
    const d = run(empty(), ana, { type: 'add', song: song(1) }, 1, 'one');
    const msgs: JamClientMessage[] = [
      { type: 'start', itemId: 'one' },
      { type: 'finish' },
      { type: 'end' },
      { type: 'remove', itemId: 'one' },
    ];
    for (const msg of msgs) {
      expect(applyAction(d, bob, msg, 1, 'x')).toEqual({ error: 'not_host' });
    }
  });

  it('lets the host or the author remove', () => {
    const d = run(empty(), ana, { type: 'add', song: song(1) }, 1, 'one');
    expect(run(d, ana, { type: 'remove', itemId: 'one' }).queue).toHaveLength(0);
    expect(run(d, host, { type: 'remove', itemId: 'one' }).queue).toHaveLength(0);
  });

  it('start moves the item to nowPlaying; finish clears it', () => {
    let d = run(empty(), ana, { type: 'add', song: song(1) }, 1, 'one');
    d = run(d, host, { type: 'start', itemId: 'one' });
    expect(d.nowPlaying?.id).toBe('one');
    expect(d.queue).toHaveLength(0);
    expect(run(d, host, { type: 'finish' }).nowPlaying).toBeNull();
  });

  it('builds a personal snapshot', () => {
    const d = run(empty(), ana, { type: 'add', song: song(1) }, 1, 'one');
    expect(toSnapshot(d, [host], 'a', false).queue[0]).toMatchObject({
      votes: 1,
      votedByMe: true,
      mine: true,
    });
    expect(toSnapshot(d, [host], 'b', false).queue[0]).toMatchObject({
      votedByMe: false,
      mine: false,
    });
  });

  it('reports canSkip and the pending skip in the snapshot', () => {
    expect(toSnapshot(empty(), [host], 'a', false)).toMatchObject({
      canSkip: false,
      skipRequested: null,
    });
    const d: JamData = { ...empty(), skipRequested: 'one' };
    expect(toSnapshot(d, [host], 'a', true)).toMatchObject({
      canSkip: true,
      skipRequested: 'one',
    });
  });

  it('start and finish clear the pending skip', () => {
    let d = run(empty(), ana, { type: 'add', song: song(1) }, 1, 'one');
    d = { ...d, skipRequested: 'old' };
    expect(run(d, host, { type: 'start', itemId: 'one' }).skipRequested).toBeNull();
    expect(run(d, host, { type: 'finish' }).skipRequested).toBeNull();
  });
});

describe('requestSkip', () => {
  const playing = (): JamData => {
    const d = run(empty(), ana, { type: 'add', song: song(1) }, 1, 'one');
    return run(d, host, { type: 'start', itemId: 'one' });
  };
  const ready = { now: 10_000, host: 'ready' as const };

  it('records the song that is playing', () => {
    expect(requestSkip(playing(), 'one', ready)).toMatchObject({
      data: { skipRequested: 'one', nowPlaying: { id: 'one' } },
    });
  });

  it('fails when the host cannot skip', () => {
    expect(requestSkip(playing(), 'one', { ...ready, host: 'outdated' })).toEqual({
      error: 'host_outdated',
    });
    expect(requestSkip(playing(), 'one', { ...ready, host: 'away' })).toEqual({
      error: 'host_away',
    });
  });

  it('ignores a second request within the per-person interval', () => {
    const recent = ready.now - HUB_LIMITS.jamSkipEveryMs + 1;
    expect(requestSkip(playing(), 'one', { ...ready, lastSkipAt: recent })).toEqual({
      ignored: true,
    });
    const old = ready.now - HUB_LIMITS.jamSkipEveryMs;
    expect(requestSkip(playing(), 'one', { ...ready, lastSkipAt: old })).toHaveProperty('data');
  });

  it('ignores a song that is not playing or is already requested', () => {
    expect(requestSkip(playing(), 'other', ready)).toEqual({ ignored: true });
    expect(requestSkip(empty(), 'one', ready)).toEqual({ ignored: true });
    const pending: JamData = { ...playing(), skipRequested: 'one' };
    expect(requestSkip(pending, 'one', ready)).toEqual({ ignored: true });
  });
});
