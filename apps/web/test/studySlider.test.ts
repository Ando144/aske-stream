import { describe, expect, it } from 'vitest';
import { valueForKey, valueFromX } from '../src/study/slider';

describe('valueFromX', () => {
  it('maps the position inside the track to a value', () => {
    expect(valueFromX(150, 100, 200, 0, 100)).toBe(25);
  });

  it('clamps to the limits', () => {
    expect(valueFromX(0, 100, 200, 0, 100)).toBe(0);
    expect(valueFromX(900, 100, 200, 0, 100)).toBe(100);
  });

  it('rounds to the step', () => {
    expect(valueFromX(137, 100, 200, 0, 100)).toBe(19);
    expect(valueFromX(137, 100, 200, 0, 100, 10)).toBe(20);
  });

  it('returns min for a zero-width track', () => {
    expect(valueFromX(50, 50, 0, 0, 100)).toBe(0);
  });
});

describe('valueForKey', () => {
  it('moves by one step with the arrows', () => {
    expect(valueForKey('ArrowLeft', 50, 0, 100)).toBe(49);
    expect(valueForKey('ArrowDown', 50, 0, 100)).toBe(49);
    expect(valueForKey('ArrowRight', 50, 0, 100)).toBe(51);
    expect(valueForKey('ArrowUp', 50, 0, 100, 5)).toBe(55);
  });

  it('moves by ten steps with page keys', () => {
    expect(valueForKey('PageDown', 50, 0, 100)).toBe(40);
    expect(valueForKey('PageUp', 50, 0, 100, 2)).toBe(70);
  });

  it('jumps to the ends with Home and End', () => {
    expect(valueForKey('Home', 50, 0, 100)).toBe(0);
    expect(valueForKey('End', 50, 0, 100)).toBe(100);
  });

  it('clamps at the limits', () => {
    expect(valueForKey('ArrowLeft', 0, 0, 100)).toBe(0);
    expect(valueForKey('PageUp', 95, 0, 100)).toBe(100);
  });

  it('returns null for other keys', () => {
    expect(valueForKey('a', 50, 0, 100)).toBeNull();
    expect(valueForKey('Enter', 50, 0, 100)).toBeNull();
  });
});
