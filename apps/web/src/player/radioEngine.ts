import { t } from '../i18n';
import { catalog } from '../stores/radio';
import { toast } from '../stores/ui';
import { audio, resetSource, rt } from './runtime';
import type { RadioItem } from './types';

export interface RadioDeps {
  set: (partial: {
    mode?: 'radio';
    station?: RadioItem;
    position?: number;
    duration?: number;
    buffering?: boolean;
    isPlaying?: boolean;
    rate?: number;
  }) => void;
  updateMediaSession: () => void;
}

/** Next (dir 1) or previous (dir -1) station, wrapping around; null if there is nowhere to go. */
export function stationAt(
  list: RadioItem[],
  currentKey: string | undefined,
  dir: 1 | -1,
): RadioItem | null {
  if (list.length < 2) return null;
  const i = list.findIndex((x) => x.key === currentKey);
  return list[(i + dir + list.length) % list.length] ?? null;
}

/** Web apps served over HTTPS cannot play http:// streams; try the https variant first. */
function upgradedUrl(url: string, forced: boolean): string {
  rt.triedHttpsUpgrade = false;
  if (!forced && url.startsWith('http://') && location.protocol === 'https:') {
    rt.triedHttpsUpgrade = true;
    return `https://${url.slice('http://'.length)}`;
  }
  return url;
}

async function attachStream(url: string, isHls: boolean, seq: number): Promise<void> {
  if (isHls && !audio.canPlayType('application/vnd.apple.mpegurl')) {
    const { default: HlsLib } = await import('hls.js/light');
    if (seq !== rt.loadSeq) return;
    if (HlsLib.isSupported()) {
      rt.hls = new HlsLib({ enableWorker: true, lowLatencyMode: false });
      rt.hls.loadSource(url);
      rt.hls.attachMedia(audio);
      return;
    }
  }
  audio.src = url;
}

export async function startRadio(
  item: RadioItem,
  deps: RadioDeps,
  forceUrl?: string,
): Promise<void> {
  if (!navigator.onLine) {
    toast(t('radio.offline'), 'error');
    return;
  }
  const seq = ++rt.loadSeq;
  resetSource();
  const url = upgradedUrl(forceUrl ?? item.streamUrl, !!forceUrl);
  deps.set({ mode: 'radio', station: item, position: 0, duration: 0, buffering: true, rate: 1 });
  audio.playbackRate = 1;
  await attachStream(url, item.hls || /\.m3u8(\?|$)/i.test(url), seq);
  if (seq !== rt.loadSeq) return;
  deps.updateMediaSession();
  audio.play().catch(() => deps.set({ isPlaying: false, buffering: false }));
  if (item.rbUuid && !forceUrl) void catalog.click(item.rbUuid);
}
