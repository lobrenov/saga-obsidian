import { useEffect, useReducer } from 'react'
import { expect, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { MapRoot } from '../../src/map/MapRoot'
import '../../src/map/map.css'
import './mapVars.css'
import { MapFake } from '../fakes/map'

function Live({ fake }: { fake: MapFake }) {
  const [, update] = useReducer((n: number) => n + 1, 0)
  useEffect(() => fake.subscribe(update), [fake])
  return <MapRoot state={fake.state()} />
}

/** The map view over a fake vault, 1100 x 800 as in a pane; `setup` runs before it renders. `ready: false` for states without a stage. */
export async function renderMap(setup?: (fake: MapFake) => void | Promise<void>, ready = true) {
  const fake = await MapFake.create()
  await setup?.(fake)
  const screen = await render(
    <div className="saga-map-view" style={{ width: 1100, height: 800 }}>
      <Live fake={fake} />
    </div>
  )
  if (ready) await vi.waitFor(() => expect(stage()).not.toBeNull())
  // The real pointer rests over the header, not over a pin left by the previous test.
  await userEvent.hover(document.querySelector('.saga-map-header') ?? document.body)
  return { fake, screen }
}

export const markers = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-pin]')]
export const clusters = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-map-cluster]')]
export const stage = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-map-stage]')
export const ghosts = (): number => document.querySelectorAll('[data-map-ghost]').length
export const marker = (name: string): HTMLElement => {
  const found = markers().find((el) => el.textContent?.startsWith(name))
  if (!found) throw new Error(`no marker ${name}`)
  return found
}
export const color = (el: HTMLElement): string | undefined => el.querySelector('svg')?.getAttribute('style') ?? undefined

/** The image's box on screen and its scale (screen px per image px). */
export function imageBox() {
  const box = document.querySelector('img[data-map-image]')!.getBoundingClientRect()
  return { left: box.left, top: box.top, scale: box.width / 1400 }
}

/** The screen point of a pin's tip (the outline ends 1 px above the button's bottom edge). */
export const tipOf = (el: HTMLElement): { x: number; y: number } => {
  const box = el.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.bottom - 1 }
}

/** Dispatches a pointer event (mouse pointer 1) on `target` at client coordinates; `buttons` is 1 while the button is down. */
export function firePointer(target: EventTarget, type: string, x: number, y: number, buttons = 1): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, buttons, clientX: x, clientY: y, view: window }))
}

/** Drags a pin with pointer events: press on it, three moves, release `dx`, `dy` away. */
export async function dragMarker(el: Element, dx: number, dy: number): Promise<void> {
  const box = el.getBoundingClientRect()
  const start = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  firePointer(el, 'pointerdown', start.x, start.y)
  for (const step of [0.3, 0.6, 1]) {
    firePointer(el, 'pointermove', start.x + dx * step, start.y + dy * step)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  firePointer(el, 'pointerup', start.x + dx, start.y + dy, 0)
}

/** Clicks the map at a point of the map container, in container pixels from its top left. */
export function clickMapAt(x: number, y: number): void {
  const container = stage()
  if (!container) throw new Error('no map')
  const box = container.getBoundingClientRect()
  const init = { bubbles: true, cancelable: true, button: 0, clientX: box.left + x, clientY: box.top + y, view: window }
  const pointer = { ...init, pointerId: 1, isPrimary: true, pointerType: 'mouse' }
  container.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, buttons: 1 }))
  container.dispatchEvent(new MouseEvent('mousedown', { ...init, buttons: 1 }))
  container.dispatchEvent(new PointerEvent('pointerup', pointer))
  container.dispatchEvent(new MouseEvent('mouseup', init))
  container.dispatchEvent(new MouseEvent('click', init))
}

export const pressKey = (key: string, shiftKey = false): void => void document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
