import { beforeAll, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import headerCss from '../../src/header/header.css?inline'
import { renderHeader } from './header.support'

beforeAll(() => {
  const style = document.createElement('style')
  style.textContent = headerCss
  document.head.append(style)
})

const path = 'Lore/The Gull King’s Return.md'

const calendar = `---
type: calendar
months:
  - name: Thawmoon
    days: 30
  - name: Seedtide
    days: 20
weekdays:
  - Moonday
  - Tideday
  - Netday
  - Saltday
first-weekday: Moonday
eras:
  - name: The Drowned Age
    short: DA
    side: before
  - name: Before the Lanterns
    short: BL
    side: before
    start: 600
  - name: Age of Lanterns
    short: AL
    side: after
  - name: The Second Tide
    short: ST
    side: after
    start: 1400
---
`
const CALENDARS = { 'Calendars/The Tidereckoning.md': calendar }
const link = '"[[The Tidereckoning]]"'
const lore = (extra: string, calendarLink: string | null = link, type = 'event'): string =>
  `---\ntype: ${type}\n${calendarLink === null ? '' : `calendar: ${calendarLink}\n`}${extra}---\n`

const open = async (screen: Awaited<ReturnType<typeof renderHeader>>['screen'], field: 'When' | 'Ends'): Promise<void> => {
  await screen.getByRole('button', { name: field, exact: true }).click()
}
const precision = (screen: Awaited<ReturnType<typeof renderHeader>>['screen'], name: string) => screen.getByRole('button', { name, exact: true })

test('type lore and event draw the Lore header with the dates, calendar, where and who', async () => {
  for (const type of ['lore', 'event']) {
    const { screen } = await renderHeader(
      path,
      lore('year: 1312\nmonth: 2\nday: 3\nend-year: 1313\nwhere: "[[Waterdeep]]"\nwho:\n  - "[[Bob]]"\n', link, type),
      { files: CALENDARS }
    )
    await expect.element(screen.getByRole('region', { name: 'Lore header' })).toBeVisible()
    expect(document.querySelector('.saga-header-badge [data-icon="scroll-text"]')).not.toBeNull()
    await expect.element(screen.getByRole('button', { name: 'When', exact: true })).toHaveTextContent('3 Seedtide 1312 AL')
    await expect.element(screen.getByRole('button', { name: 'Ends', exact: true })).toHaveTextContent('1313 AL')
    await expect.element(screen.getByRole('button', { name: 'The Tidereckoning' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Waterdeep' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Bob' })).toBeVisible()
    await screen.unmount()
  }
})

test('the type selector lists lore and event', async () => {
  const { screen, menus } = await renderHeader(path, lore('', link, 'lore'), { files: CALENDARS })
  await screen.getByRole('button', { name: 'Type' }).click()
  expect(menus.at(-1)?.items.map((item) => item.title)).toEqual(['lore', 'event'])
})

test('an empty When and Ends are quiet buttons', async () => {
  const { screen } = await renderHeader(path, lore(''), { files: CALENDARS })
  await expect.element(screen.getByRole('button', { name: 'When', exact: true })).toHaveTextContent('Set date')
  await expect.element(screen.getByRole('button', { name: 'Ends', exact: true })).toHaveTextContent('Add end')
  expect(document.querySelectorAll('[aria-label="Remove When"], [aria-label="Remove Ends"]')).toHaveLength(0)
})

test('Day: choosing a day writes year, month and day', async () => {
  const { screen, text, app } = await renderHeader(path, lore('year: 1312\nmonth: 1\nday: 3\n'), { files: CALENDARS })
  await open(screen, 'When')
  await expect.element(screen.getByRole('dialog', { name: 'When date' })).toBeVisible()
  await expect.element(precision(screen, 'Day')).toHaveAttribute('aria-pressed', 'true')
  await expect.element(screen.getByRole('heading', { name: 'Thawmoon 1312 AL' })).toBeVisible()
  await expect.element(screen.getByRole('button', { name: '3 Thawmoon 1312 AL' })).toHaveAttribute('aria-pressed', 'true')
  await screen.getByRole('button', { name: 'Next month' }).click()
  await expect.element(screen.getByRole('heading', { name: 'Seedtide 1312 AL' })).toBeVisible()
  await screen.getByRole('button', { name: '7 Seedtide 1312 AL' }).click()
  await vi.waitFor(() => expect(text()).toBe(lore('year: 1312\nmonth: 2\nday: 7\n')))
  expect(app.processed).toHaveLength(1)
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument()
  await expect.element(screen.getByRole('button', { name: 'When', exact: true })).toHaveFocus()
})

test('Day: the grid follows the calendar’s weekdays and days from neighbouring months pick their own date', async () => {
  const { screen, text } = await renderHeader(path, lore('year: 1312\nmonth: 1\nday: 3\n'), { files: CALENDARS })
  await open(screen, 'When')
  expect([...document.querySelectorAll('.saga-lore-weekday')].map((el) => el.textContent)).toEqual(['Mo', 'Ti', 'Ne', 'Sa'])
  expect((document.querySelector('.saga-lore-days') as HTMLElement).style.getPropertyValue('--saga-lore-columns')).toBe('4')
  // Thawmoon 1312 begins 1311 * 50 days after Moonday, a Netday: the first row holds the last two days of Seedtide 1311.
  const cells = [...document.querySelectorAll('.saga-lore-day')]
  expect(cells.map((el) => el.hasAttribute('data-outside')).slice(0, 4)).toEqual([true, true, false, false])
  await screen.getByRole('button', { name: '19 Seedtide 1311 AL' }).click()
  await vi.waitFor(() => expect(text()).toBe(lore('year: 1311\nmonth: 2\nday: 19\n')))
})

test('Day: year 0 is never produced when stepping across year 1', async () => {
  const { screen, text } = await renderHeader(path, lore('year: 1\nmonth: 1\nday: 1\n'), { files: CALENDARS })
  await open(screen, 'When')
  await screen.getByRole('button', { name: 'Previous month' }).click()
  await expect.element(screen.getByRole('heading', { name: 'Seedtide 1 BL' })).toBeVisible()
  await screen.getByRole('button', { name: 'Next year' }).click()
  await expect.element(screen.getByRole('heading', { name: 'Seedtide 1 AL' })).toBeVisible()
  await screen.getByRole('button', { name: 'Previous year' }).click()
  await expect.element(screen.getByRole('heading', { name: 'Seedtide 1 BL' })).toBeVisible()
  await screen.getByRole('button', { name: 'Previous month' }).click()
  await screen.getByRole('button', { name: '1 Thawmoon 1 BL' }).click()
  await vi.waitFor(() => expect(text()).toBe(lore('year: -1\nmonth: 1\nday: 1\n')))
})

test('Month: choosing a month writes year and month and removes the day, in one write', async () => {
  const { screen, text, app } = await renderHeader(path, lore('year: 1312\nmonth: 1\nday: 3\n'), { files: CALENDARS })
  await open(screen, 'When')
  await precision(screen, 'Month').click()
  await expect.element(precision(screen, 'Month')).toHaveAttribute('aria-pressed', 'true')
  await expect.element(screen.getByRole('heading', { name: '1312 AL' })).toBeVisible()
  await screen.getByRole('button', { name: 'Next year' }).click()
  await screen.getByRole('button', { name: 'Seedtide 1313 AL' }).click()
  await vi.waitFor(() => expect(text()).toBe(lore('year: 1313\nmonth: 2\n')))
  expect(app.processed).toHaveLength(1)
  await expect.element(screen.getByRole('button', { name: 'When', exact: true })).toHaveTextContent('Seedtide 1313 AL')
})

test('Year: typing a year writes it and removes month and day, in one write', async () => {
  const { screen, text, app } = await renderHeader(path, lore('year: 1312\nmonth: 1\nday: 3\n'), { files: CALENDARS })
  await open(screen, 'When')
  await precision(screen, 'Year').click()
  const year = screen.getByRole('textbox', { name: 'Year' })
  await expect.element(year).toHaveFocus()
  await expect.element(year).toHaveValue('1312')
  await year.fill('1400')
  await expect.element(screen.getByLabelText('Era')).toHaveTextContent('ST')
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => expect(text()).toBe(lore('year: 1400\n')))
  expect(app.processed).toHaveLength(1)
  await expect.element(screen.getByRole('button', { name: 'When', exact: true })).toHaveTextContent('1400 ST')
})

