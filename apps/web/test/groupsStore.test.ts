import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HubError } from '../src/hub/client';
import { setStatsRepo, useStats } from '../src/stores/stats';
import { memoryStatsRepo } from '../src/stats/repo';

const h = vi.hoisted(() => ({
  prefs: new Map<string, unknown>(),
  toast: vi.fn(),
  api: {
    listMyGroups: vi.fn(),
    createGroup: vi.fn(),
    joinGroup: vi.fn(),
    removeMember: vi.fn(),
    deleteMyGroupData: vi.fn(),
    deleteMyStats: vi.fn(),
  },
  sync: vi.fn(async () => undefined),
  resetDeviceKey: vi.fn(() => 'new-key'),
}));

vi.mock('../src/lib/storage', () => ({
  loadValue: (key: string, fallback: unknown) => h.prefs.get(key) ?? fallback,
  savePref: (key: string, value: unknown) => h.prefs.set(key, value),
}));
vi.mock('../src/stores/ui', () => ({ toast: h.toast }));
vi.mock('../src/i18n', () => ({ t: (key: string) => key }));
vi.mock('../src/hub/groupsClient', () => h.api);
vi.mock('../src/groups/sync', () => ({ syncGroupStats: h.sync }));
vi.mock('../src/groups/deviceKey', () => ({ resetDeviceKey: h.resetDeviceKey }));
vi.mock('../src/hub/errors', () => ({
  hubErrorText: (e: unknown) => `err:${(e as HubError).code}`,
}));

import { useGroups } from '../src/stores/groups';

const group = { id: 'g1', name: 'Friends', members: 2, isOwner: true };
const detail = {
  id: 'g1',
  name: 'Friends',
  inviteCode: 'ABCD2345',
  isOwner: true,
  you: 'm1',
  members: [],
};

beforeEach(() => {
  h.prefs.clear();
  vi.clearAllMocks();
  setStatsRepo(memoryStatsRepo());
  useStats.setState({ consent: 'unset' });
  useGroups.setState({ consent: 'off', groups: [group] });
  h.api.listMyGroups.mockResolvedValue([group]);
});

describe('setSharing(true)', () => {
  it('turns the Recap on when it was off and forces the first upload', async () => {
    h.prefs.set('groups-last-sync', 123);
    expect(await useGroups.getState().setSharing(true)).toBe(true);
    expect(useStats.getState().consent).toBe('on');
    expect(useGroups.getState().consent).toBe('on');
    expect(h.prefs.get('groups-last-sync')).toBeNull();
    expect(h.sync).toHaveBeenCalledWith({ force: true });
    expect(h.toast).toHaveBeenCalledWith('groups.toast.recapOn');
  });

  it('leaves the Recap alone when it was already on', async () => {
    useStats.setState({ consent: 'on' });
    const setEnabled = vi.fn(async () => true);
    useStats.setState({ setEnabled });
    await useGroups.getState().setSharing(true);
    expect(setEnabled).not.toHaveBeenCalled();
    expect(h.toast).not.toHaveBeenCalledWith('groups.toast.recapOn');
  });
});

describe('setSharing(false)', () => {
  beforeEach(() => {
    useStats.setState({ consent: 'on' });
    useGroups.setState({ consent: 'on' });
  });

  it('wipes the stats and keeps Recap, groups and key', async () => {
    h.api.deleteMyStats.mockResolvedValue(undefined);
    expect(await useGroups.getState().setSharing(false)).toBe(true);
    expect(useGroups.getState().consent).toBe('off');
    expect(useStats.getState().consent).toBe('on');
    expect(useGroups.getState().groups).toEqual([group]);
    expect(h.resetDeviceKey).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith('groups.toast.statsDeleted');
  });

  it('turns off even if the network fails and retries later', async () => {
    h.api.deleteMyStats.mockRejectedValueOnce(new HubError('network', 0));
    expect(await useGroups.getState().setSharing(false)).toBe(false);
    expect(useGroups.getState().consent).toBe('off');
    expect(useStats.getState().consent).toBe('on');
    expect(h.prefs.get('groups-stats-wipe-pending')).toBe(true);
    expect(h.toast).toHaveBeenCalledWith('groups.err.wipe', 'error');

    h.api.deleteMyStats.mockResolvedValueOnce(undefined);
    await useGroups.getState().retryPendingWipe();
    expect(h.prefs.get('groups-stats-wipe-pending')).toBe(false);
    expect(h.api.deleteMyStats).toHaveBeenCalledTimes(2);
  });

  it('does not retry when nothing is pending', async () => {
    await useGroups.getState().retryPendingWipe();
    expect(h.api.deleteMyStats).not.toHaveBeenCalled();
  });
});

describe('wipeAll', () => {
  it('empties the groups and changes the key', async () => {
    h.api.deleteMyGroupData.mockResolvedValue(undefined);
    useGroups.setState({ consent: 'on' });
    expect(await useGroups.getState().wipeAll()).toBe(true);
    expect(useGroups.getState().groups).toEqual([]);
    expect(useGroups.getState().consent).toBe('off');
    expect(h.resetDeviceKey).toHaveBeenCalled();
  });

  it('changes nothing when it fails', async () => {
    h.api.deleteMyGroupData.mockRejectedValue(new HubError('network', 0));
    expect(await useGroups.getState().wipeAll()).toBe(false);
    expect(useGroups.getState().groups).toEqual([group]);
    expect(h.resetDeviceKey).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith('err:network', 'error');
  });
});

describe('create, join, leave, kick', () => {
  it('create and join work with sharing off', async () => {
    h.api.createGroup.mockResolvedValue(detail);
    h.api.joinGroup.mockResolvedValue(detail);
    expect(await useGroups.getState().create('Friends', 'Ana')).toEqual(detail);
    expect(await useGroups.getState().join('ABCD2345', 'Ana')).toEqual(detail);
    expect(h.sync).not.toHaveBeenCalled();
  });

  it('shows a translated error and returns null', async () => {
    h.api.joinGroup.mockRejectedValue(new HubError('group_full', 409));
    expect(await useGroups.getState().join('ABCD2345', 'Ana')).toBeNull();
    expect(h.toast).toHaveBeenCalledWith('err:group_full', 'error');
  });

  it('leave and kick remove the member', async () => {
    h.api.removeMember.mockResolvedValue(undefined);
    expect(await useGroups.getState().kick('g1', 'm2')).toBe(true);
    expect(h.toast).toHaveBeenCalledWith('groups.toast.kicked');
    expect(await useGroups.getState().leave('g1', 'm1')).toBe(true);
    expect(useGroups.getState().groups).toEqual([]);
    expect(h.toast).toHaveBeenCalledWith('groups.toast.left');
  });
});
