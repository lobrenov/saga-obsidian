import { useLayoutEffect, useReducer } from 'react'
import { expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import '../../src/calendar/calendar.css'
import { CalendarRoot } from '../../src/calendar/CalendarRoot'
import { calendarOptions } from '../../src/calendar/options'
import type { App, BasesViewConfig } from 'obsidian'
import type { ConfigStore } from '../../src/obsidian/vault'
import { CONFIG_PATH } from '../../src/obsidian/vault'
import { CAL, CONFIG_YAML, CalendarFake, OTHER_CAL, lore } from '../fakes/calendar'
import '../../src/styles.css'
import './mapVars.css'

function Live({ fake }: { fake: CalendarFake }) {
  const [, update] = useReducer((n: number) => n + 1, 0)
  useLayoutEffect(() => fake.subscribe(update), [fake])
  return <CalendarRoot state={fake.state()} />
}

const fixture = (fake: CalendarFake): void => {
  fake.addNote('Lore/Chain toll raised.md', lore('year: 1\nmonth: 3\nday: 3', 'The harbour chain costs more.\n'))
  fake.addNote('Lore/Festival of Lamps.md', lore('year: 1\nmonth: 3\nday: 2\nend-year: 1\nend-month: 3\nend-day: 4'))
  fake.addNote('Lore/Herring run fails.md', lore('year: 1\nmonth: 3'))
  fake.addNote('Lore/Elsewhere event.md', lore('year: 1\nmonth: 3\nday: 10', '', 'Elsewhere'))
  fake.addNote('Lore/Outside.md', lore('year: 1\nmonth: 3\nday: 12'), false)
}

/** The view over a fake vault holding `fixture` and what `setup` adds; `width` is the pane's. */
async function renderCalendar(setup?: (fake: CalendarFake) => void, width = 1100) {
  const fake = await CalendarFake.create()
  fixture(fake)
  setup?.(fake)
  const screen = await render(
    <div className="saga-calview-view" style={{ width, height: 800 }}>
      <Live fake={fake} />
    </div>
  )
  return { fake, screen }
}

const title = (): string => document.querySelector('.saga-calview-title')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const dayName = (el: Element): string => el.querySelector('.saga-calview-sr')?.textContent ?? ''
const cell = (name: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('.saga-calview-day')].find((el) => dayName(el) === name)
  if (!found) throw new Error(`no cell ${name}`)
  return found
}
const cells = (row: number): string[] => [...document.querySelectorAll('.saga-calview-grid .saga-calview-week')[row + 1]!.querySelectorAll('.saga-calview-day')].map(dayName)
const bars = (el: ParentNode = document): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.saga-calview-bar:not([data-spacer])')]
const chips = (): string[] => [...document.querySelectorAll('.saga-calview-chip')].map((el) => el.textContent ?? '')
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const press = async (name: string, times = 1) => {
  for (let i = 0; i < times; i++) {
    document.querySelector<HTMLElement>(`[aria-label="${name}"]`)!.click()
    await settle()
  }
}
const next = (times = 1) => press('Next month', times)
const prev = (times = 1) => press('Previous month', times)

test('options hide by display', () => {
  const visible = (display: string | undefined): string[] => {
    const view = { get: (key: string) => (key === 'display' ? display : undefined) } as unknown as BasesViewConfig
    return calendarOptions({} as App, {} as ConfigStore, view)
      .filter((option) => !option.shouldHide?.())
      .map((option) => ('key' in option ? option.key : ''))
  }
  expect(visible('calendar')).toEqual(['calendar', 'display', 'opens'])
  expect(visible(undefined)).toEqual(['calendar', 'display', 'opens'])
  expect(visible('feed')).toEqual(['calendar', 'display', 'feed-order', 'banners'])
  expect(visible('timeline')).toEqual(['calendar', 'display', 'scale'])
})

