# 0013 — Listening statistics are opt-in only, with a local Recap

**Status:** accepted

**Introduced in:** v0.8.0 (local Recap), v0.8.7 (sharing with friend groups)

## Context

People like a summary of what they listen to, but listening history is personal data covered by the
GDPR.

## Options

- **Collect by default, allow opting out** — rejected: consent must be explicit.
- **Server-side history for everyone** — needs identifiers and a database of habits.
- **Local history, off until accepted** — nothing leaves the device.
- **Optional sharing on top of the local history** — a second, separate choice.

## Decision

The Recap is off until the user accepts it, and its history stays in IndexedDB on the device.
Turning it off deletes the history. Sharing with friend groups is a separate switch, also off by
default. Turning it on also turns on the Recap, and turning it off deletes the shared figures from
the Hub. Skipped songs, radio and podcasts are never sent. No other usage statistics are sent.

## Consequences

Recaps are per device. Group figures only count people who share. Anonymous telemetry and an admin
dashboard appear in the [phase plan](../v2/architecture.md) and are not built. Any future
statistics need explicit consent. Details: [PRIVACY.md](../PRIVACY.md).
