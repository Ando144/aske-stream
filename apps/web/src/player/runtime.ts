import type Hls from 'hls.js';

/** The single <audio> element of the app session (keeps playing in the background on mobile). */
export const audio = new Audio();
audio.preload = 'auto';

/** Mutable engine state shared by the player modules. */
export const rt: {
  hls: Hls | null;
  objectUrl: string | null;
  loadSeq: number;
  pendingSeek: number | null;
  /** Watchdog reload loading: its errors go back to the watchdog. */
  reloading: boolean;
  listenedMarked: boolean;
  consecutiveErrors: number;
  triedHttpsUpgrade: boolean;
  /** Bumped on every pause the user asked for; loads compare it around their awaits. */
  userPauseSeq: number;
} = {
  hls: null,
  objectUrl: null,
  loadSeq: 0,
  pendingSeek: null,
  reloading: false,
  listenedMarked: false,
  consecutiveErrors: 0,
  triedHttpsUpgrade: false,
  userPauseSeq: 0,
};

export function resetSource(): void {
  if (rt.hls) {
    rt.hls.destroy();
    rt.hls = null;
  }
  if (rt.objectUrl) {
    URL.revokeObjectURL(rt.objectUrl);
    rt.objectUrl = null;
  }
}

/** Pause asked by the user (not by the system or the watchdog). */
export function userPause(): void {
  rt.userPauseSeq++;
  audio.pause();
}
