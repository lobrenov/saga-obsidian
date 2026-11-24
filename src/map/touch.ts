import { pinch, type Viewport } from '../shared/maps/viewport'
import type { ViewportStore } from './viewportStore'

/** A finger held still this long opens the menu under it. */
export const HOLD_MS = 500
/** A finger that moves this far is not held. */
const HOLD_SLOP_PX = 4

type Point = { x: number; y: number }
interface Finger {
  start: Point
  at: Point
  target: EventTarget
}

/**
 * Touch navigation over the stage's own pointer handlers, which take a one-finger pan or pin drag as they take a mouse.
 * A second finger cancels the first finger's press (a dragged pin returns) and pinches: the zoom follows the fingers' spread
 * and the map follows their midpoint, until a finger lifts. A finger or pen held still for `HOLD_MS` cancels its press and opens the menu under it
 * (a `contextmenu` at that point). The pointer events of a pinch or hold, the browser's own `contextmenu` after a touch,
 * the click that ends a hold and WebKit's `gesture*` events during a touch are kept from the stage; touch events stop at the stage. Returns the detach function.
 */
export function attachTouch(element: HTMLElement, store: ViewportStore): () => void {
  const fingers = new Map<number, Finger>()
  /** Fingers whose events the stage no longer sees (a pinch's or a hold's). */
  const taken = new Set<number>()
  let pinchStart: { v: Viewport; from: [Point, Point] } | null = null
  let hold = 0
  let lastWasTouch = false
  let skipClick = false
  /** An event this module dispatches, which its own listeners let through. */
  let own: Event | null = null

  const local = (p: Point): Point => {
    const box = element.getBoundingClientRect()
    return { x: p.x - box.left, y: p.y - box.top }
  }
  const dispatch = (target: EventTarget, event: Event): void => {
    own = event
    target.dispatchEvent(event)
    own = null
  }
  const stopHold = (): void => {
    window.clearTimeout(hold)
    hold = 0
  }
  /** Sends the pointer's later events to the stage wherever the finger goes. */
  const capture = (id: number): void => {
    try {
      element.setPointerCapture(id)
    } catch {
      // A pointer that is not active (a synthetic one) cannot be captured; its events still reach the stage.
    }
  }
  /** Ends the finger's press for the stage (a pan stops, a dragged pin returns); its later events are kept from it. */
  const take = (id: number, finger: Finger): void => {
    if (taken.has(id)) return
    taken.add(id)
    dispatch(finger.target, new PointerEvent('pointercancel', { bubbles: true, pointerId: id, pointerType: 'touch', clientX: finger.at.x, clientY: finger.at.y }))
    capture(id)
  }
  const onHold = (id: number): void => {
    hold = 0
    const finger = fingers.get(id)
    if (!finger) return
    take(id, finger)
    skipClick = true
    const target = element.contains(finger.target as Node) ? finger.target : element
    dispatch(target, new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: finger.at.x, clientY: finger.at.y }))
  }

  const onDown = (event: PointerEvent): void => {
    if (event === own) return
    skipClick = false
    lastWasTouch = event.pointerType !== 'mouse'
    if (!lastWasTouch) return
    // The first finger down: no other finger is down, whatever earlier events were missed.
    if (event.isPrimary) {
      stopHold()
      fingers.clear()
      taken.clear()
      pinchStart = null
    }
    const at = { x: event.clientX, y: event.clientY }
    fingers.set(event.pointerId, { start: at, at, target: event.target ?? element })
    if (fingers.size === 1) {
      hold = window.setTimeout(() => onHold(event.pointerId), HOLD_MS)
      return
    }
    stopHold()
    for (const [id, finger] of fingers) if (id !== event.pointerId) take(id, finger)
    taken.add(event.pointerId)
    capture(event.pointerId)
    event.stopPropagation()
    const [a, b] = [...fingers.values()]
    if (fingers.size === 2 && a && b) pinchStart = { v: store.get(), from: [local(a.at), local(b.at)] }
  }
  const onMove = (event: PointerEvent): void => {
    const finger = fingers.get(event.pointerId)
    if (event === own || !finger) return
    finger.at = { x: event.clientX, y: event.clientY }
    if (hold && Math.hypot(finger.at.x - finger.start.x, finger.at.y - finger.start.y) >= HOLD_SLOP_PX) stopHold()
    const [a, b] = [...fingers.values()]
    if (pinchStart && a && b) store.set(pinch(pinchStart.v, store.view(), pinchStart.from, [local(a.at), local(b.at)], store.limits))
    if (taken.has(event.pointerId)) event.stopPropagation()
  }
  const onUp = (event: PointerEvent): void => {
    if (event === own || !fingers.delete(event.pointerId)) return
    stopHold()
    pinchStart = null
    if (taken.delete(event.pointerId)) event.stopPropagation()
  }
  const onContextMenu = (event: Event): void => {
    if (event === own || !lastWasTouch) return
    event.preventDefault()
    event.stopPropagation()
  }
  const onClick = (event: Event): void => {
    if (!skipClick) return
    skipClick = false
    event.preventDefault()
    event.stopPropagation()
  }
  /** Obsidian's swipes (the side drawers) never see a touch on the map. */
  const onTouch = (event: Event): void => {
    event.stopPropagation()
    if (event.type === 'touchmove') event.preventDefault()
  }
  const onGesture = (event: Event): void => {
    if (fingers.size === 0) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  const listeners: [string, (event: never) => void][] = [
    ['pointerdown', onDown],
    ['pointermove', onMove],
    ['pointerup', onUp],
    ['pointercancel', onUp],
    ['contextmenu', onContextMenu],
    ['click', onClick],
    ['gesturestart', onGesture],
    ['gesturechange', onGesture],
    ['gestureend', onGesture]
  ]
  for (const [type, listener] of listeners) element.addEventListener(type, listener as EventListener, { capture: true })
  element.addEventListener('touchstart', onTouch)
  element.addEventListener('touchmove', onTouch, { passive: false })
  return () => {
    stopHold()
    for (const [type, listener] of listeners) element.removeEventListener(type, listener as EventListener, { capture: true })
    element.removeEventListener('touchstart', onTouch)
    element.removeEventListener('touchmove', onTouch)
  }
}
