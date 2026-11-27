import { create } from 'zustand';
import { onSharedText, takeSharedText } from '../native/shareTarget';
import { parseSharedText, type SharedLink } from '../share/sharedLink';

interface ShareInState {
  /** What another app shared and the user has not dealt with yet. */
  pending: SharedLink | null;
  receive(text: string): void;
  clear(): void;
}

export const useShareIn = create<ShareInState>((set) => ({
  pending: null,
  receive: (text) => set({ pending: parseSharedText(text) }),
  clear: () => set({ pending: null }),
}));

/** Listens for "Share → Aske Stream"; returns the function that stops listening. */
export function startShareIn(): () => void {
  let stopped = false;
  let receivedLive = false;
  let unsubscribe: (() => void) | undefined;

  // Read even if stopped meanwhile: the native side has already forgotten this text.
  void takeSharedText().then((text) => {
    if (text !== null && !receivedLive) useShareIn.getState().receive(text);
  });
  void onSharedText((text) => {
    receivedLive = true;
    useShareIn.getState().receive(text);
  }).then((stop) => {
    if (stopped) stop();
    else unsubscribe = stop;
  });

  return () => {
    stopped = true;
    unsubscribe?.();
  };
}
