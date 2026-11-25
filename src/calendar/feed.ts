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

/** The days an entry covers: from its start's first day to its end's last day when it has an end, else to the last day of its start; an era-only start counts as its era's first day alone. */
function span(calendar: Calendar, { entry, start }: FeedEntry): { from: number; to: number } {
  const range = dateRange(calendar, start)
  const last = 'era' in start ? range.from : range.to
  return { from: range.from, to: entry.end ? Math.max(last, dateRange(calendar, entry.end).to) : last }
}

/** Whole years in the days that lie wholly between the end of what came before and the start of this entry; 0 when either is unbounded. */
function yearsBetween(calendar: Calendar, before: number, from: number): number {
  const days = from - before - 1
  return Number.isFinite(days) && days > daysInYear(calendar) ? Math.floor(days / daysInYear(calendar)) : 0
}

/** The feed's rows. Entries sort by `compareDates` (a coarser date before a finer one that begins at the same point, ties in the base's order); Newest first sorts by its opposite, so ties keep the base's order there too. An era header opens each run of entries in one era, a gap marker sits between entries more than a year apart, and a year marker opens a run of entries sharing a year. A gap is measured in days from the latest end among the entries chronologically up to the earlier of the two (an event's end counts) to the later one's start, in whole calendar years. */
export function buildFeed(calendar: Calendar, entries: readonly CalendarEntry[], order: Order): Feed {
  const problems: CalendarEntry[] = []
  const chronological: FeedEntry[] = []
  for (const entry of entries) {
    const { start } = entry
    if (!start) {
      problems.push(entry)
      continue
    }
    const year = 'year' in start ? start.year : undefined
    const era = 'era' in start ? calendar.eras.find((candidate) => candidate.name === start.era) : year === undefined ? undefined : eraOf(calendar, year)
    chronological.push({ entry, start, precision: precisionOf(start), era, year })
  }
  chronological.sort((a, b) => compareDates(calendar, a.start, b.start))

  // Each entry's first day, and the last day reached by it and the entries before it.
  const first = new Map<FeedEntry, number>()
  const reach = new Map<FeedEntry, number>()
  let latest = -Infinity
  for (const item of chronological) {
    const range = span(calendar, item)
    latest = Math.max(latest, range.to)
    first.set(item, range.from)
    reach.set(item, latest)
  }

  const items = order === 'oldest' ? chronological : [...chronological].sort((a, b) => compareDates(calendar, b.start, a.start))
  const rows: FeedRow[] = []
  let count = 0
  items.forEach((item, index) => {
    const previous = items[index - 1]
    if (previous) {
      const [earlier, later] = order === 'oldest' ? [previous, item] : [item, previous]
      const years = yearsBetween(calendar, reach.get(earlier)!, first.get(later)!)
      if (years > 0) rows.push({ kind: 'gap', years })
    }
    if (item.era && item.era !== previous?.era) rows.push({ kind: 'era', era: item.era })
    const shared = item.year !== undefined && (item.year === previous?.year || items[index + 1]?.year === item.year)
    if (shared && item.year !== previous?.year) rows.push({ kind: 'year', year: item.year! })
    rows.push({ kind: 'entry', item, side: count++ % 2 === 0 ? 'left' : 'right', under: shared ? item.year : undefined })
  })
  return { rows, problems }
}