test('Year: the Set year button writes, for touch', async () => {
  const { screen, text } = await renderHeader(path, lore(''), { files: CALENDARS })
  await open(screen, 'When')
  await precision(screen, 'Year').click()
  await screen.getByRole('textbox', { name: 'Year' }).fill('77')
  await screen.getByRole('button', { name: 'Set year' }).click()
  await vi.waitFor(() => expect(text()).toContain('year: 77\n'))
})

test('BL years: a minus sign or a before era’s short name writes a negative year; year 0 is refused', async () => {
  const { screen, text, app } = await renderHeader(path, lore(''), { files: CALENDARS })
  await open(screen, 'When')
  await precision(screen, 'Year').click()
  const year = screen.getByRole('textbox', { name: 'Year' })
  await year.fill('-600')
  await expect.element(screen.getByLabelText('Era')).toHaveTextContent('BL')
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => expect(text()).toBe(lore('year: -600\n')))
  await expect.element(screen.getByRole('button', { name: 'When', exact: true })).toHaveTextContent('600 BL')

  await open(screen, 'When')
  await precision(screen, 'Year').click()
  await expect.element(screen.getByRole('textbox', { name: 'Year' })).toHaveValue('-600')
  await screen.getByRole('textbox', { name: 'Year' }).fill('700 BL')
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => expect(text()).toBe(lore('year: -700\n')))

  await open(screen, 'When')
  await precision(screen, 'Year').click()
  await screen.getByRole('textbox', { name: 'Year' }).fill('0')
  await userEvent.keyboard('{Enter}')
  await expect.element(screen.getByRole('alert')).toHaveTextContent('There is no year 0')
  await screen.getByRole('textbox', { name: 'Year' }).fill('5 XX')
  await userEvent.keyboard('{Enter}')
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Unknown era XX')
  await screen.getByRole('textbox', { name: 'Year' }).fill('twelve')
  await userEvent.keyboard('{Enter}')
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Enter a whole number')
  expect(text()).toBe(lore('year: -700\n'))
  expect(app.processed).toHaveLength(2)
})

