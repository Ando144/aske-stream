import { describe, expect, it } from 'vitest';
import {
  buildSearchRequest,
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
