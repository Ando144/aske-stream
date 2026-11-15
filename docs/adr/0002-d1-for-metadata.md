# 0002 — D1 for metadata

**Status:** accepted

## Context

The library needs tracks, playlists with order, likes and saved stations, editable from the phone.

## Options

- **`library.json` in R2** — simplest, but every edit rewrites the whole file, concurrent edits
  (CLI uploading while the phone edits a playlist) can overwrite each other, and each rewrite is a
  paid-class R2 write.
- **D1 (SQLite)** — relational integrity (cascading deletes), transactions, cheap partial updates,
  free tier far beyond one user's needs.

## Decision

D1. A `library_version` counter, bumped inside each write transaction, doubles as the ETag so the
client still downloads a single snapshot and revalidates it for free.

## Consequences

Migrations live in `apps/api/migrations`. Set-based SQL (`json_each`) keeps every request well
below the free plan's 50 queries per invocation.
