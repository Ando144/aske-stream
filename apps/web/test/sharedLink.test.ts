import { describe, expect, it } from 'vitest';
import { parseSharedText } from '../src/share/sharedLink';

describe('parseSharedText', () => {
  it('finds a video link inside a sentence', () => {
    expect(parseSharedText('Mira esto https://youtu.be/abc123def45?si=x')).toEqual({
      kind: 'video',
      videoId: 'abc123def45',
      url: 'https://youtu.be/abc123def45?si=x',
    });
  });

  it('accepts watch, mobile and shorts links', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=abc123def45',
      'https://m.youtube.com/watch?v=abc123def45',
      'https://youtube.com/shorts/abc123def45',
    ]) {
      expect(parseSharedText(url)).toEqual({ kind: 'video', videoId: 'abc123def45', url });
    }
  });

  it('prefers the video over the list it was opened in', () => {
    const url = 'https://music.youtube.com/watch?v=abc123def45&list=PL1l6AxQgMSitYk_LSlj';
    expect(parseSharedText(url)).toEqual({ kind: 'video', videoId: 'abc123def45', url });
  });

  it('prefers the video even when the list is an automatic mix', () => {
    const url = 'https://www.youtube.com/watch?v=abc123def45&list=RDabc123def45';
    expect(parseSharedText(url).kind).toBe('video');
  });

  it('recognises a playlist link', () => {
    const url = 'https://www.youtube.com/playlist?list=PL1l6AxQgMSitYk_LSlj';
    expect(parseSharedText(url)).toEqual({
      kind: 'playlist',
      playlistId: 'PL1l6AxQgMSitYk_LSlj',
      url,
    });
  });

  it('blocks mixes and personal lists', () => {
    expect(parseSharedText('https://www.youtube.com/playlist?list=RDCLAK5uy_abcdef')).toEqual({
      kind: 'blocked',
      reason: 'mix',
    });
    expect(parseSharedText('https://music.youtube.com/playlist?list=LM')).toEqual({
      kind: 'blocked',
      reason: 'personal',
    });
  });

  it('skips links that are not YouTube and drops trailing punctuation', () => {
    expect(parseSharedText('https://example.com y (https://youtu.be/abc123def45).')).toEqual({
      kind: 'video',
      videoId: 'abc123def45',
      url: 'https://youtu.be/abc123def45',
    });
  });

  it('rejects everything else', () => {
    for (const text of [
      '',
      'hola',
      'https://example.com',
      'https://www.youtube.com/',
      'https://www.youtube.com/watch?v=<script>',
      'https://youtube.com.evil.com/watch?v=abc123def45',
      'ftp://youtu.be/abc123def45',
    ]) {
      expect(parseSharedText(text)).toEqual({ kind: 'invalid' });
    }
  });

  it('only reads the first 2000 characters', () => {
    const link = ' https://youtu.be/abc123def45';
    expect(parseSharedText('a'.repeat(10_000))).toEqual({ kind: 'invalid' });
    expect(parseSharedText('a'.repeat(2000) + link)).toEqual({ kind: 'invalid' });
    expect(parseSharedText('http://'.repeat(1500))).toEqual({ kind: 'invalid' });
  });
});