test('Era: eras are grouped Before year 1 and From year 1; choosing one writes era and removes year, month and day', async () => {
  const { screen, text, app } = await renderHeader(path, lore('year: 1312\nmonth: 1\nday: 3\n'), { files: CALENDARS })
  await open(screen, 'When')
  await precision(screen, 'Era').click()
  expect([...document.querySelectorAll('.saga-lore-group')].map((el) => el.textContent)).toEqual(['Before year 1', 'From year 1'])
  expect([...document.querySelectorAll('[role="radio"]')].map((el) => el.textContent)).toEqual([
    'The Drowned AgeUntil 601 DADA',
    'Before the Lanterns600 BL – 1 BLBL',
    'Age of Lanterns1 AL – 1399 ALAL',
    'The Second Tide1400 ST onwardST'
  ])
  await screen.getByRole('radio', { name: /The Second Tide/ }).click()
  await vi.waitFor(() => expect(text()).toBe(lore('era: The Second Tide\n')))
  expect(app.processed).toHaveLength(1)
  await expect.element(screen.getByRole('button', { name: 'When', exact: true })).toHaveTextContent('The Second Tide')
  await open(screen, 'When')
  await expect.element(precision(screen, 'Era')).toHaveAttribute('aria-pressed', 'true')
  await expect.element(screen.getByRole('radio', { name: /The Second Tide/ })).toHaveAttribute('aria-checked', 'true')
})

