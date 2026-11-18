import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildBrowseRequest,
  buildSearchRequest,
  isPlaylistComplete,
  pickLongerList,
  parsePlaylistPage,
  parseDuration,
  parseSearchResponse,
  youtubePlaylistId,
} from '../src/youtube';

describe('links', () => {
  it('finds real playlists but not endless mixes', () => {
    expect(youtubePlaylistId('https://music.youtube.com/playlist?list=PL1l6AxQgMSitYk_LSlj')).toBe(
      'PL1l6AxQgMSitYk_LSlj',
    );
    expect(youtubePlaylistId('https://www.youtube.com/watch?v=abc&list=OLAK5uy_kabcdefghij')).toBe(
      'OLAK5uy_kabcdefghij',
    );
    expect(youtubePlaylistId('https://www.youtube.com/watch?v=abc&list=RDabcdefghijkl')).toBeNull();
    expect(youtubePlaylistId('https://example.com/?list=PLxxxxxxxxxxxx')).toBeNull();
  });
});

describe('durations', () => {
  it('reads clock-style durations only', () => {
    expect(parseDuration('3:45')).toBe(225);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('Canción')).toBeUndefined();
  });
});

describe('search request', () => {
  it('uses YouTube Music for songs and youtube.com otherwise', () => {
    const songs = buildSearchRequest('itoiz', 'songs');
    expect(songs.url).toContain('music.youtube.com');
    expect(JSON.parse(songs.body)).toMatchObject({
      query: 'itoiz',
      context: { client: { clientName: 'WEB_REMIX' } },
    });
    expect(buildSearchRequest('itoiz', 'playlists').url).toContain('www.youtube.com');
  });
});

