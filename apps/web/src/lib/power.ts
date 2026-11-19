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
