import { shuffled } from '../offline/planner';

export interface ShuffleCycle {
  key: string;
  played: string[];
  usedAt: number;
  /** Fixes the order of the round; rounds saved by older versions have none yet. */
  seed?: number;
}
export type ShuffleCycles = Record<string, ShuffleCycle>;
export const MAX_REMEMBERED_CYCLES = 20;
/** The whole library is a single round, whatever filter or search is applied. */
export const LIBRARY_CYCLE_KEY = 'library';
const MAX_SEED_RETRIES = 32;

export function cycleKey(
  context: { cycleKey?: string; path?: string; label: string } | null,
): string {
  return context?.cycleKey ?? context?.path ?? context?.label ?? 'none';
}

export function cycleFor(cycles: ShuffleCycles, key: string, now: number): ShuffleCycle {
  return cycles[key] ?? { key, played: [], usedAt: now };
}

export function rememberCycle(
  cycles: ShuffleCycles,
  cycle: ShuffleCycle,
  now: number,
): ShuffleCycles {
  const all = { ...cycles, [cycle.key]: { ...cycle, usedAt: now } };
  const newestFirst = Object.values(all).sort((a, b) => b.usedAt - a.usedAt);
  const next: ShuffleCycles = {};
  for (const c of newestFirst.slice(0, MAX_REMEMBERED_CYCLES)) next[c.key] = c;
  return next;
}

export function newSeed(random: () => number = Math.random): number {
  return Math.floor(random() * 0x100000000) >>> 0;
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

/** Stable pseudo-random order: adding or removing songs never moves the others around. */
export function rankBySeed(ids: readonly string[], seed: number): string[] {
  return ids
    .map((id) => ({ id, rank: fnv1a(`${seed}:${id}`) }))
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
    .map((entry) => entry.id);
}

/** Chosen song (if any), then the unheard songs and then the heard ones, both by rank. */
export function roundOrder(
  ids: readonly string[],
  firstId: string | null,
  played: ReadonlySet<string>,
  seed: number,
): string[] {
  const first = firstId !== null && ids.includes(firstId) ? firstId : null;
  const ranked = rankBySeed(
    ids.filter((id) => id !== first),
    seed,
  );
  return [
    ...(first === null ? [] : [first]),
    ...ranked.filter((id) => !played.has(id)),
    ...ranked.filter((id) => played.has(id)),
  ];
}

/** Moves the song that has just played to the end when it would open the list again. */
export function avoidOpeningWith(order: string[], lastId: string | null): string[] {
  if (order.length < 2 || order[0] !== lastId) return order;
  return [...order.slice(1), lastId];
}

export function reseedAll(
  cycles: ShuffleCycles,
  random: () => number = Math.random,
): ShuffleCycles {
  return Object.fromEntries(
    Object.entries(cycles).map(([key, cycle]) => [key, { ...cycle, seed: newSeed(random) }]),
  );
}

/** Seed for the next round, chosen so that `lastId` does not open it. */
function nextRoundSeed(ids: readonly string[], lastId: string, random: () => number): number {
  let seed = newSeed(random);
  for (let i = 0; i < MAX_SEED_RETRIES && ids.length > 1; i++) {
    if (rankBySeed(ids, seed)[0] !== lastId) break;
    seed = (seed + 1) >>> 0;
  }
  return seed;
}

export function recordPlayed(
  cycle: ShuffleCycle,
  id: string,
  ids: readonly string[],
  random: () => number = Math.random,
): ShuffleCycle {
  const played = cycle.played.includes(id) ? cycle.played : [...cycle.played, id];
  const done = new Set(played);
  if (ids.length > 0 && ids.every((x) => done.has(x))) {
    const seed = nextRoundSeed(ids, id, random);
    return { key: cycle.key, played: [], usedAt: cycle.usedAt, seed };
  }
  return { ...cycle, played };
}

export function insertShuffled(
  context: readonly string[],
  index: number,
  newIds: readonly string[],
  random: () => number = Math.random,
): string[] {
  const out = [...context];
  for (const id of shuffled(newIds, random)) {
    const from = index + 1;
    const pos = from + Math.floor(random() * (out.length - from + 1));
    out.splice(pos, 0, id);
  }
  return out;
}
