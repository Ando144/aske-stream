import { useMemo } from 'react';
import { CircleCheck, EllipsisVertical, Mic, Play } from 'lucide-react';
import { useT } from '../i18n';
import { formatLongDuration, formatTime } from '../lib/format';
import type { LocalTrack } from '../storage/types';
import { useAllTracks } from '../stores/library';
import { useCurrentTrackId, usePlayer } from '../stores/player';
import { usePodcasts } from '../stores/podcasts';
import { useUi } from '../stores/ui';
import { Cover } from '../components/Cover';
import { SettingsLink } from '../components/SettingsLink';
import { ScreenTip } from '../components/ScreenTip';

interface Show {
  name: string;
  episodes: LocalTrack[];
}

/**
 * Podcasts live apart from music: grouped by show (the channel or artist),
 * newest episode first, with a progress bar and resume position per episode.
 */
export function PodcastsView() {
  const t = useT();
  const all = useAllTracks();
  const progress = usePodcasts((s) => s.progress);
  const currentId = useCurrentTrackId();

  const shows = useMemo<Show[]>(() => {
    const map = new Map<string, LocalTrack[]>();
    for (const tr of all) {
      if (tr.kind !== 'podcast') continue;
      const name = tr.artist || tr.album || t('library.unknownArtist');
      map.set(name, [...(map.get(name) ?? []), tr]);
    }
    return [...map.entries()]
      .map(([name, episodes]) => ({
        name,
        episodes: episodes.sort((a, b) => b.createdAt - a.createdAt),
      }))
      .sort((a, b) => b.episodes[0]!.createdAt - a.episodes[0]!.createdAt);
  }, [all, t]);

  const play = (show: Show, id: string) =>
    usePlayer.getState().playTracks(
      show.episodes.map((e) => e.id),
      id,
      { shuffle: false, context: { label: show.name, path: '/podcasts' } },
    );

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
        <section key={show.name} className="podcast-show">
          <header className="row">
            <Cover trackId={show.episodes[0]!.id} hasCover={show.episodes[0]!.hasCover} size={56} />
            <div className="grow">
              <h2 className="ellipsis">{show.name}</h2>
              <div className="muted small">
                {t('podcasts.episodes', { count: show.episodes.length })}
              </div>
            </div>
          </header>
          {show.episodes.map((ep) => {
            const p = progress[ep.id];
            const pct = p?.finished ? 100 : p && p.duration ? (p.position / p.duration) * 100 : 0;
            const left = p && !p.finished && p.duration ? p.duration - p.position : null;
            return (
              <div key={ep.id} className={`episode${currentId === ep.id ? ' current' : ''}`}>
                <button className="episode-main" onClick={() => play(show, ep.id)}>
                  <span className="episode-play" aria-hidden>
                    {p?.finished ? (
                      <CircleCheck size={20} />
                    ) : (
                      <Play size={18} fill="currentColor" />
                    )}
                  </span>
                  <span className="grow">
                    <span className="track-title" style={{ display: 'block' }}>
                      {ep.title}
                    </span>
                    <span className="muted small">
                      {new Date(ep.createdAt).toLocaleDateString()} ·{' '}
                      {p?.finished
                        ? t('podcasts.finished')
                        : left !== null
                          ? t('podcasts.left', { time: formatTime(left) })
                          : formatLongDuration(ep.durationMs)}
                    </span>
                    {pct > 0 && !p?.finished && (
                      <span className="episode-progress">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </span>
                </button>
                <button
                  className="icon-btn"
                  onClick={() => useUi.getState().openTrackMenu(ep.id)}
                  aria-label={t('common.more')}
                >
                  <EllipsisVertical size={18} />
                </button>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