test('no option uses a key Bases keeps for its own view settings', () => {
  const view = { get: () => undefined } as unknown as BasesViewConfig
  const keys = calendarOptions({} as App, {} as ConfigStore, view).map((option) => ('key' in option ? option.key : ''))
  for (const own of ['type', 'name', 'filters', 'order', 'sort', 'limit', 'groupBy', 'summaries']) expect(keys).not.toContain(own)
})

test('the calendar option accepts calendar notes only', async () => {
  const fake = await CalendarFake.create()
  fixture(fake)
  const option = calendarOptions(fake.app, fake.settings, { get: () => undefined } as unknown as BasesViewConfig)[0]
  const filter = option?.type === 'file' ? option.filter : undefined
  expect([CAL, 'Lore/Chain toll raised.md'].map((path) => filter?.(fake.file(path)))).toEqual([true, false])
})

test('entries are the base notes whose calendar link resolves to the chosen note, with their dates', async () => {
  const fake = await CalendarFake.create()
  fixture(fake)
  fake.addNote('Lore/Dateless.md', lore(''))
  fake.addNote('Lore/No calendar.md', '---\ntype: event\nyear: 1\n---\n')
  const state = fake.state()
  if (state.kind !== 'calendar') throw new Error('not a calendar')
  expect(state.entries.map((entry) => [entry.title, entry.renderer, entry.start, entry.end, entry.issues])).toEqual([
    ['Chain toll raised', 'lore', { year: 1, month: 3, day: 3 }, undefined, []],
    ['Festival of Lamps', 'lore', { year: 1, month: 3, day: 2 }, { year: 1, month: 3, day: 4 }, []],
    ['Herring run fails', 'lore', { year: 1, month: 3 }, undefined, []]
  ])
  fake.options['calendar'] = OTHER_CAL
  const other = fake.state()
  expect(other.kind === 'calendar' && other.entries.map((entry) => entry.title)).toEqual(['Elsewhere event'])
})

test('a renamed calendar key of the Lore renderer is followed', async () => {
  const fake = await CalendarFake.create()
  fake.fake.setRaw(CONFIG_PATH, CONFIG_YAML.replace('    types: [lore, event]\n', '    types: [lore, event]\n    keys: { calendar: world }\n'))
  await fake.settings.reload()
  fake.addNote('Lore/Renamed.md', '---\ntype: lore\nworld: "[[The Tidereckoning]]"\nyear: 1\n---\n')
  fake.addNote('Lore/Old key.md', lore('year: 1'))
  const state = fake.state()
  expect(state.kind === 'calendar' && state.entries.map((entry) => entry.title)).toEqual(['Renamed'])
})

test('a bad date keeps the entry with its issues and no start; an end that is bad or before the start is dropped', async () => {
  const fake = await CalendarFake.create()
  fake.addNote('Lore/Month 9.md', lore('year: 1\nmonth: 9'))
  fake.addNote('Lore/Day 31.md', lore('year: 1\nmonth: 2\nday: 31'))
  fake.addNote('Lore/Backwards.md', lore('year: 1\nmonth: 3\nday: 5\nend-year: 1\nend-month: 3\nend-day: 2'))
  fake.addNote('Lore/Bad end.md', lore('year: 1\nmonth: 3\nday: 5\nend-year: 1\nend-month: 8'))
  fake.addNote('Lore/Month only.md', lore('month: 3'))
  const state = fake.state()
  if (state.kind !== 'calendar') throw new Error('not a calendar')
  expect(state.entries.map((entry) => [entry.title, entry.start, entry.end, entry.issues])).toEqual([
    ['Month 9', undefined, undefined, ["month: Month 9 is beyond the calendar's 3 months"]],
    ['Day 31', undefined, undefined, ['day: Day 31 is beyond the 28 days of Seedtide']],
    ['Backwards', { year: 1, month: 3, day: 5 }, undefined, ['end: Ends before it starts']],
    ['Bad end', { year: 1, month: 3, day: 5 }, undefined, ["end-month: Month 8 is beyond the calendar's 3 months"]],
    ['Month only', undefined, undefined, ['month: Month needs a year']]
  ])
})