test('the precision switch alone writes nothing', async () => {
  const { screen, app } = await renderHeader(path, lore('year: 1312\n'), { files: CALENDARS })
  await open(screen, 'When')
  for (const name of ['Era', 'Month', 'Day', 'Year']) await precision(screen, name).click()
  expect(app.processed).toEqual([])
})

test('Ends is empty until added, writes end- keys, and clears them', async () => {
  const { screen, text, app } = await renderHeader(path, lore('year: 1312\nmonth: 1\nday: 3\n'), { files: CALENDARS })
  await open(screen, 'Ends')
  await precision(screen, 'Year').click()
  await screen.getByRole('textbox', { name: 'Year' }).fill('1313')
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => expect(text()).toBe(lore('year: 1312\nmonth: 1\nday: 3\nend-year: 1313\n')))
  await open(screen, 'Ends')
  await precision(screen, 'Month').click()
  await screen.getByRole('button', { name: 'Seedtide 1313 AL' }).click()
  await vi.waitFor(() => expect(text()).toBe(lore('year: 1312\nmonth: 1\nday: 3\nend-year: 1313\nend-month: 2\n')))
  await open(screen, 'Ends')
  await precision(screen, 'Era').click()
  await screen.getByRole('radio', { name: /Age of Lanterns/ }).click()
  await vi.waitFor(() => expect(text()).toBe(lore('year: 1312\nmonth: 1\nday: 3\nend-era: Age of Lanterns\n')))
  await screen.getByRole('button', { name: 'Remove Ends' }).click()
  await vi.waitFor(() => expect(text()).toBe(lore('year: 1312\nmonth: 1\nday: 3\n')))
  expect(app.processed).toHaveLength(4)
})

test('Ends earlier than When is refused with a reason; a coarser Ends that reaches When is allowed', async () => {
  const { screen, text, app } = await renderHeader(path, lore('year: 1\nmonth: 2\nday: 3\n'), { files: CALENDARS })
  await open(screen, 'Ends')
  await precision(screen, 'Year').click()
  await screen.getByRole('textbox', { name: 'Year' }).fill('-1')
  await userEvent.keyboard('{Enter}')
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Ends cannot be earlier than When')
  expect(text()).toBe(lore('year: 1\nmonth: 2\nday: 3\n'))
  expect(app.processed).toEqual([])
  await open(screen, 'Ends')
  await precision(screen, 'Day').click()
  await screen.getByRole('button', { name: 'Next month' }).click()
  await screen.getByRole('button', { name: '2 Seedtide 1 AL' }).click()
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Ends cannot be earlier than When')
  expect(app.processed).toEqual([])
  await open(screen, 'Ends')
  await precision(screen, 'Year').click()
  await screen.getByRole('textbox', { name: 'Year' }).fill('1')
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => expect(text()).toBe(lore('year: 1\nmonth: 2\nday: 3\nend-year: 1\n')))
  await expect.element(screen.getByRole('alert')).not.toBeInTheDocument()
})

test('an Ends in an earlier era than When’s year is refused', async () => {
  const { screen, text } = await renderHeader(path, lore('year: 1500\n'), { files: CALENDARS })
  await open(screen, 'Ends')
  await precision(screen, 'Era').click()
  await screen.getByRole('radio', { name: /Before the Lanterns/ }).click()
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Ends cannot be earlier than When')
  expect(text()).toBe(lore('year: 1500\n'))
})

test('without a calendar the popover asks for one first, from the calendar notes only', async () => {
  const { screen, text, suggesters, app } = await renderHeader(path, lore('', null), {
    files: { ...CALENDARS, 'Calendars/Other.md': calendar, 'Notes/Plain.md': '# plain\n' }
  })
  await open(screen, 'When')
  expect(document.querySelector('.saga-lore-precision')).toBeNull()
  const input = screen.getByRole('textbox', { name: 'Calendar' })
  await expect.element(input).toHaveFocus()
  const suggester = suggesters.find((s) => s.input === input.element())
  expect(suggester?.kind).toBe('note')
  expect(suggester?.offered()).toEqual(['Calendars/The Tidereckoning.md', 'Calendars/Other.md'])
  suggester?.pick('Other')
  await vi.waitFor(() => expect(text()).toBe(lore('', '"[[Other]]"')))
  expect(app.processed).toHaveLength(1)
  await expect.element(precision(screen, 'Day')).toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'Thawmoon 1 AL' })).toBeVisible()
  expect(document.querySelector('.saga-lore-link')?.textContent).toBe('Other')
  await screen.getByRole('button', { name: 'Next month' }).click()
  await screen.getByRole('button', { name: '4 Seedtide 1 AL' }).click()
  await vi.waitFor(() => expect(text()).toBe(lore('year: 1\nmonth: 2\nday: 4\n', '"[[Other]]"')))
})

