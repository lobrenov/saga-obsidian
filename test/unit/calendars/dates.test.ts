import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  compareDates,
  dateKeys,
  dayOfYear,
  daysInYear,
  eraOf,
  eraSpan,
  formatDate,
  monthGrid,
  readDate,
  weekdayOf,
  type CalendarDate
} from '../../../src/shared/calendars/dates'
import { parseCalendar, type Calendar } from '../../../src/shared/calendars/schema'
import { tidereckoning } from './tidereckoning'

const load = (patch: Record<string, unknown> = {}): Calendar => {
  const { value } = parseCalendar({ ...tidereckoning, ...patch })
  if (!value) throw new Error('invalid sample calendar')
  return value
}
const calendar = load()
const year = fc.integer({ min: -3000, max: 3000 }).filter((y) => y !== 0)
const dateArb: fc.Arbitrary<CalendarDate> = fc.oneof(
  fc.constantFrom(...calendar.eras).map((era): CalendarDate => ({ era: era.name })),
  fc
    .record({
      year,
      month: fc.option(fc.integer({ min: 1, max: 6 }), { nil: undefined }),
      day: fc.option(fc.integer({ min: 1, max: 28 }), { nil: undefined })
    })
    .map(({ year, month, day }): CalendarDate => (month === undefined ? { year } : day === undefined ? { year, month } : { year, month, day }))
)
const eraNamed = (name: string) => calendar.eras.find((era) => era.name === name)!

describe('eras', () => {
  it('finds the era of a year at each boundary', () => {
    const name = (y: number) => eraOf(calendar, y)?.short
    expect(name(-5000)).toBe('DA')
    expect(name(-601)).toBe('DA')
    expect(name(-600)).toBe('BL')
    expect(name(-1)).toBe('BL')
    expect(name(1)).toBe('AL')
    expect(name(1399)).toBe('AL')
    expect(name(1400)).toBe('ST')
    expect(name(99999)).toBe('ST')
  })

  it('has no era where the calendar has none on that side', () => {
    expect(eraOf(load({ eras: [] }), 5)).toBeUndefined()
    expect(eraOf(load({ eras: [tidereckoning.eras[2]] }), -5)).toBeUndefined()
  })

  it('spans each era', () => {
    const span = (name: string) => eraSpan(calendar, eraNamed(name))
    expect(span('The Drowned Age')).toEqual({ from: -Infinity, to: -601 })
    expect(span('Before the Lanterns')).toEqual({ from: -600, to: -1 })
    expect(span('Age of Lanterns')).toEqual({ from: 1, to: 1399 })
    expect(span('The Second Tide')).toEqual({ from: 1400, to: Infinity })
  })

  it('places every year in the span of its era', () => {
    fc.assert(
      fc.property(year, (y) => {
        const era = eraOf(calendar, y)!
        const { from, to } = eraSpan(calendar, era)
        expect(y >= from && y <= to).toBe(true)
      })
    )
  })
})

describe('formatDate', () => {
  it('formats each precision', () => {
    expect(formatDate(calendar, { year: 1312, month: 4, day: 28 })).toBe('28 Highsun 1312 AL')
    expect(formatDate(calendar, { year: 1312, month: 4 })).toBe('Highsun 1312 AL')
    expect(formatDate(calendar, { year: 1312 })).toBe('1312 AL')
    expect(formatDate(calendar, { era: 'Age of Lanterns' })).toBe('Age of Lanterns')
  })

  it('counts before-era years back from 1', () => {
    expect(formatDate(calendar, { year: -1 })).toBe('1 BL')
    expect(formatDate(calendar, { year: -600, month: 1, day: 3 })).toBe('3 Thawmoon 600 BL')
    expect(formatDate(calendar, { year: -601 })).toBe('601 DA')
    expect(formatDate(calendar, { year: 1 })).toBe('1 AL')
  })

  it('shows the signed year without an era', () => {
    expect(formatDate(load({ eras: [] }), { year: -5 })).toBe('-5')
  })

  it('round-trips a year through its label', () => {
    fc.assert(
      fc.property(year, (y) => {
        const [number, short] = formatDate(calendar, { year: y }).split(' ')
        const era = calendar.eras.find((e) => e.short === short)!
        expect(era.side === 'before' ? -Number(number) : Number(number)).toBe(y)
      })
    )
  })
})

