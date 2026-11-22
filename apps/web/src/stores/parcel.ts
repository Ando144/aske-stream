import { create } from 'zustand';
import {
  HUB_LIMITS,
  isVideoId,
  parseParcelInput,
  type CreatedParcel,
  type HubSong,
} from '@aske/shared/hub';
import type { SearchResult } from '@aske/shared/youtube';
import { cancelParcel, claimParcel, createParcel, getParcelStatus, HubError } from '../hub/client';
import { hubErrorText } from '../hub/errors';
import { t, type MessageKey } from '../i18n';
import { parcelEn } from '../i18n/parcel';
import type { LocalTrack } from '../storage/types';
import { useDownloads } from './downloads';
import { useLibrary } from './library';
import { toast } from './ui';

export type ParcelPhase = 'waiting' | 'received' | 'expired';
export interface ActiveParcel extends CreatedParcel {
  phase: ParcelPhase;
}
export type ReceiveOutcome = 'ok' | 'invalid' | 'error';
interface PlaylistMeta {
  name: string;
  unavailable: number;
}

interface ParcelState {
  /** Computer: songs picked so far (memory only). */
  basket: HubSong[];
  /** Parcel already created and shown with its QR. */
  current: ActiveParcel | null;
  busy: boolean;
  /** Code that arrived through a #send= link. */
  pendingCode: string | null;
  add: (song: HubSong) => boolean;
  remove: (videoId: string) => void;
  clear: () => void;
  create: () => Promise<boolean>;
  sendTracks: (trackIds: readonly string[]) => Promise<boolean>;
  sendPlaylist: (playlist: {
    name: string;
    songs: HubSong[];
    unavailable: number;
  }) => Promise<boolean>;
  poll: () => Promise<void>;
  cancel: () => Promise<void>;
  dismiss: () => void;
  setPendingCode: (code: string | null) => void;
  receive: (input: string) => Promise<ReceiveOutcome>;
}

export function songFromResult(r: Pick<SearchResult, 'id' | 'title' | 'author'>): HubSong {
  return { videoId: r.id, title: r.title, artist: r.author };
}

/** Sendable (YouTube) songs without duplicates, in order; skipped = not sendable. */
export function songsFromTracks(tracks: readonly LocalTrack[]): {
  songs: HubSong[];
  skipped: number;
} {
  const songs: HubSong[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const tr of tracks) {
    const ref = tr.sourceRef;
    if (tr.source !== 'youtube' || !ref || !isVideoId(ref)) {
      skipped++;
      continue;
    }
    if (seen.has(ref)) continue;
    seen.add(ref);
    songs.push({ videoId: ref, title: tr.title, artist: tr.artist, durationMs: tr.durationMs });
  }
  return { songs, skipped };
}

export function phaseWhenMissing(expiresAt: number, now: number): ParcelPhase {
  return now < expiresAt ? 'received' : 'expired';
}

export function receivedMessage(
  queued: number,
  name: string,
  unavailable: number,
  translate: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  let base: string;
  if (queued === 0) base = translate('parcel.nothingNew');
  else if (name) base = translate('pick.gotPlaylist', { count: queued, name });
  else base = translate('parcel.gotSongs', { count: queued });
  if (unavailable > 0) base += ' ' + translate('pick.unavailableSummary', { count: unavailable });
  return base;
}

export function parcelErrorText(err: unknown): string {
  if (err instanceof HubError) {
    const key = `parcel.err.${err.code}`;
    if (key in parcelEn) return t(key as MessageKey);
  }
  return hubErrorText(err);
}

