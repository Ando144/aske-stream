import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/offline/db', () => ({ getDb: vi.fn() }));
vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    api: { updatePlaylist: vi.fn(), updateFolder: vi.fn() },
  };
});

import { ApiError, api } from '../src/api/client';
import { cloudflareHome } from '../src/storage/homes';

const oldWorker = () => new ApiError(400, 'validation_error', 'Invalid input');

describe('cloudflareHome pinning against an old Worker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the 400 validation_error of an old Worker to cloudflare_outdated (playlist)', async () => {
    vi.mocked(api.updatePlaylist).mockRejectedValue(oldWorker());
    await expect(cloudflareHome.setPlaylistPinned('p1', true)).rejects.toThrow(
      'cloudflare_outdated',
    );
  });

  it('maps the 400 validation_error of an old Worker to cloudflare_outdated (folder)', async () => {
    vi.mocked(api.updateFolder).mockRejectedValue(oldWorker());
    await expect(cloudflareHome.setFolderPinned('f1', true)).rejects.toThrow('cloudflare_outdated');
  });

  it('keeps other errors untouched', async () => {
    const other = new ApiError(500, 'internal', 'boom');
    vi.mocked(api.updatePlaylist).mockRejectedValue(other);
    await expect(cloudflareHome.setPlaylistPinned('p1', true)).rejects.toBe(other);
  });
});
