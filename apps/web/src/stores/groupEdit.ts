import { sanitizeGroupName } from '@aske/shared/groups';
import { create } from 'zustand';
import { isOfflineError } from '../groups/look';
import { forgetGroupPhoto } from '../groups/photoCache';
import { hubErrorText } from '../hub/errors';
import * as api from '../hub/groupsClient';
import { t } from '../i18n';
import { useGroups } from './groups';

export interface LookDraft {
  name: string;
  /** undefined = unchanged. */
  photo?: Blob | 'remove';
}

export type SaveLookResult =
  { ok: true; name: string; photoAt: number | null } | { ok: false; message: string };

interface Look {
  name: string;
  photoAt: number | null;
}

interface GroupEditState {
  /** Only what is still waiting to be saved, so that it can be retried. */
  drafts: Record<string, LookDraft>;
  saving: string | null;
  save(groupId: string, draft: LookDraft, current: Look): Promise<SaveLookResult>;
  discard(groupId: string): void;
}

function failureMessage(err: unknown): string {
  console.error('Could not save the group name or photo', err);
  if (isOfflineError(err)) return t('groups.look.offline');
  const text = hubErrorText(err);
  return text === t('hub.err.internal_error') ? t('groups.look.failed') : text;
}

async function savePhoto(groupId: string, photo: Blob | 'remove'): Promise<number | null> {
  if (photo !== 'remove') return (await api.uploadGroupPhoto(groupId, photo)).photoAt;
  await api.deleteGroupPhoto(groupId);
  return null;
}

/**
 * Names saved by an attempt whose photo then failed. The caller may still hold the
 * old name, so going back to it has to be sent too.
 */
const partlySaved = new Map<string, string>();

async function saveName(groupId: string, name: string, currentName: string): Promise<void> {
  const earlier = partlySaved.get(groupId);
  if (name === currentName && (earlier === undefined || name === earlier)) return;
  await api.renameGroup(groupId, name);
  partlySaved.set(groupId, name);
}

export const useGroupEdit = create<GroupEditState>((set, get) => {
  const discard = (groupId: string) => {
    const drafts = { ...get().drafts };
    delete drafts[groupId];
    set({ drafts });
  };

  return {
    drafts: {},
    saving: null,
    discard,

    async save(groupId, draft, current) {
      const name = sanitizeGroupName(draft.name) ?? draft.name;
      set({ saving: groupId });
      try {
        await saveName(groupId, name, current.name);
        const photoAt =
          draft.photo === undefined ? current.photoAt : await savePhoto(groupId, draft.photo);
        partlySaved.delete(groupId);
        discard(groupId);
        forgetGroupPhoto(groupId);
        useGroups.getState().patchSummary(groupId, { name, photoAt });
        return { ok: true, name, photoAt };
      } catch (err) {
        set({ drafts: { ...get().drafts, [groupId]: { ...draft, name } } });
        return { ok: false, message: failureMessage(err) };
      } finally {
        set({ saving: null });
      }
    },
  };
});
