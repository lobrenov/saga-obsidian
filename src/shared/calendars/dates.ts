import type { Validated } from '../result'
import type { Calendar, Era } from './schema'
import { dateKeysSchema } from './schema'

export type CalendarDate = { era: string } | { year: number; month?: number; day?: number }

/** A day in a month grid; `inMonth` is false for the days borrowed from neighbouring months. */
export interface GridDay {
  year: number
  month: number
  day: number
  inMonth: boolean
}

const KEYS = ['era', 'year', 'month', 'day'] as const

/** Reads the date under `prefix` (`''` or `end-`); undefined without issues when no date key is present. */
export function readDate(frontmatter: Readonly<Record<string, unknown>>, prefix: string): Validated<CalendarDate> {
  const raw: Record<string, unknown> = {}
  for (const key of KEYS) {
    const value = frontmatter[prefix + key]
    if (value !== undefined && value !== null) raw[key] = value
  }
  if (Object.keys(raw).length === 0) return { value: undefined, issues: [] }
  const parsed = dateKeysSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      value: undefined,
      issues: parsed.error.issues.map((issue) => ({
        path: prefix + issue.path.map(String).join('.'),
        message: issue.message
      }))
    }
  }
  const { era, year, month, day } = parsed.data
  if (era !== undefined) return { value: { era }, issues: [] }
  if (year === undefined) return { value: undefined, issues: [] }
  return {
    value: {
      year,
      ...(month !== undefined && { month }),
      ...(day !== undefined && { day })
    },
    issues: []
  }
}

/** The first year of an era; -Infinity for the earliest before era. */
const eraFrom = (era: Era): number => {
  if (era.start === undefined) return era.side === 'before' ? -Infinity : 1
  return era.side === 'before' ? -era.start : era.start
}

/** The era a year falls in; undefined when the calendar has no era on that side. */
export function eraOf(calendar: Calendar, year: number): Era | undefined {
  const side = year < 0 ? 'before' : 'after'
  return calendar.eras.filter((era) => era.side === side).findLast((era) => eraFrom(era) <= year)
}

/** The first and last year of an era; infinite where it runs without end. */
export function eraSpan(calendar: Calendar, era: Era): { from: number; to: number } {
  const side = calendar.eras.filter((e) => e.side === era.side)
  const next = side[side.indexOf(era) + 1]
  return {
    from: eraFrom(era),
    to: next ? eraFrom(next) - 1 : era.side === 'before' ? -1 : Infinity
  }
}

/** Year, month and day as numbers that sort; a missing month or day is 0 so a coarser date comes first, and an era-only date precedes a year date at the same year. */
function sortKey(calendar: Calendar, date: CalendarDate): number[] {
  if ('era' in date) {
    const era = calendar.eras.find((e) => e.name === date.era)
    return [era ? eraSpan(calendar, era).from : Infinity, 0, 0, 0]
  }
  return [date.year, date.month ?? 0, date.day ?? 0, 1]
}

export function compareDates(calendar: Calendar, a: CalendarDate, b: CalendarDate): number {
  const kb = sortKey(calendar, b)
  for (const [i, value] of sortKey(calendar, a).entries()) {
    const other = kb[i] ?? 0
    if (value !== other) return value < other ? -1 : 1
  }
  return 0
}

/** `28 Highsun 1312 AL`, `Highsun 1312 AL`, `1312 AL`, or the era's name. */
export function formatDate(calendar: Calendar, date: CalendarDate): string {
  if ('era' in date) return date.era
  const era = eraOf(calendar, date.year)
  const year = era ? `${Math.abs(date.year)} ${era.short}` : String(date.year)
  const month = date.month === undefined ? undefined : (calendar.months[date.month - 1]?.name ?? String(date.month))
  return [date.day, month, year].filter((part) => part !== undefined).join(' ')
}

export const daysInYear = (calendar: Calendar): number => calendar.months.reduce((total, month) => total + month.days, 0)

/** The 1-based day of the year. */
export function dayOfYear(calendar: Calendar, month: number, day: number): number {
  return calendar.months.slice(0, month - 1).reduce((total, m) => total + m.days, 0) + day
}

/** Days since 1 <first month> 1 (negative before it). Year 1 follows year -1. */
const dayNumber = (calendar: Calendar, year: number, month: number, day: number): number =>
  (year > 0 ? year - 1 : year) * daysInYear(calendar) + dayOfYear(calendar, month, day) - 1

function fromDayNumber(calendar: Calendar, n: number): Omit<GridDay, 'inMonth'> {
  const length = daysInYear(calendar)
  const index = Math.floor(n / length)
  let rest = n - index * length
  let month = 1
  for (const m of calendar.months) {
    if (rest < m.days) break
    rest -= m.days
    month++
  }
  return { year: index >= 0 ? index + 1 : index, month, day: rest + 1 }
}

/** The index into `weekdays` of a day. */
export function weekdayOf(calendar: Calendar, year: number, month: number, day: number): number {
  const length = calendar.weekdays.length
  const first = calendar.weekdays.indexOf(calendar['first-weekday'])
  return (((first + dayNumber(calendar, year, month, day)) % length) + length) % length
}

/** A month as weeks of `weekdays.length` days, with days of the neighbouring months filling the first and last week. */
export function monthGrid(calendar: Calendar, year: number, month: number): GridDay[][] {
  const length = calendar.weekdays.length
  const days = calendar.months[month - 1]?.days ?? 0
  const lead = weekdayOf(calendar, year, month, 1)
  const trail = (length - ((lead + days) % length)) % length
  const first = dayNumber(calendar, year, month, 1) - lead
  const cells = Array.from({ length: lead + days + trail }, (_, i): GridDay => {
    const date = fromDayNumber(calendar, first + i)
    return { ...date, inMonth: date.year === year && date.month === month }
  })
  return Array.from({ length: cells.length / length }, (_, week) => cells.slice(week * length, (week + 1) * length))
}

/** The keys that write `date` under `prefix` and the keys to remove so no finer or era key is left behind. */
export function dateKeys(date: CalendarDate, prefix: string): { write: Record<string, string | number>; remove: string[] } {
  const write: Record<string, string | number> = 'era' in date ? { [prefix + 'era']: date.era } : { [prefix + 'year']: date.year }
  if ('year' in date) {
    if (date.month !== undefined) write[prefix + 'month'] = date.month
    if (date.day !== undefined) write[prefix + 'day'] = date.day
  }
  return {
    write,
    remove: KEYS.map((key) => prefix + key).filter((key) => !(key in write))
  }
}
