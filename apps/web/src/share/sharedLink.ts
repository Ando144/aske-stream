import { classifyPlaylistLink, isYoutubeUrl, youtubeVideoId } from '@aske/shared/youtube';

/** What another app shared with us ("Share → Aske Stream"). */
export type SharedLink =
  | { kind: 'video'; videoId: string; url: string }
  | { kind: 'playlist'; playlistId: string; url: string }
  | { kind: 'blocked'; reason: 'mix' | 'personal' }
  | { kind: 'invalid' };

const MAX_TEXT_LENGTH = 2000;
const URL_IN_TEXT = /https?:\/\/[^\s<>"]+/gi;
/** Punctuation of the surrounding sentence that sticks to the end of a link. */
const TRAILING_PUNCTUATION = /[.,;:!?'")\]}»”’]+$/;
const VIDEO_ID = /^[\w-]{6,20}$/;

/** The text comes from any app on the phone, so nothing in it is trusted. */
export function parseSharedText(text: string): SharedLink {
  const found = text.slice(0, MAX_TEXT_LENGTH).match(URL_IN_TEXT) ?? [];
  const url = found.map((u) => u.replace(TRAILING_PUNCTUATION, '')).find(isYoutubeUrl);
  return url ? readYoutubeLink(url) : { kind: 'invalid' };
}

function readYoutubeLink(url: string): SharedLink {
  const videoId = youtubeVideoId(url);
  if (videoId && VIDEO_ID.test(videoId)) return { kind: 'video', videoId, url };

  const list = classifyPlaylistLink(url);
  if (list.kind === 'playlist') return { kind: 'playlist', playlistId: list.id, url };
  if (list.kind === 'none') return { kind: 'invalid' };
  return { kind: 'blocked', reason: list.kind };
}
