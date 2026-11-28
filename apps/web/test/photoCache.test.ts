import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  fetchGroupPhoto: vi.fn(),
  fetchInvitePhoto: vi.fn(),
}));

vi.mock('../src/hub/groupsClient', () => ({
  fetchGroupPhoto: h.fetchGroupPhoto,
  fetchInvitePhoto: h.fetchInvitePhoto,
}));

import { forgetGroupPhoto, loadGroupPhoto } from '../src/groups/photoCache';

beforeEach(() => {
  vi.clearAllMocks();
  forgetGroupPhoto('g');
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  h.fetchGroupPhoto.mockResolvedValue(new Blob(['a']));
});

describe('loadGroupPhoto with an old hub', () => {
  it('asks for nothing when the hub does not send photoAt', async () => {
    expect(await loadGroupPhoto({ groupId: 'g', photoAt: undefined as never })).toBeNull();
    expect(h.fetchGroupPhoto).not.toHaveBeenCalled();
  });

  it('asks for no invite photo either', async () => {
    const src = { inviteCode: 'ABCD2345', photoAt: undefined as never };
    expect(await loadGroupPhoto(src)).toBeNull();
    expect(h.fetchInvitePhoto).not.toHaveBeenCalled();
  });

  it('downloads the photo when photoAt is a number', async () => {
    expect(await loadGroupPhoto({ groupId: 'g', photoAt: 1 })).toBe('blob:photo');
    expect(h.fetchGroupPhoto).toHaveBeenCalledWith('g');
  });
});
