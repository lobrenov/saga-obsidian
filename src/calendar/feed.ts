import { compareDates, dateRange, daysInYear, eraOf, type CalendarDate } from '../shared/calendars/dates'
import type { Calendar, Era } from '../shared/calendars/schema'
import type { CalendarEntry } from './entries'

export type Order = 'oldest' | 'newest'

/** How precisely an entry is dated. */
export type Precision = 'day' | 'month' | 'year' | 'era'

/** An entry in the feed with what its markers need. */
export interface FeedEntry {
  entry: CalendarEntry
  /** The valid start date. */
  start: CalendarDate
  precision: Precision
  era: Era | undefined
  /** The year of a year, month or day date. */
  year: number | undefined
}

export type FeedRow =
  | { kind: 'era'; era: Era }
  /** Whole years between two entries in feed order. */
  | { kind: 'gap'; years: number }
  | { kind: 'year'; year: number }
  | { kind: 'entry'; item: FeedEntry; side: 'left' | 'right'; /** The year a marker above already gives. */ under: number | undefined }

export interface Feed {
  rows: FeedRow[]
  /** Entries with no valid start date. */
  problems: CalendarEntry[]
}

const precisionOf = (date: CalendarDate): Precision => {
  if ('era' in date) return 'era'
  return date.day !== undefined ? 'day' : date.month !== undefined ? 'month' : 'year'
}

/** The days an entry covers: a year or month date its whole range, a day date to its end date when it has one, an era-only date its era's first day alone (where it sits in the feed). */
function span(calendar: Calendar, { entry, start }: FeedEntry): { from: number; to: number } {
  const range = dateRange(calendar, start)
  if ('era' in start) return { from: range.from, to: range.from }
  return { from: range.from, to: entry.end ? Math.max(range.to, dateRange(calendar, entry.end).to) : range.to }
}

/** Whole years in the days that lie wholly between the end of what came before and the start of this entry; 0 when either is unbounded. */
function yearsBetween(calendar: Calendar, before: number, from: number): number {
  const days = from - before - 1
  return Number.isFinite(days) && days > daysInYear(calendar) ? Math.floor(days / daysInYear(calendar)) : 0
}

/** The feed's rows. Entries sort by `compareDates` (a coarser date before a finer one that begins at the same point, ties in the base's order), reversed for `newest`. An era header opens each run of entries in one era, a gap marker sits between entries more than a year apart, and a year marker opens a run of entries sharing a year. A gap is measured in days from the latest end among the entries before (an event's end counts) to the next entry's start, in whole calendar years; an era-only date counts as its era's first day. */
export function buildFeed(calendar: Calendar, entries: readonly CalendarEntry[], order: Order): Feed {
  const problems: CalendarEntry[] = []
  const items: FeedEntry[] = []
  for (const entry of entries) {
    const { start } = entry
    if (!start) {
      problems.push(entry)
      continue
    }
    const year = 'year' in start ? start.year : undefined
    const era = 'era' in start ? calendar.eras.find((candidate) => candidate.name === start.era) : year === undefined ? undefined : eraOf(calendar, year)
    items.push({ entry, start, precision: precisionOf(start), era, year })
  }
  items.sort((a, b) => compareDates(calendar, a.start, b.start))

  // The gap before each entry, in chronological order.
  const gapBefore = new Map<FeedEntry, number>()
  let reach = -Infinity
  items.forEach((item, index) => {
    const { from, to } = span(calendar, item)
    if (index > 0) gapBefore.set(item, yearsBetween(calendar, reach, from))
    reach = Math.max(reach, to)
  })

  if (order === 'newest') items.reverse()
  const rows: FeedRow[] = []
  let count = 0
  items.forEach((item, index) => {
    const previous = items[index - 1]
    if (previous) {
      const years = (order === 'oldest' ? gapBefore.get(item) : gapBefore.get(previous)) ?? 0
      if (years > 0) rows.push({ kind: 'gap', years })
    }
    if (item.era && item.era !== previous?.era) rows.push({ kind: 'era', era: item.era })
    const shared = item.year !== undefined && (item.year === previous?.year ? true : items[index + 1]?.year === item.year)
    if (shared && item.year !== previous?.year) rows.push({ kind: 'year', year: item.year! })
    rows.push({ kind: 'entry', item, side: count++ % 2 === 0 ? 'left' : 'right', under: shared ? item.year : undefined })
  })
  return { rows, problems }
}
