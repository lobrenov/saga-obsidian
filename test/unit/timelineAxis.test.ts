import { describe, expect, it } from 'vitest'
import { dateRange, dayNumber, type CalendarDate } from '../../src/shared/calendars/dates'
import { parseCalendar, type Calendar } from '../../src/shared/calendars/schema'
import { axisFor, markOf, position, stepYear, titleOf, windowStart } from '../../src/calendar/timelineAxis'
import { timelineRows } from '../../src/calendar/timelineRows'
import type { CalendarEntry } from '../../src/calendar/entries'
import type { TFile } from 'obsidian'
import { tidereckoning } from './calendars/tidereckoning'

const load = (patch: Record<string, unknown> = {}): Calendar => {
  const { value } = parseCalendar({ ...tidereckoning, ...patch })
  if (!value) throw new Error('invalid sample calendar')
  return value
}
const calendar = load()
const YEAR = 179

describe('windows', () => {
  it('are whole decades and centuries from year 1 and back from year -1', () => {
    expect([1, 10, 11, 1312].map((y) => windowStart('decade', y))).toEqual([1, 1, 11, 1311])
    expect([-1, -5, -10, -11].map((y) => windowStart('decade', y))).toEqual([-10, -10, -10, -20])
    expect([1, 100, 101, -1, -100, -101].map((y) => windowStart('century', y))).toEqual([1, 1, 101, -100, -100, -200])
  })

  it('step across year 1 and -1 without a year 0', () => {
    expect(stepYear('year', -1, 1)).toBe(1)
    expect(stepYear('year', 1, -1)).toBe(-1)
    expect(stepYear('decade', -5, 1)).toBe(6)
    expect(windowStart('decade', stepYear('decade', -5, 1))).toBe(1)
    expect(stepYear('century', 50, -1)).toBe(-51)
  })

  it('are titled by year, years or era-spanning years', () => {
    expect(titleOf(calendar, 'year', 1312)).toBe('1312 AL')
    expect(titleOf(calendar, 'decade', 1312)).toBe('1311–1320 AL')
    expect(titleOf(calendar, 'century', 1)).toBe('1–100 AL')
    expect(titleOf(calendar, 'decade', 1395)).toBe('1391 AL – 1400 ST')
    expect(titleOf(calendar, 'all', 1)).toBe('All eras')
  })
})

describe('axes', () => {
  it('size the months of a year by their days', () => {
    const axis = axisFor(calendar, 'year', 1312)
    expect(axis.columns.map((c) => [c.label, c.weight])).toEqual([['Thawmoon', 30], ['Seedtide', 28], ['Bloomrise', 31], ['Highsun', 30], ['Emberfall', 29], ['Frostwane', 31]])
    expect(axis.from).toBe(dayNumber(calendar, 1312, 1, 1))
    expect(axis.to).toBe(axis.from + YEAR - 1)
    expect(position(axis, dayNumber(calendar, 1312, 4, 1))).toBeCloseTo(89 / 179)
    expect(position(axis, dayNumber(calendar, 1312, 4, 1) + 15)).toBeCloseTo(104 / 179)
  })

  it('size the years of a decade and a century equally', () => {
    const decade = axisFor(calendar, 'decade', 1312)
    expect(decade.columns.map((c) => c.label)).toEqual(['1311', '1312', '1313', '1314', '1315', '1316', '1317', '1318', '1319', '1320'])
    expect(position(decade, dayNumber(calendar, 1313, 1, 1))).toBeCloseTo(0.2)
    const century = axisFor(calendar, 'century', 1312)
    expect(century.columns).toHaveLength(100)
    expect(century.columns.filter((c) => c.label !== '').map((c) => c.label)).toEqual(['1301', '1311', '1321', '1331', '1341', '1351', '1361', '1371', '1381', '1391'])
    expect(position(century, dayNumber(calendar, 1351, 1, 1))).toBeCloseTo(0.5)
  })

  it('run through year 1 after year -1', () => {
    const decade = axisFor(calendar, 'decade', -3)
    expect(decade.to + 1).toBe(dayNumber(calendar, 1, 1, 1))
    expect(decade.columns).toHaveLength(10)
  })

  it('size eras in years and draw an open era 300 years long', () => {
    const axis = axisFor(calendar, 'all', 1)
    expect(axis.columns.map((c) => [c.title, c.weight])).toEqual([['The Drowned Age', 300], ['Before the Lanterns', 600], ['Age of Lanterns', 1399], ['The Second Tide', 300]])
    expect(axis.total).toBe(2599)
    expect(position(axis, dayNumber(calendar, 1, 1, 1))).toBeCloseTo(900 / 2599)
    expect(position(axis, dayNumber(calendar, 1400, 1, 1))).toBeCloseTo(2299 / 2599)
  })

  it('draw an open era as far as a dated note reaches', () => {
    const axis = axisFor(calendar, 'all', 1, [-2000, 2500])
    expect(axis.columns[0]?.weight).toBe(1400)
    expect(axis.columns[3]?.weight).toBe(1101)
  })

  it('draw one column from the earliest to the latest year without eras', () => {
    const bare = load({ eras: [] })
    const axis = axisFor(bare, 'all', 1, [-3, 5])
    expect(axis.columns).toHaveLength(1)
    expect(axis.columns[0]?.weight).toBe(8)
    expect(axis.from).toBe(dayNumber(bare, -3, 1, 1))
  })
})

