import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

export interface PromptRequest {
  title: string;
  placeholder: string;
  initial: string;
  confirmLabel: string;
  resolve: (value: string | null) => void;
}

interface UiState {
  toasts: Toast[];
  nowPlayingOpen: boolean;
  /** Track ids for the "add to playlist" sheet; null when closed. */
  playlistSheet: string[] | null;
  /** Song whose ⋮ menu is open (and the playlist it was opened from, if any). */
  trackMenu: { trackId: string; playlistId?: string } | null;
  confirm: ConfirmRequest | null;
  prompt: PromptRequest | null;
  online: boolean;
  /** Multi-select mode: selected track ids, or null when not selecting. */
  selection: string[] | null;
  /** When picking songs for a playlist ("Add songs"). */
  selectionTarget: { playlistId: string; name: string } | null;
  /** Ids of the list currently on screen, for "Select all". */
  visibleIds: string[];

  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  setNowPlayingOpen: (open: boolean) => void;
  openPlaylistSheet: (trackIds: string[]) => void;
  closePlaylistSheet: () => void;
  openTrackMenu: (trackId: string, playlistId?: string) => void;
  closeTrackMenu: () => void;
  startSelection: (firstId?: string, target?: UiState['selectionTarget']) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  endSelection: () => void;
  setVisibleIds: (ids: string[]) => void;
}

let toastId = 0;

export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  nowPlayingOpen: false,
  playlistSheet: null,
  trackMenu: null,
  selection: null,
  selectionTarget: null,
  visibleIds: [],
  confirm: null,
  prompt: null,
  online: navigator.onLine,

  toast: (message, tone = 'info') => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone }] });
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 5000 : 2800);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setNowPlayingOpen: (nowPlayingOpen) => set({ nowPlayingOpen }),
  openPlaylistSheet: (trackIds) => set({ playlistSheet: trackIds }),
  closePlaylistSheet: () => set({ playlistSheet: null }),
  openTrackMenu: (trackId, playlistId) => set({ trackMenu: { trackId, playlistId } }),
  closeTrackMenu: () => set({ trackMenu: null }),
  startSelection: (firstId, target = null) =>
    set({ selection: firstId ? [firstId] : [], selectionTarget: target }),
  toggleSelected: (id) => {
    const sel = get().selection ?? [];
    set({ selection: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] });
  },
  selectAll: () => {
    const sel = get().selection ?? [];
    const all = get().visibleIds;
    set({ selection: sel.length === all.length ? [] : [...all] });
  },
  endSelection: () => set({ selection: null, selectionTarget: null }),
  setVisibleIds: (visibleIds) => set({ visibleIds }),
}));

/** Promise-based confirm dialog rendered by <Dialogs />. */
export function confirmDialog(
  message: string,
  confirmLabel: string,
  danger = false,
): Promise<boolean> {
  return new Promise((resolve) => {
    useUi.setState({
      confirm: {
        message,
        confirmLabel,
        danger,
        resolve: (ok) => {
          useUi.setState({ confirm: null });
          resolve(ok);
        },
      },
    });
  });
}

/** Promise-based text prompt rendered by <Dialogs />. Resolves null on cancel. */
export function promptDialog(opts: Omit<PromptRequest, 'resolve'>): Promise<string | null> {
  return new Promise((resolve) => {
    useUi.setState({
      prompt: {
        ...opts,
        resolve: (value) => {
          useUi.setState({ prompt: null });
          resolve(value);
        },
      },
    });
  });
}

export const toast = (message: string, tone?: Toast['tone']) =>
  useUi.getState().toast(message, tone);

window.addEventListener('online', () => useUi.setState({ online: true }));
window.addEventListener('offline', () => useUi.setState({ online: false }));
