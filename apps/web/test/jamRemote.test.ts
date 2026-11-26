import type { JamSnapshot } from '@aske/shared/hub';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/stores/jam', () => ({ useJam: vi.fn() }));
vi.mock('../src/stores/player', () => ({ usePlayer: vi.fn() }));

import { hostSkipTarget, jamBarVisible, skipAvailability } from '../src/hub/jamRemote';

const snap = (over: Partial<JamSnapshot> = {}): JamSnapshot =>
  ({
    nowPlaying: { id: 'i1' },
    members: [{ nickname: 'Ana', isHost: true }],
    canSkip: true,
    skipRequested: null,
    ...over,
  }) as unknown as JamSnapshot;

describe('skipAvailability', () => {
  it('is nothing without a snapshot or a current song', () => {
    expect(skipAvailability(null)).toBe('nothing');
    expect(skipAvailability(snap({ nowPlaying: null }))).toBe('nothing');
  });

  it('is ok when the hub says the host can skip', () => {
    expect(skipAvailability(snap())).toBe('ok');
  });

  it('is outdated when a connected host cannot skip', () => {
    expect(skipAvailability(snap({ canSkip: false }))).toBe('outdated');
  });

  it('is away when no host is connected', () => {
    const members = [{ nickname: 'Bea', isHost: false }];
    expect(skipAvailability(snap({ canSkip: false, members }))).toBe('away');
  });

  it('treats an old hub (canSkip absent) as unable to skip', () => {
    expect(skipAvailability(snap({ canSkip: undefined }))).toBe('outdated');
    expect(skipAvailability(snap({ canSkip: undefined, members: [] }))).toBe('away');
  });
});

describe('hostSkipTarget', () => {
  it('returns the requested id when it is the current song', () => {
    expect(hostSkipTarget(snap({ skipRequested: 'i1' }), null)).toBe('i1');
  });

  it('ignores a request already handled', () => {
    expect(hostSkipTarget(snap({ skipRequested: 'i1' }), 'i1')).toBeNull();
  });

  it('ignores requests for other songs, no request or nothing playing', () => {
    expect(hostSkipTarget(snap({ skipRequested: 'i0' }), null)).toBeNull();
    expect(hostSkipTarget(snap(), null)).toBeNull();
    expect(hostSkipTarget(snap({ skipRequested: undefined }), null)).toBeNull();
    expect(hostSkipTarget(snap({ nowPlaying: null, skipRequested: 'i1' }), null)).toBeNull();
  });
});

describe('jamBarVisible', () => {
  const visible = {
    role: 'guest' as const,
    connection: 'open' as const,
    snapshot: snap(),
    playerPlaying: false,
  };

  it('is true for a guest in an open Jam with a song and a silent player', () => {
    expect(jamBarVisible(visible)).toBe(true);
  });

  it('is false for the host or outside a Jam', () => {
    expect(jamBarVisible({ ...visible, role: 'host' })).toBe(false);
    expect(jamBarVisible({ ...visible, role: undefined })).toBe(false);
  });

  it('is false when the Jam is not open', () => {
    expect(jamBarVisible({ ...visible, connection: 'reconnecting' })).toBe(false);
    expect(jamBarVisible({ ...visible, connection: 'idle' })).toBe(false);
  });

  it('is false without a song or while the player is playing', () => {
    expect(jamBarVisible({ ...visible, snapshot: null })).toBe(false);
    expect(jamBarVisible({ ...visible, snapshot: snap({ nowPlaying: null }) })).toBe(false);
    expect(jamBarVisible({ ...visible, playerPlaying: true })).toBe(false);
  });
});
