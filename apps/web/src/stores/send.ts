import { create } from 'zustand';
import type { SendItem } from '@aske/shared';
import { youtubeVideoId, type SearchResult } from '@aske/shared/youtube';
import { api } from '../api/client';
import { t } from '../i18n';
import { isNative } from '../native/platform';
import { friendlyError, useDownloads } from './downloads';
import { useSetup } from './setup';
import { toast } from './ui';

/**
 * "Send to phone": the computer picks songs or playlists, the phone (which is
 * the one that can download from YouTube) picks them up and downloads them
 * into the Cloudflare library. The list lives in the owner's Cloudflare, so
 * both sides see the same thing.
 */

interface SendState {
  items: SendItem[];
  loaded: boolean;
  /** Computer: refresh the list. */
  refresh: () => Promise<void>;
  /** Computer: send a search result or a pasted link. */
  send: (item: Pick<SearchResult, 'url' | 'title' | 'author' | 'thumbnail'>) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  /** Phone: pick up what the computer sent. */
  checkInbox: () => Promise<void>;
}

const cloudflareReady = () => useSetup.getState().config?.home === 'cloudflare';
let checking = false;

export const useSend = create<SendState>((set, get) => ({
  items: [],
  loaded: false,

  async refresh() {
    if (!cloudflareReady()) return;
    try {
      set({ items: await api.sendList(), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  async send(item) {
    try {
      const created = await api.sendCreate({
        url: item.url,
        title: item.title,
        author: item.author,
        thumbnail: item.thumbnail.startsWith('https://') ? item.thumbnail : '',
      });
      set({ items: [created, ...get().items] });
      toast(t('send.sent'));
      return true;
    } catch {
      toast(t('send.failed'), 'error');
      return false;
    }
  },

  async remove(id) {
    await api.sendDelete(id).catch(() => undefined);
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  async checkInbox() {
    if (!isNative || !cloudflareReady() || checking || !navigator.onLine) return;
    checking = true;
    try {
      const pending = (await api.sendList()).filter((i) => i.status === 'pending');
      if (pending.length) toast(t('send.pickedUp', { count: pending.length }));
      for (const item of pending) {
        await api.sendUpdate(item.id, 'taken').catch(() => undefined);
        try {
          const videoId = youtubeVideoId(item.url);
          const queued = videoId
            ? await useDownloads.getState().enqueue(
                [
                  {
                    videoId,
                    title: item.title,
                    author: item.author,
                    thumbnail: item.thumbnail || undefined,
                  },
                ],
                { sendId: item.id },
              )
            : await useDownloads.getState().enqueueUrl(item.url, item.id);
          if (queued === 0) await api.sendUpdate(item.id, 'done', t('send.detailAlready'));
        } catch (err) {
          await api
            .sendUpdate(item.id, 'error', friendlyError(String((err as Error).message ?? err)))
            .catch(() => undefined);
        }
      }
    } catch {
      // offline or server unreachable: try again later
    } finally {
      checking = false;
    }
  },
}));
