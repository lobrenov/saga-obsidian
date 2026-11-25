import { useLayoutEffect, useReducer } from 'react'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import '../../src/calendar/calendar.css'
import { CalendarRoot } from '../../src/calendar/CalendarRoot'
import { CalendarFake, lore } from '../fakes/calendar'
import '../../src/styles.css'
import './mapVars.css'

function Live({ fake }: { fake: CalendarFake }) {
  const [, update] = useReducer((n: number) => n + 1, 0)
  useLayoutEffect(() => fake.subscribe(update), [fake])
  return <CalendarRoot state={fake.state()} />
}

/** The Timeline display of a fake vault: 88-day years of Thawmoon 30, Seedtide 28 and Highsun 30; `setup` adds notes. */
async function renderTimeline(options: Record<string, unknown>, setup: (fake: CalendarFake) => void, width = 1100) {
  const fake = await CalendarFake.create()
  Object.assign(fake.options, { display: 'timeline' }, options)
  setup(fake)
  const screen = await render(
    <div className="saga-calview-view" style={{ width, height: 800 }}>
      <Live fake={fake} />
    </div>
  )
  return { fake, screen }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const press = async (name: string, times = 1) => {
  for (let i = 0; i < times; i++) {
    document.querySelector<HTMLElement>(`[aria-label="${name}"]`)!.click()
    await settle()
  }
}
const scaleButton = (name: string): HTMLElement => [...document.querySelectorAll<HTMLElement>('[aria-label="Scale"] button')].find((el) => el.textContent === name)!
const title = (): string => document.querySelector('.saga-calview-title')?.textContent ?? ''
const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.saga-timeline-row')]
const row = (name: string): HTMLElement => rows().find((el) => el.querySelector('.saga-timeline-label-text')?.textContent === name)!
const markOf = (name: string): HTMLElement => row(name).querySelector<HTMLElement>('.saga-timeline-mark')!
const prop = (el: HTMLElement, name: string): number => parseFloat(el.style.getPropertyValue(name))
const near = (value: number, expected: number): void => expect(value).toBeCloseTo(expected, 0)
const windowLeft = (): number => prop(document.querySelector<HTMLElement>('.saga-timeline-window')!, '--saga-timeline-left')

const dated = (fake: CalendarFake): void => {
  fake.addNote('Lore/Whole year.md', lore('year: 1312'))
  fake.addNote('Lore/Month.md', lore('year: 1312\nmonth: 2'))
  fake.addNote('Lore/Day.md', lore('year: 1312\nmonth: 3\nday: 1'))
  fake.addNote('Lore/Bar.md', lore('year: 1312\nmonth: 1\nday: 11\nend-year: 1312\nend-month: 2\nend-day: 10'))
  fake.addNote('Lore/Runs on.md', lore('year: 1312\nmonth: 3\nday: 20\nend-year: 1313\nend-month: 1\nend-day: 5'))
  fake.addNote('Lore/Came before.md', lore('year: 1311\nmonth: 3\nday: 20\nend-year: 1312\nend-month: 1\nend-day: 5'))
  fake.addNote('Lore/Another year.md', lore('year: 1320\nmonth: 1\nday: 1'))
  fake.addNote('Lore/Age.md', lore('era: Age of Lanterns'))
  fake.addNote('Lore/Broken.md', lore('year: 1312\nmonth: 9'))
}

test('rows follow the base order and only entries in the range are drawn; a date problem is a chip', async () => {
  await renderTimeline({ scale: 'year' }, dated)
  expect(title()).toBe('1311 AL')
  await press('Next year')
  expect(title()).toBe('1312 AL')
  expect(rows().map((el) => el.querySelector('.saga-timeline-label-text')?.textContent)).toEqual(['Whole year', 'Month', 'Day', 'Bar', 'Runs on', 'Came before', 'Age'])
  expect([...document.querySelectorAll('.saga-calview-chip')].map((el) => el.textContent)).toEqual(['Broken'])
})

test('months are as wide as their days, and entries sit at their day', async () => {
  await renderTimeline({ scale: 'year' }, dated)
  await press('Next year')
  expect([...document.querySelectorAll<HTMLElement>('.saga-timeline-column-label')].map((el) => [el.textContent, el.style.getPropertyValue('--saga-timeline-weight')])).toEqual([
    ['Thawmoon', '30'],
    ['Seedtide', '28'],
    ['Highsun', '30']
  ])
  const day = markOf('Day')
  expect(day.dataset['kind']).toBe('point')
  near(prop(day, '--saga-timeline-left'), ((58 + 0.5) / 88) * 100)
  const bar = markOf('Bar')
  expect(bar.dataset['kind']).toBe('bar')
  near(prop(bar, '--saga-timeline-left'), (10 / 88) * 100)
  near(prop(bar, '--saga-timeline-width'), (30 / 88) * 100)
})

test('a bar that starts before or ends after the range is open on that side', async () => {
  await renderTimeline({ scale: 'year' }, dated)
  await press('Next year')
  expect(markOf('Bar').hasAttribute('data-open-start') || markOf('Bar').hasAttribute('data-open-end')).toBe(false)
  const before = markOf('Came before')
  expect(before.hasAttribute('data-open-start')).toBe(true)
  expect(before.hasAttribute('data-open-end')).toBe(false)
  near(prop(before, '--saga-timeline-left'), 0)
  const after = markOf('Runs on')
  expect(after.hasAttribute('data-open-end')).toBe(true)
  expect(after.hasAttribute('data-open-start')).toBe(false)
  near(prop(after, '--saga-timeline-left') + prop(after, '--saga-timeline-width'), 100)
})

test('months, years and eras are hatched over their whole length', async () => {
  await renderTimeline({ scale: 'year' }, dated)
  await press('Next year')
  const month = markOf('Month')
  expect(month.dataset['kind']).toBe('span')
  near(prop(month, '--saga-timeline-left'), (30 / 88) * 100)
  near(prop(month, '--saga-timeline-width'), (28 / 88) * 100)
  const year = markOf('Whole year')
  expect(year.dataset['kind']).toBe('span')
  near(prop(year, '--saga-timeline-width'), 100)
  const era = markOf('Age')
  expect(era.dataset['kind']).toBe('span')
  expect(era.hasAttribute('data-open-end')).toBe(true)
})

test('years are the columns at Decade and Century, and eras at All', async () => {
  await renderTimeline({ scale: 'decade' }, dated)
  const labels = (): string[] => [...document.querySelectorAll('.saga-timeline-column-label')].map((el) => el.textContent ?? '')
  expect(title()).toBe('1311–1320 AL')
  expect(labels()).toEqual(['1311', '1312', '1313', '1314', '1315', '1316', '1317', '1318', '1319', '1320'])
  near(prop(markOf('Another year'), '--saga-timeline-left'), 90)
  scaleButton('Century').click()
  await settle()
  expect(title()).toBe('1301–1400 AL')
  expect(labels().filter(Boolean)).toHaveLength(10)
  expect(document.querySelectorAll('.saga-timeline-column-label')).toHaveLength(100)
  scaleButton('All').click()
  await settle()
  expect(title()).toBe('All eras')
  expect(labels()).toEqual(['The Drowned Age · BL', 'Age of Lanterns · AL'])
  expect(document.querySelector('[aria-label="Next all"]')).toBeNull()
  expect(document.querySelector('.saga-timeline-window')).toBeNull()
  near(prop(markOf('Age'), '--saga-timeline-left'), (300 / 1620) * 100)
  near(prop(markOf('Age'), '--saga-timeline-width'), (1320 / 1620) * 100)
})

test('the overview window follows navigation and marks the visible range', async () => {
  await renderTimeline({ scale: 'decade' }, dated)
  const strip = document.querySelector('.saga-timeline-overview')!
  expect(strip.getAttribute('aria-label')).toBe('Showing 1311–1320 AL of The Drowned Age, Age of Lanterns')
  expect(strip.querySelectorAll('.saga-timeline-tick').length).toBeGreaterThan(0)
  const first = windowLeft()
  await press('Next decade')
  expect(title()).toBe('1321–1330 AL')
  expect(windowLeft()).toBeGreaterThan(first)
  await press('Previous decade', 2)
  expect(title()).toBe('1301–1310 AL')
  expect(windowLeft()).toBeLessThan(first)
})

test('navigation crosses from year -1 to year 1', async () => {
  await renderTimeline({ scale: 'year' }, (fake) => {
    fake.addNote('Lore/Last of BL.md', lore('year: -1\nmonth: 3\nday: 30'))
    fake.addNote('Lore/First of AL.md', lore('year: 1\nmonth: 1\nday: 1'))
  })
  expect(title()).toBe('1 BL')
  expect(rows().map((el) => el.textContent)).toEqual([expect.stringContaining('Last of BL')])
  await press('Next year')
  expect(title()).toBe('1 AL')
  expect(rows().map((el) => el.textContent)).toEqual([expect.stringContaining('First of AL')])
  await press('Previous year')
  expect(title()).toBe('1 BL')
  scaleButton('Decade').click()
  await settle()
  expect(title()).toBe('10–1 BL')
  await press('Next decade')
  expect(title()).toBe('1–10 AL')
})

test('the Scale control shows its choice at once and writes the option; a later option wins', async () => {
  const { fake } = await renderTimeline({ scale: 'year' }, dated)
  expect(scaleButton('Year').getAttribute('aria-pressed')).toBe('true')
  scaleButton('Decade').click()
  await settle()
  expect(fake.written).toEqual([['scale', 'decade']])
  expect(scaleButton('Decade').getAttribute('aria-pressed')).toBe('true')
  expect(scaleButton('Year').getAttribute('aria-pressed')).toBe('false')
  fake.set('scale', 'century')
  await settle()
  expect(scaleButton('Century').getAttribute('aria-pressed')).toBe('true')
  expect(scaleButton('Decade').getAttribute('aria-pressed')).toBe('false')
})

test('a row label opens the entry card', async () => {
  await renderTimeline({ scale: 'year' }, (fake) => fake.addNote('Lore/Day.md', lore('year: 1\nmonth: 3\nday: 1', 'Text.\n')))
  const label = document.querySelector<HTMLElement>('.saga-timeline-label')!
  label.click()
  await settle()
  expect(document.querySelector('.saga-calview-card-title')?.textContent).toBe('Day')
  expect(label.getAttribute('aria-expanded')).toBe('true')
})

const box = (el: Element): DOMRect => el.getBoundingClientRect()

test('the header labels sit over the grid columns, after a label column of the same width', async () => {
  await renderTimeline({ scale: 'decade' }, dated)
  const labels = [...document.querySelectorAll('.saga-timeline-column-label')]
  const grid = [...document.querySelectorAll('.saga-timeline-column')]
  expect(labels).toHaveLength(grid.length)
  labels.forEach((label, i) => {
    expect(box(label).left).toBeCloseTo(box(grid[i]!).left, 0)
    expect(box(label).width).toBeCloseTo(box(grid[i]!).width, 0)
  })
  expect(box(document.querySelector('.saga-timeline-corner')!).width).toBe(240)
  expect(box(document.querySelector('.saga-timeline-label')!).width).toBe(240)
  expect(box(labels[0]!).left).toBeCloseTo(box(document.querySelector('.saga-timeline-track')!).left, 0)
})

test('at Century a mark sits at its year among the hundred', async () => {
  await renderTimeline({ scale: 'century' }, (fake) => {
    fake.addNote('Lore/Year.md', lore('year: 1312'))
    fake.addNote('Lore/Midway.md', lore('year: 1351\nmonth: 1\nday: 1'))
    fake.addNote('Lore/Span.md', lore('year: 1320\nend-year: 1329'))
  })
  near(prop(markOf('Year'), '--saga-timeline-left'), 11)
  near(prop(markOf('Year'), '--saga-timeline-width'), 1)
  near(prop(markOf('Midway'), '--saga-timeline-left'), 50.5)
  near(prop(markOf('Span'), '--saga-timeline-left'), 19)
  near(prop(markOf('Span'), '--saga-timeline-width'), 10)
})

test('a date text flips left of its mark only with room there, and sits inside a wide mark', async () => {
  await renderTimeline({ scale: 'decade' }, (fake) => {
    fake.addNote('Lore/Early.md', lore('year: 1311\nmonth: 1\nday: 1'))
    fake.addNote('Lore/Late.md', lore('year: 1320\nmonth: 1\nday: 1'))
    fake.addNote('Lore/Late bar.md', lore('year: 1311\nend-year: 1319'))
    fake.addNote('Lore/Early span.md', lore('year: 1311\nend-year: 1312'))
  })
  const when = (name: string): HTMLElement => row(name).querySelector<HTMLElement>('.saga-timeline-when')!
  expect(when('Early').hasAttribute('data-flip')).toBe(false)
  expect(when('Late').hasAttribute('data-flip')).toBe(true)
  expect(when('Late bar').hasAttribute('data-inside')).toBe(true)
  expect(when('Early span').hasAttribute('data-flip')).toBe(false)
})

test('Page keys step the window but are left alone at All', async () => {
  await renderTimeline({ scale: 'decade' }, dated)
  const key = (name: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })
    document.querySelector('.saga-timeline-label')!.dispatchEvent(event)
    return event
  }
  expect(key('PageDown').defaultPrevented).toBe(true)
  await settle()
  expect(title()).toBe('1321–1330 AL')
  scaleButton('All').click()
  await settle()
  expect(key('PageDown').defaultPrevented).toBe(false)
})

