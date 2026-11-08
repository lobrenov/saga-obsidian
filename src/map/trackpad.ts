import type { ViewportStore } from './viewportStore'

/** Zoom levels per pixel of pinch (`wheel` with Ctrl) or ⌘-wheel. */
export const ZOOM_PER_PIXEL = 1 / 100
const LINE_PX = 16

/** Safari/WebKit's pinch event (`gesturestart`/`gesturechange`/`gestureend`). */
interface GestureEvent extends UIEvent {
  scale: number
  clientX: number
  clientY: number
}

/**
 * Trackpad navigation: a two-finger scroll (or a plain mouse wheel) pans, a pinch zooms continuously around the fingers
 * (Ctrl+`wheel` in Chromium, gesture events in WebKit), ⌘+wheel zooms. Changes are applied once per animation frame.
 * Returns the detach function.
 */
export function attachTrackpad(element: HTMLElement, store: ViewportStore): () => void {
  let pan = { x: 0, y: 0 }
  let zoom: number | null = null
  let around = { x: 0, y: 0 }
  let pinchStart: number | null = null
  let frame = 0

  const clamp = (z: number): number => Math.min(store.limits.max, Math.max(store.limits.min, z))
  const pointOf = (event: { clientX: number; clientY: number }): { x: number; y: number } => {
    const box = element.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }
  const flush = (): void => {
    frame = 0
    if (zoom !== null) store.zoomAt(around.x, around.y, zoom - store.get().zoom)
    if (pan.x !== 0 || pan.y !== 0) store.panBy(-pan.x, -pan.y)
    zoom = null
    pan = { x: 0, y: 0 }
  }
  const schedule = (): void => {
    if (!frame) frame = requestAnimationFrame(flush)
  }

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const unit = event.deltaMode === 1 ? LINE_PX : event.deltaMode === 2 ? element.clientHeight : 1
    if (event.ctrlKey || event.metaKey) {
      // WebKit reports a pinch as gesture events; a Ctrl+wheel during one is the same pinch.
      if (pinchStart !== null) return
      zoom = clamp((zoom ?? store.get().zoom) - event.deltaY * unit * ZOOM_PER_PIXEL)
      around = pointOf(event)
    } else {
      pan = { x: pan.x + event.deltaX * unit, y: pan.y + event.deltaY * unit }
    }
    schedule()
  }
  const onGestureStart = (event: Event): void => {
    event.preventDefault()
    pinchStart = store.get().zoom
  }
  const onGestureChange = (event: Event): void => {
    event.preventDefault()
    const gesture = event as GestureEvent
    if (pinchStart === null || !(gesture.scale > 0)) return
    zoom = clamp(pinchStart + Math.log2(gesture.scale))
    around = pointOf(gesture)
    schedule()
  }
  const onGestureEnd = (event: Event): void => {
    event.preventDefault()
    pinchStart = null
    cancelAnimationFrame(frame)
    flush()
  }

  element.addEventListener('wheel', onWheel, { passive: false })
  element.addEventListener('gesturestart', onGestureStart)
  element.addEventListener('gesturechange', onGestureChange)
  element.addEventListener('gestureend', onGestureEnd)
  return () => {
    cancelAnimationFrame(frame)
    element.removeEventListener('wheel', onWheel)
    element.removeEventListener('gesturestart', onGestureStart)
    element.removeEventListener('gesturechange', onGestureChange)
    element.removeEventListener('gestureend', onGestureEnd)
  }
}