test('without a calendar, with a missing or non-calendar note, or with an invalid calendar the view says why', async () => {
  const fake = await CalendarFake.create()
  fixture(fake)
  fake.addNote('Worlds/Broken.md', '---\ntype: calendar\nmonths: []\nweekdays: [A]\nfirst-weekday: B\n---\n')
  fake.addNote('Worlds/Empty.md', '---\ntype: calendar\n---\n')
  const message = (options: Record<string, unknown>): string => {
    Object.keys(fake.options).forEach((key) => delete fake.options[key])
    Object.assign(fake.options, options)
    const state = fake.state()
    return state.kind === 'empty' ? [state.message, ...state.issues].join(' | ') : 'calendar'
  }
  expect(message({})).toBe('Choose a calendar note in the view options.')
  expect(message({ calendar: 'Worlds/Nope.md' })).toBe('Worlds/Nope.md is not in the vault.')
  expect(message({ calendar: 'Lore/Chain toll raised.md' })).toBe('Chain toll raised is not a calendar note.')
  expect(message({ calendar: 'Worlds/Broken.md' })).toContain('Broken is not a valid calendar. | ')
  expect(message({ calendar: 'Worlds/Empty.md' })).toBe('Empty is not a valid calendar. | months: Not set | weekdays: Not set | first-weekday: Not set')
  expect(message({ calendar: 'The Tidereckoning' })).toBe('calendar')

  fake.options['calendar'] = 'Worlds/Broken.md'
  const screen = await render(<CalendarRoot state={fake.state()} />)
  await expect.element(screen.getByText('Broken is not a valid calendar.')).toBeVisible()
  expect(screen.getByRole('list', { name: 'Problems with the calendar' }).element().querySelectorAll('li').length).toBeGreaterThan(0)
})

test('the month opens on the earliest dated entry; weeks run on the calendar weekdays with neighbouring days dimmed', async () => {
  await renderCalendar()
  expect(title()).toBe('Highsun 1 AL')
  expect([...document.querySelectorAll('.saga-calview-weekday-full')].map((el) => el.textContent)).toEqual(['Moonday', 'Tideday', 'Netday', 'Saltday', 'Lampday', 'Restday'])
  expect(document.querySelector('.saga-calview-grid')?.getAttribute('aria-label')).toBe('Highsun 1 AL')
  expect(cells(0)).toEqual(['25 Seedtide 1 AL', '26 Seedtide 1 AL', '27 Seedtide 1 AL', '28 Seedtide 1 AL', '1 Highsun 1 AL', '2 Highsun 1 AL'])
  expect(cells(5).slice(-2)).toEqual(['1 Thawmoon 2 AL', '2 Thawmoon 2 AL'])
  expect(document.querySelectorAll('.saga-calview-grid .saga-calview-week')).toHaveLength(7)
  expect([...document.querySelectorAll('.saga-calview-day[data-outside]')].map(dayName)).toEqual(['25 Seedtide 1 AL', '26 Seedtide 1 AL', '27 Seedtide 1 AL', '28 Seedtide 1 AL', '1 Thawmoon 2 AL', '2 Thawmoon 2 AL'])
})

test('with no dated entry the view opens on the first month of year 1', async () => {
  await renderCalendar((fake) => {
    fake.base.length = 0
    fake.base.push(CAL)
  })
  expect(title()).toBe('Thawmoon 1 AL')
  expect(cells(0)[0]).toBe('1 Thawmoon 1 AL')
})

