import { describe, expect, it } from 'vitest';
import { initialSelection, pickedEntries, toggleSelection } from '../src/downloads/pickSelection';

describe('pickSelection', () => {
  it('selects the first max ids', () => {
    expect([...initialSelection(['a', 'b', 'c'], 2)]).toEqual(['a', 'b']);
  });

  it('adds and removes ids', () => {
    const added = toggleSelection(new Set(['a']), 'b', 3);
    expect(added).toEqual({ selected: new Set(['a', 'b']), refused: false });
    expect(toggleSelection(added.selected, 'a', 3).selected).toEqual(new Set(['b']));
  });

  it('refuses to go over the maximum and leaves the set unchanged', () => {
    const start = new Set(['a', 'b']);
    const res = toggleSelection(start, 'c', 2);
    expect(res.refused).toBe(true);
    expect(res.selected).toEqual(start);
    expect(res.selected).not.toBe(start);
  });

  it('still allows removing when full', () => {
    expect(toggleSelection(new Set(['a', 'b']), 'a', 2).refused).toBe(false);
  });

  it('returns picked entries in playlist order', () => {
    const entries = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(pickedEntries(entries, new Set(['c', 'a']))).toEqual([{ id: 'a' }, { id: 'c' }]);
  });
});
