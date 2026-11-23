import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeParam {
  value: number;
  setTargetAtTime: ReturnType<typeof vi.fn>;
}
const audio = vi.hoisted(() => ({
  contexts: 0,
  sources: [] as {
    loop: boolean;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[],
  gains: [] as { gain: FakeParam }[],
  resume: vi.fn(async () => undefined),
}));

class FakeAudioContext {
  sampleRate = 100;
  currentTime = 5;
  destination = {};
  constructor() {
    audio.contexts += 1;
  }
  resume = audio.resume;
  createBuffer(_c: number, length: number) {
    return { length, copyToChannel: vi.fn() };
  }
  createBufferSource() {
    const s = {
      buffer: null as unknown,
      loop: false,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    audio.sources.push(s);
    return s;
  }
  createGain() {
    const g = { gain: { value: 1, setTargetAtTime: vi.fn() }, connect: vi.fn() };
    audio.gains.push(g);
    return g;
  }
  createBiquadFilter() {
    return {
      type: '',
      frequency: { value: 0 },
      Q: { value: 0 },
      gain: { value: 0 },
      connect: vi.fn(),
    };
  }
}

async function load() {
  vi.resetModules();
  return import('../src/study/ambient');
}

describe('ambient sounds', () => {
  beforeEach(() => {
    audio.contexts = 0;
    audio.sources.length = 0;
    audio.gains.length = 0;
    audio.resume.mockClear();
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  it('always offers the generated noises and only the bundled files that exist', async () => {
    const { availableAmbient } = await load();
    const ids = availableAmbient();
    expect(ids.slice(0, 3)).toEqual(['white', 'gray', 'brown']);
    expect(ids.every((id) => ['white', 'gray', 'brown', 'rain', 'waves'].includes(id))).toBe(true);
  });

  it('starts a looping voice and ramps the gain to the requested level', async () => {
    const { setAmbientLevel } = await load();
    await setAmbientLevel('brown', 0.5);
    expect(audio.sources).toHaveLength(1);
    expect(audio.sources[0]!.loop).toBe(true);
    expect(audio.sources[0]!.start).toHaveBeenCalled();
    expect(audio.gains[0]!.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, 5, expect.any(Number));
  });

  it('clamps levels above 1 and below 0', async () => {
    const { setAmbientLevel } = await load();
    await setAmbientLevel('white', 7);
    expect(audio.gains[0]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 5, expect.any(Number));
    await setAmbientLevel('white', -3);
    expect(audio.gains[0]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 5, expect.any(Number));
    expect(audio.sources[0]!.stop).toHaveBeenCalledTimes(1);
  });

  it('changing the level of a playing sound reuses the same voice', async () => {
    const { setAmbientLevel } = await load();
    await setAmbientLevel('brown', 0.2);
    await setAmbientLevel('brown', 0.8);
    expect(audio.sources).toHaveLength(1);
    expect(audio.gains[0]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.8,
      5,
      expect.any(Number),
    );
  });

  it('level 0 for a sound that is not playing creates nothing', async () => {
    const { setAmbientLevel } = await load();
    await setAmbientLevel('brown', 0);
    expect(audio.sources).toHaveLength(0);
  });

  it('two simultaneous calls for the same sound leave a single audible voice', async () => {
    const { setAmbientLevel } = await load();
    await Promise.all([setAmbientLevel('gray', 0.4), setAmbientLevel('gray', 0.6)]);
    const stopped = audio.sources.filter((s) => s.stop.mock.calls.length > 0).length;
    expect(audio.sources.length - stopped).toBe(1);
  });

  it('a bundled sound whose file is missing is silently skipped', async () => {
    const { setAmbientLevel, availableAmbient } = await load();
    if (availableAmbient().includes('rain')) return;
    await setAmbientLevel('rain', 0.5);
    expect(audio.sources).toHaveLength(0);
  });

  it('stopAllAmbient fades every voice out and allows restarting afterwards', async () => {
    const { setAmbientLevel, stopAllAmbient } = await load();
    await setAmbientLevel('brown', 0.5);
    await setAmbientLevel('white', 0.5);
    stopAllAmbient(2000);
    for (const s of audio.sources) expect(s.stop).toHaveBeenCalledWith(5 + 2 + 0.1);
    expect(audio.gains[0]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 5, expect.any(Number));
    await setAmbientLevel('brown', 0.5);
    expect(audio.sources).toHaveLength(3);
  });

  it('stopAllAmbient before any sound was played does not create an audio context', async () => {
    const { stopAllAmbient } = await load();
    stopAllAmbient();
    expect(audio.contexts).toBe(0);
  });
});
