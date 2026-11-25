import { useLayoutEffect, useReducer } from 'react'
import { expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import '../../src/calendar/calendar.css'
import '../../src/header/header.css'
import { CalendarRoot } from '../../src/calendar/CalendarRoot'
import { EditEntry } from '../../src/calendar/EditEntry'
import { deleteEntry, entryNoun, saveEntry, type EntryDraft } from '../../src/calendar/entryActions'
import { noteCalendar } from '../../src/header/noteCalendar'
import { frontmatterOf } from '../../src/obsidian/vault'
import { CAL, CalendarFake, lore } from '../fakes/calendar'
import { testEnv, type HeaderFakeApp } from '../fakes/header'
import '../../src/styles.css'
import './mapVars.css'

function Live({ fake }: { fake: CalendarFake }) {
  const [, update] = useReducer((n: number) => n + 1, 0)
  useLayoutEffect(() => fake.subscribe(update), [fake])
  return <CalendarRoot state={fake.state()} />
}

const NOTE = 'Lore/Festival of Lamps.md'
const DATED = 'year: 1\nmonth: 3\nday: 2\nend-year: 1\nend-month: 3\nend-day: 4'

async function renderView(display: string) {
  const fake = await CalendarFake.create()
  fake.addNote(NOTE, lore(DATED))
  fake.addNote('Lore/Herring run fails.md', lore('year: 1\nmonth: 3\nday: 2').replace('type: event', 'type: Lore'))
  fake.options['display'] = display
  fake.options['scale'] = 'year'
  const screen = await render(
    <div className="saga-calview-view" style={{ width: 1100, height: 800 }}>
      <Live fake={fake} />
    </div>
  )
  return { fake, screen }
}

const rightClick = (el: Element): void => void el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 30 }))
const titles = (fake: CalendarFake): string[] => fake.menus.at(-1)?.items.map((item) => item.title) ?? []

test('a right-click on an entry offers to edit or delete it, named by its type', async () => {
  for (const [display, selector] of [
    ['calendar', '.saga-calview-bar:not([data-spacer])'],
    ['feed', '.saga-feed-card'],
    ['timeline', '.saga-timeline-label'],
    ['timeline', '.saga-timeline-track']
  ] as const) {
    const { fake, screen } = await renderView(display)
    const el = [...document.querySelectorAll(selector)].find((candidate) => candidate.textContent?.includes('Festival') || candidate.getAttribute('data-entry') === NOTE)
    rightClick(el!)
    expect(titles(fake)).toEqual(['Edit event…', 'Delete event'])
    expect(fake.menus.at(-1)?.at).toMatchObject({ x: 20, y: 30 })
    fake.choose('Edit event…')
    fake.choose('Delete event')
    expect(fake.actions).toEqual([
      ['edit', NOTE],
      ['delete', NOTE]
    ])
    await screen.unmount()
  }
})

test('the noun is the type as written, lowercased unless all capitals, else the renderer label', () => {
  expect(entryNoun({ type: 'Lore', renderer: 'lore' })).toBe('lore')
  expect(entryNoun({ type: 'NPC', renderer: 'character' })).toBe('NPC')
  expect(entryNoun({ type: null, renderer: 'lore' })).toBe('lore')
})

test('a touch held on an entry opens the menu, and the click that ends it opens no card', async () => {
  const { fake } = await renderView('timeline')
  const label = document.querySelector(`.saga-timeline-label[data-entry="${NOTE}"]`)!
  label.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 5, clientY: 6 }))
  await new Promise((resolve) => setTimeout(resolve, 600))
  expect(titles(fake)).toEqual(['Edit event…', 'Delete event'])
  expect(fake.menus.at(-1)?.at).toMatchObject({ x: 5, y: 6 })
  label.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }))
  label.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 6 }))
  ;(label as HTMLElement).click()
  expect(fake.menus).toHaveLength(1)
  expect(document.querySelector('.saga-calview-card')).toBeNull()
})