describe('search answer', () => {
  const web = {
    contents: {
      twoColumnSearchResultsRenderer: {
        primaryContents: {
          sectionListRenderer: {
            contents: [
              {
                itemSectionRenderer: {
                  contents: [
                    {
                      videoRenderer: {
                        videoId: 'vid00000001',
                        title: { runs: [{ text: 'Itoiz - Lau teilatu' }] },
                        ownerText: { runs: [{ text: 'Itoiz' }] },
                        lengthText: { simpleText: '4:31' },
                        thumbnail: {
                          thumbnails: [
                            { url: 'https://i.ytimg.com/vi/vid00000001/default.jpg', width: 120 },
                            { url: 'https://i.ytimg.com/vi/vid00000001/hq720.jpg', width: 720 },
                          ],
                        },
                      },
                    },
                    {
                      playlistRenderer: {
                        playlistId: 'PLabcdefghijk',
                        title: { simpleText: 'Euskal rock' },
                        videoCount: '42',
                        shortBylineText: { runs: [{ text: 'Someone' }] },
                        thumbnails: [
                          { thumbnails: [{ url: 'https://i.ytimg.com/a.jpg', width: 300 }] },
                        ],
                      },
                    },
                    {
                      lockupViewModel: {
                        contentId: 'PLzzzzzzzzzzz',
                        contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST',
                        contentImage: {
                          collectionThumbnailViewModel: {
                            primaryThumbnail: {
                              thumbnailViewModel: {
                                image: {
                                  sources: [{ url: 'https://i.ytimg.com/b.jpg', width: 480 }],
                                },
                                overlays: [
                                  {
                                    thumbnailOverlayBadgeViewModel: {
                                      thumbnailBadges: [
                                        { thumbnailBadgeViewModel: { text: '12 vídeos' } },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                          },
                        },
                        metadata: {
                          lockupMetadataViewModel: {
                            title: { content: 'Gaztea hits' },
                            metadata: {
                              contentMetadataViewModel: {
                                metadataRows: [
                                  { metadataParts: [{ text: { content: 'Gaztea' } }] },
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  };

  it('reads videos and both playlist layouts', () => {
    const r = parseSearchResponse(web);
    expect(r).toEqual([
      {
        kind: 'video',
        id: 'vid00000001',
        title: 'Itoiz - Lau teilatu',
        author: 'Itoiz',
        duration: 271,
        thumbnail: 'https://i.ytimg.com/vi/vid00000001/hq720.jpg',
        url: 'https://www.youtube.com/watch?v=vid00000001',
      },
      {
        kind: 'playlist',
        id: 'PLabcdefghijk',
        title: 'Euskal rock',
        author: 'Someone',
        count: 42,
        thumbnail: 'https://i.ytimg.com/a.jpg',
        url: 'https://www.youtube.com/playlist?list=PLabcdefghijk',
      },
      {
        kind: 'playlist',
        id: 'PLzzzzzzzzzzz',
        title: 'Gaztea hits',
        author: 'Gaztea',
        count: 12,
        thumbnail: 'https://i.ytimg.com/b.jpg',
        url: 'https://www.youtube.com/playlist?list=PLzzzzzzzzzzz',
      },
    ]);
  });

  it('reads YouTube Music song rows', () => {
    const music = {
      contents: [
        {
          musicResponsiveListItemRenderer: {
            playlistItemData: { videoId: 'song0000001' },
            thumbnail: {
              musicThumbnailRenderer: {
                thumbnail: {
                  thumbnails: [{ url: 'https://lh3.googleusercontent.com/x=w120', width: 120 }],
                },
              },
            },
            flexColumns: [
              {
                musicResponsiveListItemFlexColumnRenderer: {
                  text: { runs: [{ text: 'Lau teilatu' }] },
                },
              },
              {
                musicResponsiveListItemFlexColumnRenderer: {
                  text: {
                    runs: [
                      { text: 'Canción' },
                      { text: ' • ' },
                      { text: 'Itoiz' },
                      { text: ' • ' },
                      { text: 'Ezekiel' },
                      { text: ' • ' },
                      { text: '4:31' },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    };
    expect(parseSearchResponse(music)).toEqual([
      {
        kind: 'video',
        id: 'song0000001',
        title: 'Lau teilatu',
        author: 'Itoiz',
        album: 'Ezekiel',
        duration: 271,
        thumbnail: 'https://lh3.googleusercontent.com/x=w120',
        url: 'https://www.youtube.com/watch?v=song0000001',
      },
    ]);
  });

  it('never throws on unexpected answers', () => {
    expect(parseSearchResponse(null)).toEqual([]);
    expect(parseSearchResponse({ weird: [1, 'a', { videoRenderer: {} }] })).toEqual([]);
  });
});

describe('playlist pages', () => {
  it('asks for the first page by id and the next ones by token', () => {
    expect(JSON.parse(buildBrowseRequest('PLabc', null).body).browseId).toBe('VLPLabc');
    expect(JSON.parse(buildBrowseRequest('PLabc', 'TOKEN').body)).toMatchObject({
      continuation: 'TOKEN',
    });
  });

  it('reads songs, skips unplayable ones and finds the next page', () => {
    const page = {
      metadata: { playlistMetadataRenderer: { title: 'Euskal rock' } },
      header: { playlistHeaderRenderer: { ownerText: { runs: [{ text: 'Someone' }] } } },
      contents: [
        {
          playlistVideoRenderer: {
            videoId: 'aaaaaaaaaaa',
            title: { runs: [{ text: 'Song A' }] },
            shortBylineText: { runs: [{ text: 'Band A' }] },
            lengthSeconds: '201',
          },
        },
        {
          playlistVideoRenderer: {
            videoId: 'bbbbbbbbbbb',
            title: { simpleText: '[Deleted video]' },
            isPlayable: false,
          },
        },
        { playlistVideoRenderer: { videoId: 'aaaaaaaaaaa', title: { runs: [{ text: 'dup' }] } } },
        {
          continuationItemRenderer: {
            continuationEndpoint: { continuationCommand: { token: 'NEXT' } },
          },
        },
      ],
    };
    expect(parsePlaylistPage(page)).toEqual({
      title: 'Euskal rock',
      author: 'Someone',
      entries: [{ id: 'aaaaaaaaaaa', title: 'Song A', author: 'Band A', duration: 201 }],
      continuation: 'NEXT',
      totalCount: null,
    });
  });

  it('a continuation answer has songs and maybe no further token', () => {
    const next = {
      onResponseReceivedActions: [
        {
          appendContinuationItemsAction: {
            continuationItems: [
              {
                playlistVideoRenderer: {
                  videoId: 'ccccccccccc',
                  title: { runs: [{ text: 'C' }] },
                  lengthSeconds: '60',
                },
              },
            ],
          },
        },
      ],
    };
    const r = parsePlaylistPage(next);
    expect(r.entries.map((e) => e.id)).toEqual(['ccccccccccc']);
    expect(r.continuation).toBeNull();
  });

  const fixture = (name: string) =>
    JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

  it('real first page: list token (not the "more playlists" one) and the header count', () => {
    const r = parsePlaylistPage(fixture('playlist-page1.json'));
    expect(r.entries).toHaveLength(3);
    expect(r.totalCount).toBe(168);
    expect(r.title).toContain('EUSKAL MUSIKA');
    // Captured page 1 has two tokens: the list one comes first, the other is the next section.
    expect(r.continuation).toMatch(/^4qmFsgKBARIk/);
  });

  it('real continuation page gives the next songs and no further token', () => {
    const r = parsePlaylistPage(fixture('playlist-page2.json'));
    expect(r.entries).toHaveLength(2);
    expect(r.continuation).toBeNull();
    expect(r.totalCount).toBeNull();
  });

  it('reads the count from the old header and the new page header', () => {
    const old = {
      header: {
        playlistHeaderRenderer: {
          numVideosText: { runs: [{ text: '1.234' }, { text: ' videos' }] },
        },
      },
    };
    expect(parsePlaylistPage(old).totalCount).toBe(1234);
    const modern = {
      header: {
        pageHeaderViewModel: {
          metadata: {
            contentMetadataViewModel: {
              metadataRows: [
                {
                  metadataParts: [
                    { text: { content: 'de ZUGA' } },
                    { text: { content: '2026 vídeos' } },
                  ],
                },
                { metadataParts: [{ text: { content: '332.979 visualizaciones' } }] },
              ],
            },
          },
        },
      },
    };
    expect(parsePlaylistPage(modern).totalCount).toBe(2026);
  });
});

describe('search thumbnails and albums', () => {
  const lockup = (extra: Record<string, unknown>) => ({
    contents: [
      {
        lockupViewModel: {
          metadata: { lockupMetadataViewModel: { title: { content: 'T' } } },
          ...extra,
        },
      },
    ],
  });

  it('skips empty images and uses the first video thumbnail for playlists without one', () => {
    const empty = lockup({
      contentId: 'PLabcdefghijk',
      contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST',
      contentImage: { a: { image: { sources: [] } } },
      rendererContext: { e: { watchEndpoint: { videoId: 'first000001' } } },
    });
    expect(parseSearchResponse(empty)[0]?.thumbnail).toBe(
      'https://i.ytimg.com/vi/first000001/hqdefault.jpg',
    );
    const second = lockup({
      contentId: 'PLabcdefghijk',
      contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST',
      contentImage: [
        { image: { sources: [] } },
        { image: { sources: [{ url: 'https://i.ytimg.com/real.jpg', width: 100 }] } },
      ],
    });
    expect(parseSearchResponse(second)[0]?.thumbnail).toBe('https://i.ytimg.com/real.jpg');
  });

  it('albums use their OLAK5uy playlist id, or are dropped without one', () => {
    const album = lockup({
      contentId: 'MPREb_abc',
      contentType: 'LOCKUP_CONTENT_TYPE_ALBUM',
      rendererContext: { e: { watchPlaylistEndpoint: { playlistId: 'OLAK5uy_xyz123' } } },
    });
    const r = parseSearchResponse(album)[0];
    expect(r?.id).toBe('OLAK5uy_xyz123');
    expect(r?.url).toBe('https://www.youtube.com/playlist?list=OLAK5uy_xyz123');
    const noId = lockup({ contentId: 'MPREb_abc', contentType: 'LOCKUP_CONTENT_TYPE_ALBUM' });
    expect(parseSearchResponse(noId)).toEqual([]);
  });
});

describe('playlist completeness', () => {
  it('is incomplete only when we read fewer than announced and YouTube did not say it ended', () => {
    expect(isPlaylistComplete(100, 168, false)).toBe(false);
    expect(isPlaylistComplete(167, 168, true)).toBe(true);
    expect(isPlaylistComplete(168, 168, false)).toBe(true);
    expect(isPlaylistComplete(10, null, false)).toBe(true);
  });

  it('keeps the longer reading and prefers the first on a tie', () => {
    expect(pickLongerList([1, 2], [1, 2, 3])).toEqual([1, 2, 3]);
    expect(pickLongerList([1, 2, 3], [9, 9])).toEqual([1, 2, 3]);
    expect(pickLongerList([1], [2])).toEqual([1]);
  });
});
