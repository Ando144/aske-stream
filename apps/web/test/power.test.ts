import { describe, expect, it } from 'vitest';
import { isStreamingSource, mayDoBackgroundWork, mayRotateOffline } from '../src/lib/power';

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

describe('mayRotateOffline', () => {
  const hiddenPlaying = { hidden: true, playing: true };

  it('always allows it with the app visible', () => {
    expect(mayRotateOffline({ hidden: false, playing: false, power: {} })).toBe(true);
  });

  it('blocks it hidden and paused, even when charging', () => {
    const power = { charging: true };
    expect(mayRotateOffline({ hidden: true, playing: false, power })).toBe(false);
  });

  it('allows it hidden while charging', () => {
    expect(mayRotateOffline({ ...hiddenPlaying, power: { charging: true } })).toBe(true);
  });

  it('allows it hidden on Wi-Fi with battery saver off', () => {
    const power = { charging: false, wifi: true, powerSave: false };
    expect(mayRotateOffline({ ...hiddenPlaying, power })).toBe(true);
  });

  it('blocks it hidden on Wi-Fi with battery saver on', () => {
    const power = { charging: false, wifi: true, powerSave: true };
    expect(mayRotateOffline({ ...hiddenPlaying, power })).toBe(false);
  });

  it('blocks it hidden on mobile data', () => {
    const power = { charging: false, wifi: false, powerSave: false };
    expect(mayRotateOffline({ ...hiddenPlaying, power })).toBe(false);
  });

  it('blocks it hidden when the data is unknown', () => {
    expect(mayRotateOffline({ ...hiddenPlaying, power: {} })).toBe(false);
    expect(mayRotateOffline({ ...hiddenPlaying, power: { wifi: true } })).toBe(false);
  });
});
