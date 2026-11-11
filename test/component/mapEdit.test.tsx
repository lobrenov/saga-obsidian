import { expect, test, vi } from 'vitest'
import { GULL } from '../fakes/map'
import { dragMarker, ghosts, imageBox, marker, markers, renderMap, stage, tipOf } from './mapSupport'

/** Right-clicks the map at a point of the stage, in stage pixels from its top left. */
const rightClickMapAt = (x: number, y: number): void => {
  const box = stage()!.getBoundingClientRect()
  stage()!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: box.left + x, clientY: box.top + y }))
}
const key = (target: Element, name: string, shiftKey = false): void => void target.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true }))

test('right-clicking the map opens its menu at the pointer; Add pin here asks for the note and adds the pin while the ghost holds the place', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const box = stage()!.getBoundingClientRect()
  rightClickMapAt(box.width / 2, box.height / 2)
  expect(fake.menus).toHaveLength(1)
  expect(fake.menus[0]?.at).toEqual({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
  expect(fake.menus[0]?.items.map((item) => item.title)).toEqual(['Add pin here'])

  const release = fake.holdWrites()
  fake.pick = () => Promise.resolve(fake.file('People/Mother Hesk.md'))
  fake.choose('Add pin here')
  await vi.waitFor(() => expect(fake.pickCalls).toBe(1))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(ghosts()).toBe(1)
  expect(markers()).toHaveLength(3)
  release()

  await vi.waitFor(() => expect(markers()).toHaveLength(4))
  await vi.waitFor(() => expect(ghosts()).toBe(0))
  expect(fake.text('People/Mother Hesk.md')).toMatch(/^---\ntype: NPC\nmap-pins:\n {2}- map: "\[\[The Shattered Coast\]\]"\n {4}x: \d+(\.\d)?\n {4}y: \d+(\.\d)?\n---\nHesk, the rumour-monger\.\n$/)
  const image = imageBox()
  const tip = tipOf(marker('Mother Hesk'))
  expect(tip.x).toBeCloseTo(box.left + box.width / 2, -1)
  expect((tip.x - image.left) / image.scale).toBeCloseTo(700, -1)
  expect(fake.writes).toEqual(['People/Mother Hesk.md'])
  expect(fake.notices).toEqual([])
})

test('the ContextMenu key or Shift+F10 on the stage opens the map menu at the view centre', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const box = stage()!.getBoundingClientRect()
  key(stage()!, 'ContextMenu')
  key(stage()!, 'F10', true)
  expect(fake.menus.map((menu) => menu.at)).toEqual([
    { x: box.left + box.width / 2, y: box.top + box.height / 2 },
    { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  ])
  fake.pick = () => Promise.resolve(fake.file('People/Mother Hesk.md'))
  fake.choose('Add pin here')
  await vi.waitFor(() => expect(fake.writes).toEqual(['People/Mother Hesk.md']))
  await vi.waitFor(() => expect(markers()).toHaveLength(4))
  const image = imageBox()
  const tip = tipOf(marker('Mother Hesk'))
  expect((tip.x - image.left) / image.scale).toBeCloseTo(700, -1)
})

test('cancelling the note picker writes nothing and removes the ghost', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  rightClickMapAt(300, 300)
  fake.choose('Add pin here')
  await vi.waitFor(() => expect(fake.pickCalls).toBe(1))
  await vi.waitFor(() => expect(ghosts()).toBe(0))
  expect(fake.writes).toEqual([])
})

test('the picker can create a note, which is then pinned', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  fake.pick = () => Promise.resolve(fake.addNote('People/Quillon.md', '---\ntype: NPC\n---\n'))
  rightClickMapAt(300, 300)
  fake.choose('Add pin here')
  await vi.waitFor(() => expect(fake.writes).toEqual(['People/Quillon.md']))
  await vi.waitFor(() => expect(markers()).toHaveLength(4))
  expect(fake.text('People/Quillon.md')).toContain('map-pins:\n  - map: "[[The Shattered Coast]]"')
})

test('a failed add is reported with a notice and the ghost goes', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  fake.pick = () => Promise.resolve(fake.file('People/Mother Hesk.md'))
  fake.failWrites('Disk full')
  rightClickMapAt(300, 300)
  fake.choose('Add pin here')
  await vi.waitFor(() => expect(fake.notices).toEqual(['Disk full']))
  await vi.waitFor(() => expect(ghosts()).toBe(0))
  expect(markers()).toHaveLength(3)
})

test('right-clicking a pin opens the pin menu, not the map menu; Remove pin asks first and removes only that entry', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  marker('The Gull King').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 50 }))
  expect(fake.menus).toHaveLength(1)
  expect(fake.menus[0]?.at).toEqual({ x: 40, y: 50 })
  expect(fake.menus[0]?.items.map((item) => [item.title, item.warning])).toEqual([['Remove pin', true]])

  fake.confirm = false
  fake.choose('Remove pin')
  await vi.waitFor(() => expect(fake.prompts).toEqual(['Remove this pin from The Gull King.md?']))
  expect(fake.writes).toEqual([])
  expect(markers()).toHaveLength(3)

  fake.confirm = true
  fake.choose('Remove pin')
  await vi.waitFor(() => expect(markers()).toHaveLength(2))
  expect(fake.text('People/The Gull King.md')).toBe(GULL.replace(/ {2}- map: "\[\[The Shattered Coast]]"[\s\S]*?note: keep\n/, ''))
})

test('the ContextMenu key on a focused pin opens its menu at the pin', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const pin = marker('Saltmere')
  key(pin, 'ContextMenu')
  key(pin, 'F10', true)
  expect(fake.menus).toHaveLength(2)
  const box = pin.getBoundingClientRect()
  expect(fake.menus[0]?.at).toEqual({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
  expect(fake.menus[0]?.items.map((item) => item.title)).toEqual(['Remove pin'])
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

test('the card changes a pin\'s style, and Auto removes the override', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: 'The Gull King — Character, danger' }).click()
  const card = screen.getByRole('dialog', { name: 'The Gull King' })
  const style = card.getByRole('button', { name: 'Style' })
  await expect.element(style).toHaveTextContent('Danger')
  await style.click()
  expect(fake.menus.at(-1)?.items.map((item) => [item.title, item.checked])).toEqual([
    ['Auto (Character)', false],
    ['Rumour', false],
    ['Danger', true],
    ['Treasure', false],
    ['Quest', false],
    ['Camp', false]
  ])
  fake.choose('Quest')
  await vi.waitFor(() => expect(fake.text('People/The Gull King.md')).toContain('style: quest\n    note: keep'))
  await style.click()
  fake.choose('Auto (Character)')
  await vi.waitFor(() => expect(fake.text('People/The Gull King.md')).not.toContain('style:'))
  expect(fake.text('People/The Gull King.md')).toContain('note: keep')
  expect(fake.text('People/The Gull King.md')).toContain('[[Elsewhere]]')
  expect(fake.writes).toHaveLength(2)
})

