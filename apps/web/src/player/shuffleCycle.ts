import { shuffled } from '../offline/planner';

export interface ShuffleCycle {
  key: string;
  played: string[];
  usedAt: number;
}
export type ShuffleCycles = Record<string, ShuffleCycle>;
export const MAX_REMEMBERED_CYCLES = 20;

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

export function shuffledCycleOrder(
  ids: readonly string[],
  firstId: string | null,
  played: ReadonlySet<string>,
  lastPlayed: string | null,
  random: () => number = Math.random,
): string[] {
  const hasFirst = firstId !== null && ids.includes(firstId);
  const rest = ids.filter((id) => id !== firstId || !hasFirst);
  const head = hasFirst ? [firstId] : [];

  if (ids.every((id) => played.has(id))) {
    const order = shuffled(rest, random);
    if (!hasFirst && order.length > 1 && order[0] === lastPlayed) {
      // Swap with a random other position so the repeat never opens the new round.
      const j = 1 + Math.floor(random() * (order.length - 1));
      [order[0], order[j]] = [order[j]!, order[0]!];
    }
    return [...head, ...order] as string[];
  }
  const fresh = shuffled(
    rest.filter((id) => !played.has(id)),
    random,
  );
  const old = shuffled(
    rest.filter((id) => played.has(id)),
    random,
  );
  return [...head, ...fresh, ...old] as string[];
}

export function recordPlayed(
  cycle: ShuffleCycle,
  id: string,
  ids: readonly string[],
): ShuffleCycle {
  const played = cycle.played.includes(id) ? cycle.played : [...cycle.played, id];
  const done = new Set(played);
  if (ids.length > 0 && ids.every((x) => done.has(x))) {
    return { key: cycle.key, played: [], usedAt: cycle.usedAt };
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
