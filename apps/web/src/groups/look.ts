import { GROUP_LIMITS } from '@aske/shared/groups';
import { HubError } from '../hub/client';
import { squareJpeg } from '../lib/cover';

/** Whole visible characters, so that an emoji is never cut in half. */
function graphemes(text: string): string[] {
  return Array.from(new Intl.Segmenter().segment(text), (part) => part.segment);
}

/** First letters of the first and last word, or the first two letters of a single word. */
export function groupInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = graphemes(words[0] ?? '');
  const letters =
    words.length > 1 ? [first[0], graphemes(words.at(-1) ?? '')[0]] : first.slice(0, 2);
  return letters.join('').toUpperCase();
}

export function personInitials(alias: string): string {
  const [first = '', second = ''] = graphemes(alias.trim());
  return first.toUpperCase() + second.toLowerCase();
}

/** Number for the '+N' bubble after the stack of people; 0 means no bubble. */
export function cardMoreCount(members: number, shown: number): number {
  return Math.max(0, members - shown);
}

/** Square JPEG ready to upload; null when the image cannot be used. */
export async function preparePhoto(file: Blob): Promise<Blob | null> {
  const jpeg = await squareJpeg(file, GROUP_LIMITS.photoSide);
  return jpeg && jpeg.size <= GROUP_LIMITS.photoMaxBytes ? jpeg : null;
}

export function isOfflineError(err: unknown): boolean {
  return navigator.onLine === false || (err instanceof HubError && err.code === 'network');
}
