import { LIMITS } from '@aske/shared';
import type { PlaylistEntry } from '@aske/shared/youtube';
import { useT } from '../../i18n';
import { toggleSelection } from '../../downloads/pickSelection';
import { toast } from '../../stores/ui';

/** Playlist songs with a checkbox each, plus "select all / none" and a counter. */
export function PickList({
  entries,
  selected,
  onChange,
}: {
  entries: readonly PlaylistEntry[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  const t = useT();
  const max = LIMITS.playlistMaxTracks;

  const toggle = (id: string) => {
    const result = toggleSelection(selected, id, max);
    if (result.refused) toast(t('pick.max', { count: max }));
    else onChange(result.selected);
  };

  return (
    <>
      <div className="row small" style={{ justifyContent: 'space-between' }}>
        <span aria-live="polite">
          {t('pick.selected', { count: selected.size, total: entries.length })}
        </span>
        <span className="row">
          <button
            type="button"
            className="btn small"
            onClick={() => onChange(new Set(entries.slice(0, max).map((e) => e.id)))}
          >
            {t('pick.all')}
          </button>
          <button type="button" className="btn small" onClick={() => onChange(new Set())}>
            {t('pick.none')}
          </button>
        </span>
      </div>
      <div className="dl-entries dl-pick">
        {entries.map((e, i) => (
          <label key={e.id} className="row small dl-pick-row">
            <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
            <span className="ellipsis">
              <span className="faint">{i + 1}.</span> {e.title}
              {e.author ? <span className="muted"> · {e.author}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </>
  );
}
