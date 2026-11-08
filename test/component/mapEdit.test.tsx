import { expect, test, vi } from 'vitest'
import { GULL, HESK } from '../fakes/map'
import { clickMapAt, dragMarker, ghosts, imageBox, marker, markers, pressKey, renderMap, stage, tipOf } from './mapSupport'

const addAtCentre = async (screen: Awaited<ReturnType<typeof renderMap>>['screen']): Promise<void> => {
  await screen.getByRole('button', { name: 'Add pin' }).click()
  const box = stage()!.getBoundingClientRect()
  clickMapAt(box.width / 2, box.height / 2)
}

test('Add pin: a ghost follows the cursor, a click asks for the note, and the pin is added to it while the ghost holds the place', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: 'Add pin' }).click()
  expect(document.body.textContent).toContain('Click the map to place a pin · Esc to cancel')
  const container = stage()!
  const box = container.getBoundingClientRect()
  container.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: box.left + 200, clientY: box.top + 200, pointerId: 1, isPrimary: true, pointerType: 'mouse' }))
  await vi.waitFor(() => expect(ghosts()).toBe(1))

  const release = fake.holdWrites()
  fake.pick = () => Promise.resolve(fake.file('People/Mother Hesk.md'))
  clickMapAt(box.width / 2, box.height / 2)
  await vi.waitFor(() => expect(fake.pickCalls).toBe(1))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(ghosts()).toBe(1)
  expect(markers()).toHaveLength(3)
  release()

  await vi.waitFor(() => expect(markers()).toHaveLength(4))
  await vi.waitFor(() => expect(ghosts()).toBe(0))
  expect(fake.text('People/Mother Hesk.md')).toMatch(/^---\ntype: NPC\nmap-pins:\n {2}- map: "\[\[The Shattered Coast\]\]"\n {4}x: \d+(\.\d)?\n {4}y: \d+(\.\d)?\n---\nHesk, the rumour-monger\.\n$/)
  const pin = marker('Mother Hesk')
  const image = imageBox()
  const tip = tipOf(pin)
  expect(tip.x).toBeCloseTo(box.left + box.width / 2, -1)
  expect((tip.x - image.left) / image.scale).toBeCloseTo(700, -1)
  expect(fake.writes).toEqual(['People/Mother Hesk.md'])
  await expect.element(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
  expect(fake.notices).toEqual([])
})

test('cancelling the note picker writes nothing, removes the ghost and keeps Add pin on', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await addAtCentre(screen)
  await vi.waitFor(() => expect(fake.pickCalls).toBe(1))
  await vi.waitFor(() => expect(ghosts()).toBe(0))
  expect(fake.writes).toEqual([])
  await expect.element(screen.getByRole('button', { name: 'Add pin' })).toHaveAttribute('aria-pressed', 'true')
  expect(HESK).toBe(fake.text('People/Mother Hesk.md'))
})

test('the picker can create a note, which is then pinned', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  fake.pick = () => Promise.resolve(fake.addNote('People/Quillon.md', '---\ntype: NPC\n---\n'))
  await addAtCentre(screen)
  await vi.waitFor(() => expect(fake.writes).toEqual(['People/Quillon.md']))
  await vi.waitFor(() => expect(markers()).toHaveLength(4))
  expect(fake.text('People/Quillon.md')).toContain('map-pins:\n  - map: "[[The Shattered Coast]]"')
})

test('a failed add is reported with a notice and the ghost goes', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  fake.pick = () => Promise.resolve(fake.file('People/Mother Hesk.md'))
  fake.failWrites('Disk full')
  await addAtCentre(screen)
  await vi.waitFor(() => expect(fake.notices).toEqual(['Disk full']))
  await vi.waitFor(() => expect(ghosts()).toBe(0))
  expect(markers()).toHaveLength(3)
})

test('Add pin at centre in the Pins list asks for a note', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  fake.pick = () => Promise.resolve(fake.file('People/Mother Hesk.md'))
  await screen.getByRole('button', { name: /Pins ·/ }).click()
  await screen.getByRole('button', { name: 'Add pin at centre' }).click()
  await vi.waitFor(() => expect(fake.writes).toEqual(['People/Mother Hesk.md']))
  await vi.waitFor(() => expect(markers()).toHaveLength(4))
})

test('Escape leaves Add pin', async () => {
  const { screen } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: 'Add pin' }).click()
  stage()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await expect.element(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
})

test('dragging a pin writes once, on release, changing only that entry`s position', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await dragMarker(marker('The Gull King'), 60, 30)
  await vi.waitFor(() => expect(fake.writes).toHaveLength(1))
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(fake.writes).toEqual(['People/The Gull King.md'])
  const after = fake.text('People/The Gull King.md')
  expect(after).toContain('style: danger\n    note: keep')
  expect(after).toContain('[[Elsewhere]]')
  expect(after).not.toContain('x: 300\n')
  expect(after.replace(/x: [\d.]+\n {4}y: [\d.]+/, 'x: 300\n    y: 590')).toBe(GULL)
})

test('a dragged pin keeps its drop point while the write is pending and after it lands', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const pin = marker('Saltmere')
  const before = tipOf(pin)
  const release = fake.holdWrites()
  await dragMarker(pin, 50, 40)
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(fake.writes).toEqual([])
  expect(tipOf(pin).x).toBeCloseTo(before.x + 50, 0)
  expect(tipOf(pin).y).toBeCloseTo(before.y + 40, 0)
  release()
  await vi.waitFor(() => expect(fake.writes).toHaveLength(1))
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(tipOf(marker('Saltmere')).x).toBeCloseTo(before.x + 50, 0)
  expect(tipOf(marker('Saltmere')).y).toBeCloseTo(before.y + 40, 0)
})