test('a multi-day bar is one bar per week, continued through the cells and cut at the week break; lanes keep bars apart', async () => {
  await renderCalendar()
  const festival = bars().filter((el) => el.textContent === 'Festival of Lamps')
  expect(festival).toHaveLength(2)
  const [first, second] = festival as [HTMLElement, HTMLElement]
  expect(dayName(first.closest('.saga-calview-day')!)).toBe('2 Highsun 1 AL')
  expect([first.dataset['joinStart'], first.dataset['joinEnd']]).toEqual([undefined, 'true'])
  expect(dayName(second.closest('.saga-calview-day')!)).toBe('3 Highsun 1 AL')
  expect([second.dataset['joinStart'], second.dataset['joinEnd']]).toEqual(['true', 'true'])
  const day4 = bars(cell('4 Highsun 1 AL'))
  expect(day4).toHaveLength(1)
  expect([day4[0]?.getAttribute('aria-hidden'), day4[0]?.dataset['joinStart'], day4[0]?.dataset['joinEnd']]).toEqual(['true', 'true', undefined])
  // Day 3 holds the long bar in lane 0 and the single-day bar below it; day 5 holds neither.
  expect([...cell('3 Highsun 1 AL').querySelectorAll('.saga-calview-bar')].map((el) => el.textContent || (el as HTMLElement).dataset['span'])).toEqual(['Festival of Lamps', 'Chain toll raised'])
  expect(bars(cell('5 Highsun 1 AL'))).toHaveLength(0)
  expect(cell('3 Highsun 1 AL').getBoundingClientRect().height).toBe(cell('4 Highsun 1 AL').getBoundingClientRect().height)
})

test('entries of other calendars and notes outside the base are not drawn', async () => {
  await renderCalendar()
  const drawn = bars().map((el) => el.textContent).filter(Boolean)
  expect(drawn).not.toContain('Elsewhere event')
  expect(drawn).not.toContain('Outside')
  expect(new Set(drawn)).toEqual(new Set(['Chain toll raised', 'Festival of Lamps']))
})

test('month and year dates are listed as No day set where their range falls', async () => {
  await renderCalendar((fake) => {
    fake.addNote('Lore/Charter lapses.md', lore('year: 1'))
    fake.addNote('Lore/Next year.md', lore('year: 2'))
    fake.addNote('Lore/Drowned.md', lore('era: Age of Lanterns'))
  })
  expect(title()).toBe('Thawmoon 1 AL')
  expect(document.querySelector('.saga-calview-chips-label')?.textContent).toBe('No day set')
  expect(chips()).toEqual(['1 ALCharter lapses'])
  await next(2)
  expect(title()).toBe('Highsun 1 AL')
  expect(chips()).toEqual(['HighsunHerring run fails', '1 ALCharter lapses'])
  await next()
  expect(title()).toBe('Thawmoon 2 AL')
  expect(chips()).toEqual(['2 ALNext year'])
})

test('a chip opens the card of its entry', async () => {
  const { screen } = await renderCalendar()
  await screen.getByRole('button', { name: /Herring run fails/ }).click()
  const card = screen.getByRole('dialog', { name: 'Herring run fails' })
  await expect.element(card).toBeVisible()
  expect(card.element().textContent).toContain('Highsun 1 AL')
})

test('the card shows renderer, title link, weekday and date, and excerpt; the title opens the note and previews on hover', async () => {
  const { fake, screen } = await renderCalendar()
  await screen.getByRole('button', { name: 'Chain toll raised' }).click()
  const card = screen.getByRole('dialog', { name: 'Chain toll raised' })
  await expect.element(card).toBeVisible()
  const text = card.element().textContent ?? ''
  expect(text).toContain('Lore')
  expect(text).toContain('Moonday, 3 Highsun 1 AL')
  await vi.waitFor(() => expect(card.element().textContent).toContain('The harbour chain costs more.'))
  const link = card.getByRole('link', { name: 'Chain toll raised' })
  await expect.element(link).toHaveFocus()

  await userEvent.hover(link.element())
  expect(fake.hovered).toEqual(['Lore/Chain toll raised.md'])
  await link.click()
  link.element().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
  expect(fake.opened).toEqual([
    { linktext: 'Lore/Chain toll raised.md', sourcePath: CAL, newLeaf: false },
    { linktext: 'Lore/Chain toll raised.md', sourcePath: CAL, newLeaf: 'tab' }
  ])
})

