import { describe, expect, it } from 'vitest';
import { nextRadioIndex } from '../src/lib/radioKeys';

describe('nextRadioIndex', () => {
  it('moves forward with ArrowDown and ArrowRight, wrapping to the first', () => {
    expect(nextRadioIndex('ArrowDown', 0, 3)).toBe(1);
    expect(nextRadioIndex('ArrowRight', 1, 3)).toBe(2);
    expect(nextRadioIndex('ArrowDown', 2, 3)).toBe(0);
    expect(nextRadioIndex('ArrowRight', 2, 3)).toBe(0);
  });

  it('moves back with ArrowUp and ArrowLeft, wrapping to the last', () => {
    expect(nextRadioIndex('ArrowUp', 2, 3)).toBe(1);
    expect(nextRadioIndex('ArrowLeft', 1, 3)).toBe(0);
    expect(nextRadioIndex('ArrowUp', 0, 3)).toBe(2);
    expect(nextRadioIndex('ArrowLeft', 0, 3)).toBe(2);
  });

  it('jumps to the ends with Home and End', () => {
    expect(nextRadioIndex('Home', 2, 3)).toBe(0);
    expect(nextRadioIndex('End', 0, 3)).toBe(2);
  });

  it('ignores other keys, so Tab, Enter and Space keep working', () => {
    expect(nextRadioIndex('Tab', 1, 3)).toBeNull();
    expect(nextRadioIndex('Enter', 1, 3)).toBeNull();
    expect(nextRadioIndex(' ', 1, 3)).toBeNull();
    expect(nextRadioIndex('a', 1, 3)).toBeNull();
  });

  it('has nowhere to move in an empty group', () => {
    expect(nextRadioIndex('ArrowDown', 0, 0)).toBeNull();
    expect(nextRadioIndex('Home', 0, 0)).toBeNull();
    expect(nextRadioIndex('End', 0, 0)).toBeNull();
  });
});
