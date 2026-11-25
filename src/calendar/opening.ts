import { compareDates } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import type { CalendarEntry } from './entries'

/** The year and month a display opens on: the earliest dated entry's, else month 1 of year 1. */
export function opening(calendar: Calendar, entries: readonly CalendarEntry[]): { year: number; month: number } {
  const dated = entries.flatMap(({ start }) => (start && 'year' in start ? [start] : []))
  const first = dated.sort((a, b) => compareDates(calendar, a, b))[0]
  return first && 'year' in first ? { year: first.year, month: first.month ?? 1 } : { year: 1, month: 1 }
}
