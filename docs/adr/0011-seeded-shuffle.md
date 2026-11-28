# 0011 — Seeded shuffle order

**Status:** accepted

**Introduced in:** v0.9.3 (the v0.8.4 notes already describe remembering the songs heard in each
list)

## Context

Shuffle must play everything once before repeating, and keep its order across restarts, filters and
new downloads.

## Options

- **Random pick on each skip** — songs repeat before others are heard.
- **Store a shuffled list** — has to be patched whenever songs are added or removed.
- **Store a seed and the songs already played** — the order is recomputed when needed.

## Decision

Each round of a list keeps a seed and the played ids (`apps/web/src/player/shuffleCycle.ts`). A
song's rank is a hash of the seed and its id, so adding or removing songs never moves the others
around. Unplayed songs come first. The whole library is a single round, whatever filter or search is
applied. When a round ends, a new seed is chosen so that the last song does not open the next one.
"Shuffle again" in Settings gives every remembered round a new seed.

## Consequences

Little is persisted, and only the 20 most recently used rounds are remembered. The logic is pure
and testable.
