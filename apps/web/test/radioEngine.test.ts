import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/stores/radio', () => ({ catalog: { click: async () => {} } }));
vi.mock('../src/stores/ui', () => ({ toast() {} }));
vi.mock('../src/player/runtime', () => ({
  audio: {},
  rt: {},
  resetSource() {},
}));

import { stationAt } from '../src/player/radioEngine';
import type { RadioItem } from '../src/player/types';

const station = (key: string) => ({ key, name: key }) as unknown as RadioItem;
const list = ['a', 'b', 'c'].map(station);

describe('stationAt', () => {
  it('moves forward and wraps around', () => {
    expect(stationAt(list, 'a', 1)?.key).toBe('b');
    expect(stationAt(list, 'c', 1)?.key).toBe('a');
  });

  it('moves backward and wraps around', () => {
    expect(stationAt(list, 'b', -1)?.key).toBe('a');
    expect(stationAt(list, 'a', -1)?.key).toBe('c');
  });

  it('returns null with zero or one station', () => {
    expect(stationAt([], undefined, 1)).toBeNull();
    expect(stationAt([station('a')], 'a', -1)).toBeNull();
  });
});
