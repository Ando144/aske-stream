import { ListMusic, Mic, Music } from 'lucide-react';
import { artColors, type ArtKind } from '../../lib/generatedArt';
import '../../art.css';

const ICONS = { song: Music, playlist: ListMusic, podcast: Mic };

/** Placeholder picture; without a size it fills its parent. */
export function GeneratedArt({
  seed,
  kind,
  size,
  className,
}: {
  seed: string;
  kind: ArtKind;
  size?: number;
  className?: string;
}) {
  const { from, to, angle, ink } = artColors(seed);
  const Icon = ICONS[kind];
  return (
    <div
      className={className ? `gen-art ${className}` : 'gen-art'}
      style={{
        background: `linear-gradient(${angle}deg, ${from}, ${to})`,
        color: ink,
        ...(size ? { width: size, height: size } : null),
      }}
      aria-hidden
    >
      <Icon />
    </div>
  );
}
