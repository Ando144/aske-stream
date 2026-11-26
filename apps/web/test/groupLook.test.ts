import { GROUP_LIMITS } from '@aske/shared/groups';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HubError } from '../src/hub/client';

const h = vi.hoisted(() => ({
  squareJpeg: vi.fn(),
  fetchGroupPhoto: vi.fn(),
  fetchInvitePhoto: vi.fn(),
}));

vi.mock('../src/lib/cover', () => ({ squareJpeg: h.squareJpeg }));
vi.mock('../src/hub/groupsClient', () => ({
  fetchGroupPhoto: h.fetchGroupPhoto,
  fetchInvitePhoto: h.fetchInvitePhoto,
}));

import {
  cardMoreCount,
  groupInitials,
  isOfflineError,
  personInitials,
  preparePhoto,
} from '../src/groups/look';
import { forgetGroupPhoto, loadGroupPhoto } from '../src/groups/photoCache';

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('groupInitials', () => {
  it.each([
    ['Cuadrilla del pueblo', 'CP'],
    ['Viajes', 'VI'],
    ['  los   viernes  ', 'LV'],
    ['🎸 Rock', '🎸R'],
    ['👨‍👩‍👧', '👨‍👩‍👧'],
    ['a', 'A'],
    ['   ', ''],
  ])('%s gives %s', (name, initials) => {
    expect(groupInitials(name)).toBe(initials);
  });
});

describe('personInitials', () => {
  it.each([
    ['leire', 'Le'],
    ['LEIRE', 'Le'],
    ['  ane ', 'An'],
    ['🦊zorro', '🦊z'],
    ['👩🏽‍🚀', '👩🏽‍🚀'],
    ['j', 'J'],
    ['', ''],
  ])('%s gives %s', (alias, initials) => {
    expect(personInitials(alias)).toBe(initials);
  });
});

describe('cardMoreCount', () => {
  it('counts the people left out of the stack', () => {
    expect(cardMoreCount(5, 4)).toBe(1);
    expect(cardMoreCount(3, 3)).toBe(0);
    expect(cardMoreCount(2, 4)).toBe(0);
  });
});

describe('preparePhoto', () => {
  const file = new Blob(['x'], { type: 'image/png' });

  it('returns the square JPEG at the group photo size', async () => {
    const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' });
    h.squareJpeg.mockResolvedValue(jpeg);
    expect(await preparePhoto(file)).toBe(jpeg);
    expect(h.squareJpeg).toHaveBeenCalledWith(file, GROUP_LIMITS.photoSide);
  });

  it('returns null when the image cannot be used or is too big', async () => {
    h.squareJpeg.mockResolvedValue(null);
    expect(await preparePhoto(file)).toBeNull();
    h.squareJpeg.mockResolvedValue(new Blob([new Uint8Array(GROUP_LIMITS.photoMaxBytes + 1)]));
    expect(await preparePhoto(file)).toBeNull();
  });
});

describe('isOfflineError', () => {
  it('detects a missing connection', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(isOfflineError(new HubError('network', 0))).toBe(true);
    expect(isOfflineError(new HubError('internal_error', 500))).toBe(false);
    vi.stubGlobal('navigator', { onLine: false });
    expect(isOfflineError(new Error('boom'))).toBe(true);
  });
});

describe('loadGroupPhoto', () => {
  let created = 0;
  const revoke = vi.fn();
  beforeEach(() => {
    created = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++created}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke);
    h.fetchGroupPhoto.mockResolvedValue(new Blob(['a']));
    forgetGroupPhoto('g1');
    revoke.mockClear();
  });

  it('asks for nothing when there is no photo', async () => {
    expect(await loadGroupPhoto({ groupId: 'g1', photoAt: null })).toBeNull();
    expect(h.fetchGroupPhoto).not.toHaveBeenCalled();
  });

  it('keeps one URL per version and revokes the previous one', async () => {
    expect(await loadGroupPhoto({ groupId: 'g1', photoAt: 1 })).toBe('blob:1');
    expect(await loadGroupPhoto({ groupId: 'g1', photoAt: 1 })).toBe('blob:1');
    expect(h.fetchGroupPhoto).toHaveBeenCalledTimes(1);
    expect(await loadGroupPhoto({ groupId: 'g1', photoAt: 2 })).toBe('blob:2');
    expect(revoke).toHaveBeenCalledWith('blob:1');
    forgetGroupPhoto('g1');
    expect(revoke).toHaveBeenCalledWith('blob:2');
  });

  it('revokes the URL when the group loses its photo', async () => {
    await loadGroupPhoto({ groupId: 'g1', photoAt: 1 });
    expect(await loadGroupPhoto({ groupId: 'g1', photoAt: null })).toBeNull();
    expect(revoke).toHaveBeenCalledWith('blob:1');
  });

  it('uses the invite code for someone who is not a member', async () => {
    h.fetchInvitePhoto.mockResolvedValue(new Blob(['a']));
    expect(await loadGroupPhoto({ inviteCode: 'ABCD2345', photoAt: 1 })).toBe('blob:1');
    expect(h.fetchInvitePhoto).toHaveBeenCalledWith('ABCD2345');
  });

  it('drops a download that was forgotten while it was running', async () => {
    const pending = loadGroupPhoto({ groupId: 'g1', photoAt: 1 });
    forgetGroupPhoto('g1');
    expect(await pending).toBeNull();
    expect(created).toBe(0);
  });

  it('tries again after a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.fetchGroupPhoto.mockRejectedValueOnce(new HubError('network', 0));
    expect(await loadGroupPhoto({ groupId: 'g1', photoAt: 1 })).toBeNull();
    expect(await loadGroupPhoto({ groupId: 'g1', photoAt: 1 })).toBe('blob:1');
  });
});
