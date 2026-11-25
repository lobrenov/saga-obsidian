import { dateRange, formatDate } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import type { CalendarEntry } from './entries'

/** An entry as the timeline draws it: a day, a date to its end, or the whole length of a month, year or era. */
export interface TimelineRow {
  entry: CalendarEntry
  kind: 'point' | 'bar' | 'span'
  /** The first and last day number drawn; infinite for an era without an end. */
  from: number
  to: number
}

/** The rows in the order of `entries`, and the entries without a valid start date. */
export function timelineRows(calendar: Calendar, entries: readonly CalendarEntry[]): { rows: TimelineRow[]; unplaced: CalendarEntry[] } {
  const rows: TimelineRow[] = []
  const unplaced: CalendarEntry[] = []
  for (const entry of entries) {
    const { start, end } = entry
    if (!start) {
      unplaced.push(entry)
      continue
    }
    const range = dateRange(calendar, start)
    const to = end ? dateRange(calendar, end).to : range.to
    const dayDated = 'year' in start && start.day !== undefined
    rows.push({ entry, kind: dayDated ? (end ? 'bar' : 'point') : 'span', from: range.from, to })
  }
  return { rows, unplaced }
}

/** The dates as written on a row: the start, then its end after a dash. */
export function rowDate(calendar: Calendar, entry: CalendarEntry): string {
  const { start, end } = entry
  if (!start) return ''
  return end ? `${formatDate(calendar, start)} – ${formatDate(calendar, end)}` : formatDate(calendar, start)
}
