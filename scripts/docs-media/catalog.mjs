/**
 * Invented demo data for the documentation pictures. Nothing here refers to a real song,
 * artist, station or video. `art` is the gradient (two hex colours) used for each picture.
 */

/** Uploaded in this order, so the last one is the first of "Recently added". */
export const songs = [
  {
    title: 'Copper Skyline',
    artist: 'Velmora Drift',
    album: 'Low Tide Signals',
    seconds: 194,
    art: ['f2a93b', '5a2308'],
  },
  {
    title: 'Paper Compass',
    artist: 'Okta Marrow',
    album: 'Field Notes',
    seconds: 171,
    art: ['ffd27a', 'a3470f'],
  },
  {
    title: 'Slow Harbour',
    artist: 'Velmora Drift',
    album: 'Low Tide Signals',
    seconds: 208,
    art: ['c9621c', '241008'],
  },
  {
    title: 'Marigold Radio',
    artist: 'The Quillfeather Set',
    album: 'Window Seat',
    seconds: 183,
    art: ['ffe3a6', 'd9780f'],
  },
  {
    title: 'Lantern Weather',
    artist: 'Solenne Quarv',
    album: 'Soft Machines',
    seconds: 226,
    art: ['e8862a', '3b0f0a'],
  },
  {
    title: 'Seventh Floor Garden',
    artist: 'Okta Marrow',
    album: 'Field Notes',
    seconds: 165,
    art: ['b98a2e', '1f1a07'],
  },
  {
    title: 'Honey in the Static',
    artist: 'Brisa Nocturne Club',
    album: 'After Hours Atlas',
    seconds: 199,
    art: ['f6b94f', '6e1f2a'],
  },
  {
    title: 'Northbound Postcards',
    artist: 'Juniper Vantablue',
    album: 'Small Distances',
    seconds: 212,
    art: ['ff9f45', '4a2a10'],
  },
  {
    title: 'Quiet Arithmetic',
    artist: 'Solenne Quarv',
    album: 'Soft Machines',
    seconds: 176,
    art: ['d9a441', '2b1b3a'],
  },
  {
    title: 'Ember Cartography',
    artist: 'The Quillfeather Set',
    album: 'Window Seat',
    seconds: 188,
    art: ['ff7a2f', '20100c'],
  },
  {
    title: 'Last Tram to Orlune',
    artist: 'Brisa Nocturne Club',
    album: 'After Hours Atlas',
    seconds: 221,
    art: ['f4c06a', '123033'],
  },
  {
    title: 'Golden Hour Machines',
    artist: 'Juniper Vantablue',
    album: 'Small Distances',
    seconds: 180,
    art: ['ffcf5c', '8a2f12'],
  },
];

/** Songs are referenced by their position in `songs`. */
export const playlists = [
  { name: 'Sunday Kitchen', songs: [1, 3, 6, 11, 7] },
  { name: 'Study Focus', songs: [8, 5, 2, 4, 9] },
  { name: 'Late Night Drive', songs: [10, 0, 6, 9, 2, 4, 11] },
];

export const likedSongs = [11, 10, 6, 3];

const station = (n, name, tags, votes, art) => ({
  rbUuid: `00000000-0000-4000-8000-00000000000${n}`,
  name,
  streamUrl: `https://radio.invalid/stream/${n}`,
  homepage: 'https://radio.invalid/',
  favicon: `https://radio.invalid/logo-${n}.jpg`,
  countryCode: 'US',
  tags,
  codec: 'AAC',
  bitrate: 128,
  hls: false,
  votes,
  clickCount: votes * 3,
  art,
});

export const stations = [
  station(1, 'Ambergrove FM', ['indie', 'chill'], 842, ['f2a93b', '3a1706']),
  station(2, 'Quillhaven Jazz', ['jazz', 'lounge'], 615, ['d9780f', '16202b']),
  station(3, 'Harbour Light Radio', ['folk', 'acoustic'], 498, ['ffd27a', '7a3b12']),
  station(4, 'Night Tram 94.1', ['electronic', 'ambient'], 377, ['ff8a3d', '2a0f33']),
  station(5, 'Copper Valley Classics', ['classical'], 264, ['e0b25a', '2b2207']),
  station(6, 'Pocket Sunrise', ['pop', 'morning'], 190, ['ffe08a', 'c2461a']),
];

/** The first ones appear under "Your stations". */
export const savedStations = [0, 1];

export const radioTags = ['indie', 'jazz', 'chill', 'folk', 'ambient', 'classical', 'pop'];

export const radioCountries = [
  { code: 'US', name: 'United States', stationCount: stations.length },
];

/** Replace the placeholder results of the fake Android downloader, in order. */
export const videoResults = [
  { title: 'Copper Skyline (Live Session)', author: 'Velmora Drift', art: ['ffb347', '41160a'] },
  { title: 'Lantern Weather', author: 'Solenne Quarv', art: ['e8662a', '14233b'] },
  { title: 'Rainy Desk Mix', author: 'Okta Marrow', art: ['f7d070', '5c3a0c'] },
  { title: 'Ember Cartography (Demo)', author: 'The Quillfeather Set', art: ['ff7a2f', '2b0d1c'] },
];
