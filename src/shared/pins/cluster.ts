export interface ClusterItem {
  key: string
  /** Position in screen pixels at the current zoom. */
  px: number
  py: number
}

export interface Cluster<T extends ClusterItem> {
  items: T[]
  /** Mean screen position. */
  px: number
  py: number
}

/** Pins shown individually up to this many; above it, nearby pins merge into clusters. */
export const CLUSTER_THRESHOLD = 50
export const CLUSTER_CELL = 56

/** Groups items by a screen-space grid; with `threshold` items or fewer every item is its own group. `keep` items are never merged. */
export function clusterItems<T extends ClusterItem>(items: readonly T[], keep: ReadonlySet<string> = new Set(), threshold = CLUSTER_THRESHOLD, cell = CLUSTER_CELL): Cluster<T>[] {
  const single = (item: T): Cluster<T> => ({ items: [item], px: item.px, py: item.py })
  if (items.length <= threshold) return items.map(single)
  const cells = new Map<string, T[]>()
  const out: Cluster<T>[] = []
  for (const item of items) {
    if (keep.has(item.key)) {
      out.push(single(item))
      continue
    }
    const id = `${Math.floor(item.px / cell)}:${Math.floor(item.py / cell)}`
    const group = cells.get(id)
    if (group) group.push(item)
    else cells.set(id, [item])
  }
  for (const group of cells.values()) {
    out.push({ items: group, px: group.reduce((sum, i) => sum + i.px, 0) / group.length, py: group.reduce((sum, i) => sum + i.py, 0) / group.length })
  }
  return out
}
