# 0008 — YouTube downloads on the phone with yt-dlp

**Status:** accepted

**Introduced in:** v0.3.0

## Context

Users want to add music from the app itself. YouTube blocks datacenter addresses, and downloads
made by a server would not be the user's own traffic.

## Options

- **Download in the Worker** — rejected for the two reasons above.
- **Command-line tool only** — works (`tools/ingest`), but not for non-technical users.
- **yt-dlp inside the Android app** — runs on the user's own connection (typically a residential or
  mobile address) and can be updated without releasing a new app.

## Decision

The phone downloads, using youtubedl-android (Python, yt-dlp and QuickJS). Opus audio is stored as
YouTube delivers it (in WebM), without re-encoding. Search uses YouTube's InnerTube API with
yt-dlp as a fallback. In the app, a computer can only search and send the picks to a phone ("Send
to phone").

## Consequences

Downloading in the app is an Android feature. The yt-dlp engine is refreshed weekly and on demand,
because YouTube changes often. The APK is larger and is built per processor type. The Worker
accepts WebM as well as Ogg. YouTube may still ask downloaders to prove they are not a robot.
Details: [android.md](../android.md).
