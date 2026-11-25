import { describe, expect, it } from 'vitest'
import { parseCalendar } from '../../../src/shared/calendars/schema'
import { readDate } from '../../../src/shared/calendars/dates'
import { tidereckoning } from './tidereckoning'

const parse = (patch: Record<string, unknown>) => parseCalendar({ ...tidereckoning, ...patch })
const paths = (patch: Record<string, unknown>) => parse(patch).issues.map((issue) => issue.path)

describe('parseCalendar', () => {
  it('keeps a valid calendar', () => {
    const { value, issues } = parseCalendar(tidereckoning)
    expect(issues).toEqual([])
    expect(value?.months).toHaveLength(6)
    expect(value?.eras).toHaveLength(4)
  })

  it('needs months, each with a name and at least 1 day', () => {
    expect(paths({ months: [] })).toEqual(['months'])
    expect(paths({ months: [{ name: 'A', days: 0 }] })).toEqual(['months.0.days'])
    expect(paths({ months: [{ days: 3 }] })).toEqual(['months.0.name'])
    expect(paths({ months: undefined })).toEqual(['months'])
  })

  it('needs weekdays', () => {
    expect(parse({ weekdays: [] }).issues).toEqual([
      { path: 'weekdays', message: 'A calendar needs at least 1 weekday' },
      { path: 'first-weekday', message: 'Not one of the weekdays' }
    ])
  })

  it('needs first-weekday to be one of the weekdays', () => {
    expect(paths({ 'first-weekday': 'Sunday' })).toEqual(['first-weekday'])
    expect(paths({ 'first-weekday': undefined })).toEqual(['first-weekday'])
  })

  it('allows no eras', () => {
    expect(parse({ eras: undefined }).value?.eras).toEqual([])
  })

  it('needs each era to name itself, its side and its short label', () => {
    expect(paths({ eras: [{ name: 'A', side: 'after' }] })).toEqual(['eras.0.short'])
    expect(paths({ eras: [{ name: 'A', short: 'A', side: 'sideways' }] })).toEqual(['eras.0.side'])
  })

  it('puts before eras first', () => {
    const eras = [
      { name: 'A', short: 'A', side: 'after' },
      { name: 'B', short: 'B', side: 'before' }
    ]
    expect(paths({ eras })).toEqual(['eras.1.side'])
  })

  it('gives the first era on each side no start and the others one', () => {
    expect(paths({ eras: [{ name: 'A', short: 'A', side: 'after', start: 5 }] })).toEqual(['eras.0.start'])
    expect(paths({ eras: [{ name: 'A', short: 'A', side: 'before', start: 5 }] })).toEqual(['eras.0.start'])
    const eras = [
      { name: 'A', short: 'A', side: 'after' },
      { name: 'B', short: 'B', side: 'after' }
    ]
    expect(paths({ eras })).toEqual(['eras.1.start'])
  })

  it('needs starts to increase in time on each side', () => {
    const after = (starts: number[]) => [
      { name: 'A', short: 'A', side: 'after' },
      ...starts.map((start, i) => ({
        name: `B${i}`,
        short: 'B',
        side: 'after',
        start
      }))
    ]
    const before = (starts: number[]) => [
      { name: 'A', short: 'A', side: 'before' },
      ...starts.map((start, i) => ({
        name: `B${i}`,
        short: 'B',
        side: 'before',
        start
      }))
    ]
    expect(paths({ eras: after([10, 20]) })).toEqual([])
    expect(paths({ eras: after([20, 10]) })).toEqual(['eras.2.start'])
    expect(paths({ eras: after([1]) })).toEqual(['eras.1.start'])
    expect(paths({ eras: before([600, 300]) })).toEqual([])
    expect(paths({ eras: before([300, 600]) })).toEqual(['eras.2.start'])
    expect(paths({ eras: before([300, 300]) })).toEqual(['eras.2.start'])
  })
})

