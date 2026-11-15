import { useState } from 'react';
import { Music } from 'lucide-react';
import { coverUrl } from '../api/client';

interface Props {
  trackId: string | null | undefined;
  hasCover: boolean;
  size?: number;
  className?: string;
}

export function Cover({ trackId, hasCover, size = 48, className = 'cover' }: Props) {
  const [failed, setFailed] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  if (!trackId || !hasCover || failed) {
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
      src={coverUrl(trackId)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
