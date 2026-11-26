import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HubError } from '../src/hub/client';

const h = vi.hoisted(() => ({
  api: { renameGroup: vi.fn(), uploadGroupPhoto: vi.fn(), deleteGroupPhoto: vi.fn() },
  forget: vi.fn(),
}));

vi.mock('../src/lib/storage', () => ({
  loadValue: (_key: string, fallback: unknown) => fallback,
  savePref: vi.fn(),
}));
vi.mock('../src/stores/ui', () => ({ toast: vi.fn() }));
vi.mock('../src/i18n', () => ({ t: (key: string) => key }));
vi.mock('../src/hub/groupsClient', () => h.api);
vi.mock('../src/groups/photoCache', () => ({ forgetGroupPhoto: h.forget }));
vi.mock('../src/hub/errors', () => ({
  hubErrorText: (e: unknown) =>
    e instanceof HubError ? `hub.err.${e.code}` : 'hub.err.internal_error',
}));

import { useGroupEdit, type LookDraft } from '../src/stores/groupEdit';
import { useGroups } from '../src/stores/groups';

const current = { name: 'Friends', photoAt: 5 };
const photo = new Blob(['jpeg'], { type: 'image/jpeg' });
const save = (draft: LookDraft, from = current) => useGroupEdit.getState().save('g1', draft, from);
const draft = () => useGroupEdit.getState().drafts.g1;
const listed = () => useGroups.getState().groups[0];

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('navigator', { onLine: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  useGroupEdit.setState({ drafts: {}, saving: null });
  useGroups.setState({
    groups: [{ id: 'g1', name: 'Friends', members: 2, isOwner: false, photoAt: 5 }],
  });
  h.api.renameGroup.mockResolvedValue({ name: 'Trips' });
  h.api.uploadGroupPhoto.mockResolvedValue({ photoAt: 9 });
  h.api.deleteGroupPhoto.mockResolvedValue(undefined);
});

describe('save', () => {
  it('renames and uploads the photo, then updates the list', async () => {
    const result = await save({ name: 'Trips', photo });
    expect(result).toEqual({ ok: true, name: 'Trips', photoAt: 9 });
    expect(h.api.renameGroup).toHaveBeenCalledWith('g1', 'Trips');
    expect(h.api.uploadGroupPhoto).toHaveBeenCalledWith('g1', photo);
    expect(h.forget).toHaveBeenCalledWith('g1');
    expect(listed()).toMatchObject({ name: 'Trips', photoAt: 9 });
    expect(draft()).toBeUndefined();
    expect(useGroupEdit.getState().saving).toBeNull();
  });

  it('removes the photo without renaming an unchanged name', async () => {
    const result = await save({ name: ' Friends ', photo: 'remove' });
    expect(result).toEqual({ ok: true, name: 'Friends', photoAt: null });
    expect(h.api.deleteGroupPhoto).toHaveBeenCalledWith('g1');
    expect(h.api.renameGroup).not.toHaveBeenCalled();
    expect(listed()?.photoAt).toBeNull();
  });

  it('keeps the photo version when only the name changes', async () => {
    expect(await save({ name: 'Trips' })).toEqual({ ok: true, name: 'Trips', photoAt: 5 });
    expect(h.api.uploadGroupPhoto).not.toHaveBeenCalled();
    expect(h.api.deleteGroupPhoto).not.toHaveBeenCalled();
  });

  it('marks the group as being saved while the request runs', async () => {
    const pending = save({ name: 'Trips' });
    expect(useGroupEdit.getState().saving).toBe('g1');
    await pending;
  });

  it('keeps name and photo when there is no connection', async () => {
    h.api.renameGroup.mockRejectedValue(new HubError('network', 0));
    expect(await save({ name: 'Trips', photo })).toEqual({
      ok: false,
      message: 'groups.look.offline',
    });
    expect(draft()).toEqual({ name: 'Trips', photo });
    expect(h.api.uploadGroupPhoto).not.toHaveBeenCalled();
    expect(useGroupEdit.getState().saving).toBeNull();
    expect(listed()?.name).toBe('Friends');
  });

  it('keeps only the photo when just the photo fails, and finishes on retry', async () => {
    h.api.uploadGroupPhoto.mockRejectedValueOnce(new HubError('internal_error', 500));
    expect(await save({ name: 'Trips', photo })).toEqual({
      ok: false,
      message: 'groups.look.failed',
    });
    expect(draft()).toEqual({ name: 'Trips', photo });
    h.api.renameGroup.mockClear();
    const result = await save(draft()!, { name: 'Trips', photoAt: 5 });
    expect(result).toEqual({ ok: true, name: 'Trips', photoAt: 9 });
    expect(h.api.renameGroup).not.toHaveBeenCalled();
    expect(draft()).toBeUndefined();
  });

  it('can go back to the old name after a partial save', async () => {
    h.api.uploadGroupPhoto.mockRejectedValueOnce(new HubError('network', 0));
    await save({ name: 'Trips', photo });
    h.api.renameGroup.mockClear();
    await save({ name: 'Friends', photo });
    expect(h.api.renameGroup).toHaveBeenCalledWith('g1', 'Friends');
  });

  it('shows the specific Hub message when there is one', async () => {
    h.api.renameGroup.mockRejectedValue(new HubError('rate_limited', 429));
    expect(await save({ name: 'Trips' })).toEqual({
      ok: false,
      message: 'hub.err.rate_limited',
    });
  });

  it('discards a draft', async () => {
    h.api.renameGroup.mockRejectedValue(new HubError('network', 0));
    await save({ name: 'Trips' });
    useGroupEdit.getState().discard('g1');
    expect(draft()).toBeUndefined();
  });
});
