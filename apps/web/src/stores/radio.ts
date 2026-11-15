import { create } from 'zustand';
import type { CatalogCountry, CatalogStation, CatalogTag, Station } from '@aske/shared';
import {
  countClick as rbCountClick,
  listCountries,
  listTags,
  searchStations,
} from '@aske/shared/radio-browser';
import { api, ApiError } from '../api/client';
import { t } from '../i18n';
import type { RadioItem } from './player';
import { getHome, useSetup } from './setup';
import { toast } from './ui';

interface RadioState {
  stations: Station[];
  loaded: boolean;
  load: () => Promise<void>;
  /** Heart on a catalog station: save it (liked) or remove it from "Your stations". */
  toggleCatalogLike: (station: CatalogStation) => Promise<void>;
  /** Heart on a saved station. Catalog stations are removed when unliked. */
  toggleLike: (station: Station) => Promise<void>;
  addCustom: (name: string, streamUrl: string) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
}

const sortStations = (list: Station[]) =>
  [...list].sort(
    (a, b) =>
      Number(b.likedAt !== null) - Number(a.likedAt !== null) ||
      (b.likedAt ?? 0) - (a.likedAt ?? 0) ||
      a.name.localeCompare(b.name),
  );

function reportError(err: unknown) {
  if (err instanceof ApiError && err.status === 0) toast(t('toast.offline'), 'error');
  else toast(err instanceof Error ? err.message : t('toast.error'), 'error');
}

export const useRadio = create<RadioState>((set, get) => ({
  stations: [],
  loaded: false,

  async load() {
    try {
      set({ stations: sortStations(await getHome().listStations()), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  async toggleCatalogLike(cs) {
    const saved = get().stations.find((s) => s.rbUuid === cs.rbUuid);
    try {
      if (saved) {
        await getHome().deleteStation(saved.id);
        set({ stations: get().stations.filter((s) => s.id !== saved.id) });
      } else {
        const station = await getHome().saveStation({ ...cs, liked: true });
        set({ stations: sortStations([...get().stations, station]) });
      }
    } catch (err) {
      reportError(err);
    }
  },

  async toggleLike(station) {
    try {
      if (!station.isCustom && station.likedAt !== null) {
        await getHome().deleteStation(station.id);
        set({ stations: get().stations.filter((s) => s.id !== station.id) });
        return;
      }
      const updated = await getHome().updateStation(station.id, {
        liked: station.likedAt === null,
      });
      set({
        stations: sortStations(get().stations.map((s) => (s.id === updated.id ? updated : s))),
      });
    } catch (err) {
      reportError(err);
    }
  },

  async addCustom(name, streamUrl) {
    try {
      const station = await getHome().saveStation({ name, streamUrl, liked: true });
      set({ stations: sortStations([...get().stations, station]) });
      toast(t('toast.stationSaved'));
      return true;
    } catch (err) {
      reportError(err);
      return false;
    }
  },

  async remove(id) {
    try {
      await getHome().deleteStation(id);
      set({ stations: get().stations.filter((s) => s.id !== id) });
    } catch (err) {
      reportError(err);
    }
  },
}));

const describe = (tags: string[], countryCode: string, codec: string, bitrate: number) =>
  [countryCode, tags.slice(0, 3).join(', '), bitrate ? `${codec} ${bitrate} kbps`.trim() : codec]
    .filter(Boolean)
    .join(' · ');

export const stationToItem = (s: Station): RadioItem => ({
  key: s.rbUuid ?? s.id,
  name: s.name,
  streamUrl: s.streamUrl,
  favicon: s.favicon,
  hls: s.hls,
  rbUuid: s.rbUuid,
  subtitle: describe(s.tags, s.countryCode, s.codec, s.bitrate),
});

export const catalogToItem = (s: CatalogStation): RadioItem => ({
  key: s.rbUuid,
  name: s.name,
  streamUrl: s.streamUrl,
  favicon: s.favicon,
  hls: s.hls,
  rbUuid: s.rbUuid,
  subtitle: describe(s.tags, s.countryCode, s.codec, s.bitrate),
});

/**
 * Radio Browser catalog. With a Cloudflare home it goes through the Worker
 * (cached, proper User-Agent); otherwise the app talks to the public
 * directory directly, so radio works without any server of your own.
 */
const viaWorker = () => useSetup.getState().config?.home === 'cloudflare';

export const catalog = {
  search: (
    q: {
      q?: string;
      country?: string;
      tag?: string;
      order: 'votes' | 'clickcount' | 'name' | 'trend';
      offset: number;
      limit: number;
    },
    signal?: AbortSignal,
  ): Promise<CatalogStation[]> =>
    viaWorker()
      ? api.catalog(q, signal)
      : searchStations({
          ...q,
          name: q.q || undefined,
          country: q.country || undefined,
          tag: q.tag || undefined,
        }),
  tags: (): Promise<CatalogTag[]> => (viaWorker() ? api.catalogTags() : listTags(40)),
  countries: (): Promise<CatalogCountry[]> =>
    viaWorker() ? api.catalogCountries() : listCountries(),
  click: (uuid: string) => (viaWorker() ? api.countClick(uuid) : rbCountClick(uuid)),
};
