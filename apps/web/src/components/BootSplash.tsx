import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { BOOT_PULSE_AFTER_MS, shouldPulse } from '../lib/boot';
import '../boot.css';

// Keep in sync with the static copy in index.html, so nothing jumps when React takes over.
const BARS = [
  { x: 13, y: 26, height: 12 },
  { x: 23, y: 18, height: 28 },
  { x: 33, y: 12, height: 40 },
  { x: 43, y: 22, height: 20 },
];

function BootLogo() {
  return (
    <svg className="boot-logo" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#14110f" />
      {BARS.map((b) => (
        <rect key={b.x} className="boot-bar" x={b.x} y={b.y} width="6" height={b.height} rx="3" />
      ))}
    </svg>
  );
}

function usePulsing(): boolean {
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(
      () => setPulsing(shouldPulse(BOOT_PULSE_AFTER_MS, reducedMotion)),
      BOOT_PULSE_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, []);
  return pulsing;
}

/** Full-screen opening screen: only the logo, which pulses if starting takes a while. */
export function BootSplash({ leaving = false }: { leaving?: boolean }) {
  const t = useT();
  const pulsing = usePulsing();
  const classes = ['boot-splash', pulsing && 'pulsing', leaving && 'leaving']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} role="status" aria-label={t('boot.loading')}>
      <div className="boot-pulse">
        <BootLogo />
      </div>
    </div>
  );
}
