import { useState } from 'react';
import type { ArtKind } from '../lib/generatedArt';
import { GeneratedArt } from './art/GeneratedArt';

export function youtubeThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

interface Props {
  videoId?: string | null;
  src?: string;
  title?: string;
  artist?: string;
  kind?: ArtKind;
  size?: number;
  className?: string;
}

/** Picture for songs that are not in this library (Jams, shared lists, downloads). */
export function SongThumb({
  videoId,
  src,
  title,
  artist = '',
  kind = 'song',
  size = 48,
  className = 'cover',
}: Props) {
  // Remembering which pictures failed lets a reused row try again with the next song.
  const [failed, setFailed] = useState<readonly string[]>([]);
  const candidates = [src, videoId ? youtubeThumb(videoId) : undefined];
  const url = candidates.find((c): c is string => !!c && !failed.includes(c));

  if (!url) {
    const seed = title ? `${title}|${artist}` : (videoId ?? src ?? '');
    return <GeneratedArt seed={seed} kind={kind} size={size} className={className} />;
  }
  return (
    <img
      className={className}
      style={size ? { width: size, height: size } : undefined}
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed((previous) => [...previous, url])}
    />
  );
}
