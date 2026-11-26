/**
 * Keyboard behaviour of a pop-up menu: the option to focus after `key`, 'close' when the menu
 * must close, or null when the key is not the menu's business.
 */
export function nextMenuIndex(key: string, index: number, count: number): number | 'close' | null {
  if (key === 'Escape' || key === 'Tab') return 'close';
  if (count <= 0) return null;
  if (key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
