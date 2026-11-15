import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { eu } from '../src/i18n/eu';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe.each([
  ['es', es],
  ['eu', eu],
])('%s translation', (_, dict) => {
  it('defines exactly the same keys as English', () => {
    expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
  });

  it('keeps every {placeholder} of the English text', () => {
    for (const [key, text] of Object.entries(en)) {
      expect(placeholders(dict[key as keyof typeof en]), key).toEqual(placeholders(text));
    }
  });

  it('has no empty strings', () => {
    for (const [key, text] of Object.entries(dict)) expect(text.trim(), key).not.toBe('');
  });
});
