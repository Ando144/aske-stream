import type { Language } from '../../i18n';

export type SectionId =
  | 'start'
  | 'music'
  | 'listen'
  | 'offline'
  | 'drive'
  | 'cloudflare'
  | 'android'
  | 'problems'
  | 'privacy';

export type Text = Record<Language, string>;

export interface HelpSection {
  id: SectionId;
  title: Text;
}

export interface HelpArticle {
  id: string;
  section: SectionId;
  title: Text;
  body: Text;
}
