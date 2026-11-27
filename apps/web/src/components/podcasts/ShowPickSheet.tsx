import { useMemo, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { LIMITS } from '@aske/shared';
import { useT } from '../../i18n';
import { normalizeText } from '../../lib/format';
import { groupShows, type Show } from '../../podcasts/shows';
import { useAllTracks, useLibrary } from '../../stores/library';
import { useUi } from '../../stores/ui';
import { Cover } from '../Cover';
import { Sheet } from '../Sheet';
import '../../podcasts.css';

/** Moves episodes to a show: one they already have or a new name. Also renames a whole show. */
export function ShowPickSheet() {
  const trackIds = useUi((s) => s.showPicker);
  if (!trackIds) return null;
  return <ShowPicker key={trackIds.join()} trackIds={trackIds} />;
}

/** The shows worth offering, and whether the chosen episodes are exactly one whole show. */
function useShowChoices(trackIds: string[]): { others: Show[]; renaming: boolean } {
  const all = useAllTracks();
  return useMemo(() => {
    // Episodes without any name are grouped under '', which cannot be picked.
    const shows = groupShows(all, '');
    const chosen = new Set(trackIds);
    const current = shows.find(
      (show) => show.episodes.filter((e) => chosen.has(e.id)).length === chosen.size,
    );
    return {
      others: shows.filter((show) => show.name !== '' && show !== current),
      renaming: chosen.size > 1 && current?.episodes.length === chosen.size,
    };
  }, [all, trackIds]);
}

function ShowPicker({ trackIds }: { trackIds: string[] }) {
  const t = useT();
  const close = useUi((s) => s.closeShowPicker);
  const { others, renaming } = useShowChoices(trackIds);
  const [name, setName] = useState('');
  const title = t(renaming ? 'podcasts.renameShow' : 'podcasts.showSheet.title');

  const save = (event: FormEvent) => {
    event.preventDefault();
    const album = name.trim();
    if (!album) return;
    close();
    void useLibrary.getState().setAlbumMany(trackIds, album);
  };

  return (
    <Sheet onClose={close} label={title}>
      <div className="sheet-header">
        <strong className="grow">{title}</strong>
      </div>
      <form className="show-pick-form" onSubmit={save}>
        <p className="muted small">{t('podcasts.showSheet.text')}</p>
        <div className="row">
          <input
            className="input grow"
            value={name}
            maxLength={LIMITS.titleMax}
            placeholder={t('podcasts.showSheet.placeholder')}
            aria-label={t('podcasts.showSheet.placeholder')}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            {t('podcasts.showSheet.save')}
          </button>
        </div>
      </form>
      {others.length > 0 && (
        <ExistingShows shows={others} selected={normalizeText(name.trim())} onPick={setName} />
      )}
    </Sheet>
  );
}

interface ExistingShowsProps {
  shows: Show[];
  /** Key of the show whose name is typed, if any. */
  selected: string;
  onPick: (name: string) => void;
}

function ExistingShows({ shows, selected, onPick }: ExistingShowsProps) {
  const t = useT();
  return (
    <>
      <h3 className="show-pick-title muted small">{t('podcasts.showSheet.existing')}</h3>
      {shows.map((show) => (
        <button
          key={show.key}
          type="button"
          className="menu-item"
          aria-pressed={show.key === selected}
          onClick={() => onPick(show.name)}
        >
          <Cover trackId={show.episodes[0]!.id} hasCover={show.episodes[0]!.hasCover} size={40} />
          <span className="grow ellipsis">{show.name}</span>
          {show.key === selected && <Check size={20} aria-hidden />}
        </button>
      ))}
    </>
  );
}
