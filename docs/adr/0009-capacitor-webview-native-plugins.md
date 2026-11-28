# 0009 — Capacitor WebView with our own native plugins

**Status:** accepted

**Introduced in:** v0.2.0

## Context

[ADR 0001](0001-pwa-first.md) left room for a native Android client. The app needed reliable
background playback, in-app updates and later native downloads, without writing the interface
twice.

## Options

- **Native Kotlin + Media3** — the strongest playback support, but a second app to keep in step.
- **Flutter or React Native** — a new codebase instead of the existing web app.
- **Capacitor shell with playback in a native player** — two playback paths to maintain.
- **Capacitor shell with playback in the WebView `<audio>`** — one code path with the web app.

## Decision

Wrap the web build in Capacitor. Playback stays in the WebView's `<audio>`, so queue, offline
cache, device files, podcasts and radio are shared. A native media session with a `mediaPlayback`
foreground service (`@capgo/capacitor-media-session`) provides lock-screen controls, and our own
plugin holds wake and Wi-Fi locks while playing. Other native needs are small Java plugins, each
behind a file in `apps/web/src/native/`.

## Consequences

Features reach web and Android together, and fake plugins let browser tests run Android flows.
Background behaviour depends on how Android treats the WebView. Rotating the offline cache with the
app fully closed is not done, because the cache lives in WebView storage. The APK is distributed
through GitHub Releases and updates itself. Details: [android.md](../android.md).
