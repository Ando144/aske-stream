import { describe, expect, it } from 'vitest';
import { nextMenuIndex } from '../src/lib/menuKeys';

describe('nextMenuIndex', () => {
  it('moves down and wraps to the first option', () => {
    expect(nextMenuIndex('ArrowDown', 0, 3)).toBe(1);
    expect(nextMenuIndex('ArrowDown', 2, 3)).toBe(0);
  });

  it('moves up and wraps to the last option', () => {
    expect(nextMenuIndex('ArrowUp', 2, 3)).toBe(1);
    expect(nextMenuIndex('ArrowUp', 0, 3)).toBe(2);
  });

  it('jumps to the ends with Home and End', () => {
    expect(nextMenuIndex('Home', 2, 3)).toBe(0);
    expect(nextMenuIndex('End', 0, 3)).toBe(2);
  });

  it('closes with Escape and Tab', () => {
    expect(nextMenuIndex('Escape', 1, 3)).toBe('close');
    expect(nextMenuIndex('Tab', 1, 3)).toBe('close');
  });

  it('ignores other keys, so Enter and Space reach the button', () => {
    expect(nextMenuIndex('Enter', 1, 3)).toBeNull();
    expect(nextMenuIndex(' ', 1, 3)).toBeNull();
    expect(nextMenuIndex('a', 1, 3)).toBeNull();
  });

  it('has nowhere to move in an empty menu', () => {
    expect(nextMenuIndex('ArrowDown', 0, 0)).toBeNull();
    expect(nextMenuIndex('End', 0, 0)).toBeNull();
    expect(nextMenuIndex('Escape', 0, 0)).toBe('close');
  });
});
