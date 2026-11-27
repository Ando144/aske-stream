import { Heart, Play, X } from 'lucide-react';
import type { JamItemView } from '@aske/shared/hub';
import { useT } from '../../i18n';
import { useJam } from '../../stores/jam';
import { SongThumb } from '../SongThumb';
import '../../jamPick.css';

function PrepareState({ videoId }: { videoId: string }) {
  const t = useT();
  const state = useJam((s) => s.preparing[videoId]);
  if (!state) return null;
  return <span className={`jam-prep ${state}`}>{t(`jam.prep.${state}`)}</span>;
}

function QueueItem({ item, isHost }: { item: JamItemView; isHost: boolean }) {
  const t = useT();
  const canRemove = isHost || item.mine;
  const votes = item.votes === 1 ? t('jam.votes.one') : t('jam.votes', { count: item.votes });
  return (
    <li className="jam-item">
      <SongThumb videoId={item.song.videoId} title={item.song.title} artist={item.song.artist} />
      <div className="grow">
        <div className="card-title ellipsis">{item.song.title}</div>
        <div className="muted small ellipsis">
          {item.song.artist ? `${item.song.artist} · ` : ''}
          {t('jam.addedBy', { name: item.addedBy })}
        </div>
        {isHost && <PrepareState videoId={item.song.videoId} />}
      </div>
      <button
        className={`jam-vote${item.votedByMe ? ' on' : ''}`}
        onClick={() => useJam.getState().vote(item.id)}
        aria-pressed={item.votedByMe}
        aria-label={item.votedByMe ? t('jam.unvote') : t('jam.vote')}
        title={votes}
      >
        <Heart size={18} fill={item.votedByMe ? 'currentColor' : 'none'} />
        <span>{item.votes}</span>
      </button>
      {isHost && (
        <button
          className="icon-btn"
          onClick={() => useJam.getState().playItem(item.id)}
          aria-label={t('jam.playNow')}
          title={t('jam.playNow')}
        >
          <Play size={18} />
        </button>
      )}
      {canRemove && (
        <button
          className="icon-btn"
          onClick={() => useJam.getState().remove(item.id)}
          aria-label={t('jam.remove')}
          title={t('jam.remove')}
        >
          <X size={18} />
        </button>
      )}
    </li>
  );
}

/** "Now playing" plus the sorted queue; hosts get the extra controls. */
export function JamQueue({
  nowPlaying,
  queue,
  isHost,
}: {
  nowPlaying: JamItemView | null;
  queue: JamItemView[];
  isHost: boolean;
}) {
  const t = useT();
  return (
    <>
      <h2>{t('jam.nowPlaying')}</h2>
      {nowPlaying ? (
        <div className="jam-now jam-now-art">
          <SongThumb
            videoId={nowPlaying.song.videoId}
            title={nowPlaying.song.title}
            artist={nowPlaying.song.artist}
            size={64}
          />
          <div className="grow">
            <div className="card-title ellipsis">{nowPlaying.song.title}</div>
            <div className="muted small ellipsis">
              {nowPlaying.song.artist ? `${nowPlaying.song.artist} · ` : ''}
              {t('jam.addedBy', { name: nowPlaying.addedBy })}
            </div>
          </div>
        </div>
      ) : (
        <p className="muted small">{t('jam.nothingPlaying')}</p>
      )}
      <h2>{t('jam.queue')}</h2>
      {queue.length === 0 ? (
        <p className="muted small">{t('jam.queueEmpty')}</p>
      ) : (
        <ul className="jam-list">
          {queue.map((item) => (
            <QueueItem key={item.id} item={item} isHost={isHost} />
          ))}
        </ul>
      )}
    </>
  );
}
