import { CapacitorHttp, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { withTimeout } from '../lib/timeout';
import { isNative } from './platform';

/** Native plugin (apps/mobile/android/.../ShareTargetPlugin.java). */
export interface ShareTargetPlugin {
  /** Text shared while the app was closed; it is cleared once read. */
  takePending(): Promise<{ text: string | null }>;
  addListener(
    event: 'shared',
    listener: (p: { text: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const ShareTarget = registerPlugin<ShareTargetPlugin>('ShareTarget');

const VIDEO_INFO_TIMEOUT_MS = 8000;

export async function takeSharedText(): Promise<string | null> {
  if (!isNative) return null;
  try {
    const { text } = await ShareTarget.takePending();
    return text ?? null;
  } catch (err) {
    console.error('Could not read the shared text', err);
    return null;
  }
}

/** Calls `cb` for every text shared while the app is open; resolves to the unsubscribe. */
export async function onSharedText(cb: (text: string) => void): Promise<() => void> {
  if (!isNative) return () => {};
  try {
    const handle = await ShareTarget.addListener('shared', ({ text }) => cb(text));
    return () => void handle.remove();
  } catch (err) {
    console.error('Could not listen for shared texts', err);
    return () => {};
  }
}

/** Title and channel from YouTube's public oEmbed; null for private videos or without network. */
export async function fetchVideoInfo(
  videoId: string,
): Promise<{ title: string; author: string } | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await withTimeout(
      CapacitorHttp.get({
        url: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`,
        responseType: 'json',
        connectTimeout: VIDEO_INFO_TIMEOUT_MS,
        readTimeout: VIDEO_INFO_TIMEOUT_MS,
      }),
      VIDEO_INFO_TIMEOUT_MS,
    );
    if (res.status !== 200) return null;
    const data = res.data as { title?: unknown; author_name?: unknown } | null;
    if (typeof data?.title !== 'string' || !data.title) return null;
    return {
      title: data.title,
      author: typeof data.author_name === 'string' ? data.author_name : '',
    };
  } catch (err) {
    console.error('Could not read the video title', err);
    return null;
  }
}