describe('compareDates', () => {
  const sort = (dates: CalendarDate[]) => [...dates].sort((a, b) => compareDates(calendar, a, b)).map((d) => formatDate(calendar, d))

  it('sorts coarser first at equal prefixes', () => {
    expect(sort([{ year: 1312, month: 4, day: 3 }, { year: 1312, month: 4 }, { year: 1312 }, { year: 1312, month: 1, day: 30 }])).toEqual([
      '1312 AL',
      '30 Thawmoon 1312 AL',
      'Highsun 1312 AL',
      '3 Highsun 1312 AL'
    ])
  })

  it('sorts years across year 1 and before-era years', () => {
    expect(sort([{ year: 1 }, { year: -1 }, { year: -600 }, { year: -601 }, { year: 2 }])).toEqual(['601 DA', '600 BL', '1 BL', '1 AL', '2 AL'])
  })

  it('sorts era-only dates at their era start', () => {
    expect(
      sort([{ year: 5 }, { era: 'The Second Tide' }, { era: 'Age of Lanterns' }, { year: -3 }, { era: 'The Drowned Age' }, { era: 'Before the Lanterns' }])
    ).toEqual(['The Drowned Age', 'Before the Lanterns', '3 BL', 'Age of Lanterns', '5 AL', 'The Second Tide'])
    expect(sort([{ year: 1 }, { era: 'Age of Lanterns' }])).toEqual(['Age of Lanterns', '1 AL'])
    expect(sort([{ year: 1400 }, { era: 'The Second Tide' }, { year: 1399, month: 6, day: 31 }])).toEqual([
      '31 Frostwane 1399 AL',
      'The Second Tide',
      '1400 ST'
    ])
  })

  it('sorts an unknown era last', () => {
    expect(sort([{ era: 'Nope' }, { year: 5000 }])).toEqual(['5000 ST', 'Nope'])
  })

  it('is a total order', () => {
    const cmp = (a: CalendarDate, b: CalendarDate) => compareDates(calendar, a, b)
    fc.assert(
      fc.property(dateArb, dateArb, dateArb, (a, b, c) => {
        expect(Math.sign(cmp(a, b)) + Math.sign(cmp(b, a))).toBe(0)
        expect(cmp(a, a)).toBe(0)
        if (cmp(a, b) <= 0 && cmp(b, c) <= 0) expect(cmp(a, c)).toBeLessThanOrEqual(0)
      })
    )
  })
})

describe('days and weekdays', () => {
  it('counts the days of the year', () => {
    expect(daysInYear(calendar)).toBe(179)
    expect(dayOfYear(calendar, 1, 1)).toBe(1)
    expect(dayOfYear(calendar, 2, 1)).toBe(31)
    expect(dayOfYear(calendar, 6, 31)).toBe(179)
  })

  const weekday = (y: number, m: number, d: number, cal = calendar) => cal.weekdays[weekdayOf(cal, y, m, d)]

  it('starts year 1 on first-weekday', () => {
    expect(weekday(1, 1, 1)).toBe('Moonday')
    expect(weekday(1, 2, 1)).toBe('Moonday')
    expect(weekday(1, 6, 31)).toBe('Lampday')
    expect(weekday(2, 1, 1)).toBe('Restday')
  })

  it('runs backwards from year 1 without a gap', () => {
    expect(weekday(-1, 6, 31)).toBe('Restday')
    expect(weekday(-1, 6, 30)).toBe('Lampday')
    expect(weekday(-1, 1, 1)).toBe('Tideday')
    expect(weekday(-2, 6, 31)).toBe('Moonday')
    expect(weekday(-1, 6, 31, load({ 'first-weekday': 'Netday' }))).toBe('Tideday')
  })

  it('advances one weekday a day', () => {
    fc.assert(
      fc.property(year, fc.integer({ min: 1, max: 6 }), (y, m) => {
        const days = calendar.months[m - 1]!.days
        for (let d = 1; d < days; d++) {
          expect(weekdayOf(calendar, y, m, d + 1)).toBe((weekdayOf(calendar, y, m, d) + 1) % 6)
        }
      })
    )
  })
})

