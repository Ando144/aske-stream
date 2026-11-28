import { useEffect, useState } from 'react';
import { fetchGroupPhoto, fetchInvitePhoto } from '../hub/groupsClient';

interface PhotoSource {
  groupId?: string;
  inviteCode?: string;
  photoAt: number | null;
}

interface Entry {
  photoAt: number;
  url: string | null;
  loading: Promise<string | null>;
}

/** One blob: URL per group (or invite code), for the newest version asked for. */
const cache = new Map<string, Entry>();

function cacheKey({ groupId, inviteCode }: PhotoSource): string | null {
  if (groupId) return `group:${groupId}`;
  return inviteCode ? `code:${inviteCode}` : null;
}

function drop(key: string): void {
  const url = cache.get(key)?.url;
  if (url) URL.revokeObjectURL(url);
  cache.delete(key);
}

async function download(key: string, src: PhotoSource, entry: () => Entry | undefined) {
  try {
    const blob = src.groupId
      ? await fetchGroupPhoto(src.groupId)
      : await fetchInvitePhoto(src.inviteCode ?? '');
    const current = entry();
    // Forgotten or replaced meanwhile: creating a URL now would leak it.
    if (!blob || !current) return null;
    current.url = URL.createObjectURL(blob);
    return current.url;
  } catch (err) {
    console.error('Could not load a group photo', err);
    if (entry()) cache.delete(key); // so that the next screen tries again
    return null;
  }
}

/** A hub that has not been updated yet does not send `photoAt` at all. */
function knownVersion(photoAt: unknown): number | null {
  return typeof photoAt === 'number' ? photoAt : null;
}

export function loadGroupPhoto(src: PhotoSource): Promise<string | null> {
  const key = cacheKey(src);
  if (!key) return Promise.resolve(null);
  const photoAt = knownVersion(src.photoAt);
  const cached = cache.get(key);
  if (cached && cached.photoAt === photoAt) return cached.loading;
  drop(key);
  if (photoAt === null) return Promise.resolve(null);
  const entry: Entry = { photoAt, url: null, loading: Promise.resolve(null) };
  cache.set(key, entry);
  entry.loading = download(key, src, () => (cache.get(key) === entry ? entry : undefined));
  return entry.loading;
}

function cachedUrl(src: PhotoSource): string | null {
  const entry = cache.get(cacheKey(src) ?? '');
  return entry && entry.photoAt === src.photoAt ? entry.url : null;
}

/** URL to show the photo, or null while it loads or when there is none. */
export function useGroupPhotoUrl(src: PhotoSource): string | null {
  const { groupId, inviteCode } = src;
  const photoAt = knownVersion(src.photoAt);
  const version = `${groupId ?? ''}|${inviteCode ?? ''}|${photoAt ?? ''}`;
  const [loaded, setLoaded] = useState<{ version: string; url: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    void loadGroupPhoto({ groupId, inviteCode, photoAt }).then((url) => {
      if (active) setLoaded({ version, url });
    });
    return () => {
      active = false;
    };
  }, [groupId, inviteCode, photoAt, version]);

  if (loaded?.version === version) return loaded.url;
  return cachedUrl({ groupId, inviteCode, photoAt });
}

export function forgetGroupPhoto(groupId: string): void {
  drop(`group:${groupId}`);
}
