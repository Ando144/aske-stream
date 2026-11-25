import { Shuffle } from 'lucide-react';
import { useT } from '../i18n';
import { usePlayer } from '../stores/player';
import { toast } from '../stores/ui';

export function ShuffleToggle({ size = 22, disabled }: { size?: number; disabled?: boolean }) {
  const t = useT();
  const shuffle = usePlayer((s) => s.shuffle);
  const onClick = () => {
    usePlayer.getState().toggleShuffle();
    toast(t(usePlayer.getState().shuffle ? 'player.shuffleOn' : 'player.shuffleOff'));
  };
  return (
    <button
      className={`icon-btn${shuffle ? ' on' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={t('player.shuffle')}
      title={t('player.shuffle')}
      aria-pressed={shuffle}
    >
      <Shuffle size={size} />
    </button>
  );
}
