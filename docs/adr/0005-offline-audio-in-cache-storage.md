# 0005 — Offline audio in Cache Storage, played through blob: URLs

**Status:** accepted

## Context

Downloaded songs must play and seek with no network, while online streaming keeps HTTP Range
requests against R2.

## Options

- **Service worker serving cached audio** — must synthesise `206 Partial Content` responses for
  every seek; easy to get subtly wrong and it intercepts online streaming too.
- **IndexedDB blobs** — works, but large binaries bloat the database and slow down queries.
- **Cache Storage + `blob:` URL** — store the whole file as a `Response`, and for playback create an
  object URL from it. The media element seeks inside the blob natively.

## Decision

Cache Storage (`aske-audio-v1`) for audio, IndexedDB for small metadata (entries, rotation history,
cached library). The player picks the source per song: cached blob first, network otherwise.

## Consequences

The service worker stays simple (app shell + covers). Object URLs are revoked when the song changes.
