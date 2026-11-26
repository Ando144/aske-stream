import { useState } from 'react';
import { Music } from 'lucide-react';

export function youtubeThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

/** Public YouTube thumbnail for songs that are not in this library (Jams, shared lists). */
export function SongThumb({ videoId, size = 48 }: { videoId: string; size?: number }) {
  // Remembering which video failed lets a reused row try again with the next one.
  const [failedId, setFailedId] = useState<string | null>(null);
  const style = { width: size, height: size };

  if (failedId === videoId) {
    return (
      <div className="cover" style={style} aria-hidden>
        <Music size={Math.round(size * 0.42)} />
      </div>
    );
  }
  return (
    <img
      className="cover"
      style={style}
      src={youtubeThumb(videoId)}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedId(videoId)}
    />
  );
}
