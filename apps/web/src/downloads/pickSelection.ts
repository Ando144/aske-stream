/** The first `max` ids, in order. */
export function initialSelection(ids: readonly string[], max: number): Set<string> {
  return new Set(ids.slice(0, max));
}

/** New set; refused = true (and set unchanged) when adding would go over max. */
export function toggleSelection(
  selected: ReadonlySet<string>,
  id: string,
  max: number,
): { selected: Set<string>; refused: boolean } {
  const next = new Set(selected);
  if (next.delete(id)) return { selected: next, refused: false };
  if (next.size >= max) return { selected: next, refused: true };
  next.add(id);
  return { selected: next, refused: false };
}

/** Entries whose id is selected, in playlist order. */
export function pickedEntries<T extends { id: string }>(
  entries: readonly T[],
  selected: ReadonlySet<string>,
): T[] {
  return entries.filter((e) => selected.has(e.id));
}
