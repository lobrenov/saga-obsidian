import { dateRange } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import type { CalendarEntry } from './entries'

/** An entry over the day numbers `from` to `to`. */
export interface Placed {
  entry: CalendarEntry
  from: number
  to: number
}

/** How the Calendar display places entries. */
export interface Placement {
  /** Dated to a day, to its end when it has one: drawn on the days. */
  days: Placed[]
  /** Dated to a month or a year: listed as "No day set" where their range falls. */
  loose: Placed[]
  /** Without a valid start date: listed with their issues. */
  unplaced: CalendarEntry[]
}

/** Sorts entries into those drawn on days, those with no day set and those with a bad date; era-only dates are left to the other displays. */
export function place(calendar: Calendar, entries: readonly CalendarEntry[]): Placement {
  const placement: Placement = { days: [], loose: [], unplaced: [] }
  for (const entry of entries) {
    const { start, end } = entry
    if (!start) placement.unplaced.push(entry)
    else if ('year' in start) {
      const range = dateRange(calendar, start)
      const to = end ? dateRange(calendar, end).to : range.to
      if (start.day === undefined) placement.loose.push({ entry, from: range.from, to })
      else placement.days.push({ entry, from: range.from, to })
    }
  }
  return placement
}
