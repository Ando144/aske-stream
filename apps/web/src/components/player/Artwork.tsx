import { useState } from 'react';
import { Music, Radio } from 'lucide-react';
import { Cover } from '../Cover';
import type { PlayingInfo } from './usePlayingInfo';

export function Artwork({
  info,
  size,
  className,
}: {
  info: PlayingInfo;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const style = size ? { width: size, height: size } : undefined;
  const iconSize = size ? Math.round(size * 0.42) : 64;
  if (info.kind === 'radio') {
    const showImg = info.favicon && failed !== info.favicon;
    return (
      <div className={className ?? 'station-logo'} style={style}>
        {showImg ? (
          <img src={info.favicon} alt="" onError={() => setFailed(info.favicon)} />
        ) : (
          <Radio size={iconSize} />
        )}
      </div>
    );
  }
  if (info.kind === 'track') {
    return (
      <Cover
        trackId={info.trackId}
        hasCover={info.hasCover}
        size={size}
        className={className ?? 'cover'}
      />
    );
  }
  return (
    <div className={className ?? 'cover'} style={style}>
      <Music size={iconSize} />
    </div>
  );
}
