import { formatDate, weekdayOf } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import type { CalendarEntry } from './entries'

/** The entry's date as written: the start, an end after a dash, and for a single day its weekday first unless `weekday` is false. */
export function dateText(calendar: Calendar, entry: CalendarEntry, weekday = true): string {
  const { start, end } = entry
  if (!start) return ''
  const text = formatDate(calendar, start)
  if (end) return `${text} – ${formatDate(calendar, end)}`
  if (weekday && 'year' in start && start.month !== undefined && start.day !== undefined) return `${calendar.weekdays[weekdayOf(calendar, start.year, start.month, start.day)]}, ${text}`
  return text
}