test('a ranged entry shows both dates on its card', async () => {
  const { screen } = await renderCalendar()
  await screen.getByRole('button', { name: 'Festival of Lamps' }).first().click()
  await expect.element(screen.getByRole('dialog', { name: 'Festival of Lamps' })).toHaveTextContent('LoreFestival of Lamps2 Highsun 1 AL – 4 Highsun 1 AL')
})

test('Escape, the close button, the same bar and a click elsewhere close the card; focus returns to the bar', async () => {
  const { screen } = await renderCalendar()
  const bar = screen.getByRole('button', { name: 'Chain toll raised' })
  const open = async () => {
    bar.element().focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(screen.getByRole('dialog')).toBeVisible()
  }
  const closed = () => vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())

  await open()
  await userEvent.keyboard('{Escape}')
  await closed()
  expect(document.activeElement).toBe(bar.element())

  await open()
  await screen.getByRole('button', { name: 'Close' }).click()
  await closed()

  await open()
  await bar.click()
  await closed()

  await open()
  cell('20 Highsun 1 AL').click()
  await closed()
})

test('the card is placed beside its bar inside the view', async () => {
  const { screen } = await renderCalendar()
  await screen.getByRole('button', { name: 'Chain toll raised' }).click()
  const card = document.querySelector('[role="dialog"]')!.getBoundingClientRect()
  const view = document.querySelector('.saga-calview-content')!.getBoundingClientRect()
  const bar = document.querySelector<HTMLElement>('[aria-expanded="true"]')!.getBoundingClientRect()
  expect(card.left).toBeGreaterThanOrEqual(view.left)
  expect(card.right).toBeLessThanOrEqual(view.right)
  expect(card.left >= bar.right || card.right <= bar.left).toBe(true)
})

test('a note with a bad date is listed as a Date problem and its card shows the issues', async () => {
  const { screen } = await renderCalendar((fake) => void fake.addNote('Lore/Month 9.md', lore('year: 1\nmonth: 9')))
  expect([...document.querySelectorAll('.saga-calview-chips-label')].map((el) => el.textContent)).toEqual(['No day set', 'Date problem'])
  await screen.getByRole('button', { name: 'Month 9' }).click()
  const issues = screen.getByRole('list', { name: 'Problems with this note' })
  expect(issues.element().textContent).toBe("month: Month 9 is beyond the calendar's 3 months")
})

test('previous and next step by month and the range title follows, across year 1 and -1 with no year 0', async () => {
  await renderCalendar()
  await prev(2)
  expect(title()).toBe('Thawmoon 1 AL')
  await prev()
  expect(title()).toBe('Highsun 1 BL')
  expect(document.querySelector('.saga-calview-grid')?.getAttribute('aria-label')).toBe('Highsun 1 BL')
  expect(cells(0).every((label) => label.length > 0)).toBe(true)
  await prev()
  expect(title()).toBe('Seedtide 1 BL')
  await next(2)
  expect(title()).toBe('Thawmoon 1 AL')
})

test('entries in years before 1 are drawn in their month', async () => {
  await renderCalendar((fake) => void fake.addNote('Lore/Old flood.md', lore('year: -1\nmonth: 3\nday: 5')))
  expect(title()).toBe('Highsun 1 BL')
  expect(bars().map((el) => el.textContent)).toEqual(['Old flood'])
  expect(dayName(bars()[0]!.closest('.saga-calview-day')!)).toBe('5 Highsun 1 BL')
  await next()
  expect(title()).toBe('Thawmoon 1 AL')
  await next(2)
  expect(bars().map((el) => el.textContent)).toContain('Chain toll raised')
})

