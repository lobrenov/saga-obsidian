import { addYears, dayNumber, daysInYear, eraOf, eraSpan, formatDate, type CalendarDate } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import type { Scale } from './types'

/** Years drawn for an era that has no end (as the header's era strip weighs it), more when a note is dated further out. */
export const OPEN_ERA_YEARS = 300

/** A column of the timeline over the day numbers `from` to `to`; `weight` is its share of the width. */
export interface Column {
  label: string
  title: string
  from: number
  to: number
  weight: number
}

export interface Axis {
  columns: Column[]
  /** The first and last day drawn. */
  from: number
  to: number
  total: number
}

/** Years per column group at each scale below All. */
const YEARS: Record<Exclude<Scale, 'all'>, number> = { year: 1, decade: 10, century: 100 }

/** The 0-based count of years from year 1 (year -1 is -1). */
const index = (year: number): number => (year > 0 ? year - 1 : year)

const axisOf = (columns: Column[]): Axis => ({
  columns,
  from: columns[0]?.from ?? 0,
  to: columns.at(-1)?.to ?? 0,
  total: columns.reduce((sum, column) => sum + column.weight, 0)
})

/** The lowest and highest of `years` and `bound`, without spreading the years. */
function extent(years: readonly number[], bound: number): { low: number; high: number } {
  let low = bound
  let high = bound
  for (const year of years) {
    if (year < low) low = year
    if (year > high) high = year
  }
  return { low, high }
}

/** The years an entry's dates fall in. */
export function yearsOf(...dates: (CalendarDate | undefined)[]): number[] {
  return dates.flatMap((date) => (date && 'year' in date ? [date.year] : []))
}

/** The first year of the window of `scale` that holds `year`; windows are whole decades or centuries counted from year 1 and back from year -1. */
export function windowStart(scale: Exclude<Scale, 'all'>, year: number): number {
  const size = YEARS[scale]
  return addYears(1, Math.floor(index(year) / size) * size)
}

/** The first and last year of the window of `scale` that holds `year`. */
export const windowYears = (scale: Exclude<Scale, 'all'>, year: number): number[] => {
  const first = windowStart(scale, year)
  return [first, addYears(first, YEARS[scale] - 1)]
}

/** The year `n` windows of `scale` from `year`. */
export const stepYear = (scale: Exclude<Scale, 'all'>, year: number, n: number): number => addYears(year, n * YEARS[scale])

/** The axis of the years of the window of `scale` holding `year`: the months at Year, the years at Decade and Century. */
function yearsAxis(calendar: Calendar, scale: Exclude<Scale, 'all'>, year: number): Axis {
  const first = windowStart(scale, year)
  const length = daysInYear(calendar)
  if (scale === 'year') {
    let from = dayNumber(calendar, first, 1, 1)
    return axisOf(
      calendar.months.map((month) => {
        const column = { label: month.name, title: month.name, from, to: from + month.days - 1, weight: month.days }
        from += month.days
        return column
      })
    )
  }
  return axisOf(
    Array.from({ length: YEARS[scale] }, (_, i) => {
      const at = addYears(first, i)
      const from = dayNumber(calendar, at, 1, 1)
      const named = String(Math.abs(at))
      return { label: scale === 'decade' || i % 10 === 0 ? named : '', title: formatDate(calendar, { year: at }), from, to: from + length - 1, weight: 1 }
    })
  )
}

/** The axis of every era, weighed in years; an era without an end is drawn `OPEN_ERA_YEARS` long, or as long as `years` reach out. Without eras, one column from the earliest to the latest of `years`. */
function erasAxis(calendar: Calendar, years: readonly number[]): Axis {
  const length = daysInYear(calendar)
  if (calendar.eras.length === 0) {
    const { low: first, high: last } = extent(years, 1)
    const count = index(last) - index(first) + 1
    const from = dayNumber(calendar, first, 1, 1)
    return axisOf([{ label: 'All', title: 'All', from, to: from + count * length - 1, weight: count }])
  }
  return axisOf(
    calendar.eras.map((era) => {
      const span = eraSpan(calendar, era)
      let { from, to } = span
      if (!Number.isFinite(from)) from = addYears(to, 1 - Math.max(OPEN_ERA_YEARS, index(to) - index(extent(years, to).low) + 1))
      if (!Number.isFinite(to)) to = addYears(from, Math.max(OPEN_ERA_YEARS, index(extent(years, from).high) - index(from) + 1) - 1)
      const count = index(to) - index(from) + 1
      return { label: `${era.name} · ${era.short}`, title: era.name, from: dayNumber(calendar, from, 1, 1), to: dayNumber(calendar, to, 1, 1) + length - 1, weight: count }
    })
  )
}

/** The axis of `scale`; `year` picks the window below All, and `years` (the years entries are dated in) the extent of open-ended eras. */
export function axisFor(calendar: Calendar, scale: Scale, year: number, years: readonly number[] = []): Axis {
  return scale === 'all' ? erasAxis(calendar, years) : yearsAxis(calendar, scale, year)
}

/** Where day number `day` begins along the axis, from 0 to 1; days before or after the axis give 0 or 1. */
export function position(axis: Axis, day: number): number {
  let before = 0
  for (const column of axis.columns) {
    if (day < column.from) break
    if (day < column.to + 1) return (before + (column.weight * (day - column.from)) / (column.to - column.from + 1)) / axis.total
    before += column.weight
  }
  return before / axis.total
}

/** The title of the window: a year, the years of a decade or century, or all eras. */
export function titleOf(calendar: Calendar, scale: Scale, year: number): string {
  if (scale === 'all') return 'All eras'
  if (scale === 'year') return formatDate(calendar, { year })
  const first = windowStart(scale, year)
  const last = addYears(first, YEARS[scale] - 1)
  const era = eraOf(calendar, first)
  if (era && era === eraOf(calendar, last)) return `${Math.abs(first)}–${Math.abs(last)} ${era.short}`
  return `${formatDate(calendar, { year: first })} – ${formatDate(calendar, { year: last })}`
}

/** A placed entry's mark: its extent along the axis, and whether it carries on past either edge. */
export interface Mark {
  /** Fractions from 0 to 1. */
  left: number
  right: number
  openStart: boolean
  openEnd: boolean
}

/** The mark of the day numbers `from` to `to` on the axis; undefined when they miss it. */
export function markOf(axis: Axis, from: number, to: number): Mark | undefined {
  if (from > axis.to || to < axis.from) return undefined
  return { left: position(axis, from), right: position(axis, to + 1), openStart: from < axis.from, openEnd: to > axis.to }
}
