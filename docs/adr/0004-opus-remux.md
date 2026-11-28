# 0004 — Ogg Opus, remuxed by default

**Status:** accepted; since v0.3.0 the phone also stores Opus in WebM as downloaded
([ADR 0008](0008-youtube-download-on-the-phone.md))

## Context

Storage is capped at 10 GB on the free tier; mobile data and offline space also matter. Most music
comes from YouTube, which already delivers Opus (~130–160 kbps).

## Options

- **Remux**: copy YouTube's Opus stream into an Ogg container. No quality loss, no CPU, ~1.1 MB/min.
- **Re-encode at 96 kbps**: ~35–40 % smaller, but a second lossy generation.
- **AAC/MP3**: wider device support (old Safari), worse quality per byte; not needed for Android.

## Decision

Remux by default; `--bitrate N` re-encodes when space matters. Non-Opus sources are transcoded once
to Opus 128 kbps. Everything is stored as Ogg (`audio/ogg; codecs=opus`), which Chrome, Firefox and
Safari 18.4+ play natively.

## Consequences

About 150 hours of music fit in the free tier.
