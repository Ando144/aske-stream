import { t } from '../i18n';
import { isStreamingSource } from '../lib/power';
import { AskeNative } from '../native/askeNative';
import { mediaControls } from '../native/mediaControls';
import { isNative } from '../native/platform';
import { resolveCoverDataUrl } from '../storage/media';
import { useLibrary } from '../stores/library';
import type { usePlayer } from '../stores/player';

/** Lock screen / notification controls and Android wake locks for the playback engine. */

type PlayerApi = ReturnType<typeof usePlayer.getState>;

const FALLBACK_ART = [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }];

/** The native wake lock expires after 30 min, so renew it every 10 min while music plays. */
const AWAKE_RENEW_MS = 10 * 60 * 1000;

export function createMediaSession(audio: HTMLAudioElement, player: () => PlayerApi) {
  const controls = mediaControls;

  /** Wake/Wi-Fi locks in the Android app; the native side delays the release itself. */
  let awake = false;
  let awakeStreaming = false;
  let lastAwakeCall = 0;
  let lastPositionState = 0;

  function keepAwake(playing: boolean) {
    if (!playing) {
      awake = false;
      void AskeNative.keepAwake({ playing: false }).catch(() => undefined);
      return;
    }
    // hls.js feeds radios through a blob: URL, so the source alone can't tell it is a stream.
    const streaming = player().mode === 'radio' || isStreamingSource(audio.currentSrc);
    if (awake && streaming === awakeStreaming) return;
    awake = true;
    awakeStreaming = streaming;
    lastAwakeCall = Date.now();
    void AskeNative.keepAwake({ playing: true, streaming }).catch(() => undefined);
  }

  function renewAwake() {
    if (!isNative || !awake || Date.now() - lastAwakeCall < AWAKE_RENEW_MS) return;
    lastAwakeCall = Date.now();
    void AskeNative.keepAwake({ playing: true, streaming: awakeStreaming }).catch(() => undefined);
  }

  function setPlaybackState(state: 'none' | 'paused' | 'playing') {
    // While stalled the notification keeps showing pause; setStalled(false) restores 'playing'.
    if (!(stalled && state === 'playing')) controls?.setPlaybackState(state);
    if (isNative) keepAwake(state === 'playing');
  }

  function pushPositionState() {
    if (!controls) return;
    const d = audio.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    controls.setPositionState({
      duration: d,
      playbackRate: audio.playbackRate,
      position: Math.min(audio.currentTime, d),
    });
  }

  function updatePositionState() {
    if (!controls || player().mode !== 'track') return;
    const now = performance.now();
    if (now - lastPositionState < 1000) return;
    lastPositionState = now;
    pushPositionState();
  }

  /** While the watchdog retries, the notification shows pause at the real position. */
  let stalled = false;
  let retryHandler: () => void = () => undefined;

  function setStalled(value: boolean) {
    stalled = value;
    if (!controls) return;
    if (value) {
      pushPositionState();
      // Not setPlaybackState: the wake/Wi-Fi locks must stay held while retrying.
      controls.setPlaybackState('paused');
    } else if (!audio.paused) {
      pushPositionState();
      controls.setPlaybackState('playing');
    }
  }

  function setRetryHandler(fn: () => void) {
    retryHandler = fn;
  }

  function setSeekHandlers(step = 10) {
    if (!controls) return;
    controls.setActionHandler('seekto', (d) => {
      if (d.seekTime !== undefined && d.seekTime !== null) player().seek(d.seekTime);
    });
    controls.setActionHandler('seekbackward', (d) => player().seekBy(-(d.seekOffset ?? step)));
    controls.setActionHandler('seekforward', (d) => player().seekBy(d.seekOffset ?? step * 2));
  }

  function updateMediaSession() {
    if (!controls) return;
    const s = player();
    if (s.mode === 'radio' && s.station) {
      controls.setMetadata({
        title: s.station.name,
        artist: t('player.live'),
        album: t('player.radio'),
        artwork: s.station.favicon ? [{ src: s.station.favicon }] : FALLBACK_ART,
      });
      for (const action of ['seekto', 'seekbackward', 'seekforward'] as const) {
        controls.setActionHandler(action, null);
      }
      return;
    }
    const track = s.currentId ? useLibrary.getState().tracks[s.currentId] : undefined;
    if (!track) return;
    const info = { title: track.title, artist: track.artist, album: track.album };
    controls.setMetadata({ ...info, artwork: FALLBACK_ART });
    setSeekHandlers(track.kind === 'podcast' ? 15 : 10);
    if (track.hasCover) {
      void resolveCoverDataUrl(track).then((src) => {
        if (src && player().currentId === track.id) {
          controls.setMetadata({
            ...info,
            artwork: [{ src, sizes: '512x512', type: 'image/jpeg' }],
          });
        }
      });
    }
  }

  if (controls) {
    controls.setActionHandler('play', () => {
      if (stalled && !audio.paused) retryHandler();
      else if (!player().isPlaying) player().togglePlay();
    });
    controls.setActionHandler('pause', () => player().pause());
    controls.setActionHandler('stop', () => player().pause());
    controls.setActionHandler('previoustrack', () => player().previous());
    controls.setActionHandler('nexttrack', () => player().next());
    setSeekHandlers();
  }

  return {
    keepAwake,
    renewAwake,
    setPlaybackState,
    updatePositionState,
    updateMediaSession,
    setStalled,
    setRetryHandler,
  };
}
