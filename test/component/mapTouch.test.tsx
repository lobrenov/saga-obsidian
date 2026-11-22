import { expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { HOLD_MS } from '../../src/map/touch'
import { imageBox, marker, markers, renderMap, stage, tipOf } from './mapSupport'

/** Dispatches a touch pointer event; finger 1 uses pointer id 1, the one Chromium lets a synthetic event capture. */
function touch(target: EventTarget, type: string, finger: number, x: number, y: number): void {
  const down = type === 'pointerdown' || type === 'pointermove'
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: finger, isPrimary: finger === 1, pointerType: 'touch', button: down && type === 'pointerdown' ? 0 : -1, buttons: down ? 1 : 0, clientX: x, clientY: y, view: window }))
}
const centre = (el: Element): { x: number; y: number } => {
  const box = el.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}
const frame = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50))
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
const card = (): Element | null => document.querySelector('[role="dialog"]')

test('two fingers spreading to twice their distance zoom one level around their midpoint', async () => {
  await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const s = stage()!
  const c = centre(s)
  const before = imageBox()
  const under = { x: (c.x - before.left) / before.scale, y: (c.y - before.top) / before.scale }
  touch(s, 'pointerdown', 1, c.x - 50, c.y)
  touch(s, 'pointerdown', 2, c.x + 50, c.y)
  touch(s, 'pointermove', 1, c.x - 100, c.y)
  touch(s, 'pointermove', 2, c.x + 100, c.y)
  touch(s, 'pointerup', 1, c.x - 100, c.y)
  touch(s, 'pointerup', 2, c.x + 100, c.y)
  await frame()
  const after = imageBox()
  expect(after.scale).toBeCloseTo(before.scale * 2, 3)
  expect((c.x - after.left) / after.scale).toBeCloseTo(under.x, 0)
  expect((c.y - after.top) / after.scale).toBeCloseTo(under.y, 0)
})

test('one finger dragging the map pans it', async () => {
  await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const s = stage()!
  const c = centre(s)
  const before = imageBox()
  touch(s, 'pointerdown', 1, c.x, c.y)
  touch(s, 'pointermove', 1, c.x + 20, c.y + 10)
  touch(s, 'pointermove', 1, c.x + 40, c.y + 30)
  touch(s, 'pointerup', 1, c.x + 40, c.y + 30)
  await frame()
  const after = imageBox()
  expect(after.left - before.left).toBeCloseTo(40, 0)
  expect(after.top - before.top).toBeCloseTo(30, 0)
})

test('holding a finger on the map opens the map menu there; the click after it does not close the open card', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  marker('Saltmere').click()
  await vi.waitFor(() => expect(card()).not.toBeNull())
  const s = stage()!
  const c = centre(s)
  touch(s, 'pointerdown', 1, c.x, c.y)
  await wait(HOLD_MS + 100)
  expect(fake.menus.map((menu) => [menu.at, menu.items.map((item) => item.title)])).toEqual([[c, ['Add pin here']]])
  touch(s, 'pointerup', 1, c.x, c.y)
  s.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: c.x, clientY: c.y }))
  await frame()
  expect(card()).not.toBeNull()
})

test('a mouse click after a hold with no click of its own is not ignored', async () => {
  await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const s = stage()!
  const c = centre(s)
  touch(s, 'pointerdown', 1, c.x, c.y)
  await wait(HOLD_MS + 100)
  touch(s, 'pointerup', 1, c.x, c.y)
  await userEvent.click(marker('Saltmere'))
  await vi.waitFor(() => expect(card()).not.toBeNull())
})

