import type { CatalogCountry, CatalogStation, CatalogTag } from './index';

/**
 * Thin client (Worker and browser) for the community-run Radio Browser directory
 * (https://api.radio-browser.info). Following their guidelines we discover
 * mirrors dynamically, spread load randomly, identify ourselves with a
 * User-Agent and cache aggressively.
 */

/** Browsers do not let scripts set User-Agent; the Worker does (see configureRadioBrowser). */
let uaHeaders: Record<string, string> = {};
export function configureRadioBrowser(opts: { userAgent?: string }) {
  uaHeaders = opts.userAgent ? { 'User-Agent': opts.userAgent } : {};
}

export class RadioBrowserUnavailable extends Error {
  constructor() {
    super('The radio catalog is not reachable right now');
  }
}
const FALLBACK_HOSTS = [
  'de2.api.radio-browser.info',
  'fi1.api.radio-browser.info',
  'nl1.api.radio-browser.info',
  'at1.api.radio-browser.info',
];
const HOSTS_TTL_MS = 6 * 60 * 60 * 1000;

let hostCache: { hosts: string[]; at: number } | null = null;
/** Per-isolate memory cache; survives between requests served by the same isolate. */
const memory = new Map<string, { data: unknown; expires: number }>();

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function getHosts(): Promise<string[]> {
  if (hostCache && Date.now() - hostCache.at < HOSTS_TTL_MS) return shuffle(hostCache.hosts);
  try {
    const res = await fetch('https://all.api.radio-browser.info/json/servers', {
      headers: uaHeaders,
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const list = (await res.json()) as { name?: string }[];
      const hosts = [...new Set(list.map((s) => s.name ?? ''))].filter((n) =>
        /^[a-z0-9-]+\.api\.radio-browser\.info$/.test(n),
      );
      if (hosts.length) {
        hostCache = { hosts, at: Date.now() };
        return shuffle(hosts);
      }
    }
  } catch {
    // fall through to the static list
  }
  return shuffle(FALLBACK_HOSTS);
}

async function rbFetch(
  path: string,
  params: URLSearchParams,
  ttlSeconds: number,
): Promise<unknown> {
  params.sort();
  const key = `${path}?${params}`;
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;

  const hosts = (await getHosts()).slice(0, 3);
  for (const host of hosts) {
    try {
      const res = await fetch(`https://${host}${key}`, {
        headers: { ...uaHeaders, Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data: unknown = await res.json();
      if (memory.size > 200) memory.clear();
      memory.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
      return data;
    } catch {
      // try the next mirror
    }
  }
  throw new RadioBrowserUnavailable();
}

interface RbStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  countrycode: string;
  tags: string;
  codec: string;
  bitrate: number;
  hls: number;
  votes: number;
  clickcount: number;
  lastcheckok: number;
}

const httpsOrEmpty = (u: string | undefined) => (u && u.startsWith('https://') ? u : '');

export function mapStation(s: RbStation): CatalogStation | null {
  // Prefer an https URL; keep http-only stations too (they play in the Android app).
  const candidates = [s.url_resolved, s.url].filter(
    (u): u is string => !!u && /^https?:\/\//.test(u),
  );
  const streamUrl = candidates.find((u) => u.startsWith('https://')) ?? candidates[0] ?? '';
  if (!streamUrl || !s.stationuuid || s.lastcheckok === 0) return null;
  return {
    rbUuid: s.stationuuid,
    name: (s.name ?? '').trim() || 'Unknown station',
    streamUrl,
    homepage: s.homepage ?? '',
    favicon: httpsOrEmpty(s.favicon),
    countryCode: (s.countrycode ?? '').toUpperCase(),
    tags: (s.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8),
    codec: s.codec ?? '',
    bitrate: Number(s.bitrate) || 0,
    hls: s.hls === 1,
    votes: Number(s.votes) || 0,
    clickCount: Number(s.clickcount) || 0,
  };
}

export interface CatalogQuery {
  name?: string;
  country?: string;
  tag?: string;
  order: 'votes' | 'clickcount' | 'name' | 'trend';
  offset: number;
  limit: number;
}

export async function searchStations(q: CatalogQuery): Promise<CatalogStation[]> {
  const base = () =>
    new URLSearchParams({
      hidebroken: 'true',
      offset: String(q.offset),
      limit: String(q.limit),
      order: q.order === 'trend' ? 'clicktrend' : q.order,
      reverse: q.order === 'name' ? 'false' : 'true',
    });
  const withFilters = (params: URLSearchParams) => {
    if (q.country) params.set('countrycode', q.country);
    if (q.tag) params.set('tag', q.tag);
    return params;
  };
  const requests: Promise<unknown>[] = [];
  const byName = withFilters(base());
  if (q.name) byName.set('name', q.name);
  requests.push(rbFetch('/json/stations/search', byName, 15 * 60));
  // "eitb" or "rock" may be a tag rather than part of the name: search both.
  if (q.name && !q.tag) {
    const byTag = withFilters(base());
    byTag.set('tag', q.name.toLowerCase());
    requests.push(rbFetch('/json/stations/search', byTag, 15 * 60).catch(() => []));
  }
  const pages = (await Promise.all(requests)) as RbStation[][];
  const seen = new Set<string>();
  const out: CatalogStation[] = [];
  for (const st of pages.flat()) {
    const mapped = mapStation(st);
    if (mapped && !seen.has(mapped.rbUuid)) {
      seen.add(mapped.rbUuid);
      out.push(mapped);
    }
  }
  return out;
}

export async function listTags(limit: number): Promise<CatalogTag[]> {
  const params = new URLSearchParams({
    order: 'stationcount',
    reverse: 'true',
    hidebroken: 'true',
    limit: String(limit),
  });
  const data = (await rbFetch('/json/tags', params, 24 * 3600)) as {
    name: string;
    stationcount: number;
  }[];
  return data.map((t) => ({ name: t.name, stationCount: t.stationcount }));
}

export async function listCountries(): Promise<CatalogCountry[]> {
  const params = new URLSearchParams({ order: 'name', hidebroken: 'true' });
  const data = (await rbFetch('/json/countries', params, 24 * 3600)) as {
    name: string;
    iso_3166_1: string;
    stationcount: number;
  }[];
  return data
    .filter((c) => c.iso_3166_1 && c.stationcount > 0)
    .map((c) => ({ code: c.iso_3166_1.toUpperCase(), name: c.name, stationCount: c.stationcount }));
}

/** Radio Browser asks clients to report plays so popular stations rank higher. */
export async function countClick(uuid: string): Promise<void> {
  const [host] = await getHosts();
  try {
    await fetch(`https://${host}/json/url/${encodeURIComponent(uuid)}`, {
      headers: uaHeaders,
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // best effort
  }
}