describe('monthGrid', () => {
  const days = (grid: ReturnType<typeof monthGrid>) => grid.flat()
  const label = (cell: { year: number; month: number; day: number }) => `${cell.day}/${cell.month}/${cell.year}`

  it('has no leading days when the month starts on the first weekday', () => {
    const grid = monthGrid(calendar, 1, 1)
    expect(grid).toHaveLength(5)
    expect(label(grid[0]![0]!)).toBe('1/1/1')
    expect(days(grid).every((cell) => cell.inMonth)).toBe(true)
  })

  it('fills the last week from the next month', () => {
    const flat = days(monthGrid(calendar, 1, 2))
    expect(flat).toHaveLength(30)
    expect(flat.slice(28).map(label)).toEqual(['1/3/1', '2/3/1'])
    expect(flat.slice(28).some((cell) => cell.inMonth)).toBe(false)
  })

  it('fills the first week from the previous month', () => {
    const flat = days(monthGrid(calendar, 1, 3))
    expect(flat.slice(0, 4).map(label)).toEqual(['25/2/1', '26/2/1', '27/2/1', '28/2/1'])
    expect(label(flat[4]!)).toBe('1/3/1')
    expect(flat.slice(-1).map(label)).toEqual(['1/4/1'])
  })

  it('reaches into the previous year', () => {
    const flat = days(monthGrid(calendar, 2, 1))
    expect(flat.slice(0, 5).map(label)).toEqual(['27/6/1', '28/6/1', '29/6/1', '30/6/1', '31/6/1'])
  })

  it('crosses year 1 without a year 0', () => {
    const shifted = load({ 'first-weekday': 'Netday' })
    expect(
      days(monthGrid(shifted, 1, 1))
        .slice(0, 2)
        .map(label)
    ).toEqual(['30/6/-1', '31/6/-1'])
    expect(
      days(monthGrid(shifted, -1, 6))
        .slice(-4)
        .map(label)
    ).toEqual(['1/1/1', '2/1/1', '3/1/1', '4/1/1'])
  })

  it('lays every week on the weekdays', () => {
    fc.assert(
      fc.property(year, fc.integer({ min: 1, max: 6 }), (y, m) => {
        const grid = monthGrid(calendar, y, m)
        const inMonth = days(grid).filter((cell) => cell.inMonth)
        expect(inMonth).toHaveLength(calendar.months[m - 1]!.days)
        grid.forEach((week) => {
          expect(week).toHaveLength(6)
          week.forEach((cell, i) => expect(weekdayOf(calendar, cell.year, cell.month, cell.day)).toBe(i))
        })
      })
    )
  })
})

describe('dateKeys', () => {
  it('writes the keys of the precision and removes the others', () => {
    expect(dateKeys({ year: 1312, month: 4, day: 28 }, '')).toEqual({
      write: { year: 1312, month: 4, day: 28 },
      remove: ['era']
    })
    expect(dateKeys({ year: 1312, month: 4 }, '')).toEqual({
      write: { year: 1312, month: 4 },
      remove: ['era', 'day']
    })
    expect(dateKeys({ year: -600 }, '')).toEqual({
      write: { year: -600 },
      remove: ['era', 'month', 'day']
    })
    expect(dateKeys({ era: 'Age of Lanterns' }, '')).toEqual({
      write: { era: 'Age of Lanterns' },
      remove: ['year', 'month', 'day']
    })
  })

  it('round-trips through readDate', () => {
    fc.assert(
      fc.property(dateArb, fc.constantFrom('', 'end-'), (date, prefix) => {
        const { write } = dateKeys(date, prefix)
        expect(readDate(write, prefix)).toEqual({ value: date, issues: [] })
      })
    )
  })

  it('prefixes every key', () => {
    expect(dateKeys({ year: 3, month: 1 }, 'end-')).toEqual({
      write: { 'end-year': 3, 'end-month': 1 },
      remove: ['end-era', 'end-day']
    })
  })
})