test('a touch that moves or lifts early opens no menu', async () => {
  const { fake } = await renderView('timeline')
  const label = document.querySelector(`.saga-timeline-label[data-entry="${NOTE}"]`)!
  label.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 5, clientY: 6 }))
  label.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'touch', clientX: 25, clientY: 6 }))
  await new Promise((resolve) => setTimeout(resolve, 600))
  label.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 5, clientY: 6 }))
  label.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }))
  await new Promise((resolve) => setTimeout(resolve, 600))
  expect(fake.menus).toHaveLength(0)
})

test('a right-click elsewhere in the view shows no menu and leaves the browser menu alone', async () => {
  const { fake } = await renderView('calendar')
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  document.querySelector('.saga-calview-title')!.dispatchEvent(event)
  expect(fake.menus).toHaveLength(0)
  expect(event.defaultPrevented).toBe(false)
})

const draftOf = (fake: CalendarFake): { before: EntryDraft; calendar: ReturnType<typeof noteCalendar> } => {
  const file = fake.file(NOTE)
  const calendar = noteCalendar(fake.app, file, fake.settings.state().config, 'lore', frontmatterOf(fake.app, file))
  return { before: { title: 'Festival of Lamps', when: { year: 1, month: 3, day: 2 }, end: { year: 1, month: 3, day: 4 } }, calendar }
}

test('saving renames the note, then writes the changed dates in one write', async () => {
  const fake = await CalendarFake.create()
  fake.addNote(NOTE, lore(DATED))
  const { before, calendar } = draftOf(fake)
  const file = fake.file(NOTE)
  const result = await saveEntry(fake.app, file, before, { title: 'Lamp Night', when: { year: 1 }, end: before.end }, calendar.calendar)
  expect(result).toBeNull()
  expect(file.path).toBe('Lore/Lamp Night.md')
  expect(fake.fake.text('Lore/Lamp Night.md')).toBe(lore('year: 1\nend-year: 1\nend-month: 3\nend-day: 4'))
  expect(fake.fake.processed).toEqual(['Lore/Lamp Night.md'])
})

test('saving refuses an empty or clashing title and Ends before When, writing nothing', async () => {
  const fake = await CalendarFake.create()
  fake.addNote(NOTE, lore(DATED))
  fake.addNote('Lore/Taken.md', lore('year: 1'))
  const { before, calendar } = draftOf(fake)
  const file = fake.file(NOTE)
  const save = (draft: Partial<EntryDraft>) => saveEntry(fake.app, file, before, { ...before, ...draft }, calendar.calendar)
  expect(await save({ title: '  ' })).toBe('The title cannot be empty')
  expect(await save({ title: 'a/b' })).toBe('The title cannot contain \\ / : * " < > ? or |')
  expect(await save({ title: 'Why?' })).toBe('The title cannot contain \\ / : * " < > ? or |')
  expect(await save({ title: 'Taken' })).toBe('Taken already exists')
  expect(await save({ title: 'taken' })).toBe('taken already exists')
  expect(await save({ when: { year: 2 } })).toBe('Ends cannot be earlier than When')
  expect(await save({})).toBeNull()
  expect(fake.fake.processed).toEqual([])
  expect(file.path).toBe(NOTE)
})

test('deleting asks first; Cancel keeps the note and Delete trashes it', async () => {
  const fake = await CalendarFake.create()
  fake.addNote(NOTE, lore(DATED))
  const file = fake.file(NOTE)
  const asked: string[][] = []
  await deleteEntry(fake.app, file, 'event', (...args) => (asked.push(args), Promise.resolve(false)))
  expect(fake.app.vault.getFileByPath(NOTE)).not.toBeNull()
  await deleteEntry(fake.app, file, 'event', () => Promise.resolve(true))
  expect(fake.app.vault.getFileByPath(NOTE)).toBeNull()
  expect(asked).toEqual([['Delete event', 'Delete “Festival of Lamps”?', 'Delete', 'Cancel']])
})