describe('parseCalendar uniqueness and starts', () => {
  it('needs unique weekdays', () => {
    expect(parse({ weekdays: ['A', 'B', 'A'], 'first-weekday': 'A' }).issues).toEqual([{ path: 'weekdays.2', message: 'Weekday names must be unique' }])
  })

  it('needs unique era names', () => {
    const eras = [
      { name: 'A', short: 'A', side: 'before' },
      { name: 'A', short: 'B', side: 'after' }
    ]
    expect(parse({ eras }).issues).toEqual([{ path: 'eras.1.name', message: 'Era names must be unique' }])
  })

  it('gives a start below 1 one issue', () => {
    const eras = (start: number) => [
      { name: 'A', short: 'A', side: 'after' },
      { name: 'B', short: 'B', side: 'after', start }
    ]
    expect(parse({ eras: eras(0) }).issues).toEqual([{ path: 'eras.1.start', message: 'Starts count from 1' }])
    expect(parse({ eras: eras(-5) }).issues).toEqual([{ path: 'eras.1.start', message: 'Starts count from 1' }])
  })
})

describe('readDate', () => {
  it('reads each precision', () => {
    expect(readDate({ year: 1312, month: 4, day: 28 }, '')).toEqual({
      value: { year: 1312, month: 4, day: 28 },
      issues: []
    })
    expect(readDate({ year: 1312, month: 4 }, '')).toEqual({
      value: { year: 1312, month: 4 },
      issues: []
    })
    expect(readDate({ year: -600 }, '')).toEqual({
      value: { year: -600 },
      issues: []
    })
    expect(readDate({ era: 'Age of Lanterns' }, '')).toEqual({
      value: { era: 'Age of Lanterns' },
      issues: []
    })
  })

  it('reads the keys under a prefix only', () => {
    const fm = { year: 1, 'end-year': 2, 'end-month': 3 }
    expect(readDate(fm, 'end-')).toEqual({
      value: { year: 2, month: 3 },
      issues: []
    })
    expect(readDate(fm, '')).toEqual({ value: { year: 1 }, issues: [] })
  })

  it('is empty without date keys', () => {
    expect(readDate({ title: 'x' }, '')).toEqual({
      value: undefined,
      issues: []
    })
    expect(readDate({ year: null }, '')).toEqual({
      value: undefined,
      issues: []
    })
  })

  it('rejects year 0 and non-integers', () => {
    expect(readDate({ year: 0 }, '').issues.map((i) => i.path)).toEqual(['year'])
    const rejected = (year: unknown) => readDate({ year }, '')
    expect(rejected(1.5).value).toBeUndefined()
    expect(rejected(1.5).issues.map((i) => i.path)).toEqual(['year'])
    expect(rejected('1312').value).toBeUndefined()
    expect(rejected('1312').issues.map((i) => i.path)).toEqual(['year'])
    expect(rejected(0).issues).toEqual([{ path: 'year', message: 'There is no year 0' }])
    expect(readDate({ year: 1, month: 0 }, '').issues.map((i) => i.path)).toEqual(['month'])
    expect(readDate({ year: 1, month: 1, day: 0 }, '').issues.map((i) => i.path)).toEqual(['day'])
  })

  it('rejects finer keys without coarser ones', () => {
    expect(readDate({ month: 4 }, '').issues).toEqual([{ path: 'month', message: 'Month needs a year' }])
    expect(readDate({ year: 1, day: 4 }, '').issues).toEqual([{ path: 'day', message: 'Day needs a month' }])
    expect(readDate({ 'end-day': 4 }, 'end-').issues.map((i) => i.path)).toEqual(['end-day'])
  })

  it('takes era alone', () => {
    expect(readDate({ era: 'A', year: 1 }, '').issues).toEqual([{ path: 'era', message: 'Era is for a date with no year' }])
    expect(readDate({ era: '' }, '').value).toBeUndefined()
  })
})
