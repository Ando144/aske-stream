declare global {
  interface Window {
    __askeFakeShare?: (text: string) => void;
  }
}

const listeners = new Set<(text: string) => void>();
let pendingRead = false;

/** Browser tests call this to pretend another app shared a text with the open app. */
window.__askeFakeShare = (text) => listeners.forEach((cb) => cb(text));

/** Stand-in for a cold start: the page's `?share=` is handed out only once. */
export async function takeSharedText(): Promise<string | null> {
  if (pendingRead) return null;
  pendingRead = true;
  return new URLSearchParams(window.location.search).get('share');
}

export async function onSharedText(cb: (text: string) => void): Promise<() => void> {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

export async function fetchVideoInfo(
  videoId: string,
): Promise<{ title: string; author: string } | null> {
  return { title: `Shared song ${videoId}`, author: 'Fake channel' };
}
