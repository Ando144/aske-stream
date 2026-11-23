import type { GroupDetail, GroupSummary } from '@aske/shared/groups';
import { create } from 'zustand';
import { resetDeviceKey } from '../groups/deviceKey';
import { syncGroupStats, waitForGroupSync } from '../groups/sync';
import { hubErrorText } from '../hub/errors';
import * as api from '../hub/groupsClient';
import { t } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { useStats } from './stats';
import { toast } from './ui';

export type GroupsConsent = 'off' | 'on';

interface GroupsState {
  /** Only about sharing listening stats; groups work without it. */
  consent: GroupsConsent;
  groups: GroupSummary[];
  /** On: true. Off: true if the Hub data was deleted, false if the deletion is pending. */
  setSharing(on: boolean): Promise<boolean>;
  retryPendingWipe(): Promise<void>;
  wipeAll(): Promise<boolean>;
  refresh(): Promise<void>;
  create(name: string, alias: string): Promise<GroupDetail | null>;
  join(code: string, alias: string): Promise<GroupDetail | null>;
  leave(groupId: string, memberId: string): Promise<boolean>;
  kick(groupId: string, memberId: string): Promise<boolean>;
}

const showError = (err: unknown) => toast(hubErrorText(err), 'error');

async function enableRecapIfOff(): Promise<void> {
  if (useStats.getState().consent === 'on') return;
  await useStats.getState().setEnabled(true);
  toast(t('groups.toast.recapOn'));
}

export const useGroups = create<GroupsState>((set, get) => {
  const setConsent = (consent: GroupsConsent) => {
    savePref('groups-consent', consent);
    set({ consent });
  };

  const enter = async (request: () => Promise<GroupDetail>): Promise<GroupDetail | null> => {
    try {
      const detail = await request();
      await get().refresh();
      if (get().consent === 'on') void syncGroupStats({ force: true });
      return detail;
    } catch (err) {
      showError(err);
      return null;
    }
  };

  const removeFrom = async (groupId: string, memberId: string): Promise<boolean> => {
    try {
      await api.removeMember(groupId, memberId);
      return true;
    } catch (err) {
      showError(err);
      return false;
    }
  };

  return {
    consent: loadValue<string>('groups-consent', 'off') === 'on' ? 'on' : 'off',
    groups: [],

    async setSharing(on) {
      if (on) {
        await enableRecapIfOff();
        setConsent('on');
        savePref('groups-last-sync', null);
        void syncGroupStats({ force: true });
        return true;
      }
      setConsent('off');
      try {
        await waitForGroupSync();
        await api.deleteMyStats();
        savePref('groups-stats-wipe-pending', false);
        toast(t('groups.toast.statsDeleted'));
        return true;
      } catch (err) {
        console.error('Could not delete the group stats', err);
        savePref('groups-stats-wipe-pending', true);
        toast(t('groups.err.wipe'), 'error');
        return false;
      }
    },

    async retryPendingWipe() {
      if (!loadValue<boolean>('groups-stats-wipe-pending', false)) return;
      try {
        await api.deleteMyStats();
        savePref('groups-stats-wipe-pending', false);
      } catch (err) {
        console.error('Group stats are still waiting to be deleted', err);
      }
    },

    async wipeAll() {
      try {
        await api.deleteMyGroupData();
      } catch (err) {
        showError(err);
        return false;
      }
      resetDeviceKey();
      savePref('groups-last-sync', null);
      savePref('groups-stats-wipe-pending', false);
      setConsent('off');
      set({ groups: [] });
      toast(t('groups.toast.wiped'));
      return true;
    },

    async refresh() {
      try {
        set({ groups: await api.listMyGroups() });
      } catch (err) {
        showError(err);
      }
    },

    create: (name, alias) => enter(() => api.createGroup(name, alias)),
    join: (code, alias) => enter(() => api.joinGroup(code, alias)),

    async leave(groupId, memberId) {
      if (!(await removeFrom(groupId, memberId))) return false;
      set({ groups: get().groups.filter((g) => g.id !== groupId) });
      toast(t('groups.toast.left'));
      return true;
    },

    async kick(groupId, memberId) {
      if (!(await removeFrom(groupId, memberId))) return false;
      toast(t('groups.toast.kicked'));
      return true;
    },
  };
});
