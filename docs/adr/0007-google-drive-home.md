# 0007 — Google Drive with `drive.file` and a merged `library.json`

**Status:** accepted

**Introduced in:** v0.5.0

## Context

Many users have a Google account and no wish to run a server. Drive has no database, and a phone
and a computer may edit the same library, also while offline.

## Options

- **Broad Drive scope** — can read the user's whole Drive, which this app does not need.
- **`drive.file`** — only files the app created or the user opened with it. It is a non-sensitive
  scope, so no Google security review.
- **Overwrite one library file (last writer wins)** — simple, but one device can erase the changes
  of another.
- **One library file merged item by item** — more code, no server.

## Decision

Request only `drive.file`. Keep songs and covers as ordinary files under an `Aske Stream` folder,
and the metadata in one `library.json`. Every item carries `updatedAt` and deletions leave a dated
mark (tombstone). Merging two copies keeps the newest version of each item, and a deletion is
final. The merge is pure and unit-tested (`storage/drive/doc.ts`). Android gets tokens from Google
Play services, the web from Google Identity Services.

## Consequences

Changes apply to a local copy at once and are sent a few seconds later, or when the connection
returns. Deletion marks are forgotten after 180 days, so a device offline for longer could bring a
deleted item back (accepted risk). Web tokens last one hour and renewing them needs a tap. Drive
songs are fetched and played from a `blob:` URL because the token travels in a header. Google shows
an "unverified app" warning, which the app explains. Setup: [google-drive.md](../google-drive.md).
