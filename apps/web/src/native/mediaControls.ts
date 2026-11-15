import { MediaSession as NativeMediaSession } from '@capgo/capacitor-media-session';
import { isNative } from './platform';

/**
 * Lock-screen / notification controls.
 *
 * In a browser this is the standard Media Session API. In the Android app the
 * WebView has no system media notification, so the same calls go to a native
 * media session that also runs a foreground service: that is what keeps the
 * music playing with the screen off or the app in the background.
 */

export type ControlAction =
  | 'play'
  | 'pause'
  | 'stop'
  | 'previoustrack'
  | 'nexttrack'
  | 'seekto'
  | 'seekbackward'
  | 'seekforward';

export interface ControlDetails {
  seekTime?: number | null;
  seekOffset?: number | null;
}

export interface NowPlayingInfo {
  title: string;
  artist?: string;
  album?: string;
  artwork: { src: string; sizes?: string; type?: string }[];
}

export interface MediaControls {
  setMetadata(info: NowPlayingInfo): void;
  setPlaybackState(state: 'none' | 'paused' | 'playing'): void;
  setPositionState(state: { duration: number; playbackRate: number; position: number }): void;
  setActionHandler(action: ControlAction, handler: ((d: ControlDetails) => void) | null): void;
}

const ignore = () => undefined;

function browserControls(): MediaControls | null {
  if (!('mediaSession' in navigator)) return null;
  const session = navigator.mediaSession;
  return {
    setMetadata: (info) => {
      session.metadata = new MediaMetadata(info);
    },
    setPlaybackState: (state) => {
      session.playbackState = state;
    },
    setPositionState: (state) => {
      try {
        session.setPositionState(state);
      } catch {
        // invalid while switching sources
      }
    },
    setActionHandler: (action, handler) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // action not supported by this browser
      }
    },
  };
}

function nativeControls(): MediaControls {
  return {
    setMetadata: (info) => void NativeMediaSession.setMetadata(info).catch(ignore),
    setPlaybackState: (playbackState) =>
      void NativeMediaSession.setPlaybackState({ playbackState }).catch(ignore),
    setPositionState: (state) => void NativeMediaSession.setPositionState(state).catch(ignore),
    setActionHandler: (action, handler) =>
      void NativeMediaSession.setActionHandler(
        { action },
        handler ? (d) => handler({ seekTime: d.seekTime }) : null,
      ).catch(ignore),
  };
}

/** null when the platform has no media controls at all (very old browsers). */
export const mediaControls: MediaControls | null = isNative ? nativeControls() : browserControls();
