import { create } from 'zustand';
import { loadValue, savePref } from '../lib/storage';
import { en, type MessageKey, type Messages } from './en';
import { es } from './es';
import { eu } from './eu';

export type Language = 'en' | 'es' | 'eu';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'eu', label: 'Euskara' },
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
];

export const dictionaries: Record<Language, Messages> = { en, es, eu };

function detectLanguage(): Language {
  const saved = loadValue<Language | null>('language', null);
  if (saved && saved in dictionaries) return saved;
  for (const lang of navigator.languages ?? [navigator.language]) {
    const code = lang.slice(0, 2).toLowerCase();
    if (code === 'eu' || code === 'es' || code === 'en') return code;
  }
  return 'en';
}

interface I18nState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useI18n = create<I18nState>((set) => ({
  language: detectLanguage(),
  setLanguage: (language) => {
    savePref('language', language);
    document.documentElement.lang = language;
    set({ language });
  },
}));

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translate(
  language: Language,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = dictionaries[language][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** `t()` outside React (stores, toasts) uses the current language. */
export const t: Translate = (key, vars) => translate(useI18n.getState().language, key, vars);

/** React hook: re-renders when the language changes. */
export function useT(): Translate {
  const language = useI18n((s) => s.language);
  return (key, vars) => translate(language, key, vars);
}

export const songCount = (tr: Translate, count: number) =>
  count === 1 ? tr('common.song') : tr('common.songs', { count });

export type { MessageKey };
