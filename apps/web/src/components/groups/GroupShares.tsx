import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import type { GroupDetail, GroupShare } from '@aske/shared/groups';
import { hubErrorText } from '../../hub/errors';
import { deleteShare, listShares } from '../../hub/groupsClient';
import { shareJamToGroup, shareListToGroup } from '../../groups/shareActions';
import { songCount, useT } from '../../i18n';
import { useJam } from '../../stores/jam';
import { useLibrary } from '../../stores/library';
import { toast } from '../../stores/ui';
import { PlaylistArt } from '../PlaylistArt';
import { Sheet } from '../Sheet';
import '../../socialCovers.css';

function PlaylistPicker({
  onPick,
  onClose,
}: {
  onPick: (playlistId: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const playlists = useLibrary((s) => s.playlists);
  const tracks = useLibrary((s) => s.tracks);
  return (
    <Sheet onClose={onClose} label={t('groups.shares.pickList')}>
      <div className="sheet-body">
        <h2>{t('groups.shares.pickList')}</h2>
        {playlists.length === 0 && <p className="muted">{t('groups.shares.noPlaylists')}</p>}
        <ul className="groups-list social-playlists">
          {playlists.map((pl) => (
            <li key={pl.id}>
              <button className="card-row social-playlist" onClick={() => onPick(pl.id)}>
                <PlaylistArt playlist={pl} tracks={tracks} size={44} />
                <span className="grow">
                  <span className="card-title ellipsis">{pl.name}</span>
                  <span className="muted small">{songCount(t, pl.trackIds.length)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

function ShareRow({
  share,
  canRemove,
  onOpen,
  onRemove,
}: {
  share: GroupShare;
  canRemove: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const isJam = share.kind === 'jam';
  return (
    <li className="row groups-share">
      <div className="grow ellipsis">
        <div className="ellipsis">{share.title}</div>
        <div className="faint small ellipsis">
          {t(isJam ? 'groups.shares.jam' : 'groups.shares.list')} ·{' '}
          {t('groups.shares.by', { alias: share.alias })}
        </div>
      </div>
      <button className="btn small primary" onClick={onOpen}>
        {t(isJam ? 'groups.shares.joinJam' : 'groups.shares.open')}
      </button>
      {canRemove && (
        <button className="btn small" onClick={onRemove}>
          {t('groups.shares.remove')}
        </button>
      )}
    </li>
  );
}

function useShares(groupId: string) {
  const [shares, setShares] = useState<GroupShare[] | null>(null);
  const reload = () =>
    listShares(groupId).then(setShares, (err) => {
      toast(hubErrorText(err), 'error');
      setShares((current) => current ?? []);
    });
  useEffect(() => {
    void reload();
  }, [groupId]);
  return { shares, reload };
}

/** Playlists and Jams the group has shared, plus buttons to share your own. */
export function GroupShares({ group }: { group: GroupDetail }) {
  const t = useT();
  const [, navigate] = useLocation();
  const { shares, reload } = useShares(group.id);
  const [picking, setPicking] = useState(false);
  const alias = group.members.find((m) => m.memberId === group.you)?.alias ?? '';
  const hostJam = useJam((s) => s.session?.role === 'host');

  const open = (share: GroupShare) => {
    if (share.kind === 'list') return navigate(`/shared/${share.ref}`);
    void useJam
      .getState()
      .join(share.ref, alias)
      .then(() => navigate('/jam'));
  };

  const remove = async (shareId: string) => {
    try {
      await deleteShare(group.id, shareId);
      await reload();
    } catch (err) {
      toast(hubErrorText(err), 'error');
    }
  };

  const done = async (promise: Promise<GroupShare | null>) => {
    if (await promise) {
      toast(t('groups.shares.done'));
      await reload();
    }
  };

  const pick = (playlistId: string) => {
    setPicking(false);
    const playlist = useLibrary.getState().playlists.find((p) => p.id === playlistId);
    if (playlist) void done(shareListToGroup(group.id, playlist));
  };

  return (
    <section className="panel groups-section">
      <h2 className="section-title">{t('groups.shares.title')}</h2>
      {shares?.length === 0 && <p className="muted small">{t('groups.shares.empty')}</p>}
      <ul className="groups-list">
        {shares?.map((share) => (
          <ShareRow
            key={share.id}
            share={share}
            canRemove={group.isOwner || share.memberId === group.you}
            onOpen={() => open(share)}
            onRemove={() => void remove(share.id)}
          />
        ))}
      </ul>
      <div className="row wrap">
        <button className="btn small" onClick={() => setPicking(true)}>
          {t('groups.shares.addList')}
        </button>
        <button
          className="btn small"
          disabled={!hostJam}
          title={hostJam ? undefined : t('groups.shares.noJam')}
          onClick={() => void done(shareJamToGroup(group.id))}
        >
          {t('groups.shares.addJam')}
        </button>
      </div>
      {!hostJam && <p className="faint small">{t('groups.shares.noJam')}</p>}
      {picking && <PlaylistPicker onPick={pick} onClose={() => setPicking(false)} />}
    </section>
  );
}
