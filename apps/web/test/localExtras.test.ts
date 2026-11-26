import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalTrack } from '../src/storage/types';

const fake = vi.hoisted(() => ({
  stores: new Map<string, Map<string, unknown>>(),
  deleteDeviceFile: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/offline/db', () => {
  const store = (name: string) => {
    const found = fake.stores.get(name) ?? new Map<string, unknown>();
    fake.stores.set(name, found);
    return found;
  };
  return {
    getDb: () =>
      Promise.resolve({
        getAll: async (name: string) => [...store(name).values()],
        get: async (name: string, id: string) => store(name).get(id),
        put: async (name: string, value: { id: string }) => void store(name).set(value.id, value),
        delete: async (name: string, id: string) => void store(name).delete(id),
      }),
  };
});

vi.mock('../src/storage/deviceFiles', () => ({ deleteDeviceFile: fake.deleteDeviceFile }));

import {
  deleteLocalExtra,
  isOnlyOnDevice,
  listLocalExtras,
  putLocalExtra,
  updateLocalExtra,
} from '../src/storage/localExtras';

const track = (id: string, patch: Partial<LocalTrack> = {}): LocalTrack => ({
  id,
  title: `Title ${id}`,
  artist: 'Artist',
  album: '',
  durationMs: 60_000,
  sizeBytes: 1000,
  bitrateKbps: null,
  hasCover: true,
  source: 'youtube',
  sourceRef: id,
  createdAt: 1,
  likedAt: null,
  kind: 'music',
  locations: { device: true },
  mime: 'audio/ogg',
  ...patch,
});

describe('local extras store', () => {
  beforeEach(() => {
    fake.stores.clear();
    fake.deleteDeviceFile.mockClear();
  });

  it('saves and lists tracks in their own store', async () => {
    await putLocalExtra(track('a'));
    await putLocalExtra(track('b'));
    expect((await listLocalExtras()).map((t) => t.id)).toEqual(['a', 'b']);
    expect([...fake.stores.keys()]).toEqual(['local-extras']);
  });

  it('changes fields and keeps the rest', async () => {
    await putLocalExtra(track('a'));
    const updated = await updateLocalExtra('a', { album: 'Show', kind: 'podcast' });
    expect(updated).toEqual(track('a', { album: 'Show', kind: 'podcast' }));
    expect(await listLocalExtras()).toEqual([updated]);
  });

  it('sets and clears the like date, keeping the first one', async () => {
    await putLocalExtra(track('a', { likedAt: 123 }));
    expect((await updateLocalExtra('a', { liked: true })).likedAt).toBe(123);
    expect((await updateLocalExtra('a', { title: 'New' })).likedAt).toBe(123);
    expect((await updateLocalExtra('a', { liked: false })).likedAt).toBeNull();
    const liked = await updateLocalExtra('a', { liked: true });
    expect(liked.likedAt).toEqual(expect.any(Number));
    expect(liked).not.toHaveProperty('liked');
  });

  it('rejects changes to a track that does not exist', async () => {
    await expect(updateLocalExtra('missing', { title: 'x' })).rejects.toThrow('Track not found');
  });

  it('deletes the track together with its audio and cover', async () => {
    await putLocalExtra(track('a'));
    await deleteLocalExtra('a');
    expect(await listLocalExtras()).toEqual([]);
    expect(fake.deleteDeviceFile.mock.calls).toEqual([
      ['audio', 'a'],
      ['covers', 'a'],
    ]);
  });
});

describe('isOnlyOnDevice', () => {
  it('is true for a device-only song in a cloud library', () => {
    expect(isOnlyOnDevice(track('a'), 'cloudflare')).toBe(true);
    expect(isOnlyOnDevice(track('a'), 'drive')).toBe(true);
  });

  it('is false when the library lives on the device', () => {
    expect(isOnlyOnDevice(track('a'), 'device')).toBe(false);
  });

  it('is false when the song is also in a cloud or not on the device', () => {
    const inCloudflare = track('a', { locations: { device: true, cloudflare: 'a' } });
    const inDrive = track('a', { locations: { device: true, drive: 'file' } });
    const notHere = track('a', { locations: {} });
    expect(isOnlyOnDevice(inCloudflare, 'cloudflare')).toBe(false);
    expect(isOnlyOnDevice(inDrive, 'drive')).toBe(false);
    expect(isOnlyOnDevice(notHere, 'cloudflare')).toBe(false);
  });
});