async function renderDialog(onSave: (draft: EntryDraft) => Promise<string | null>) {
  const fake = await CalendarFake.create()
  fake.addNote(NOTE, lore(DATED))
  const { before, calendar } = draftOf(fake)
  const done = vi.fn()
  const screen = await render(
    <EditEntry
      env={testEnv(fake.fake as unknown as HeaderFakeApp).env}
      config={fake.settings.state().config}
      file={fake.file(NOTE)}
      renderer="lore"
      noun="event"
      calendar={calendar}
      initial={before}
      onSave={onSave}
      onDone={done}
    />
  )
  return { screen, done, before }
}

test('the dialog edits the title, When and Ends and saves them together with Update', async () => {
  const saved: EntryDraft[] = []
  const { screen, done, before } = await renderDialog((draft) => (saved.push(draft), Promise.resolve(null)))
  await expect.element(screen.getByRole('button', { name: 'When', exact: true })).toHaveTextContent('2 Highsun 1 AL')
  await screen.getByRole('textbox', { name: 'Title' }).fill('Lamp Night')
  await userEvent.hover(document.querySelectorAll('.saga-lore-date-chip')[1]!)
  await screen.getByRole('button', { name: 'Remove Ends' }).click()
  expect(saved).toEqual([])
  await screen.getByRole('button', { name: 'Update event' }).click()
  await vi.waitFor(() => expect(done).toHaveBeenCalled())
  expect(saved).toEqual([{ title: 'Lamp Night', when: before.when, end: undefined }])
})

test('Mod+Enter saves; a refused save shows why and keeps the dialog open', async () => {
  const { screen, done } = await renderDialog(() => Promise.resolve('Taken already exists'))
  await screen.getByRole('textbox', { name: 'Title' }).click()
  await userEvent.keyboard('{Control>}{Enter}{/Control}')
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Taken already exists')
  expect(done).not.toHaveBeenCalled()
})

test('a refused rename writes no dates', async () => {
  const fake = await CalendarFake.create()
  fake.addNote(NOTE, lore(DATED))
  const { before, calendar } = draftOf(fake)
  const file = fake.file(NOTE)
  fake.app.fileManager.renameFile = () => Promise.reject(new Error('EPERM'))
  expect(await saveEntry(fake.app, file, before, { ...before, title: 'Lamp Night', when: { year: 1 } }, calendar.calendar)).toBe('Could not rename the note: EPERM')
  expect(fake.fake.processed).toEqual([])
})

test('Mod+Enter in a date picker picks there and does not save', async () => {
  const saved: EntryDraft[] = []
  const { screen, done } = await renderDialog((draft) => (saved.push(draft), Promise.resolve(null)))
  await screen.getByRole('button', { name: 'When', exact: true }).click()
  await screen.getByRole('button', { name: 'Year', exact: true }).click()
  await screen.getByRole('textbox', { name: 'Year' }).fill('12')
  await userEvent.keyboard('{Control>}{Enter}{/Control}')
  await expect.element(screen.getByRole('button', { name: 'When', exact: true })).toHaveTextContent('12 AL')
  expect(saved).toEqual([])
  expect(done).not.toHaveBeenCalled()
})

test('the When picker opens inside the dialog', async () => {
  const { screen } = await renderDialog(() => Promise.resolve(null))
  await screen.getByRole('button', { name: 'When', exact: true }).click()
  await expect.element(screen.getByRole('dialog')).toBeVisible()
  expect(document.querySelector('.saga-entry-edit .saga-lore-popover')).not.toBeNull()
})

test('the calendar note itself is not an entry', async () => {
  const { fake } = await renderView('timeline')
  expect(document.querySelector(`[data-entry="${CAL}"]`)).toBeNull()
  expect(fake.menus).toHaveLength(0)
})
