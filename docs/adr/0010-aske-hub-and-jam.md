# 0010 — Aske Hub as a separate Worker, Jam on a Durable Object

**Status:** accepted

**Introduced in:** v0.7.0 (skipping from any phone: v0.9.4)

## Context

Sharing playlists and listening together needs a meeting point for people whose libraries live in
different places, some with no server at all.

## Options

- **Add the features to each user's Worker** — excludes people using this device or Drive.
- **A shared service that also hosts music** — storage cost and redistribution of audio.
- **A shared service that only relays references** — small and cheap, with no audio.

## Decision

A separate Worker (`apps/hub`) in the project owner's account, with its own D1. It stores song
references (YouTube ids, titles, artists), never music, and each person's app downloads songs
itself. Each Jam is a Durable Object holding the queue and votes over WebSocket. Only the host's
phone plays. A guest's skip is recorded by the Hub as a request (at most one every 2 s per person)
and the host's phone performs it. The Hub also serves the web app, so a Jam QR opens in a browser.

## Consequences

The Hub is deployed and migrated apart from users' servers. Data expires (Jams after 12 hours,
shared lists after 90 days, parcels after 24 hours) and per-IP limits protect the free plan. A host
with an older app cannot carry out remote skips, and the app says so. Later features reuse the same
service: "Send to phone" parcels and friend groups. Details: [hub.md](../hub.md).
