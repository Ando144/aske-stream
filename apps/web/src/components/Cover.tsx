import { useEffect, useState } from 'react';
import { Music } from 'lucide-react';
import { resolveCoverUrl } from '../storage/media';
import { useLibrary } from '../stores/library';

interface Props {
  trackId: string | null | undefined;
  hasCover: boolean;
  size?: number;
  className?: string;
}

/** Cover art from wherever the song is stored (device or cloud), with a placeholder. */
export function Cover({ trackId, hasCover, size = 48, className = 'cover' }: Props) {
  const track = useLibrary((s) => (trackId ? s.tracks[trackId] : undefined));
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!track || !hasCover) {
      setSrc(null);
      return;
    }
    const resolved = resolveCoverUrl(track);
    if (resolved === null || typeof resolved === 'string') {
      setSrc(resolved);
      return;
    }
    let alive = true;
    void resolved.then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [track, hasCover]);

  const style = size ? { width: size, height: size } : undefined;
  if (!src || failed) {
    return (
      <div className={className} style={style} aria-hidden>
        <Music size={size ? Math.round(size * 0.42) : 64} />
      </div>
    );
  }
  return (
    <img
      className={className}
      style={style}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
