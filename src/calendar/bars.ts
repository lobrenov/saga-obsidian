/** Something over the day numbers `from` to `to` (either may be infinite). */
export interface Span {
  from: number
  to: number
}

/** The part of a span on one week: its columns (0-based, inclusive) and lane, and whether it continues from the week before or into the week after. */
export interface Bar<T extends Span> {
  item: T
  first: number
  last: number
  lane: number
  before: boolean
  after: boolean
}

/** The bars of the spans that touch the week of `length` days starting at day number `start`, each on the first lane free along its columns. */
export function weekBars<T extends Span>(spans: readonly T[], start: number, length: number): Bar<T>[] {
  const end = start + length - 1
  const bars = spans
    .filter((span) => span.from <= end && span.to >= start)
    .map((span) => ({ item: span, first: Math.max(span.from, start) - start, last: Math.min(span.to, end) - start, before: span.from < start, after: span.to > end }))
    .sort((a, b) => a.first - b.first || b.last - a.last)
  const laneEnds: number[] = []
  return bars.map((bar) => {
    let lane = laneEnds.findIndex((last) => last < bar.first)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = bar.last
    return { ...bar, lane }
  })
}
