import { expect, test } from 'vitest'
import { weekBars } from '../../src/calendar/bars'

const span = (name: string, from: number, to: number) => ({ name, from, to })
const shape = (bars: ReturnType<typeof weekBars<ReturnType<typeof span>>>) => bars.map((bar) => [bar.item.name, bar.first, bar.last, bar.lane, bar.before, bar.after])

test('spans outside the week make no bar', () => {
  expect(weekBars([span('a', 0, 5), span('b', 14, 15)], 6, 6)).toEqual([])
})

test('a span inside the week covers its columns', () => {
  expect(shape(weekBars([span('a', 8, 9)], 6, 6))).toEqual([['a', 2, 3, 0, false, false]])
})

test('a span across the week break is cut at both edges and marked as continued', () => {
  const bar = span('a', 4, 14)
  expect(shape(weekBars([bar], 6, 6))).toEqual([['a', 0, 5, 0, true, true]])
  expect(shape(weekBars([bar], 0, 6))).toEqual([['a', 4, 5, 0, false, true]])
  expect(shape(weekBars([bar], 12, 6))).toEqual([['a', 0, 2, 0, true, false]])
})

test('an open-ended span runs to the week edge', () => {
  expect(shape(weekBars([span('a', -Infinity, Infinity)], 6, 6))).toEqual([['a', 0, 5, 0, true, true]])
})

test('overlapping spans take lanes, the longer first at the same start, and a lane is reused once free', () => {
  const bars = weekBars([span('short', 6, 6), span('long', 6, 8), span('late', 8, 8), span('after', 9, 9)], 6, 6)
  expect(shape(bars)).toEqual([
    ['long', 0, 2, 0, false, false],
    ['short', 0, 0, 1, false, false],
    ['late', 2, 2, 1, false, false],
    ['after', 3, 3, 0, false, false]
  ])
})
