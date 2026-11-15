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

/**
 * Reads GitHub's "latest release" answer; null if it has no usable APK.
 * Releases carry one APK per processor type: "aske-stream-X.apk" (64-bit ARM,
 * nearly every phone) and "aske-stream-X-armv7.apk" (older 32-bit phones).
 */
export function toReleaseInfo(json: unknown, abis: string[] = []): ReleaseInfo | null {
  const r = json as GitHubRelease;
  if (!r || typeof r.tag_name !== 'string' || r.draft || r.prerelease) return null;
  const apks = (r.assets ?? []).filter(
    (a) =>
      typeof a.name === 'string' &&
      a.name.toLowerCase().endsWith('.apk') &&
      typeof a.browser_download_url === 'string' &&
      a.browser_download_url.startsWith('https://'),
  );
  const isArmv7 = (name = '') => /armv7|armeabi/i.test(name);
  const only32 = abis.length > 0 && !abis.includes('arm64-v8a') && abis.includes('armeabi-v7a');
  const apk =
    apks.find((a) => (only32 ? isArmv7(a.name) : !isArmv7(a.name))) ??
    (only32 ? undefined : apks[0]);
  if (!apk) return null;
  return {
    version: r.tag_name.replace(/^v/i, ''),
    notes: (r.body ?? '').trim(),
    apkUrl: apk.browser_download_url!,
    apkBytes: apk.size ?? 0,
    publishedAt: r.published_at ?? '',
  };
}
