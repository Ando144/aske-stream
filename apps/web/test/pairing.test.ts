import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/offline/db', () => ({ getDb: vi.fn(), kvGet: vi.fn() }));
vi.mock('../src/storage/drive/auth', () => ({
  driveAvailable: vi.fn(),
  getDriveToken: vi.fn(),
  signOutDrive: vi.fn(),
}));
vi.mock('../src/storage/drive/home', () => ({
  driveHome: {},
  driveQuota: vi.fn(),
  flushDrive: vi.fn(),
  resetDriveState: vi.fn(),
}));
vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    configureApi: vi.fn(),
    api: { pairWithCode: vi.fn(), pair: vi.fn() },
  };
});

import { ApiError, api, configureApi } from '../src/api/client';
import { useSetup } from '../src/stores/setup';

describe('connectWithCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSetup.setState({ config: { home: 'device' }, status: 'choose' });
  });

  it('saves baseUrl and token for another origin', async () => {
    vi.mocked(api.pairWithCode).mockResolvedValue({ paired: true, token: 'tok' });
    await useSetup.getState().connectWithCode('abcd-2345', 'https://x.example');
    expect(api.pairWithCode).toHaveBeenCalledWith('ABCD2345');
    expect(useSetup.getState().config).toEqual({
      home: 'cloudflare',
      cloudflare: { baseUrl: 'https://x.example', token: 'tok' },
    });
  });

  it('drops the token on the same origin', async () => {
    vi.mocked(api.pairWithCode).mockResolvedValue({ paired: true, token: 'tok' });
    await useSetup.getState().connectWithCode('ABCD2345');
    expect(useSetup.getState().config?.cloudflare).toEqual({ baseUrl: '', token: null });
  });

  it('rejects a malformed code without calling the network', async () => {
    await expect(useSetup.getState().connectWithCode('nope')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_code',
    });
    expect(api.pairWithCode).not.toHaveBeenCalled();
  });

  it('restores the previous configuration when the code fails', async () => {
    vi.mocked(api.pairWithCode).mockRejectedValue(new ApiError(401, 'invalid_code', 'bad'));
    await expect(
      useSetup.getState().connectWithCode('ABCD2345', 'https://x.example'),
    ).rejects.toThrow();
    expect(useSetup.getState().config).toEqual({ home: 'device' });
    expect(vi.mocked(configureApi).mock.calls.at(-1)).toEqual(['', null]);
  });
});
