import type { HelpArticle, HelpSection } from './articles/types';
import { startArticles } from './articles/start';
import { musicArticles } from './articles/music';
import { listenArticles } from './articles/listen';
import { offlineArticles } from './articles/offline';
import { driveArticles } from './articles/drive';
import { cloudflareArticles } from './articles/cloudflare';
import { cloudflareSetupArticles } from './articles/cloudflareSetup';
import { androidArticles } from './articles/android';
import { friendsArticles } from './articles/friends';
import { problemsArticles } from './articles/problems';
import { privacyArticles } from './articles/privacy';

/**
 * Help centre. Written for people who have never set up a server: short
 * sentences, no jargon, the exact names of buttons, and what to do next.
 *
 * Markup (see HelpBody): blank line = new paragraph, "- " = bullet,
 * "1. " = numbered step, **bold**, [[article-id|text]] = link to another
 * article, [text](https://…) = link to a web page.
 */

export type { SectionId, HelpSection, HelpArticle } from './articles/types';

export const SECTIONS: HelpSection[] = [
  { id: 'start', title: { es: 'Primeros pasos', en: 'Getting started', eu: 'Lehen urratsak' } },
  { id: 'music', title: { es: 'Añadir música', en: 'Adding music', eu: 'Musika gehitu' } },
  { id: 'listen', title: { es: 'Escuchar', en: 'Listening', eu: 'Entzun' } },
  {
    id: 'offline',
    title: {
      es: 'Sin conexión y espacio',
      en: 'Offline and space',
      eu: 'Konexiorik gabe eta lekua',
    },
  },
  {
    id: 'drive',
    title: { es: 'Tu Google Drive', en: 'Your Google Drive', eu: 'Zure Google Drive' },
  },
  {
    id: 'cloudflare',
    title: { es: 'Tu Cloudflare', en: 'Your Cloudflare', eu: 'Zure Cloudflare' },
  },
  { id: 'android', title: { es: 'App de Android', en: 'Android app', eu: 'Android aplikazioa' } },
  { id: 'friends', title: { es: 'Con amigos', en: 'With friends', eu: 'Lagunekin' } },
  {
    id: 'problems',
    title: { es: 'Si algo falla', en: 'If something goes wrong', eu: 'Zerbaitek huts egiten badu' },
  },
  {
    id: 'privacy',
    title: {
      es: 'Privacidad y derechos',
      en: 'Privacy and rights',
      eu: 'Pribatutasuna eta eskubideak',
    },
  },
];

export const ARTICLES: HelpArticle[] = [
  ...startArticles,
  ...musicArticles,
  ...listenArticles,
  ...offlineArticles,
  ...driveArticles,
  ...cloudflareArticles,
  ...cloudflareSetupArticles,
  ...androidArticles,
  ...friendsArticles,
  ...problemsArticles,
  ...privacyArticles,
];

export const articleById = (id: string) => ARTICLES.find((a) => a.id === id);
