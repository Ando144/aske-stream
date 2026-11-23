import { describe, expect, it } from 'vitest';
import { diagnoseConnection } from '../src/lib/networkDiagnosis';

const SERVER = 'https://music.example.com';
const HUB = 'https://hub.example.com/';

function fakeProbe(reachable: (url: string) => boolean) {
  const calls: string[] = [];
  const probe = async (url: string) => {
    calls.push(url);
    return reachable(url);
  };
  return { probe, calls };
}

describe('diagnoseConnection', () => {
  it('reports noInternet without probing when the device is offline', async () => {
    const { probe, calls } = fakeProbe(() => true);
    expect(await diagnoseConnection(SERVER, { probe, hubUrl: HUB, online: false })).toBe(
      'noInternet',
    );
    expect(calls).toEqual([]);
  });

  it('reports blocked when the server answers', async () => {
    const { probe, calls } = fakeProbe((u) => u === `${SERVER}/favicon.svg`);
    expect(await diagnoseConnection(SERVER, { probe, hubUrl: HUB, online: true })).toBe('blocked');
    expect(calls).toEqual([`${SERVER}/favicon.svg`]);
  });

  it('reports unreachable when only the hub answers', async () => {
    const { probe, calls } = fakeProbe((u) => u === 'https://hub.example.com/hub/v1/health');
    expect(await diagnoseConnection(SERVER, { probe, hubUrl: HUB, online: true })).toBe(
      'unreachable',
    );
    expect(calls).toContain('https://hub.example.com/hub/v1/health');
  });

  it('reports noInternet when neither server nor hub answer', async () => {
    const { probe } = fakeProbe(() => false);
    expect(await diagnoseConnection(SERVER, { probe, hubUrl: HUB, online: true })).toBe(
      'noInternet',
    );
  });

  it('reports unreachable when the server fails and there is no hub', async () => {
    const { probe } = fakeProbe(() => false);
    expect(await diagnoseConnection(SERVER, { probe, hubUrl: null, online: true })).toBe(
      'unreachable',
    );
  });

  it('never probes Google or gstatic', async () => {
    const { probe, calls } = fakeProbe(() => false);
    await diagnoseConnection(SERVER, { probe, hubUrl: HUB, online: true });
    expect(calls.some((u) => /google|gstatic/.test(u))).toBe(false);
  });
});