describe('marks', () => {
  const axis = axisFor(calendar, 'year', 1312)
  const day = (m: number, d: number): number => dayNumber(calendar, 1312, m, d)

  it('sit on their days and miss the axis outside it', () => {
    const mark = markOf(axis, day(4, 1), day(4, 1))
    expect(mark?.left).toBeCloseTo(89 / 179)
    expect(mark?.right).toBeCloseTo(90 / 179)
    expect(mark?.openStart || mark?.openEnd).toBe(false)
    expect(markOf(axis, day(1, 1) - 5, day(1, 1) - 1)).toBeUndefined()
    expect(markOf(axis, axis.to + 1, axis.to + 3)).toBeUndefined()
  })

  it('are open where they start before or end after the range', () => {
    expect(markOf(axis, day(1, 1) - 50, day(2, 3))).toMatchObject({ left: 0, openStart: true, openEnd: false })
    expect(markOf(axis, day(6, 20), axis.to + 50)).toMatchObject({ right: 1, openStart: false, openEnd: true })
    expect(markOf(axis, -Infinity, Infinity)).toMatchObject({ left: 0, right: 1, openStart: true, openEnd: true })
  })

  it('draw an era-only date over its era at All', () => {
    const all = axisFor(calendar, 'all', 1)
    const range = dateRange(calendar, { era: 'Age of Lanterns' })
    const mark = markOf(all, range.from, range.to)
    expect(mark?.left).toBeCloseTo(900 / 2599)
    expect(mark?.right).toBeCloseTo(2299 / 2599)
    const open = dateRange(calendar, { era: 'The Second Tide' })
    expect(markOf(all, open.from, open.to)).toMatchObject({ right: 1, openEnd: true })
  })
})

describe('rows', () => {
  const entry = (title: string, start: CalendarDate | undefined, end?: CalendarDate): CalendarEntry => ({
    file: { path: `${title}.md`, basename: title } as TFile,
    title,
    renderer: 'lore',
    start,
    end,
    issues: [],
    banner: undefined
  })

  it('keep the entries order and sort them into points, bars and spans', () => {
    const { rows, unplaced } = timelineRows(calendar, [
      entry('span', { year: 1312, month: 4 }),
      entry('point', { year: 1312, month: 4, day: 3 }),
      entry('bar', { year: 1312, month: 4, day: 3 }, { year: 1312, month: 5, day: 2 }),
      entry('era', { era: 'Age of Lanterns' }),
      entry('bad', undefined)
    ])
    expect(rows.map((row) => [row.entry.title, row.kind])).toEqual([['span', 'span'], ['point', 'point'], ['bar', 'bar'], ['era', 'span']])
    expect(rows[0]).toMatchObject({ from: dayNumber(calendar, 1312, 4, 1), to: dayNumber(calendar, 1312, 4, 30) })
    expect(rows[2]).toMatchObject({ from: dayNumber(calendar, 1312, 4, 3), to: dayNumber(calendar, 1312, 5, 2) })
    expect(unplaced.map((e) => e.title)).toEqual(['bad'])
  })
})