test('the range toggle writes opens and the Year range steps by year across 1 and -1', async () => {
  const { fake } = await renderCalendar()
  document.querySelector<HTMLElement>('.saga-calview-range button:last-child')!.click()
  await vi.waitFor(() => expect(title()).toBe('1 AL'))
  expect(fake.written).toEqual([['opens', 'year']])
  expect(document.querySelectorAll('.saga-calview-mini')).toHaveLength(3)
  expect(document.querySelector('.saga-calview-range [aria-pressed="true"]')?.textContent).toBe('Year')
  await press('Previous year')
  expect(title()).toBe('1 BL')
  await press('Previous year')
  expect(title()).toBe('2 BL')
  await press('Next year')
  await press('Next year')
  expect(title()).toBe('1 AL')
  document.querySelector<HTMLElement>('.saga-calview-range button')!.click()
  await vi.waitFor(() => expect(title()).toBe('Highsun 1 AL'))
  expect(fake.written.at(-1)).toEqual(['opens', 'month'])
})

test('the opens option opens the Year range, one small month per month of the calendar', async () => {
  await renderCalendar((fake) => void (fake.options['opens'] = 'year'))
  expect(title()).toBe('1 AL')
  expect([...document.querySelectorAll('.saga-calview-mini-title')].map((el) => el.textContent)).toEqual(['Thawmoon', 'Seedtide', 'Highsun'])
  const highsun = document.querySelectorAll('.saga-calview-mini-grid')[2]!
  expect([...highsun.querySelectorAll('.saga-calview-weekday')].map((el) => el.textContent)).toEqual(['M', 'T', 'N', 'S', 'L', 'R'])
  expect(highsun.querySelectorAll('.saga-calview-week')).toHaveLength(7)
})

test('in the Year range a day with an entry opens its card and a day with several opens a menu of them', async () => {
  const { fake, screen } = await renderCalendar((f) => void (f.options['opens'] = 'year'))
  const marks = [...document.querySelectorAll('.saga-calview-mini-mark')].map((el) => el.getAttribute('aria-label'))
  expect(marks).toEqual(['2 Highsun 1 AL: Festival of Lamps', '3 Highsun 1 AL: Chain toll raised, Festival of Lamps', '4 Highsun 1 AL: Festival of Lamps'])
  await screen.getByRole('button', { name: '4 Highsun 1 AL: Festival of Lamps' }).click()
  await expect.element(screen.getByRole('dialog', { name: 'Festival of Lamps' })).toBeVisible()

  await userEvent.keyboard('{Escape}')
  await screen.getByRole('button', { name: /^3 Highsun/ }).click()
  expect(fake.menus.at(-1)?.items.map((item) => item.title)).toEqual(['Chain toll raised', 'Festival of Lamps'])
  fake.choose('Chain toll raised')
  await expect.element(screen.getByRole('dialog', { name: 'Chain toll raised' })).toBeVisible()
})

test('the calendar name links to the calendar note and previews on hover', async () => {
  const { fake, screen } = await renderCalendar()
  const link = screen.getByRole('link', { name: 'The Tidereckoning' })
  await userEvent.hover(link.element())
  expect(fake.hovered).toEqual([CAL])
  await link.click()
  expect(fake.opened).toEqual([{ linktext: CAL, sourcePath: CAL, newLeaf: false }])
})

test('at phone width the grid fits, controls are reachable and the card runs the width of the view', async () => {
  const { screen } = await renderCalendar(undefined, 360)
  const body = document.querySelector('.saga-calview-body')!
  expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
  for (const name of ['Previous month', 'Next month']) await expect.element(screen.getByRole('button', { name })).toBeVisible()
  await screen.getByRole('button', { name: 'Chain toll raised' }).click()
  const card = document.querySelector('[role="dialog"]')!.getBoundingClientRect()
  const view = document.querySelector('.saga-calview-content')!.getBoundingClientRect()
  expect(card.left).toBeGreaterThanOrEqual(view.left)
  expect(card.right).toBeLessThanOrEqual(view.right)
  expect(card.width).toBeGreaterThan(300)
  expect(card.top).toBeGreaterThanOrEqual(document.querySelector<HTMLElement>('[aria-expanded="true"]')!.getBoundingClientRect().bottom)
})

