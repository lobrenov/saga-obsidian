/** Matches the raw entry that is the pin at `x`, `y` on the map `isMap` recognises, however its link is written. */
export function entryMatcher(isMap: (mapLink: string) => boolean, x: number, y: number): (raw: unknown) => boolean {
  return (raw) => typeof raw === 'object' && raw !== null && (raw as { x?: unknown }).x === x && (raw as { y?: unknown }).y === y && typeof (raw as { map?: unknown }).map === 'string' && isMap((raw as { map: string }).map)
}

/** The index of the entry that is the pin: the pin's own index when that entry still matches, else the one entry that does; null when none or several do. */
export function locateEntry(list: readonly unknown[], index: number, match: (raw: unknown) => boolean): number | null {
  if (match(list[index])) return index
  const hits = list.flatMap((raw, i) => (match(raw) ? [i] : []))
  return hits.length === 1 ? (hits[0] ?? null) : null
}