test('a row opens its card from the mark or date as well, and only the label takes focus', async () => {
  await renderTimeline({ scale: 'decade' }, dated)
  const track = row('Another year').querySelector<HTMLElement>('.saga-timeline-track')!
  track.click()
  await settle()
  expect(document.querySelector('.saga-calview-card')).not.toBeNull()
  expect(row('Another year').querySelector('.saga-timeline-label')!.getAttribute('aria-expanded')).toBe('true')
  expect(track.querySelector('[tabindex], button, a')).toBeNull()
})

test('open marks say they continue, the head is hidden from assistive technology and the list is named', async () => {
  await renderTimeline({ scale: 'year' }, dated)
  expect(row('Came before').querySelector('.saga-timeline-when')?.textContent).toContain('continues after')
  await press('Next year')
  expect(row('Came before').querySelector('.saga-timeline-when')?.textContent).toContain('continues before')
  expect(document.querySelector('.saga-timeline-head')?.getAttribute('aria-hidden')).toBe('true')
  expect(document.querySelector('ol[aria-label="Timeline"]')).not.toBeNull()
  expect(document.querySelector('.saga-timeline-scroll')?.getAttribute('aria-label')).toBe('Timeline chart')
  expect(document.querySelector('.saga-timeline-era[title]')).toBeNull()
})

test('the legend and rows are absent and the empty state names the calendar when nothing is dated', async () => {
  await renderTimeline({ scale: 'year' }, () => undefined)
  expect(document.querySelector('.saga-timeline-empty')?.textContent).toBe('No dated notes on The Tidereckoning.')
  expect(document.querySelector('.saga-timeline-legend')).toBeNull()
})

test('a window with nothing in it says so', async () => {
  await renderTimeline({ scale: 'year' }, (fake) => {
    fake.addNote('Lore/Near.md', lore('year: 1311'))
    fake.addNote('Lore/Far.md', lore('year: 1400'))
  })
  await press('Next year')
  expect(document.querySelector('.saga-timeline-empty')?.textContent).toBe('Nothing is dated in 1312 AL.')
})

test('a date problem is a chip that opens its card', async () => {
  await renderTimeline({ scale: 'decade' }, dated)
  document.querySelector<HTMLElement>('.saga-calview-chip')!.click()
  await settle()
  expect(document.querySelector('.saga-calview-card-issues')).not.toBeNull()
})
