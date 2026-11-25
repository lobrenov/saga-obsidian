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

const fixture = (fake: CalendarFake): void => {
  fake.options['display'] = 'feed'
  fake.addNote('Images/sea.png', 'png', false)
  fake.addNote('Lore/Drowned Kings.md', lore('era: The Drowned Age', 'Barrow-lords of the reefs.\n'))
  fake.addNote('Lore/Sundering.md', lore('year: -340'))
  fake.addNote('Lore/Lamp lit.md', lore('year: 1\nmonth: 1\nday: 1'))
  fake.addNote('Lore/Drowning.md', lore('year: 1104\nbanner: "[[sea.png]]"'))
  fake.addNote('Lore/Charter.md', lore('year: 1290\nmonth: 3'))
  fake.addNote('Lore/Lapse.md', lore('year: 1312'))
  fake.addNote('Lore/Herring.md', lore('year: 1312\nmonth: 3'))
  fake.addNote('Lore/Toll.md', lore('year: 1312\nmonth: 3\nday: 3'))
  fake.addNote('Lore/Festival.md', lore('year: 1312\nmonth: 3\nday: 9\nend-year: 1312\nend-month: 3\nend-day: 11'))
  fake.addNote('Lore/Bad.md', lore('year: 5\nmonth: 9'))
}

