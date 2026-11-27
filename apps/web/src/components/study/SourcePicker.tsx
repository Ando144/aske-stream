import { Check } from 'lucide-react';
import { useT } from '../../i18n';
import { useLibrary } from '../../stores/library';
import type { StudySource } from '../../study/session';
import { PlaylistArt } from '../PlaylistArt';

interface Props {
  value: StudySource;
  onChange: (source: StudySource) => void;
}

/** Radio list instead of a <select>, which cannot show pictures. */
function PlaylistOptions({
  selectedId,
  onPick,
}: {
  selectedId: string;
  onPick: (id: string) => void;
}) {
  const t = useT();
  const playlists = useLibrary((s) => s.playlists);
  const tracks = useLibrary((s) => s.tracks);
  if (playlists.length === 0) return null;
  const label = t('study.source.playlist');
  return (
    <>
      <span className="small muted" aria-hidden>
        {label}
      </span>
      <div className="study-playlists" role="radiogroup" aria-label={label}>
        {playlists.map((pl) => {
          const checked = pl.id === selectedId;
          return (
            <button
              key={pl.id}
              type="button"
              role="radio"
              aria-checked={checked}
              className="menu-item study-playlist"
              onClick={() => onPick(pl.id)}
            >
              <PlaylistArt playlist={pl} tracks={tracks} size={32} />
              <span className="grow ellipsis">{pl.name}</span>
              {checked && <Check size={20} aria-hidden />}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Library, calm mix or one playlist: shared by the setup screen and the "Change" sheet. */
export function SourcePicker({ value, onChange }: Props) {
  const t = useT();
  return (
    <div className="study-section">
      <div className="chips">
        <button
          className={`chip${value.kind === 'library' ? ' active' : ''}`}
          aria-pressed={value.kind === 'library'}
          onClick={() => onChange({ kind: 'library' })}
        >
          {t('study.source.library')}
        </button>
        <button
          className={`chip${value.kind === 'calm' ? ' active' : ''}`}
          aria-pressed={value.kind === 'calm'}
          onClick={() => onChange({ kind: 'calm' })}
        >
          {t('study.source.calm')}
        </button>
      </div>
      {value.kind === 'calm' && <p className="small muted">{t('study.source.calmHint')}</p>}
      <PlaylistOptions
        selectedId={value.kind === 'playlist' ? value.id : ''}
        onPick={(id) => onChange({ kind: 'playlist', id })}
      />
    </div>
  );
}
