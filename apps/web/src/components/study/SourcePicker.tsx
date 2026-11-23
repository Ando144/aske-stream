import { useT } from '../../i18n';
import { useLibrary } from '../../stores/library';
import type { StudySource } from '../../study/session';

interface Props {
  value: StudySource;
  onChange: (source: StudySource) => void;
}

/** Library, calm mix or one playlist: shared by the setup screen and the "Change" sheet. */
export function SourcePicker({ value, onChange }: Props) {
  const t = useT();
  const playlists = useLibrary((s) => s.playlists);
  const playlistId = value.kind === 'playlist' ? value.id : '';
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
      {playlists.length > 0 && (
        <select
          className="input"
          value={playlistId}
          aria-label={t('study.source.playlist')}
          onChange={(e) => e.target.value && onChange({ kind: 'playlist', id: e.target.value })}
        >
          <option value="">{t('study.source.playlist')}</option>
          {playlists.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
