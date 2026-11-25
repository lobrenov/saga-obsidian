import { beforeAll, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import headerCss from '../../src/header/header.css?inline'
import { renderHeader } from './header.support'

beforeAll(() => {
  const style = document.createElement('style')
  style.textContent = headerCss
  document.head.append(style)
})

const path = 'Calendars/The Tidereckoning.md'

const parts = {
  months: 'months:\n  - name: Thawmoon\n    days: 30\n  - name: Seedtide\n    days: 20\n',
  weekdays: 'weekdays:\n  - Moonday\n  - Tideday\n  - Netday\n  - Saltday\n',
  first: 'first-weekday: Moonday\n',
  eras:
    'eras:\n  - name: The Drowned Age\n    short: DA\n    side: before\n  - name: Before the Lanterns\n    short: BL\n    side: before\n    start: 600\n  - name: Age of Lanterns\n    short: AL\n    side: after\n  - name: The Second Tide\n    short: ST\n    side: after\n    start: 1400\n'
}
const note = (changes: Partial<typeof parts> = {}): string => {
  const p = { ...parts, ...changes }
  return `---\ntype: calendar\n${p.months}${p.weekdays}${p.first}${p.eras}---\n`
}
const lore = (extra: string, calendar = '"[[The Tidereckoning]]"'): string => `---\ntype: event\ncalendar: ${calendar}\n${extra}---\n`

const cell = (el: Element | null): HTMLElement => el as HTMLElement
const blur = (locator: { element(): Element }): void => cell(locator.element()).blur()

test('the header shows the calendar, its summary and its tables', async () => {
  const { screen } = await renderHeader(path, note())
  await expect.element(screen.getByRole('region', { name: 'Calendar header' })).toBeVisible()
  expect(document.querySelector('.saga-header-badge [data-icon="calendar-days"]')).not.toBeNull()
  await expect.element(screen.getByText('2 months · 50 days a year · 4-day week · 4 eras')).toBeVisible()
  await expect.element(screen.getByRole('textbox', { name: 'Month 2 name' })).toHaveValue('Seedtide')
  await expect.element(screen.getByRole('spinbutton', { name: 'Seedtide days' })).toHaveValue(20)
  await expect.element(screen.getByRole('button', { name: 'Year 1 began on' })).toHaveTextContent('Moonday')
  expect([...document.querySelectorAll('.saga-calendar-fixed')].map((el) => el.textContent)).toEqual(['Earliest', 'Year 1'])
  expect(document.querySelectorAll('.saga-calendar-start input')).toHaveLength(2)
})

test('months: name, days, add and remove write only months', async () => {
  const { screen, text } = await renderHeader(path, note())
  await screen.getByRole('textbox', { name: 'Month 1 name' }).fill('Thaw')
  blur(screen.getByRole('textbox', { name: 'Month 1 name' }))
  await vi.waitFor(() => expect(text()).toBe(note({ months: parts.months.replace('Thawmoon', 'Thaw') })))
  await screen.getByRole('spinbutton', { name: 'Seedtide days' }).fill('21')
  blur(screen.getByRole('spinbutton', { name: 'Seedtide days' }))
  await vi.waitFor(() => expect(text()).toBe(note({ months: parts.months.replace('Thawmoon', 'Thaw').replace('20', '21') })))
  await screen.getByRole('button', { name: 'Add month' }).click()
  await vi.waitFor(() => expect(text()).toContain('  - name: New month\n    days: 30\n'))
  await screen.getByRole('button', { name: 'Remove New month' }).click()
  await screen.getByRole('button', { name: 'Remove Thaw' }).click()
  await vi.waitFor(() => expect(text()).toBe(note({ months: 'months:\n  - name: Seedtide\n    days: 21\n' })))
})

test('months reorder by dragging the grip onto another row', async () => {
  const { text } = await renderHeader(path, note())
  const rows = document.querySelectorAll('[data-columns="months"] .saga-calendar-row')
  await userEvent.dragAndDrop(cell(rows[0]?.querySelector('.saga-calendar-grip') ?? null), cell(rows[1] ?? null))
  await vi.waitFor(() => expect(text()).toBe(note({ months: 'months:\n  - name: Seedtide\n    days: 20\n  - name: Thawmoon\n    days: 30\n' })))
})

test('week: add, remove and reorder days write only weekdays; the first weekday is a menu', async () => {
  const { screen, text, menus, choose } = await renderHeader(path, note())
  await screen.getByRole('button', { name: 'Add day' }).click()
  await userEvent.keyboard('Restday{Enter}')
  await vi.waitFor(() => expect(text()).toBe(note({ weekdays: parts.weekdays + '  - Restday\n' })))
  await screen.getByRole('button', { name: 'Remove Tideday' }).click()
  await vi.waitFor(() => expect(text()).toBe(note({ weekdays: 'weekdays:\n  - Moonday\n  - Netday\n  - Saltday\n  - Restday\n' })))
  const chips = document.querySelectorAll('.saga-calendar-chip')
  await userEvent.dragAndDrop(cell(chips[0] ?? null), cell(chips[1] ?? null))
  await vi.waitFor(() => expect(text()).toBe(note({ weekdays: 'weekdays:\n  - Netday\n  - Moonday\n  - Saltday\n  - Restday\n' })))
  await screen.getByRole('button', { name: 'Year 1 began on' }).click()
  expect(menus.at(-1)?.items.map((item) => item.title)).toEqual(['Netday', 'Moonday', 'Saltday', 'Restday'])
  choose('Saltday')
  await vi.waitFor(() => expect(text()).toBe(note({ weekdays: 'weekdays:\n  - Netday\n  - Moonday\n  - Saltday\n  - Restday\n', first: 'first-weekday: Saltday\n' })))
})

test('eras: side, short name and start write only eras; first of each side has no start', async () => {
  const { screen, text, choose } = await renderHeader(path, note())
  await screen.getByRole('spinbutton', { name: 'Before the Lanterns starts' }).fill('700')
  blur(screen.getByRole('spinbutton', { name: 'Before the Lanterns starts' }))
  await vi.waitFor(() => expect(text()).toBe(note({ eras: parts.eras.replace('600', '700') })))
  await screen.getByRole('textbox', { name: 'The Second Tide short name' }).fill('TS')
  blur(screen.getByRole('textbox', { name: 'The Second Tide short name' }))
  await vi.waitFor(() => expect(text()).toContain('short: TS'))
  await screen.getByRole('button', { name: 'Remove The Drowned Age' }).click()
  await vi.waitFor(() => expect(text()).not.toContain('The Drowned Age'))
  // Before the Lanterns is now the first before era and loses its start.
  expect(text()).not.toContain('start: 700')
  await screen.getByRole('button', { name: 'Before the Lanterns side' }).click()
  choose('After')
  await vi.waitFor(() => expect(text()).toContain('short: BL\n    side: after'))
  await screen.getByRole('button', { name: 'Add era' }).click()
  await vi.waitFor(() => expect(text()).toContain('  - name: New era\n    short: NE\n    side: after\n    start: 1500\n'))
})

test('invalid entries show their issue', async () => {
  const { screen, text } = await renderHeader(path, note({ months: 'months:\n  - name: Thawmoon\n    days: 0\n', first: 'first-weekday: Sunday\n' }))
  await expect.element(screen.getByText('A month needs at least 1 day')).toBeVisible()
  await expect.element(screen.getByText('Not one of the weekdays')).toBeVisible()
  await expect.element(screen.getByRole('spinbutton', { name: 'Thawmoon days' })).toHaveAttribute('aria-invalid', 'true')
  await expect.element(screen.getByRole('button', { name: 'Year 1 began on' })).toHaveTextContent('Sunday')
  expect(document.querySelector('.saga-calendar-strip')).toBeNull()
  await screen.getByRole('spinbutton', { name: 'Thawmoon days' }).fill('31')
  blur(screen.getByRole('spinbutton', { name: 'Thawmoon days' }))
  await vi.waitFor(() => expect(text()).toContain('days: 31'))
  await expect.element(screen.getByText('A month needs at least 1 day')).not.toBeInTheDocument()
})

test('an era start that breaks the order shows its issue', async () => {
  const { screen } = await renderHeader(path, note({ eras: parts.eras.replace('1400', '1') }))
  await expect.element(screen.getByText('Starts must increase in time')).toBeVisible()
})

test('the era strip follows the eras, each as wide as its span', async () => {
  const { screen } = await renderHeader(path, note())
  const strip = screen.getByRole('img', { name: 'Eras in sequence: The Drowned Age, Before the Lanterns, then year 1, Age of Lanterns, The Second Tide' })
  await expect.element(strip).toBeVisible()
  const eras = [...document.querySelectorAll('.saga-calendar-era')]
  expect(eras.map((el) => el.textContent)).toEqual(['The Drowned Age · DA', 'Before the Lanterns · BL', 'Age of Lanterns · AL', 'The Second Tide · ST'])
  expect(eras.map((el) => cell(el).style.getPropertyValue('--saga-calendar-weight'))).toEqual(['300', '600', '1399', '300'])
  expect(eras.map((el) => el.hasAttribute('data-year-one'))).toEqual([false, false, true, false])
  await expect.element(screen.getByText('← counting back')).toBeVisible()
  await expect.element(screen.getByText('counting up →')).toBeVisible()
})

test('the glance shows a year with the days of linked notes marked, and steps over year 0', async () => {
  const { screen, app } = await renderHeader(path, note(), {
    files: {
      'Lore/Flood.md': lore('year: 1312\nmonth: 1\nday: 3\nend-year: 1312\nend-month: 1\nend-day: 5\n'),
      'Lore/Feast.md': lore('year: 1312\nmonth: 2\nday: 20\n'),
      'Lore/Month only.md': lore('year: 1312\nmonth: 2\n'),
      'Lore/Elsewhere.md': lore('year: 1312\nmonth: 2\nday: 1\n', '"[[Other]]"'),
      'Calendars/Other.md': note()
    }
  })
  await expect.element(screen.getByRole('heading', { name: '1312 AL at a glance' })).toBeVisible()
  const months = document.querySelectorAll('.saga-calendar-month')
  expect([...months].map((m) => m.querySelectorAll('.saga-calendar-cells [data-lore]').length)).toEqual([3, 1])
  expect([...months].map((m) => m.querySelectorAll('.saga-calendar-cells [data-day]').length)).toEqual([30, 20])
  // 1312 AL starts 1311 years * 50 days after Moonday of year 1: a weekday offset of 1311 * 50 % 4 = 2.
  expect(months[0]?.querySelectorAll('[data-blank]')).toHaveLength(2)
  app.addFile('Lore/Later.md', lore('year: 1312\nmonth: 1\nday: 10\n'))
  await vi.waitFor(() => expect(document.querySelector('.saga-calendar-month')?.querySelectorAll('.saga-calendar-cells [data-lore]')).toHaveLength(4), { timeout: 3000 })
  await screen.getByRole('button', { name: 'Previous year' }).click()
  await expect.element(screen.getByRole('heading', { name: '1311 AL at a glance' })).toBeVisible()
})

test('the glance without dated notes opens on year 1 and steps back to 1 BL', async () => {
  const { screen } = await renderHeader(path, note())
  await expect.element(screen.getByRole('heading', { name: '1 AL at a glance' })).toBeVisible()
  await screen.getByRole('button', { name: 'Previous year' }).click()
  await expect.element(screen.getByRole('heading', { name: '1 BL at a glance' })).toBeVisible()
  await screen.getByRole('button', { name: 'Next year' }).click()
  await expect.element(screen.getByRole('heading', { name: '1 AL at a glance' })).toBeVisible()
})

const inEra = {
  'Lore/Founding.md': lore('era: Age of Lanterns\n'),
  'Lore/Span.md': lore('year: 3\nend-era: Age of Lanterns\n'),
  'Lore/Other era.md': lore('era: The Second Tide\n'),
  'Lore/Other calendar.md': lore('era: Age of Lanterns\n', '"[[Other]]"'),
  'Calendars/Other.md': note()
}

test('renaming an era asks, then renames era and end-era in linked notes only', async () => {
  const { screen, text, app, confirms, notices } = await renderHeader(path, note(), { files: inEra })
  await screen.getByRole('textbox', { name: 'Era 3 name' }).fill('Age of Lamps')
  blur(screen.getByRole('textbox', { name: 'Era 3 name' }))
  await vi.waitFor(() => expect(app.text('Lore/Span.md')).toBe(lore('year: 3\nend-era: Age of Lamps\n')))
  expect(text()).toBe(note({ eras: parts.eras.replace('Age of Lanterns', 'Age of Lamps') }))
  expect(app.text('Lore/Founding.md')).toBe(lore('era: Age of Lamps\n'))
  expect(app.text('Lore/Other era.md')).toBe(inEra['Lore/Other era.md'])
  expect(app.text('Lore/Other calendar.md')).toBe(inEra['Lore/Other calendar.md'])
  expect(confirms).toEqual([{ title: 'Rename era', message: 'Rename Age of Lanterns to Age of Lamps in 2 notes?', action: 'Rename', cancel: 'Cancel' }])
  expect(notices).toEqual([])
})

test('a note that cannot be written is listed in a notice', async () => {
  const stuck = '---\n{ type: event, calendar: "[[The Tidereckoning]]", era: Age of Lanterns }\n---\n'
  const { screen, text, notices } = await renderHeader(path, note(), { files: { 'Lore/Stuck.md': stuck, 'Lore/Founding.md': inEra['Lore/Founding.md'] } })
  await screen.getByRole('textbox', { name: 'Era 3 name' }).fill('Age of Lamps')
  blur(screen.getByRole('textbox', { name: 'Era 3 name' }))
  await vi.waitFor(() => expect(notices).toEqual(['Could not rename Age of Lanterns in Stuck']))
  expect(text()).toContain('name: Age of Lamps')
})

test('renaming an era without notes in it writes eras only and does not ask', async () => {
  const { screen, text, confirms } = await renderHeader(path, note(), { files: { 'Lore/Tide.md': lore('era: The Second Tide\n') } })
  await screen.getByRole('textbox', { name: 'Era 3 name' }).fill('Age of Lamps')
  blur(screen.getByRole('textbox', { name: 'Era 3 name' }))
  await vi.waitFor(() => expect(text()).toContain('name: Age of Lamps'))
  expect(confirms).toEqual([])
})

test('cancelling the rename restores the name and writes nothing', async () => {
  const { screen, text, app, confirms, answer } = await renderHeader(path, note(), { files: inEra })
  answer.confirm = false
  await screen.getByRole('textbox', { name: 'Era 3 name' }).fill('Age of Lamps')
  blur(screen.getByRole('textbox', { name: 'Era 3 name' }))
  await expect.element(screen.getByRole('textbox', { name: 'Era 3 name' })).toHaveValue('Age of Lanterns')
  expect(confirms).toHaveLength(1)
  expect(text()).toBe(note())
  expect(app.processed).toEqual([])
})