test('a calendar link that does not resolve asks again; a link to a note that is not a calendar says so', async () => {
  const { screen } = await renderHeader(path, lore('', '"[[Nowhere]]"'), { files: CALENDARS })
  await open(screen, 'When')
  await expect.element(screen.getByRole('textbox', { name: 'Calendar' })).toBeVisible()
  await screen.unmount()
  const second = await renderHeader(path, lore('', '"[[Plain]]"'), { files: { ...CALENDARS, 'Notes/Plain.md': '---\ntype: calendar\n---\n' } })
  await open(second.screen, 'When')
  await expect.element(second.screen.getByText(/Plain is not a valid calendar/)).toBeVisible()
  await expect.element(second.screen.getByRole('textbox', { name: 'Calendar' })).toBeVisible()
})

test('the only calendar in the vault is used without asking and linked with the first date', async () => {
  const { screen, text, app } = await renderHeader(path, lore('', null), { files: CALENDARS })
  await open(screen, 'When')
  expect(document.querySelector('[aria-label="Calendar"]')).toBeNull()
  await expect.element(precision(screen, 'Day')).toBeVisible()
  expect(document.querySelector('.saga-lore-link')?.textContent).toBe('The Tidereckoning')
  await screen.getByRole('button', { name: '9 Thawmoon 1 AL' }).click()
  await vi.waitFor(() => expect(text()).toBe(`---\ntype: event\nyear: 1\nmonth: 1\nday: 9\ncalendar: "[[The Tidereckoning]]"\n---\n`))
  expect(app.processed).toHaveLength(1)
})

test('successive edits before the cache catches up keep each other: one calendar link, both dates', async () => {
  const { screen, text, app } = await renderHeader(path, lore('', null), { files: CALENDARS })
  // The header does not hear of the first write until the cache event is delivered later.
  const trigger = app.metadataCache.trigger.bind(app.metadataCache)
  const held: (() => void)[] = []
  app.metadataCache.trigger = (name: string, ...args: unknown[]) => void held.push(() => trigger(name, ...args))
  await open(screen, 'When')
  await screen.getByRole('button', { name: '9 Thawmoon 1 AL' }).click()
  await open(screen, 'Ends')
  await screen.getByRole('button', { name: '12 Thawmoon 1 AL' }).click()
  await vi.waitFor(() => expect(app.processed).toHaveLength(2))
  expect(text()).toBe(`---\ntype: event\nyear: 1\nmonth: 1\nday: 9\ncalendar: "[[The Tidereckoning]]"\nend-year: 1\nend-month: 1\nend-day: 12\n---\n`)
  held.forEach((release) => release())
})

test('Escape closes the popover and discards a typed year', async () => {
  const { screen, text, app } = await renderHeader(path, lore('year: 1312\n'), { files: CALENDARS })
  await open(screen, 'When')
  await precision(screen, 'Year').click()
  await screen.getByRole('textbox', { name: 'Year' }).fill('1400')
  await userEvent.keyboard('{Escape}')
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument()
  await expect.element(screen.getByRole('button', { name: 'When', exact: true })).toHaveFocus()
  expect(text()).toBe(lore('year: 1312\n'))
  expect(app.processed).toEqual([])
  await open(screen, 'When')
  await precision(screen, 'Year').click()
  await expect.element(screen.getByRole('textbox', { name: 'Year' })).toHaveValue('1312')
})

