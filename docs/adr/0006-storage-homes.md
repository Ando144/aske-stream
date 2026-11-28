# 0006 — Storage homes: one home, many destinations

**Status:** accepted

**Introduced in:** v0.5.0 (the release that offers all three homes; the v0.2.1 notes already
mention connecting the Android app to a Cloudflare instance)

## Context

The first version required deploying a Cloudflare backend. The app is meant for friends without a
technical background, so each person needs to choose where their music is stored, including options
that need no server.

## Options

- **Cloudflare only** — one code path, but every user must set up a server.
- **Metadata spread across several backends** — flexible, but keeping playlists consistent across
  three backends needs a conflict-resolving sync engine.
- **One home for the metadata, separate locations for the audio** — each library has a single
  source of truth, while the data model records where each audio file is.

## Decision

Each installation has exactly one **home** (`device`, `drive` or `cloudflare`) that holds songs,
playlists, folders, likes and stations. All three implement the `LibraryHome` interface
(`apps/web/src/storage/types.ts`). Audio places are **destinations**, listed per song in
`track.locations` (`device`, `cloudflare`, `drive`).

## Consequences

Library operations do not depend on the backend. Changing storage does not move anything by itself:
the app offers to copy songs, covers, playlists, folders and radios between any two storages
(`storage/copy/`), resumable and without deleting the source. Cloudflare only accepts Opus, so
other formats are skipped there. A cloud library can also hold songs that exist only on one phone
(for example, too large to upload), kept in their own IndexedDB store and merged into the list.