test('a pin whose write fails goes back and a notice says why', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const pin = marker('Saltmere')
  const before = tipOf(pin)
  fake.failWrites('Disk full')
  await dragMarker(pin, 50, 50)
  await vi.waitFor(() => expect(fake.notices).toEqual(['Disk full']))
  await vi.waitFor(() => {
    expect(tipOf(marker('Saltmere')).x).toBeCloseTo(before.x, 0)
    expect(tipOf(marker('Saltmere')).y).toBeCloseTo(before.y, 0)
  })
})

test('a pin that is no longer in the note when the write runs fails, and the file is left as it is', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  fake.frozen = true
  const edited = GULL.replace('x: 300', 'x: 301')
  fake.addNote('People/The Gull King.md', edited)
  await dragMarker(marker('The Gull King'), 40, 40)
  await vi.waitFor(() => expect(fake.notices).toEqual(['That pin is no longer in the note. Its map may have changed.']))
  expect(fake.text('People/The Gull King.md')).toBe(edited)
  expect(fake.writes).toEqual([])
})

test('a stale index writes the entry that matches the pin, not the one at that position', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  fake.frozen = true
  fake.addNote('People/The Gull King.md', GULL.replace('map-pins:\n', 'map-pins:\n  - map: "[[Elsewhere]]"\n    x: 5\n    y: 5\n'))
  await dragMarker(marker('The Gull King'), 40, 40)
  await vi.waitFor(() => expect(fake.writes).toHaveLength(1))
  const after = fake.text('People/The Gull King.md')
  expect(after).toContain('x: 5\n    y: 5\n')
  expect(after).not.toContain('x: 300\n')
  expect(after).toContain('style: danger\n    note: keep')
})

test('Move from the Pins list nudges with the arrow keys and writes once on Enter', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: /Pins ·/ }).click()
  await screen.getByRole('button', { name: 'Move Saltmere' }).click()
  await expect.element(screen.getByRole('status').getByText(/Moving Saltmere/)).toBeVisible()
  pressKey('ArrowRight')
  pressKey('ArrowRight')
  pressKey('ArrowDown', true)
  await vi.waitFor(() => expect(document.body.textContent).toMatch(/x \d+ · y \d+/))
  expect(fake.writes).toEqual([])
  pressKey('Enter')
  await vi.waitFor(() => expect(fake.writes).toEqual(['Places/Saltmere.md']))
  const [, x, y] = /x: ([\d.]+)\n\s+y: ([\d.]+)/.exec(fake.text('Places/Saltmere.md')) ?? []
  // Two small steps right, one Shift step (ten times larger) down.
  expect(Number(y) - 500).toBeGreaterThan((Number(x) - 790) * 3)
})

test('Escape cancels a keyboard move without writing', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: /Pins ·/ }).click()
  await screen.getByRole('button', { name: 'Move Saltmere' }).click()
  pressKey('ArrowLeft')
  pressKey('Escape')
  await vi.waitFor(() => expect(screen.getByText(/Moving Saltmere/).elements()).toHaveLength(0))
  expect(fake.writes).toEqual([])
  expect(markers()).toHaveLength(3)
})

test('a pin moves to a click on the map after Move on its card', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: 'Saltmere — Location' }).click()
  await screen.getByRole('dialog', { name: 'Saltmere' }).getByRole('button', { name: 'Move' }).click()
  const box = stage()!.getBoundingClientRect()
  clickMapAt(150, 150)
  await vi.waitFor(() => expect(fake.writes).toEqual(['Places/Saltmere.md']))
  const image = imageBox()
  const [, x, y] = /x: ([\d.]+)\n\s+y: ([\d.]+)/.exec(fake.text('Places/Saltmere.md')) ?? []
  expect(Number(x)).toBeCloseTo((box.left + 150 - image.left) / image.scale, -1)
  expect(Number(y)).toBeCloseTo((box.top + 150 - image.top) / image.scale, -1)
  await vi.waitFor(() => expect(tipOf(marker('Saltmere')).x).toBeCloseTo(box.left + 150, 0))
})

test('the card changes a pin\'s style, and Auto removes the override', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: 'The Gull King — Character, danger' }).click()
  const card = screen.getByRole('dialog', { name: 'The Gull King' })
  await expect.element(card.getByLabelText('Style')).toHaveValue('danger')
  await card.getByLabelText('Style').selectOptions('quest')
  await vi.waitFor(() => expect(fake.text('People/The Gull King.md')).toContain('style: quest\n    note: keep'))
  await card.getByLabelText('Style').selectOptions('auto')
  await vi.waitFor(() => expect(fake.text('People/The Gull King.md')).not.toContain('style:'))
  expect(fake.text('People/The Gull King.md')).toContain('note: keep')
  expect(fake.text('People/The Gull King.md')).toContain('[[Elsewhere]]')
  expect(fake.writes).toHaveLength(2)
})

test('Remove asks first, and removes only that entry after confirmation', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: 'The Gull King — Character, danger' }).click()
  const card = screen.getByRole('dialog', { name: 'The Gull King' })
  fake.confirm = false
  await card.getByRole('button', { name: 'Remove pin' }).click()
  await vi.waitFor(() => expect(fake.prompts).toEqual(['Remove this pin from The Gull King.md?']))
  expect(fake.writes).toEqual([])
  expect(markers()).toHaveLength(3)

  fake.confirm = true
  await card.getByRole('button', { name: 'Remove pin' }).click()
  await vi.waitFor(() => expect(markers()).toHaveLength(2))
  expect(fake.text('People/The Gull King.md')).toBe(GULL.replace(/ {2}- map: "\[\[The Shattered Coast]]"[\s\S]*?note: keep\n/, ''))
  expect(screen.getByRole('dialog').elements()).toHaveLength(0)
})