test('a press outside closes the popover and writes nothing', async () => {
  const { screen, app } = await renderHeader(path, lore('year: 1312\n'), { files: CALENDARS })
  await open(screen, 'When')
  await expect.element(screen.getByRole('dialog')).toBeVisible()
  await userEvent.click(document.querySelector('.saga-header-badge') as HTMLElement)
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument()
  expect(app.processed).toEqual([])
})

test('a month beyond the calendar and an invalid year show their issues', async () => {
  const beyond = await renderHeader(path, lore('year: 1312\nmonth: 9\n'), { files: CALENDARS })
  await expect.element(beyond.screen.getByText('Month 9 is beyond the calendar\'s 2 months')).toBeVisible()
  await expect.element(beyond.screen.getByRole('button', { name: 'When', exact: true })).toHaveTextContent('Month 9 1312 AL')
  await beyond.screen.unmount()
  const zero = await renderHeader(path, lore('year: 0\n'), { files: CALENDARS })
  await expect.element(zero.screen.getByText('There is no year 0')).toBeVisible()
})

test('the footer links the notes just before and after on the same calendar, coarser dates first', async () => {
  const { screen, app } = await renderHeader(path, lore('year: 1312\nmonth: 2\n'), {
    files: {
      ...CALENDARS,
      'Lore/Early.md': lore('year: 1312\nmonth: 1\nday: 3\n'),
      'Lore/Earliest.md': lore('year: 700\n'),
      'Lore/Late.md': lore('year: 1312\nmonth: 2\nday: 5\n'),
      'Lore/Latest.md': lore('year: 1400\n'),
      'Lore/Elsewhere.md': lore('year: 1312\nmonth: 2\nday: 1\n', '"[[Other]]"'),
      'Calendars/Other.md': calendar
    }
  })
  const footer = screen.getByRole('navigation', { name: 'Neighbouring lore' })
  await expect.element(footer.getByRole('link').first()).toHaveTextContent('Early · 3 Thawmoon 1312 AL')
  await expect.element(footer.getByRole('link').last()).toHaveTextContent('Late · 5 Seedtide 1312 AL')
  await footer.getByRole('link', { name: /Late/ }).click()
  expect(app.opened.at(-1)).toMatchObject({ linktext: 'Lore/Late.md', sourcePath: path })
})

test('the footer says so at the ends of the calendar and is absent without a date', async () => {
  const { screen } = await renderHeader(path, lore('year: 1\n'), { files: { ...CALENDARS, 'Lore/Later.md': lore('year: 2\n') } })
  await expect.element(screen.getByText('Nothing earlier')).toBeVisible()
  await expect.element(screen.getByRole('link', { name: /Later/ })).toBeVisible()
  await screen.unmount()
  await renderHeader(path, lore(''), { files: { ...CALENDARS, 'Lore/Later.md': lore('year: 2\n') } })
  expect(document.querySelector('.saga-lore-footer')).toBeNull()
})

test('the footer follows notes added to the calendar', async () => {
  const { screen, app } = await renderHeader(path, lore('year: 5\n'), { files: CALENDARS })
  await expect.element(screen.getByText('Nothing later')).toBeVisible()
  app.addFile('Lore/Next.md', lore('year: 9\n'))
  await vi.waitFor(() => expect(document.querySelector('.saga-lore-neighbour[data-direction="after"]')?.textContent).toContain('Next'), { timeout: 3000 })
})

test('the date controls are reachable by keyboard and at least 36px tall', async () => {
  const { screen } = await renderHeader(path, lore('year: 1312\nmonth: 1\nday: 3\n'), { files: CALENDARS })
  await open(screen, 'When')
  const controls = [...document.querySelectorAll<HTMLElement>('.saga-lore-popover button:not(.saga-lore-link)')]
  expect(controls.length).toBeGreaterThan(30)
  for (const control of controls) expect(control.tabIndex).toBeGreaterThanOrEqual(0)
  for (const control of [document.querySelector<HTMLElement>('.saga-lore-date-button'), ...controls]) expect(control?.getBoundingClientRect().height).toBeGreaterThanOrEqual(36)
})
