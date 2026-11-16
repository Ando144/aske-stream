import type { Language } from '../i18n';
import { normalizeText } from '../lib/format';
import { ARTICLES, type HelpArticle } from './articles';

/** Articles whose title or text contain every word of the query (accents ignored). */
export function searchHelp(query: string, language: Language): HelpArticle[] {
  const words = normalizeText(query)
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (!words.length) return [];
  const scored = ARTICLES.map((a) => {
    const title = normalizeText(a.title[language]);
    const body = normalizeText(a.body[language]);
    if (!words.every((w) => title.includes(w) || body.includes(w))) return null;
    const score = words.reduce(
      (s, w) => s + (title.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0),
      0,
    );
    return { a, score };
  }).filter((x): x is { a: HelpArticle; score: number } => x !== null);
  return scored.sort((x, y) => y.score - x.score).map((x) => x.a);
}