test('a finger whose release was missed does not turn the next touch into a pinch', async () => {
  await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const s = stage()!
  const c = centre(s)
  touch(s, 'pointerdown', 1, c.x, c.y)
  touch(s, 'pointerdown', 2, c.x + 100, c.y)
  touch(document.body, 'pointerup', 1, c.x, c.y)
  touch(s, 'pointerup', 2, c.x + 100, c.y)
  await frame()
  const before = imageBox()
  touch(s, 'pointerdown', 1, c.x, c.y)
  touch(s, 'pointermove', 1, c.x + 20, c.y)
  touch(s, 'pointermove', 1, c.x + 40, c.y)
  touch(s, 'pointerup', 1, c.x + 40, c.y)
  await frame()
  expect(imageBox().left - before.left).toBeCloseTo(40, 0)
})

test('holding a finger on a pin opens its menu, not its card', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const pin = marker('The Gull King')
  const at = centre(pin)
  touch(pin, 'pointerdown', 1, at.x, at.y)
  await wait(HOLD_MS + 100)
  touch(pin, 'pointerup', 1, at.x, at.y)
  pin.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y }))
  await frame()
  expect(fake.menus.map((menu) => menu.items.map((item) => item.title))).toEqual([['Remove pin']])
  expect(card()).toBeNull()
})

test('a finger that moves before the hold time pans and opens no menu', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const s = stage()!
  const c = centre(s)
  touch(s, 'pointerdown', 1, c.x, c.y)
  touch(s, 'pointermove', 1, c.x + 10, c.y)
  await wait(HOLD_MS + 100)
  touch(s, 'pointerup', 1, c.x + 10, c.y)
  expect(fake.menus).toEqual([])
})

test('the browser`s own contextmenu during a touch opens no menu; the hold opens one', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const s = stage()!
  const c = centre(s)
  touch(s, 'pointerdown', 1, c.x, c.y)
  s.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: c.x, clientY: c.y }))
  expect(fake.menus).toEqual([])
  await wait(HOLD_MS + 100)
  touch(s, 'pointerup', 1, c.x, c.y)
  expect(fake.menus).toHaveLength(1)
})

test('a second finger during a pin drag cancels the drag: the pin returns and nothing is written', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const pin = marker('The Gull King')
  const before = imageBox()
  const tip = tipOf(pin)
  const point = { x: (tip.x - before.left) / before.scale, y: (tip.y - before.top) / before.scale }
  const at = centre(pin)
  touch(pin, 'pointerdown', 1, at.x, at.y)
  touch(pin, 'pointermove', 1, at.x + 30, at.y + 20)
  touch(pin, 'pointermove', 1, at.x + 60, at.y + 40)
  touch(stage()!, 'pointerdown', 2, at.x + 200, at.y)
  touch(pin, 'pointermove', 1, at.x + 70, at.y + 50)
  touch(pin, 'pointerup', 1, at.x + 70, at.y + 50)
  touch(stage()!, 'pointerup', 2, at.x + 200, at.y)
  await wait(200)
  expect(fake.writes).toEqual([])
  const back = tipOf(marker('The Gull King'))
  const after = imageBox()
  expect((back.x - after.left) / after.scale).toBeCloseTo(point.x, 0)
  expect((back.y - after.top) / after.scale).toBeCloseTo(point.y, 0)
})

test('touches on the map do not reach Obsidian: touchstart and touchmove stop at the stage, and touchmove has no default action', async () => {
  await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const seen: string[] = []
  const listen = (event: Event): void => void seen.push(event.type)
  document.addEventListener('touchstart', listen)
  document.addEventListener('touchmove', listen)
  try {
    const image = document.querySelector('img[data-map-image]')!
    const point = new Touch({ identifier: 1, target: image, clientX: 400, clientY: 300 })
    const init = { bubbles: true, cancelable: true, touches: [point], targetTouches: [point], changedTouches: [point] }
    image.dispatchEvent(new TouchEvent('touchstart', init))
    const move = new TouchEvent('touchmove', init)
    image.dispatchEvent(move)
    expect(seen).toEqual([])
    expect(move.defaultPrevented).toBe(true)
  } finally {
    document.removeEventListener('touchstart', listen)
    document.removeEventListener('touchmove', listen)
  }
})
