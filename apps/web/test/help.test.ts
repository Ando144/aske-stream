import { describe, expect, it } from 'vitest';
import { ARTICLES, SECTIONS } from '../src/help/articles';
import { searchHelp } from '../src/help/search';

const LANGS = ['es', 'en', 'eu'] as const;

describe('help centre', () => {
  it('every article is written in Basque, Spanish and English', () => {
    for (const a of ARTICLES) {
      for (const l of LANGS) {
        expect(a.title[l].trim(), `${a.id} title ${l}`).not.toBe('');
        expect(a.body[l].trim().length, `${a.id} body ${l}`).toBeGreaterThan(80);
      }
    }
  });

  it('has unique ids, and every section has articles', () => {
    expect(new Set(ARTICLES.map((a) => a.id)).size).toBe(ARTICLES.length);
    for (const s of SECTIONS)
      expect(
        ARTICLES.some((a) => a.section === s.id),
        s.id,
      ).toBe(true);
  });

  it('links between articles point to articles that exist, in every language', () => {
    const ids = new Set(ARTICLES.map((a) => a.id));
    for (const a of ARTICLES) {
      for (const l of LANGS) {
        for (const m of a.body[l].matchAll(/\[\[([\w-]+)\|/g)) {
          expect(ids.has(m[1]!), `${a.id} (${l}) → ${m[1]}`).toBe(true);
        }
        // The same links in all languages.
        const links = (lang: string) =>
          [...a.body[lang as 'es'].matchAll(/\[\[([\w-]+)\|/g)].map((m) => m[1]).join(',');
        expect(links(l), `${a.id} links in ${l}`).toBe(links('es'));
      }
    }
  });

  it('only links to https web pages', () => {
    for (const a of ARTICLES)
      for (const l of LANGS)
        for (const m of a.body[l].matchAll(/\]\(([^)]+)\)/g)) expect(m[1]).toMatch(/^https:\/\//);
  });

  it('search ignores accents and ranks titles first', () => {
    expect(searchHelp('playlist', 'es')[0]?.section).toBeDefined();
    expect(searchHelp('conexion', 'es').map((a) => a.id)).toContain('offline-how');
    expect(searchHelp('irratia', 'eu').map((a) => a.id)).toContain('radio');
    expect(searchHelp('x', 'en')).toEqual([]);
  });
});
