import { Smartphone } from 'lucide-react';
import { useT } from '../i18n';

/** Marks a song that is stored only on this phone. */
export function OnlyHereBadge({ size = 14 }: { size?: number }) {
  const t = useT();
  return (
    <Smartphone className="badge-offline" size={size} role="img" aria-label={t('local.badge')} />
  );
}
