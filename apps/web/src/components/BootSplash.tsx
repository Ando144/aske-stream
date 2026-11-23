import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { BOOT_CONNECTING_HINT_MS } from '../lib/boot';
import '../boot.css';

const BARS = [
  { x: 13, y: 26, height: 12 },
  { x: 23, y: 18, height: 28 },
  { x: 33, y: 12, height: 40 },
  { x: 43, y: 22, height: 20 },
];

function BootLogo() {
  return (
    <svg className="boot-logo" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <clipPath id="boot-clip">
          {BARS.map((b) => (
            <rect key={b.x} x={b.x} y={b.y} width="6" height={b.height} rx="3" />
          ))}
        </clipPath>
        <linearGradient id="boot-flash-gradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" className="boot-flash-start" />
          <stop offset="0.5" className="boot-flash-mid" />
          <stop offset="1" className="boot-flash-start" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#14110f" />
      <g>
        {BARS.map((b) => (
          <rect
            key={b.x}
            className="boot-bar"
            x={b.x}
            y={b.y}
            width="6"
            height={b.height}
            rx="3"
            pathLength="1"
          />
        ))}
      </g>
      <g clipPath="url(#boot-clip)">
        <rect
          className="boot-flash"
          x="0"
          y="0"
          width="24"
          height="64"
          fill="url(#boot-flash-gradient)"
        />
      </g>
    </svg>
  );
}

/** Full-screen opening screen: shown while the app starts, never a bare spinner. */
export function BootSplash({ leaving = false }: { leaving?: boolean }) {
  const t = useT();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), BOOT_CONNECTING_HINT_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={`boot-splash${leaving ? ' leaving' : ''}`} aria-label={t('boot.loading')}>
      <div className="boot-pulse">
        <BootLogo />
      </div>
      <p className="boot-hint small" aria-live="polite">
        {slow && !leaving ? t('boot.connecting') : ''}
      </p>
    </div>
  );
}
