import { describe, expect, it } from 'vitest';
import type { SearchResult } from '@aske/shared/youtube';
import { appendResults, withNextPage } from '../src/downloads/searchPages';

function result(id: string, kind: SearchResult['kind'] = 'video'): SearchResult {
  return { kind, id, title: id, author: 'Band', thumbnail: '', url: `https://example.test/${id}` };
}

const ids = (list: readonly SearchResult[]) => list.map((r) => `${r.kind}:${r.id}`);

describe('appendResults', () => {
  it('drops repeated results and keeps the order', () => {
    const prev = [result('a'), result('b')];
    const next = [result('b'), result('c'), result('a'), result('d'), result('c')];

    expect(ids(appendResults(prev, next))).toEqual(['video:a', 'video:b', 'video:c', 'video:d']);
  });

  it('treats the same id of another kind as a different result', () => {
    const merged = appendResults([result('a')], [result('a', 'playlist')]);

    expect(ids(merged)).toEqual(['video:a', 'playlist:a']);
  });

  it('does not change the lists it receives', () => {
    const prev = [result('a')];
    const next = [result('b')];

    appendResults(prev, next);

    expect(ids(prev)).toEqual(['video:a']);
    expect(ids(next)).toEqual(['video:b']);
  });
});

describe('withNextPage', () => {
  const list = { results: [result('a')], continuation: 'one', ended: false };

  it('adds the new results and remembers the next token', () => {
    const merged = withNextPage(list, { results: [result('b')], continuation: 'two' });

    expect(ids(merged.results)).toEqual(['video:a', 'video:b']);
    expect(merged).toMatchObject({ continuation: 'two', ended: false });
  });

  it('ends the list when the page brings no token', () => {
    const merged = withNextPage(list, { results: [result('b')], continuation: null });

    expect(ids(merged.results)).toEqual(['video:a', 'video:b']);
    expect(merged).toMatchObject({ continuation: null, ended: true });
  });

  it('ends the list when the page is empty, even with a token', () => {
    const merged = withNextPage(list, { results: [], continuation: 'two' });

    expect(ids(merged.results)).toEqual(['video:a']);
    expect(merged).toMatchObject({ continuation: null, ended: true });
  });

  it('keeps any other data of the list', () => {
    const merged = withNextPage({ ...list, q: 'itoiz' }, { results: [], continuation: null });

    expect(merged.q).toBe('itoiz');
  });
});