export const useParcel = create<ParcelState>((set, get) => {
  const start = async (songs: HubSong[], meta?: PlaylistMeta): Promise<boolean> => {
    set({ busy: true });
    try {
      const created = await (meta ? createParcel(songs, meta) : createParcel(songs));
      set({ current: { ...created, phase: 'waiting' } });
      return true;
    } catch (err) {
      toast(parcelErrorText(err), 'error');
      return false;
    } finally {
      set({ busy: false });
    }
  };

  return {
    basket: [],
    current: null,
    busy: false,
    pendingCode: null,

    add(song) {
      const { basket } = get();
      if (basket.some((s) => s.videoId === song.videoId)) {
        toast(t('parcel.already'));
        return false;
      }
      if (basket.length >= HUB_LIMITS.parcelMaxSongs) {
        toast(t('parcel.full', { count: HUB_LIMITS.parcelMaxSongs }));
        return false;
      }
      set({ basket: [...basket, song] });
      toast(t('parcel.added'));
      return true;
    },

    remove(videoId) {
      set({ basket: get().basket.filter((s) => s.videoId !== videoId) });
    },

    clear() {
      set({ basket: [] });
    },

    async create() {
      const { basket, busy } = get();
      if (busy || basket.length === 0) return false;
      const ok = await start(basket);
      if (ok) set({ basket: [] });
      return ok;
    },

    async sendTracks(trackIds) {
      if (get().busy) return false;
      const byId = useLibrary.getState().tracks;
      const tracks = trackIds.map((id) => byId[id]).filter((tr): tr is LocalTrack => !!tr);
      const { songs, skipped } = songsFromTracks(tracks);
      if (songs.length === 0) {
        toast(t('parcel.noYoutube'), 'error');
        return false;
      }
      if (songs.length > HUB_LIMITS.parcelMaxSongs) {
        toast(t('parcel.full', { count: HUB_LIMITS.parcelMaxSongs }), 'error');
        return false;
      }
      if (skipped > 0) toast(t('parcel.skipped', { count: skipped }));
      return start(songs);
    },

    async sendPlaylist({ name, songs, unavailable }) {
      if (get().busy) return false;
      if (songs.length === 0) {
        toast(t('pick.noneSelected'), 'error');
        return false;
      }
      if (songs.length > HUB_LIMITS.parcelMaxSongs) {
        toast(t('parcel.full', { count: HUB_LIMITS.parcelMaxSongs }), 'error');
        return false;
      }
      return start(songs, { name, unavailable });
    },

    async poll() {
      const { current } = get();
      if (current?.phase !== 'waiting') return;
      const setPhase = (phase: ParcelPhase) => {
        if (get().current?.code === current.code) set({ current: { ...current, phase } });
      };
      if (Date.now() >= current.expiresAt) return setPhase('expired');
      try {
        await getParcelStatus(current.code, current.senderKey);
      } catch (err) {
        if (!(err instanceof HubError)) return;
        if (err.status === 404) setPhase(phaseWhenMissing(current.expiresAt, Date.now()));
        else if (err.status === 410) setPhase('expired');
        // network or other errors: the next poll retries
      }
    },

    async cancel() {
      const { current } = get();
      if (!current) return;
      try {
        await cancelParcel(current.code, current.senderKey);
      } catch (err) {
        // Already received or expired: nothing left to delete in the Hub.
        if (!(err instanceof HubError && err.status === 404)) {
          toast(parcelErrorText(err), 'error');
          return;
        }
      }
      set({ current: null });
      toast(t('parcel.canceled'));
    },

    dismiss() {
      set({ current: null });
    },

    setPendingCode(code) {
      set({ pendingCode: code });
    },

    async receive(input) {
      const code = parseParcelInput(input);
      if (!code) return 'invalid';
      let claimed;
      try {
        claimed = await claimParcel(code);
      } catch (err) {
        toast(parcelErrorText(err), 'error');
        return 'error';
      }
      const { songs, name, unavailable } = claimed;
      try {
        const items = songs.map((s) => ({ videoId: s.videoId, title: s.title, author: s.artist }));
        const queued = await useDownloads
          .getState()
          .enqueue(items, name ? { playlistName: name, playlistMode: 'new' } : {});
        toast(receivedMessage(queued, name ?? '', unavailable ?? 0, t));
        return 'ok';
      } catch (err) {
        // The parcel is already deleted from the Hub, so a retry with this code cannot work.
        console.error('Could not queue the received songs', err);
        toast(t('parcel.err.enqueueFailed'), 'error');
        return 'error';
      }
    },
  };
});
