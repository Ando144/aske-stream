import { AskeNative } from '../native/askeNative';

const REMOTE_HTTP = /^https?:\/\//;
const LOCAL_FILE_URL = /^https?:\/\/localhost(?::\d+)?\/_capacitor_file_/;

/** True when the audio comes from the internet (so the Wi-Fi lock is needed). */
export function isStreamingSource(src: string): boolean {
  return REMOTE_HTTP.test(src) && !LOCAL_FILE_URL.test(src);
}

/** Background network work only makes sense while the app is visible or playing. */
export function mayDoBackgroundWork(s: { hidden: boolean; playing: boolean }): boolean {
  return !s.hidden || s.playing;
}

/** What we know about the phone's power and network; `undefined` means "unknown". */
export interface PowerContext {
  charging?: boolean;
  powerSave?: boolean;
  wifi?: boolean;
}

/**
 * Offline rotation downloads a lot, so with the app hidden it only runs while the phone is
 * charging, or on Wi-Fi with battery saver off. Unknown data counts as "no".
 */
export function mayRotateOffline(s: {
  hidden: boolean;
  playing: boolean;
  power: PowerContext;
}): boolean {
  if (!s.hidden) return true;
  if (!s.playing) return false;
  if (s.power.charging === true) return true;
  return s.power.wifi === true && s.power.powerSave === false;
}

function onWifi(): boolean | undefined {
  const type = (navigator as { connection?: { type?: string } }).connection?.type;
  return type === undefined ? undefined : type === 'wifi';
}

async function readPowerContext(): Promise<PowerContext> {
  try {
    const { charging, powerSave } = await AskeNative.batteryStatus();
    return { charging, powerSave, wifi: onWifi() };
  } catch {
    return {}; // no reliable data: stay conservative
  }
}

/** Whether offline rotation may start now (reads the phone state only when hidden). */
export async function mayRotateOfflineNow(playing: boolean): Promise<boolean> {
  const hidden = document.visibilityState === 'hidden';
  if (!hidden) return true;
  return mayRotateOffline({ hidden, playing, power: await readPowerContext() });
}
