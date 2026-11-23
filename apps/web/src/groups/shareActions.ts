import type { Playlist } from '@aske/shared';
import type { GroupShare, GroupShareKind } from '@aske/shared/groups';
import { createSharedList } from '../hub/client';
import { hubErrorText } from '../hub/errors';
import { addShare } from '../hub/groupsClient';
import { songsFromPlaylist } from '../hub/sharedList';
import { useJam } from '../stores/jam';
import { useLibrary } from '../stores/library';
import { useSharedLists } from '../stores/sharedLists';
import { toast } from '../stores/ui';

interface ShareDraft {
  kind: GroupShareKind;
  ref: string;
  title: string;
}

/** Id of the playlist's live link, creating the link when there is none. */
async function listLinkId(playlist: Playlist): Promise<string | null> {
  const existing = useSharedLists.getState().forPlaylist(playlist.id);
  if (existing) return existing.id;
  const { songs } = songsFromPlaylist(playlist.trackIds, useLibrary.getState().tracks);
  if (songs.length === 0) return null;
  const created = await createSharedList(playlist.name, songs);
  useSharedLists.getState().add({ playlistId: playlist.id, ...created });
  return created.id;
}

async function post(groupId: string, draft: () => Promise<ShareDraft | null>) {
  try {
    const share = await draft();
    return share ? await addShare(groupId, share) : null;
  } catch (err) {
    toast(hubErrorText(err), 'error');
    return null;
  }
}

export function shareListToGroup(groupId: string, playlist: Playlist): Promise<GroupShare | null> {
  return post(groupId, async () => {
    const ref = await listLinkId(playlist);
    return ref ? { kind: 'list', ref, title: playlist.name } : null;
  });
}

export function shareJamToGroup(groupId: string): Promise<GroupShare | null> {
  return post(groupId, async () => {
    const session = useJam.getState().session;
    if (!session || session.role !== 'host') return null;
    return { kind: 'jam', ref: session.code, title: session.nickname };
  });
}
