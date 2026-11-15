/** Pure helpers for in-app updates (unit-tested). */

export interface ReleaseInfo {
  version: string;
  notes: string;
  apkUrl: string;
  apkBytes: number;
  publishedAt: string;
}

/** "v0.10.2" / "0.10.2" → [0, 10, 2]; anything after a "-" (pre-release) is ignored. */
export function parseVersion(v: string): [number, number, number] {
  const core = v.trim().replace(/^v/i, '').split('-')[0] ?? '';
  const parts = core.split('.').map((p) => Number.parseInt(p, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** >0 when a is newer than b. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) if (pa[i]! !== pb[i]!) return pa[i]! - pb[i]!;
  return 0;
}

interface GitHubRelease {
  tag_name?: string;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string;
  assets?: { name?: string; browser_download_url?: string; size?: number }[];
}

/** Reads GitHub's "latest release" answer; null if it has no usable APK. */
export function toReleaseInfo(json: unknown): ReleaseInfo | null {
  const r = json as GitHubRelease;
  if (!r || typeof r.tag_name !== 'string' || r.draft || r.prerelease) return null;
  const apk = r.assets?.find(
    (a) =>
      typeof a.name === 'string' &&
      a.name.toLowerCase().endsWith('.apk') &&
      typeof a.browser_download_url === 'string' &&
      a.browser_download_url.startsWith('https://'),
  );
  if (!apk) return null;
  return {
    version: r.tag_name.replace(/^v/i, ''),
    notes: (r.body ?? '').trim(),
    apkUrl: apk.browser_download_url!,
    apkBytes: apk.size ?? 0,
    publishedAt: r.published_at ?? '',
  };
}
