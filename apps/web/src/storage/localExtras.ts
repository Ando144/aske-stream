/**
 * Songs kept only on this phone while the library lives in the cloud (too big to upload).
 * They have their own store: `tracks` belongs to the "this device" home and may hold an
 * older library that must not be mixed in.
 */
import { getDb } from '../offline/db';
import { deleteDeviceFile } from './deviceFiles';
import type { HomeKind, LocalTrack, TrackPatch } from './types';

export async function listLocalExtras(): Promise<LocalTrack[]> {
  return (await getDb()).getAll('local-extras');
}

export async function putLocalExtra(track: LocalTrack): Promise<void> {
  await (await getDb()).put('local-extras', track);
}

export async function updateLocalExtra(id: string, patch: TrackPatch): Promise<LocalTrack> {
  const db = await getDb();
  const track = await db.get('local-extras', id);
  if (!track) throw new Error('Track not found');
  const { liked, ...fields } = patch;
  const updated: LocalTrack = {
    ...track,
    ...fields,
    likedAt: liked === undefined ? track.likedAt : liked ? (track.likedAt ?? Date.now()) : null,
  };
  await db.put('local-extras', updated);
  return updated;
}

export async function deleteLocalExtra(id: string): Promise<void> {
  await (await getDb()).delete('local-extras', id);
  await deleteDeviceFile('audio', id);
  await deleteDeviceFile('covers', id);
}

export function isOnlyOnDevice(track: LocalTrack, home: HomeKind | undefined): boolean {
  const { device, cloudflare, drive } = track.locations;
  return home !== 'device' && device === true && !cloudflare && !drive;
}
