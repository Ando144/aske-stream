import { useMemo } from 'react';
import { CircleCheck, EllipsisVertical, Mic, Play } from 'lucide-react';
import { useT } from '../i18n';
import { formatLongDuration, formatTime } from '../lib/format';
import { groupShows, type Show } from '../podcasts/shows';
import { isOnlyOnDevice } from '../storage/localExtras';
import type { LocalTrack } from '../storage/types';
import { useAllTracks } from '../stores/library';
import { useCurrentTrackId, usePlayer } from '../stores/player';
import { usePodcasts } from '../stores/podcasts';
import { useSetup } from '../stores/setup';
import { useUi } from '../stores/ui';
import { Cover } from '../components/Cover';
import { OnlyHereBadge } from '../components/OnlyHereBadge';
import { SettingsLink } from '../components/SettingsLink';
import { ScreenTip } from '../components/ScreenTip';
import '../podcasts.css';

/**
 * Podcasts live apart from music: grouped by show and in episode order, with a progress bar
 * and resume position per episode.
 */
export function PodcastsView() {
  const t = useT();
  const all = useAllTracks();
  const shows = useMemo(() => groupShows(all, t('library.unknownArtist')), [all, t]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('podcasts.title')}</h1>
        <SettingsLink />
      </header>
      <ScreenTip id="podcasts" text="tips.podcasts" helpId="podcasts" />

      {shows.length === 0 && (
        <div className="empty">
          <Mic size={40} />
          <p>{t('podcasts.empty')}</p>
        </div>
      )}

      {shows.map((show) => (
        <ShowSection key={show.key} show={show} />
      ))}
    </div>
  );
}

function ShowSection({ show }: { show: Show }) {
  const t = useT();
  const first = show.episodes[0]!;
  const ids = show.episodes.map((e) => e.id);
  const play = (id: string) =>
    usePlayer.getState().playTracks(ids, id, {
      shuffle: false,
      context: { label: show.name, path: '/podcasts', fixedOrder: true },
    });

  return (
    <section className="podcast-show">
      <header className="row podcast-show-header">
        <Cover trackId={first.id} hasCover={first.hasCover} size={56} />
        <div className="grow">
          <h2 className="podcast-show-name">{show.name}</h2>
          <div className="muted small">{t('podcasts.episodes', { count: ids.length })}</div>
        </div>
        <button
          className="icon-btn"
          onClick={() => useUi.getState().openShowPicker(ids)}
          aria-label={t('podcasts.showMenu')}
        >
          <EllipsisVertical size={18} />
        </button>
      </header>
      {show.episodes.map((episode) => (
        <EpisodeRow key={episode.id} episode={episode} onPlay={() => play(episode.id)} />
      ))}
    </section>
  );
}

function EpisodeRow({ episode, onPlay }: { episode: LocalTrack; onPlay: () => void }) {
  const t = useT();
  const p = usePodcasts((s) => s.progress[episode.id]);
  const current = useCurrentTrackId() === episode.id;
  const home = useSetup((s) => s.config?.home);
  const onlyHere = isOnlyOnDevice(episode, home);
  const pct = p && !p.finished && p.duration ? (p.position / p.duration) * 100 : 0;
  const left = p && !p.finished && p.duration ? p.duration - p.position : null;

  return (
    <div className={`episode${current ? ' current' : ''}`}>
      <button className="episode-main" onClick={onPlay}>
        <span className="episode-play" aria-hidden>
          {p?.finished ? <CircleCheck size={20} /> : <Play size={18} fill="currentColor" />}
        </span>
        <span className="grow">
          <span className="track-title" style={{ display: 'block' }}>
            {episode.title}
          </span>
          <span className="muted small">
            {onlyHere && (
              <>
                <OnlyHereBadge />{' '}
              </>
            )}
            {new Date(episode.createdAt).toLocaleDateString()} ·{' '}
            {p?.finished
              ? t('podcasts.finished')
              : left !== null
                ? t('podcasts.left', { time: formatTime(left) })
                : formatLongDuration(episode.durationMs)}
          </span>
          {pct > 0 && (
            <span className="episode-progress">
              <span style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
      </button>
      <button
        className="icon-btn"
        onClick={() => useUi.getState().openTrackMenu(episode.id)}
        aria-label={t('common.more')}
      >
        <EllipsisVertical size={18} />
      </button>
    </div>
  );
}