async function renderFeed(setup?: (fake: CalendarFake) => void, width = 1100) {
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const rows = (): Element[] => [...document.querySelectorAll('.saga-feed-list > li')]
const label = (row: Element): string =>
  row.classList.contains('saga-feed-entry') ? (row.querySelector('.saga-feed-title')?.textContent ?? '') : (row.textContent?.replace(/\s+/g, ' ').trim() ?? '')
const labels = (): string[] => rows().map(label)
const entries = (): string[] => rows().filter((row) => row.classList.contains('saga-feed-entry')).map(label)
const press = async (name: string) => {
  ;[...document.querySelectorAll<HTMLElement>('.saga-feed button')].find((el) => el.textContent === name)!.click()
  await settle()
}

test('Oldest first runs from the earliest date, Newest first reverses it, and the control writes the order option', async () => {
  const { fake } = await renderFeed()
  expect(entries()).toEqual(['Drowned Kings', 'Sundering', 'Lamp lit', 'Drowning', 'Charter', 'Lapse', 'Herring', 'Toll', 'Festival'])
  await press('Newest first')
  expect(fake.written).toEqual([['order', 'newest']])
  expect(entries()).toEqual(['Festival', 'Toll', 'Herring', 'Lapse', 'Charter', 'Drowning', 'Lamp lit', 'Sundering', 'Drowned Kings'])
  expect(document.querySelector('[aria-label="Order"] [aria-pressed="true"]')?.textContent).toBe('Newest first')
  await press('Oldest first')
  expect(fake.written.at(-1)).toEqual(['order', 'oldest'])
})

test('the order option wins over the control', async () => {
  await renderFeed((fake) => fake.set('order', 'newest'))
  expect(document.querySelector('[aria-label="Order"] [aria-pressed="true"]')?.textContent).toBe('Newest first')
  expect(entries()[0]).toBe('Festival')
})

test('a coarser date comes before a finer one at the same year and month', async () => {
  await renderFeed()
  const order = entries()
  expect(order.indexOf('Lapse')).toBeLessThan(order.indexOf('Herring'))
  expect(order.indexOf('Herring')).toBeLessThan(order.indexOf('Toll'))
})

test('an era-only entry sits at its era start under the era header', async () => {
  await renderFeed()
  expect(labels().slice(0, 3)).toEqual(['The Drowned Age BL', 'Drowned Kings', 'Sundering'])
})

test('era headers open each era and gaps give whole years between entries more than a year apart', async () => {
  await renderFeed()
  const all = labels()
  expect([...document.querySelectorAll('.saga-feed-era')].map((el) => el.textContent)).toEqual(['The Drowned Age BL', 'Age of Lanterns AL'])
  expect(all[all.indexOf('Age of Lanterns AL') + 1]).toBe('Lamp lit')
  expect(all.filter((text) => /years?$/.test(text) && !text.includes(' AL'))).toEqual(['339 years', '1,102 years', '185 years', '21 years'])
  expect(all[all.indexOf('Sundering') + 1]).toBe('339 years')
})

test('gap markers follow the feed order', async () => {
  await renderFeed((fake) => fake.set('order', 'newest'))
  const all = labels()
  expect(all[all.indexOf('Lapse') + 1]).toBe('21 years')
  expect(all[all.indexOf('Charter') + 1]).toBe('185 years')
})

test('a year marker opens entries sharing a year, whose day dates leave the year out', async () => {
  await renderFeed()
  const all = labels()
  expect(all.slice(all.indexOf('1312 AL') - 1, all.indexOf('1312 AL') + 3)).toEqual(['21 years', '1312 AL', 'Lapse', 'Herring'])
  expect(all.filter((text) => /^\d+ AL$/.test(text))).toEqual(['1312 AL'])
  const date = (title: string): string => [...document.querySelectorAll('.saga-feed-card')].find((card) => card.querySelector('.saga-feed-title')?.textContent === title)!.querySelector('.saga-feed-date')!.textContent
  expect(date('Toll')).toBe('3 Highsun')
  expect(date('Festival')).toBe('9 – 11 Highsun')
  expect(date('Herring')).toContain('Highsun 1312 AL')
  expect(date('Lamp lit')).toBe('1 Thawmoon 1 AL')
})

test('nodes follow precision and the legend names them', async () => {
  await renderFeed()
  const precision = (title: string): string | undefined =>
    [...document.querySelectorAll('.saga-feed-entry')].find((row) => row.querySelector('.saga-feed-title')?.textContent === title)?.querySelector('.saga-feed-node')?.getAttribute('data-precision') ?? undefined
  expect([precision('Toll'), precision('Herring'), precision('Lapse'), precision('Drowned Kings')]).toEqual(['day', 'month', 'year', 'era'])
  const fill = (title: string): string =>
    getComputedStyle([...document.querySelectorAll('.saga-feed-entry')].find((row) => row.querySelector('.saga-feed-title')?.textContent === title)!.querySelector('.saga-feed-node')!).backgroundColor
  expect(fill('Toll')).not.toBe(fill('Herring'))
  expect(fill('Drowned Kings')).not.toBe(fill('Herring'))
  expect(document.querySelector('.saga-feed-legend')?.textContent).toBe('DayMonth or yearEra')
})

test('banners show at 96px when on and are gone when off', async () => {
  await renderFeed()
  const banners = [...document.querySelectorAll<HTMLImageElement>('.saga-feed-banner img')]
  expect(banners).toHaveLength(1)
  expect(decodeURIComponent(banners[0]!.src)).toContain('Images/sea.png')
  expect(document.querySelector('.saga-feed-banner')!.getBoundingClientRect().height).toBe(96)
})

test('no banners show when the banners option is off', async () => {
  await renderFeed((fake) => fake.set('banners', false))
  expect(document.querySelectorAll('.saga-feed-banner')).toHaveLength(0)
})

test('titles and the calendar link open the note with hover preview', async () => {
  const { fake } = await renderFeed()
  const link = [...document.querySelectorAll<HTMLElement>('.saga-feed-title a')].find((a) => a.textContent === 'Toll')!
  link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  link.click()
  document.querySelector<HTMLElement>('.saga-calview-on a')!.click()
  await settle()
  expect(fake.hovered).toContain('Lore/Toll.md')
  expect(fake.opened.map((opened) => opened.linktext)).toEqual(['Lore/Toll.md', 'Worlds/The Tidereckoning.md'])
})

test('a note with a date problem is listed apart with its issue', async () => {
  await renderFeed()
  const problems = document.querySelector('.saga-feed-problems')!
  expect(problems.querySelector('h2')?.textContent).toBe('Date problem')
  expect(problems.textContent).toContain('Bad')
  expect(entries()).not.toContain('Bad')
})

test('the feed is an ordered list with the era at heading level 2', async () => {
  await renderFeed()
  expect(document.querySelector('ol[aria-label="Feed"]')).not.toBeNull()
  expect(document.querySelector('.saga-feed-era')?.tagName).toBe('H2')
})

test('at phone width the spine is at the left edge and cards stack on one side', async () => {
  await renderFeed(undefined, 380)
  const cards = [...document.querySelectorAll('.saga-feed-card')].map((card) => card.getBoundingClientRect())
  const nodes = [...document.querySelectorAll('.saga-feed-entry > .saga-feed-node')].map((node) => node.getBoundingClientRect())
  expect(new Set(cards.map((box) => Math.round(box.left))).size).toBe(1)
  expect(cards[0]!.left).toBeGreaterThan(nodes[0]!.right)
  expect(nodes[0]!.left).toBeLessThan(60)
})
