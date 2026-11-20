import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/stores/setup', () => ({
  useSetup: { getState: vi.fn(() => ({ config: { home: 'cloudflare' } })) },
}));
vi.mock('../src/api/client', () => ({ api: { health: vi.fn() } }));

import { api } from '../src/api/client';
import { useServerUpdate } from '../src/stores/serverUpdate';
import { useSetup } from '../src/stores/setup';

const saved = new Map<string, string>();

beforeEach(() => {
  saved.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => saved.set(k, v),
  });
  useServerUpdate.setState({
    serverVersion: null,
    outdated: false,
    behind: false,
    dismissedVersion: null,
  });
  vi.mocked(useSetup.getState).mockReturnValue({ config: { home: 'cloudflare' } } as never);
});

describe('serverUpdate', () => {
  it('flags an older server, and a missing version', async () => {
    vi.mocked(api.health).mockResolvedValue({ ok: true, version: '0.0.1' });
    await useServerUpdate.getState().check();
    expect(useServerUpdate.getState()).toMatchObject({ serverVersion: '0.0.1', outdated: true });

    vi.mocked(api.health).mockResolvedValue({ ok: true });
    await useServerUpdate.getState().check();
    expect(useServerUpdate.getState().outdated).toBe(true);
  });

  it('does not flag an up-to-date server', async () => {
    vi.mocked(api.health).mockResolvedValue({ ok: true, version: __APP_VERSION__ });
    await useServerUpdate.getState().check();
    expect(useServerUpdate.getState().outdated).toBe(false);
  });

  it('does nothing when the storage is not Cloudflare', async () => {
    vi.mocked(useSetup.getState).mockReturnValue({ config: { home: 'device' } } as never);
    vi.mocked(api.health).mockClear();
    await useServerUpdate.getState().check();
    expect(api.health).not.toHaveBeenCalled();
    expect(useServerUpdate.getState().outdated).toBe(false);
  });

  it('keeps the previous state when the server is unreachable', async () => {
    useServerUpdate.setState({ outdated: true });
    vi.mocked(api.health).mockRejectedValue(new Error('offline'));
    await useServerUpdate.getState().check();
    expect(useServerUpdate.getState().outdated).toBe(true);
  });

  it('dismissing lasts until the next app version', async () => {
    vi.mocked(api.health).mockResolvedValue({ ok: true, version: '0.0.1' });
    await useServerUpdate.getState().check();
    useServerUpdate.getState().dismiss();
    expect(useServerUpdate.getState().outdated).toBe(false);
    await useServerUpdate.getState().check();
    expect(useServerUpdate.getState().outdated).toBe(false);
    // Settings keeps telling the truth even when the banner was dismissed
    expect(useServerUpdate.getState().behind).toBe(true);
    expect(saved.get('aske:server-update-dismissed')).toBe(JSON.stringify(__APP_VERSION__));

    // a newer app version shows the notice again
    useServerUpdate.setState({ dismissedVersion: '0.0.9' });
    await useServerUpdate.getState().check();
    expect(useServerUpdate.getState().outdated).toBe(true);
  });
});
