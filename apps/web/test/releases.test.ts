import { describe, expect, it } from 'vitest';
import { compareVersions, parseVersion, toReleaseInfo } from '../src/native/releases';

describe('versions', () => {
  it('parses tags with or without v and ignores pre-release suffixes', () => {
    expect(parseVersion('v0.10.2')).toEqual([0, 10, 2]);
    expect(parseVersion('1.2')).toEqual([1, 2, 0]);
    expect(parseVersion('2.0.0-beta.1')).toEqual([2, 0, 0]);
  });

  it('compares numerically, not as text', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v0.2.0', '0.2.0')).toBe(0);
    expect(compareVersions('0.2.0', '0.2.1')).toBeLessThan(0);
  });
});

describe('GitHub release → update info', () => {
  const release = {
    tag_name: 'v0.3.0',
    body: 'New things',
    published_at: '2026-11-20T10:00:00Z',
    assets: [
      { name: 'checksums.txt', browser_download_url: 'https://github.com/x/sums', size: 10 },
      {
        name: 'aske-stream-0.3.0.apk',
        browser_download_url: 'https://github.com/x/a.apk',
        size: 9e6,
      },
    ],
  };

  it('picks the APK', () => {
    expect(toReleaseInfo(release)).toEqual({
      version: '0.3.0',
      notes: 'New things',
      apkUrl: 'https://github.com/x/a.apk',
      apkBytes: 9e6,
      publishedAt: '2026-11-20T10:00:00Z',
    });
  });

  it('picks the APK for the phone’s processor', () => {
    const two = {
      ...release,
      assets: [
        { name: 'aske-stream-armv7-0.3.0.apk', browser_download_url: 'https://x/v7.apk', size: 1 },
        { name: 'aske-stream-0.3.0.apk', browser_download_url: 'https://x/arm64.apk', size: 2 },
      ],
    };
    expect(toReleaseInfo(two, ['arm64-v8a', 'armeabi-v7a'])?.apkUrl).toBe('https://x/arm64.apk');
    expect(toReleaseInfo(two, ['armeabi-v7a', 'armeabi'])?.apkUrl).toBe('https://x/v7.apk');
    expect(toReleaseInfo(two)?.apkUrl).toBe('https://x/arm64.apk');
    // A 32-bit phone never gets a 64-bit-only APK.
    expect(toReleaseInfo({ ...two, assets: [two.assets[1]] }, ['armeabi-v7a'])).toBeNull();
  });

  it('ignores drafts, pre-releases, missing or insecure APKs', () => {
    expect(toReleaseInfo({ ...release, draft: true })).toBeNull();
    expect(toReleaseInfo({ ...release, prerelease: true })).toBeNull();
    expect(toReleaseInfo({ ...release, assets: [release.assets[0]] })).toBeNull();
    expect(
      toReleaseInfo({
        ...release,
        assets: [{ name: 'a.apk', browser_download_url: 'http://x/a.apk' }],
      }),
    ).toBeNull();
    expect(toReleaseInfo(null)).toBeNull();
  });
});