test('the range the toggle chose follows the opens option once the option shows it, and the option wins after that', async () => {
  const { fake } = await renderCalendar()
  document.querySelector<HTMLElement>('.saga-calview-range button:last-child')!.click()
  await vi.waitFor(() => expect(title()).toBe('1 AL'))
  expect(fake.options['opens']).toBe('year')
  fake.set('opens', 'month')
  await vi.waitFor(() => expect(title()).toBe('Highsun 1 AL'))
  fake.set('opens', 'year')
  await vi.waitFor(() => expect(title()).toBe('1 AL'))
})

test('the opening month is fixed on first render and does not jump when data changes', async () => {
  const { fake } = await renderCalendar()
  fake.addNote('Lore/Earlier.md', lore('year: 1\nmonth: 1\nday: 1'))
  await settle()
  expect(title()).toBe('Highsun 1 AL')
})

test('a month beyond the calendar after an edit is clamped to its last month', async () => {
  const { fake } = await renderCalendar()
  fake.fake.addFile(CAL, fake.fake.text(CAL).replace('  - { name: Highsun, days: 30 }\n', ''))
  await vi.waitFor(() => expect(title()).toBe('Seedtide 1 AL'))
})

test('a note with an end and no start is a Date problem', async () => {
  const fake = await CalendarFake.create()
  fake.addNote('Lore/Orphan end.md', lore('end-year: 1'))
  const state = fake.state()
  expect(state.kind === 'calendar' && state.entries.map((entry) => [entry.title, entry.start, entry.issues])).toEqual([['Orphan end', undefined, ['end: Ends without When']]])
})

test('a month chip names its year when it is not the visible one', async () => {
  await renderCalendar((fake) => void fake.addNote('Lore/Long run.md', lore('year: 1\nmonth: 3\nend-year: 2\nend-month: 1')))
  expect(chips()).toContain('HighsunLong run')
  await next()
  expect(title()).toBe('Thawmoon 2 AL')
  expect(chips()).toContain('Highsun 1 ALLong run')
})

test('navigating closes an open card and leaves focus on the navigation button', async () => {
  const { screen } = await renderCalendar()
  await screen.getByRole('button', { name: 'Chain toll raised' }).click()
  await expect.element(screen.getByRole('dialog')).toBeVisible()
  const nextButton = screen.getByRole('button', { name: 'Next month' })
  await nextButton.click()
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  expect(document.activeElement).toBe(nextButton.element())
})

test('PageDown and PageUp step the range', async () => {
  await renderCalendar()
  document.querySelector<HTMLElement>('.saga-calview-step')!.focus()
  await userEvent.keyboard('{PageDown}')
  expect(title()).toBe('Thawmoon 2 AL')
  await userEvent.keyboard('{PageUp}')
  expect(title()).toBe('Highsun 1 AL')
})

test('Shift+Tab from the card returns to the bar it opened from', async () => {
  const { screen } = await renderCalendar()
  const bar = screen.getByRole('button', { name: 'Chain toll raised' })
  await bar.click()
  screen.getByRole('button', { name: 'Close' }).element().focus()
  await userEvent.tab({ shift: true })
  expect(document.activeElement).toBe(bar.element())
})

test('more than three bars in a week show three and a +N button that lists the day', async () => {
  const { fake, screen } = await renderCalendar((f) => {
    for (const name of ['A', 'B', 'C', 'D']) f.addNote(`Lore/Day twenty ${name}.md`, lore('year: 1\nmonth: 3\nday: 20'))
  })
  const day = cell('20 Highsun 1 AL')
  expect(bars(day)).toHaveLength(3)
  await screen.getByRole('button', { name: '1 more on 20 Highsun 1 AL' }).click()
  expect(fake.menus.at(-1)?.items.map((item) => item.title)).toEqual(['Day twenty A', 'Day twenty B', 'Day twenty C', 'Day twenty D'])
  fake.choose('Day twenty D')
  await expect.element(screen.getByRole('dialog', { name: 'Day twenty D' })).toBeVisible()
})

