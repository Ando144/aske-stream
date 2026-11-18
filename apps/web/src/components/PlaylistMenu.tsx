import { useState } from 'react';
import { useLocation } from 'wouter';
import { Folder as FolderIcon, FolderMinus, Merge, Pencil, Trash2 } from 'lucide-react';
import type { Playlist } from '@aske/shared';
import { useT } from '../i18n';
import { useLibrary } from '../stores/library';
import { MergeSheet } from './MergeSheet';
import {
  CoverItems,
  deletePlaylistFlow,
  FolderPickSheet,
  MergePickSheet,
  renamePlaylistFlow,
} from './PlaylistMenuParts';
import { PlaylistArt } from './PlaylistArt';
import { Sheet } from './Sheet';

type Step = 'main' | 'folders' | 'merge';

/** The «…» sheet of a playlist. */
export function PlaylistMenu({ playlist, onClose }: { playlist: Playlist; onClose: () => void }) {
  const [step, setStep] = useState<Step>('main');
  const [mergeWith, setMergeWith] = useState<string | null>(null);

  const moveTo = (folderId: string | null) => {
    onClose();
    void useLibrary.getState().movePlaylist(playlist.id, folderId);
  };

  if (mergeWith) {
    return <MergeSheet targetId={playlist.id} sourceId={mergeWith} onClose={onClose} />;
  }
  if (step === 'folders') {
    return <FolderPickSheet playlist={playlist} onMove={moveTo} onClose={onClose} />;
  }
  if (step === 'merge') {
    return <MergePickSheet playlist={playlist} onPick={setMergeWith} onClose={onClose} />;
  }
  return (
    <PlaylistMainSheet
      playlist={playlist}
      onStep={setStep}
      onMoveOut={() => moveTo(null)}
      onClose={onClose}
    />
  );
}

function PlaylistMainSheet({
  playlist,
  onStep,
  onMoveOut,
  onClose,
}: {
  playlist: Playlist;
  onStep: (step: Step) => void;
  onMoveOut: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [, navigate] = useLocation();
  const playlists = useLibrary((s) => s.playlists);
  const tracks = useLibrary((s) => s.tracks);

  return (
    <Sheet onClose={onClose} label={playlist.name}>
      <div className="sheet-header">
        <PlaylistArt playlist={playlist} tracks={tracks} size={48} />
        <div className="grow">
          <div className="track-title">{playlist.name}</div>
        </div>
      </div>
      <button className="menu-item" onClick={() => void renamePlaylistFlow(playlist, t, onClose)}>
        <Pencil size={20} /> {t('playlists.rename')}
      </button>
      <button className="menu-item" onClick={() => onStep('folders')}>
        <FolderIcon size={20} /> {t('playlists.moveToFolder')}
      </button>
      {playlist.folderId && (
        <button className="menu-item" onClick={onMoveOut}>
          <FolderMinus size={20} /> {t('playlists.moveOut')}
        </button>
      )}
      {playlists.length > 1 && (
        <button className="menu-item" onClick={() => onStep('merge')}>
          <Merge size={20} /> {t('playlists.merge')}
        </button>
      )}
      <CoverItems playlist={playlist} onClose={onClose} />
      <button
        className="menu-item danger"
        onClick={() => void deletePlaylistFlow(playlist, t, navigate, onClose)}
      >
        <Trash2 size={20} /> {t('playlists.delete')}
      </button>
    </Sheet>
  );
}
