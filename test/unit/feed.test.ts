import { expect, test } from 'vitest'
import type { TFile } from 'obsidian'
import type { CalendarEntry } from '../../src/calendar/entries'
import { buildFeed, type FeedRow } from '../../src/calendar/feed'
import type { CalendarDate } from '../../src/shared/calendars/dates'
import { parseCalendar } from '../../src/shared/calendars/schema'

const calendar = parseCalendar({
  months: [
    { name: 'Thawmoon', days: 30 },
    { name: 'Seedtide', days: 28 },
    { name: 'Highsun', days: 30 }
  ],
  weekdays: ['Moonday', 'Tideday'],
  'first-weekday': 'Moonday',
  eras: [
    { name: 'The Drowned Age', short: 'BL', side: 'before' },
    { name: 'Age of Lanterns', short: 'AL', side: 'after' }
  ]
}).value!

const entry = (title: string, start: CalendarDate | undefined, end?: CalendarDate): CalendarEntry => ({
  file: { path: `${title}.md`, basename: title } as TFile,
  title,
  renderer: 'lore',
  start,
  end,
  issues: start ? [] : ['year: bad'],
  banner: undefined
})
const names = (rows: FeedRow[]): string[] =>
  rows.map((row) => (row.kind === 'entry' ? row.item.entry.title : row.kind === 'era' ? `era:${row.era.short}` : row.kind === 'gap' ? `gap:${row.years}` : `year:${row.year}`))

test('coarse dates come before finer ones at equal prefixes, an era-only entry at its era start', () => {
  const entries = [entry('day', { year: 5, month: 2, day: 1 }), entry('month', { year: 5, month: 2 }), entry('year', { year: 5 }), entry('era', { era: 'Age of Lanterns' })]
  expect(names(buildFeed(calendar, entries, 'oldest').rows).filter((n) => !n.includes(':'))).toEqual(['era', 'year', 'month', 'day'])
  expect(names(buildFeed(calendar, entries, 'newest').rows).filter((n) => !n.includes(':'))).toEqual(['day', 'month', 'year', 'era'])
})

test('era headers open each run; gaps measure whole years between ranges; short gaps are left out', () => {
  const entries = [entry('a', { year: -340 }), entry('b', { era: 'Age of Lanterns' }), entry('c', { year: 1104 }), entry('d', { year: 1105, month: 1, day: 1 })]
  expect(names(buildFeed(calendar, entries, 'oldest').rows)).toEqual(['era:BL', 'a', 'gap:339', 'era:AL', 'b', 'gap:1102', 'c', 'd'])
  expect(names(buildFeed(calendar, entries, 'newest').rows)).toEqual(['era:AL', 'd', 'c', 'gap:1102', 'b', 'gap:339', 'era:BL', 'a'])
})

test('a year marker opens a run of entries sharing a year; an end counts toward the gap', () => {
  const entries = [entry('a', { year: 10, month: 1, day: 1 }, { year: 14, month: 1, day: 1 }), entry('b', { year: 10, month: 2 }), entry('c', { year: 20 })]
  const { rows } = buildFeed(calendar, entries, 'oldest')
  expect(names(rows)).toEqual(['era:AL', 'year:10', 'a', 'b', 'gap:5', 'c'])
})

test('entries without a valid start are problems, not rows', () => {
  const feed = buildFeed(calendar, [entry('bad', undefined)], 'oldest')
  expect(feed.rows).toEqual([])
  expect(feed.problems.map((e) => e.title)).toEqual(['bad'])
})