test('in the Year range a day with several entries shows a count and a day an entry only continues through is faint', async () => {
  await renderCalendar((fake) => void (fake.options['opens'] = 'year'))
  const mark = (day: number): HTMLElement => document.querySelector<HTMLElement>(`[data-slot="day|2|${day}"]`)!
  expect(mark(3).querySelector('.saga-calview-mini-count')?.textContent).toBe('2')
  expect([mark(2).dataset['faint'], mark(3).dataset['faint'], mark(4).dataset['faint']]).toEqual([undefined, undefined, 'true'])
  expect(mark(3).title).toBe('Chain toll raised, Festival of Lamps')
})

test('the note named by a not-a-calendar message is a link that opens it', async () => {
  const fake = await CalendarFake.create()
  fixture(fake)
  fake.options['calendar'] = 'Lore/Chain toll raised.md'
  const screen = await render(<CalendarRoot state={fake.state()} />)
  await screen.getByRole('link', { name: 'Chain toll raised' }).click()
  expect(fake.opened).toEqual([{ linktext: 'Lore/Chain toll raised.md', sourcePath: 'Lore/Chain toll raised.md', newLeaf: false }])
  await expect.element(screen.getByText('is not a calendar note.', { exact: false })).toBeVisible()
})

test('keyboard focus draws a ring on a bar, also on the selected one, and hovering a bar tints all its segments', async () => {
  const { screen } = await renderCalendar()
  await userEvent.keyboard('{Tab}')
  let focused = document.activeElement as HTMLElement
  for (let i = 0; i < 20 && !focused.classList.contains('saga-calview-bar'); i++) {
    await userEvent.keyboard('{Tab}')
    focused = document.activeElement as HTMLElement
  }
  expect(focused.classList.contains('saga-calview-bar')).toBe(true)
  expect(getComputedStyle(focused).outlineStyle).toBe('solid')
  await userEvent.keyboard('{Enter}')
  await expect.element(screen.getByRole('dialog')).toBeVisible()
  document.querySelector<HTMLElement>('.saga-calview-card-close')!.focus()
  await userEvent.tab({ shift: true })
  expect(document.activeElement).toBe(focused)
  expect(focused.dataset['selected']).toBe('true')
  expect(getComputedStyle(focused).outlineStyle).toBe('solid')

  await userEvent.keyboard('{Escape}')
  const festival = bars().filter((el) => el.textContent === 'Festival of Lamps')[0]!
  const before = getComputedStyle(festival).backgroundColor
  await userEvent.hover(screen.getByRole('button', { name: 'Herring run fails' }).elements()[0] ?? festival)
  await userEvent.hover(festival)
  expect(getComputedStyle(festival).backgroundColor).not.toBe(before)
  expect(getComputedStyle(festival).cursor).toBe('pointer')
  expect(bars(cell('4 Highsun 1 AL'))[0]?.dataset['hover']).toBe('true')
})

test('weekday headers are two-letter labels at phone width and bars are colour only', async () => {
  await renderCalendar(undefined, 360)
  const short = [...document.querySelectorAll<HTMLElement>('.saga-calview-weekday-short')]
  expect(short.map((el) => el.textContent)).toEqual(['Mo', 'Ti', 'Ne', 'Sa', 'La', 'Re'])
  expect(short.every((el) => getComputedStyle(el).display !== 'none')).toBe(true)
  expect(getComputedStyle(document.querySelector('.saga-calview-weekday-full')!).display).toBe('none')
  const text = document.querySelector<HTMLElement>('.saga-calview-bar-text')!
  expect(text.getBoundingClientRect().width).toBeLessThanOrEqual(1)
  expect(getComputedStyle(document.querySelector('.saga-calview-bar .saga-calview-glyph')!).display).toBe('none')
})

test('the Year range lays out two months across at phone width', async () => {
  await renderCalendar((fake) => void (fake.options['opens'] = 'year'), 390)
  const tops = [...document.querySelectorAll('.saga-calview-mini')].map((el) => Math.round(el.getBoundingClientRect().top))
  expect(tops[0]).toBe(tops[1])
  expect(tops[2]).toBeGreaterThan(tops[0]!)
})
