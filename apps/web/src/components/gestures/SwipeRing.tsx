import { ListEnd, Users } from 'lucide-react';
import '../../swipe.css';

const ICONS = { queue: ListEnd, jam: Users };
const MIN_SCALE = 0.6;
const FADE_IN_SPEED = 1.5;

/** Circle that grows while a list row is swiped and fills up once it can be released. */
export function SwipeRing({ progress, icon }: { progress: number; icon: 'queue' | 'jam' }) {
  if (progress <= 0) return null;
  const Icon = ICONS[icon];
  const filled = Math.min(1, progress);
  return (
    <span
      className={`swipe-ring${filled === 1 ? ' full' : ''}`}
      style={{
        opacity: Math.min(1, filled * FADE_IN_SPEED),
        transform: `scale(${MIN_SCALE + filled * (1 - MIN_SCALE)})`,
        background: `conic-gradient(var(--accent) ${filled * 360}deg, var(--border) 0)`,
      }}
      aria-hidden
    >
      <span className="swipe-ring-core">
        <Icon size={20} />
      </span>
    </span>
  );
}
