import { create } from 'zustand';
import { loadValue, savePref } from '../lib/storage';

/** A link this device created, kept so its owner can stop sharing later. */
export interface MyShare {
  playlistId: string;
  id: string;
  deleteKey: string;
  expiresAt: number;
}

const KEY = 'hub-shares-v1';

interface SharedListsState {
  shares: MyShare[];
  /** Live link of a playlist, if any. */
  forPlaylist: (playlistId: string) => MyShare | undefined;
  add: (share: MyShare) => void;
  remove: (id: string) => void;
}

const alive = (list: MyShare[]) => list.filter((s) => s.expiresAt > Date.now());

export const useSharedLists = create<SharedListsState>((set, get) => {
  const store = (shares: MyShare[]) => {
    savePref(KEY, shares);
    set({ shares });
  };
  return {
    shares: alive(loadValue<MyShare[]>(KEY, [])),
    forPlaylist: (playlistId) => alive(get().shares).find((s) => s.playlistId === playlistId),
    add: (share) =>
      store([...alive(get().shares).filter((s) => s.playlistId !== share.playlistId), share]),
    remove: (id) => store(get().shares.filter((s) => s.id !== id)),
  };
});
