import { describe, expect, it } from 'vitest';
import { isStreamingSource, mayDoBackgroundWork } from '../src/lib/power';

describe('isStreamingSource', () => {
  it('is false for local sources', () => {
    expect(isStreamingSource('blob:https://x/abc')).toBe(false);
    expect(isStreamingSource('file:///music/a.opus')).toBe(false);
    expect(isStreamingSource('capacitor://localhost/a.opus')).toBe(false);
    expect(isStreamingSource('http://localhost/_capacitor_file_/a.opus')).toBe(false);
    expect(isStreamingSource('https://localhost/_capacitor_file_/a.opus')).toBe(false);
    expect(isStreamingSource('')).toBe(false);
  });

  it('is true for remote http(s)', () => {
    expect(isStreamingSource('https://api.example.com/audio/1')).toBe(true);
    expect(isStreamingSource('http://192.168.1.2/a.mp3')).toBe(true);
  });
});

describe('mayDoBackgroundWork', () => {
  it('allows work when visible or playing', () => {
    expect(mayDoBackgroundWork({ hidden: false, playing: false })).toBe(true);
    expect(mayDoBackgroundWork({ hidden: true, playing: true })).toBe(true);
  });

  it('blocks work when hidden and paused', () => {
    expect(mayDoBackgroundWork({ hidden: true, playing: false })).toBe(false);
  });
});
